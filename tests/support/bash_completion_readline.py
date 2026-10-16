"""Exercise actual Readline insertion, including quoting and filename handling."""

import errno
import os
from pathlib import Path
import pty
import select
import shlex
import shutil
import signal
import sys
import time


def main():
    shell = shutil.which(sys.argv[1])
    completion = Path(sys.argv[2])
    rc = completion.with_name("readline.bash")
    rc.write_text(
        'PS1="RAUTO_READY> "\n'
        'source "$RAUTO_TEST_COMPLETION_SCRIPT"\n'
        'rauto() { printf "\\036"; printf "%s\\0" "$@"; printf "\\037"; }\n'
        'bind "set editing-mode emacs"\n'
    )
    os.environ["RAUTO_TEST_COMPLETION_SCRIPT"] = str(completion)
    os.environ["TERM"] = "dumb"
    os.environ["INPUTRC"] = os.devnull
    pid, terminal = pty.fork()
    if pid == 0:
        os.execv(shell, [shell, "--noprofile", "--rcfile", str(rc), "-i"])

    def read_until(marker):
        output = b""
        deadline = time.monotonic() + 10
        while marker not in output:
            remaining = deadline - time.monotonic()
            if remaining <= 0 or not select.select([terminal], [], [], remaining)[0]:
                raise AssertionError(f"Timed out waiting for {marker!r}: {output!r}")
            try:
                chunk = os.read(terminal, 65536)
            except OSError as error:
                if error.errno != errno.EIO:
                    raise
                chunk = b""
            if not chunk:
                raise AssertionError(f"Bash exited before {marker!r}: {output!r}")
            output += chunk
        return output

    try:
        read_until(b"RAUTO_READY> ")
        cases = [
            ("rauto device sh", "rauto device show "),
            ("rauto exec id --ssh-security sec", "rauto exec id --ssh-security secure"),
            ("rauto --ssh-security sec", "rauto --ssh-security secure"),
            ("rauto --security=sec", "rauto --security=secure"),
            ("rauto --shell fi", "rauto --shell fish"),
            ("rauto -d credential exec id --security sec", "rauto -d credential exec id --security secure"),
            ("rauto completion ba", "rauto completion bash "),
            ("rauto interactive --vars vars", "rauto interactive --vars vars\\ main.json "),
            ("rauto interactive --vars vars\\ m", "rauto interactive --vars vars\\ main.json "),
            ("rauto interactive --vars 'vars m", "rauto interactive --vars 'vars main.json' "),
            ('rauto interactive --vars "vars m', 'rauto interactive --vars "vars main.json" '),
            ("rauto interactive --vars=vars", "rauto interactive --vars=vars\\ main.json "),
            ("rauto interactive --vars='vars m", "rauto interactive --vars='vars main.json' "),
            ('rauto interactive --vars="vars m', 'rauto interactive --vars="vars main.json" '),
            ("rauto interactive -t builtin:", "rauto interactive -t builtin:"),
            ("rauto exec id --device=core_", "rauto exec id --device=core_"),
            ("rauto interactive --vars '$(touch sent", "rauto interactive --vars '$(touch sentinel).json' "),
            ('rauto interactive --vars "dollar ', "rauto interactive --vars 'dollar $(touch sentinel).json' "),
            ("rauto interactive --vars 'single q", 'rauto interactive --vars "single quote\'s.json" '),
            ('rauto interactive --vars "doubleq', 'rauto interactive --vars \'doublequote "name".json\' '),
            ("rauto device sh", "rauto device show "),
            ("rauto exec id --ssh-security sec", "rauto exec id --ssh-security secure"),
        ]
        for line, expected in cases:
            os.write(terminal, line.encode() + b"\t\n")
            output = read_until(b"\x1f")
            arguments = output.split(b"\x1e", 1)[1].split(b"\x1f", 1)[0]
            actual = arguments.decode().split("\0")[:-1]
            expected_arguments = shlex.split(expected)[1:]
            if actual != expected_arguments:
                raise AssertionError(f"Completing {line!r}: expected {expected_arguments!r}, got {actual!r}")
        print("Bash Readline completion OK")
    finally:
        os.kill(pid, signal.SIGHUP)
        os.waitpid(pid, 0)
        os.close(terminal)


if __name__ == "__main__":
    main()
