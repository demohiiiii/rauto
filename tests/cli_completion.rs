use std::path::{Path, PathBuf};
use std::process::{Command, Output};

struct Fixture {
    root: PathBuf,
}

impl Fixture {
    fn new() -> Self {
        let root = std::env::temp_dir().join(format!(
            "rauto-static-completion-{:016x}",
            rand::random::<u64>()
        ));
        std::fs::create_dir_all(&root).unwrap();
        Self { root }
    }

    fn command(&self, executable: impl AsRef<std::ffi::OsStr>) -> Command {
        let mut command = Command::new(executable);
        command
            .env("RAUTO_HOME", self.root.join("data"))
            .env("HOME", &self.root)
            .env("XDG_CONFIG_HOME", self.root.join("config"))
            .env_remove("BASH_ENV")
            .current_dir(&self.root);
        command
    }

    fn generate(&self, shell: &str) -> String {
        successful(
            self.command(env!("CARGO_BIN_EXE_rauto"))
                .args(["completion", shell])
                .output()
                .unwrap(),
        )
    }

    fn script(&self, shell: &str, filename: &str) -> PathBuf {
        let path = self.root.join(filename);
        std::fs::write(&path, self.generate(shell)).unwrap();
        path
    }
}

impl Drop for Fixture {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.root);
    }
}

fn successful(output: Output) -> String {
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    assert!(
        output.stderr.is_empty(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    String::from_utf8(output.stdout).unwrap()
}

fn available(shell: impl AsRef<std::ffi::OsStr>) -> bool {
    Command::new(shell).arg("--version").output().is_ok()
}

#[test]
fn generation_is_independent_of_runtime_data_and_legacy_completion_environment() {
    let fixture = Fixture::new();
    for shell in ["bash", "zsh", "fish", "powershell", "pwsh"] {
        let script = fixture.generate(shell);
        assert!(!script.is_empty());
        assert!(!fixture.root.join("data").exists());
        let with_legacy_env = successful(
            fixture
                .command(env!("CARGO_BIN_EXE_rauto"))
                .env("RAUTO_COMPLETE", "bash")
                .args(["completion", shell])
                .output()
                .unwrap(),
        );
        assert_eq!(with_legacy_env, script);
    }
    assert_eq!(fixture.generate("powershell"), fixture.generate("pwsh"));
    std::fs::create_dir(fixture.root.join("data")).unwrap();
    let path = fixture.root.join("data/rauto.db");
    std::fs::write(&path, "invalid sqlite").unwrap();
    for shell in ["bash", "zsh", "fish", "powershell"] {
        fixture.generate(shell);
    }
    assert_eq!(std::fs::read_to_string(&path).unwrap(), "invalid sqlite");
    assert_eq!(
        std::fs::read_dir(path.parent().unwrap()).unwrap().count(),
        1
    );
}

#[cfg(unix)]
#[test]
fn bash_completes_static_values_and_handles_readline_word_breaks_and_spaced_paths() {
    if !available("bash") {
        return;
    }
    let fixture = Fixture::new();
    let script = fixture.script("bash", "rauto.bash");
    std::fs::write(fixture.root.join("vars main.json"), "{}").unwrap();
    let commands = r#"
source "$1"
rauto() { printf 'Completion must not invoke rauto\n' >&2; return 1; }
compopt() { :; }
check() {
    local expected=$1 current=$2 previous=$3
    shift 3
    COMP_WORDS=("$@")
    COMP_CWORD=$((${#COMP_WORDS[@]}-1))
    _rauto_completion rauto "$current" "$previous"
    if [[ "${COMPREPLY[*]}" != "$expected" ]]; then
        printf 'Expected <%s>, got <%s>\n' "$expected" "${COMPREPLY[*]}" >&2
        exit 1
    fi
}
check tx-workflow tx ra rauto tx
check show sh device rauto device sh
check show sh connection rauto connection sh
check --connection --con id rauto exec id --con
check secure sec --ssh-security rauto exec id --ssh-security sec
check secure sec = rauto exec id --ssh-security = sec
check '' '' : rauto interactive -t builtin : ''
check core_ core_ = rauto exec id --connection = core_
check 'vars main.json' 'vars m' --vars rauto interactive --vars 'vars m'
[[ $(complete -p rauto) != *'-o filenames'* ]] || exit 1
printf 'Bash completion OK\n'
"#;
    let output = fixture
        .command("bash")
        .args(["--noprofile", "--norc", "-c", commands, "--"])
        .arg(script)
        .output()
        .unwrap();
    assert!(successful(output).contains("Bash completion OK"));
    assert!(!fixture.root.join("data").exists());
}

#[cfg(unix)]
#[test]
fn bash_readline_quotes_paths_without_treating_static_candidates_as_files() {
    let shell = std::env::var_os("RAUTO_TEST_BASH").unwrap_or_else(|| "bash".into());
    if !available(&shell) || !available("python3") {
        return;
    }
    let fixture = Fixture::new();
    let script = fixture.script("bash", "rauto.bash");
    for directory in ["show", "secure", "bash"] {
        std::fs::create_dir(fixture.root.join(directory)).unwrap();
    }
    for filename in [
        "vars main.json",
        "$(touch sentinel).json",
        "dollar $(touch sentinel).json",
        "single quote's.json",
        "doublequote \"name\".json",
    ] {
        std::fs::write(fixture.root.join(filename), "{}").unwrap();
    }
    let output = fixture
        .command("python3")
        .arg(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/tests/support/bash_completion_readline.py"
        ))
        .arg(shell)
        .arg(script)
        .output()
        .unwrap();
    assert!(successful(output).contains("Bash Readline completion OK"));
    assert!(!fixture.root.join("sentinel").exists());
    assert!(!fixture.root.join("data").exists());
}

#[cfg(unix)]
#[test]
fn zsh_static_script_supports_first_autoload() {
    if !available("zsh") {
        return;
    }
    let fixture = Fixture::new();
    fixture.script("zsh", "_rauto");
    let commands = r#"
fpath=("$1" $fpath)
autoload -Uz _rauto
rauto() { print -u2 'Completion must not invoke rauto'; return 1; }
_arguments() { print -rl -- "$@"; }
words=(rauto exec id --ssh-security sec)
CURRENT=5
_rauto
"#;
    let output = fixture
        .command("zsh")
        .args(["-f", "-c", commands, "--"])
        .arg(&fixture.root)
        .output()
        .unwrap();
    let output = successful(output);
    assert!(output.contains("--ssh-security"));
    assert!(output.contains("secure"));
    assert!(!fixture.root.join("data").exists());
}

#[test]
fn fish_completes_static_commands_flags_and_enums_without_running_rauto() {
    let shell = std::env::var_os("RAUTO_TEST_FISH").unwrap_or_else(|| "fish".into());
    if !available(&shell) {
        return;
    }
    let fixture = Fixture::new();
    let script = fixture.script("fish", "rauto.fish");
    let commands = r#"
source $RAUTO_TEST_COMPLETION_SCRIPT
function rauto; echo 'Completion must not invoke rauto' >&2; return 1; end
complete -C 'rauto tx'
complete -C 'rauto device sh'
complete -C 'rauto exec id --con'
complete -C 'rauto exec id --ssh-security sec'
"#;
    let output = fixture
        .command(shell)
        .args(["--no-config", "-c", commands])
        .env("RAUTO_TEST_COMPLETION_SCRIPT", script)
        .output()
        .unwrap();
    let output = successful(output);
    for expected in ["tx-workflow", "show", "--connection", "secure"] {
        assert!(output.contains(expected), "{output}");
    }
    assert!(!fixture.root.join("data").exists());
}

#[test]
fn powershell_completes_static_values_at_the_cursor_without_evaluating_or_running_input() {
    let shell = std::env::var_os("RAUTO_TEST_PWSH").unwrap_or_else(|| "pwsh".into());
    if !available(&shell) {
        return;
    }
    let fixture = Fixture::new();
    let script = fixture.script("powershell", "completion.ps1");
    let commands = r#"
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
. $env:RAUTO_TEST_COMPLETION_SCRIPT
function rauto { throw 'Completion must not invoke rauto' }
foreach ($case in @(
    @('rauto tx', 'tx-workflow'),
    @('rauto device sh', 'show'),
    @('rauto connection sh', 'show'),
    @('rauto exec id --con', '--connection'),
    @('rauto exec id --ssh-security sec', 'secure'),
    @('rauto -c core exec id --ssh-security sec', 'secure'),
    @('rauto exec ''$(throw "must not execute")'' --ssh-security sec', 'secure'),
    @('rauto exec id --ssh-security=sec', '--ssh-security=secure'),
    @('rauto completion p', 'powershell')
)) {
    $line, $expected = $case
    $matches = [Management.Automation.CommandCompletion]::CompleteInput($line, $line.Length, $null).CompletionMatches
    if (@($matches | Where-Object CompletionText -eq $expected).Count -ne 1) { throw "Missing $expected in: $line" }
}
$line = 'rauto exec id --ssh-security secure --parse-textfsm'
$cursor = $line.IndexOf('secure --') + 3
$matches = [Management.Automation.CommandCompletion]::CompleteInput($line, $cursor, $null).CompletionMatches
if (@($matches | Where-Object CompletionText -eq 'secure').Count -ne 1) { throw 'Missing completion at cursor' }
'PowerShell completion OK'
"#;
    let script_path = fixture.root.join("test.ps1");
    std::fs::write(&script_path, commands).unwrap();
    let output = fixture
        .command(shell)
        .args(["-NoLogo", "-NoProfile", "-NonInteractive", "-File"])
        .arg(Path::new(&script_path))
        .env("RAUTO_TEST_COMPLETION_SCRIPT", script)
        .output()
        .unwrap();
    assert!(successful(output).contains("PowerShell completion OK"));
    assert!(!fixture.root.join("data").exists());
}
