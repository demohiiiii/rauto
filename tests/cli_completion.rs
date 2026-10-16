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
        "stdout: {}\nstderr: {}",
        String::from_utf8_lossy(&output.stdout),
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
fn obsolete_or_inapplicable_options_fail_before_runtime_initialization() {
    let fixture = Fixture::new();
    for args in [
        vec!["exec", "id", "--template-dir", "/unused"],
        vec!["flow", "--template", "example"],
        vec!["flow-template", "list"],
        vec!["device", "discovery", "list"],
        vec!["credential", "list", "--host", "192.0.2.1"],
        vec!["--host", "192.0.2.1", "templates", "list"],
        vec!["template", "inspect"],
        vec!["templates", "list"],
        vec!["exec", "id", "--template", "inspect"],
        vec!["exec", "--template", "inspect", "--target", "edge"],
        vec!["exec", "template", "list", "--device", "edge"],
        vec!["--host", "192.0.2.1", "exec", "template", "list"],
        vec!["exec", "--parse-textfsm", "template", "list"],
        vec!["interactive-template", "list"],
        vec!["interactive", "template", "list", "--device", "edge"],
        vec!["--host", "192.0.2.1", "interactive", "template", "list"],
        vec!["interactive", "--template", "inspect", "template", "list"],
        vec!["interactive", "--file", "inspect.toml", "template", "list"],
        vec!["interactive", "--vars-json", "{}", "template", "list"],
        vec!["interactive", "--parse-textfsm", "template", "list"],
        vec!["show-object", "list"],
        vec!["show", "object", "list", "--device", "edge"],
        vec!["--host", "192.0.2.1", "show", "object", "list"],
        vec!["show", "--no-parse", "object", "list"],
        vec!["show", "--list", "object", "list"],
        vec!["show", "--target", "edge", "object", "list"],
        vec!["credential", "list", "--cred", "network-admin"],
        vec!["-C", "network-admin", "exec", "template", "list"],
        vec!["show", "object", "list", "--shell", "fish"],
        vec!["show", "object", "list", "--retries", "2"],
        vec!["interactive", "template", "list", "-N", "2"],
    ] {
        let output = fixture
            .command(env!("CARGO_BIN_EXE_rauto"))
            .args(&args)
            .output()
            .unwrap();
        assert_eq!(output.status.code(), Some(2), "{args:?}: {output:?}");
        assert!(output.stdout.is_empty());
        assert!(!fixture.root.join("data").exists());
    }
}

#[test]
fn exec_template_management_and_rendering_share_the_saved_template_store() {
    let fixture = Fixture::new();
    let run = |args: &[&str]| {
        successful(
            fixture
                .command(env!("CARGO_BIN_EXE_rauto"))
                .args(args)
                .output()
                .unwrap(),
        )
    };
    run(&[
        "exec",
        "template",
        "create",
        "inspect.j2",
        "--content",
        "show {{ object }}",
    ]);
    assert!(run(&["exec", "template", "list"]).contains("inspect.j2"));
    assert!(run(&["exec", "template", "show", "inspect.j2"]).contains("show {{ object }}"));
    std::fs::write(fixture.root.join("vars.json"), r#"{"object":"version"}"#).unwrap();
    let args = ["exec", "--template", "inspect.j2", "-v", "vars.json", "-n"];
    assert!(run(&args).contains("show version"));
    run(&[
        "exec",
        "template",
        "update",
        "inspect.j2",
        "--content",
        "display {{ object }}",
    ]);
    assert!(run(&args).contains("display version"));
    run(&["exec", "template", "delete", "inspect.j2"]);
    assert!(!run(&["exec", "template", "list"]).contains("inspect.j2"));
    let output = fixture
        .command(env!("CARGO_BIN_EXE_rauto"))
        .args(args)
        .output()
        .unwrap();
    assert!(!output.status.success());
    let error = format!(
        "{}{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
    assert!(error.contains("inspect.j2"), "{error}");
}

#[test]
fn interactive_template_management_uses_nested_commands() {
    let fixture = Fixture::new();
    let run = |args: &[&str]| {
        successful(
            fixture
                .command(env!("CARGO_BIN_EXE_rauto"))
                .args(args)
                .output()
                .unwrap(),
        )
    };
    std::fs::write(
        fixture.root.join("inspect.toml"),
        "name = \"inspect\"\ncommand = \"echo before\"\n",
    )
    .unwrap();
    run(&[
        "interactive",
        "template",
        "create",
        "inspect",
        "-f",
        "inspect.toml",
    ]);
    assert!(run(&["interactive", "template", "list"]).contains("inspect"));
    assert!(run(&["interactive", "template", "show", "inspect"]).contains("echo before"));
    run(&[
        "interactive",
        "template",
        "update",
        "inspect",
        "--content",
        "name = \"inspect\"\ncommand = \"echo after\"\n",
    ]);
    let updated = run(&["interactive", "template", "show", "inspect"]);
    assert!(updated.contains("echo after"));
    let invalid = fixture
        .command(env!("CARGO_BIN_EXE_rauto"))
        .args([
            "interactive",
            "template",
            "update",
            "inspect",
            "--content",
            "command = [",
        ])
        .output()
        .unwrap();
    assert!(!invalid.status.success());
    assert_eq!(
        run(&["interactive", "template", "show", "inspect"]),
        updated
    );
    run(&["interactive", "template", "delete", "inspect"]);
    assert!(!run(&["interactive", "template", "list"]).contains("inspect"));
    let removed = fixture
        .command(env!("CARGO_BIN_EXE_rauto"))
        .args(["interactive", "template", "show", "inspect"])
        .output()
        .unwrap();
    assert!(!removed.status.success());
}

#[test]
fn show_object_management_updates_the_query_catalog() {
    let fixture = Fixture::new();
    let run = |args: &[&str]| {
        successful(
            fixture
                .command(env!("CARGO_BIN_EXE_rauto"))
                .args(args)
                .output()
                .unwrap(),
        )
    };
    let set = [
        "show",
        "object",
        "set",
        "--profile",
        "linux",
        "--object",
        "inspection-test",
        "--command",
        "printf before",
        "--mode",
        "Root,User",
    ];
    run(&set);
    let list = ["show", "object", "list", "--profile", "linux"];
    let stored = run(&list);
    assert!(stored.contains("object=inspection-test"), "{stored}");
    assert!(stored.contains("command=printf before"), "{stored}");
    assert!(stored.contains("mode=Root,User"), "{stored}");
    assert!(
        !run(&["show", "object", "list", "--profile", "cisco_ios"]).contains("inspection-test")
    );
    let catalog = ["show", "--list", "--device-profile", "linux"];
    assert!(run(&catalog).contains("inspection-test"));

    let mut disabled = set.to_vec();
    disabled.push("--disabled");
    run(&disabled);
    assert!(run(&list).contains("enabled=false"));
    assert!(!run(&catalog).contains("inspection-test"));

    run(&[
        "show",
        "object",
        "set",
        "--profile",
        "linux",
        "--object",
        "inspection-test",
        "--command",
        "printf after",
    ]);
    let updated = run(&list);
    assert!(updated.contains("command=printf after"), "{updated}");
    assert!(updated.contains("enabled=true"), "{updated}");
    assert!(run(&catalog).contains("inspection-test"));

    let delete = [
        "show",
        "object",
        "delete",
        "--profile",
        "linux",
        "--object",
        "inspection-test",
    ];
    run(&delete);
    assert!(!run(&list).contains("inspection-test"));
    assert!(!run(&catalog).contains("inspection-test"));
    let removed = fixture
        .command(env!("CARGO_BIN_EXE_rauto"))
        .args(delete)
        .output()
        .unwrap();
    assert!(!removed.status.success());
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
check show sh rauto rauto sh
check object obj show rauto show obj
check set se object rauto show object se
check --profile --pro set rauto show object set --pro
check '--device --device-profile' --dev version rauto show version --dev
check '' --dev list rauto show object list --dev
check '' --dev rauto rauto --dev
check '' --ssh rauto rauto --ssh
check '--device --device-profile' --dev id rauto exec id --dev
check '' --ssh list rauto credential list --ssh
check '' tem rauto rauto tem
check template tem exec rauto exec tem
check create cr template rauto exec template cr
check interactive int rauto rauto int
check template tem interactive rauto interactive tem
check create cr template rauto interactive template cr
check '--device --device-profile' --dev inspect rauto interactive --template inspect --dev
check '' --dev list rauto interactive template list --dev
check '--device --device-profile' --dev inspect rauto exec --template inspect --dev
check '' --dev list rauto exec template list --dev
check '' --dev template rauto tx-workflow template --dev
check '' --session-retries plan.json rauto tx-workflow plan.json --session-retries
check --device --dev replay rauto session replay --dev
check '' --host replay rauto session replay --host
check --credential --creden 192.0.2.1 rauto device discover 192.0.2.1 --creden
check fish fi --shell rauto exec id --shell fi
check secure sec --security rauto exec id --security sec
check --excel --ex id rauto exec id --ex
check --parallel --par version rauto show version --par
check '' --cre rauto rauto --cre
check '' --tf list rauto exec template list --tf
check secure sec --ssh-security rauto --ssh-security sec
check secure sec --security rauto --security sec
check fish fi --linux-shell-flavor rauto --linux-shell-flavor fi
check fish fi --shell rauto --shell fi
check secure sec = rauto --ssh-security = sec
check secure --security=sec rauto rauto --security=sec
check secure sec --security rauto -d credential --security sec
check tx-workflow tx credential rauto -d credential tx
check '--device --device-profile' --dev id rauto -d credential exec id --dev
check '' --ssh list rauto -d credential exec template list --ssh
check secure sec --ssh-security rauto exec id --ssh-security sec
check secure sec --ssh-security rauto exec id -d core -D linux --ssh-security sec
check secure sec = rauto exec id --ssh-security = sec
check '' '' : rauto interactive -t builtin : ''
check core_ core_ = rauto exec id --device = core_
check 'vars main.json' 'vars m' --vars rauto interactive --vars 'vars m'
check 'vars main.json' 'vars m' --tfsm rauto interactive --tfsm 'vars m'
check 'vars main.json' 'vars m' -F rauto interactive -F 'vars m'
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
_arguments() {
    print -rl -- "$@"
    if [[ "$*" == *'->rauto'* && $words[2] == exec ]]; then
        state=rauto
        line=(exec)
    fi
}
compadd() { print -rl -- "${_rauto_prefix_values[@]}"; }
compset() { [[ $1 == -P && $2 == '*=' ]]; }
check_prefix() {
    words=("$@")
    CURRENT=$#words
    local output=$(_rauto)
    [[ $output == *secure* && $output != *--ssh-security* ]] || return 1
}
check_prefix rauto --ssh-security sec || exit 1
check_prefix rauto --security sec || exit 1
check_prefix rauto --security=sec || exit 1
check_prefix rauto -d credential --security sec || exit 1
words=(rauto --shell fi)
CURRENT=$#words
[[ $(_rauto) == *fish* ]] || exit 1
words=(rauto --ssh)
CURRENT=$#words
[[ $(_rauto) != *--ssh-security* ]] || exit 1
words=(rauto -d credential exec id --ssh-security sec)
CURRENT=$#words
[[ $(_rauto) == *--ssh-security* ]] || exit 1
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
    std::fs::write(fixture.root.join("secure-file"), "").unwrap();
    let commands = r#"
source $RAUTO_TEST_COMPLETION_SCRIPT
function rauto; echo 'Completion must not invoke rauto' >&2; return 1; end
complete -C 'rauto tx'
complete -C 'rauto device sh'
complete -C 'rauto exec id --dev'
complete -C 'rauto exec id --ssh-security sec'
complete -C 'rauto exec template cr'
complete -C 'rauto exec --template inspect --dev'
complete -C 'rauto interactive template cr'
complete -C 'rauto interactive --template inspect --dev'
complete -C 'rauto show obj'
complete -C 'rauto show object se'
complete -C 'rauto show version --dev'
function expect_completion --argument-names line expected
    set -l candidates (complete -C "$line" | string split -f 1 \t)
    if not contains -- "$expected" $candidates
        printf 'Missing %s in completions for %s: %s\n' "$expected" "$line" "$candidates" >&2
        exit 1
    end
end
expect_completion 'rauto exec id --shell fi' fish
expect_completion 'rauto --ssh-security sec' secure
expect_completion 'rauto --security sec' secure
expect_completion 'rauto --linux-shell-flavor fi' fish
expect_completion 'rauto --shell fi' fish
expect_completion 'rauto --security=sec' --security=secure
expect_completion 'rauto -d credential --security sec' secure
expect_completion 'rauto -d credential tx' tx-workflow
expect_completion 'rauto --device credential exec id --security sec' secure
expect_completion 'rauto --cred credential exec id --dev' --device
set -l prefix_values (complete -C 'rauto --ssh-security sec' | string split -f 1 \t)
if test (count $prefix_values) -ne 1; or test "$prefix_values[1]" != secure
    printf 'Unexpected prefix values: %s\n' "$prefix_values" >&2
    exit 1
end
expect_completion 'rauto exec id --security sec' secure
expect_completion 'rauto exec id -d core -D linux --security sec' secure
expect_completion 'rauto exec id --ex' --excel
expect_completion 'rauto show version --par' --parallel
for line in 'rauto --dev' 'rauto --ssh' 'rauto --cre' 'rauto -d credential --ssh' 'rauto credential list --ssh' 'rauto -d credential exec template list --ssh' 'rauto exec template list --tf' 'rauto exec template list --dev' 'rauto interactive template list --dev' 'rauto show object list --dev' 'rauto tx-workflow template --dev' 'rauto session replay --host'
    set -l unexpected (complete -C "$line")
    if test (count $unexpected) -ne 0
        printf 'Unexpected completion for %s: %s\n' "$line" "$unexpected" >&2
        exit 1
    end
end
"#;
    let output = fixture
        .command(shell)
        .args(["--no-config", "-c", commands])
        .env("RAUTO_TEST_COMPLETION_SCRIPT", script)
        .output()
        .unwrap();
    let output = successful(output);
    for expected in [
        "tx-workflow",
        "show",
        "--device",
        "secure",
        "create",
        "object",
        "set",
    ] {
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
    @('rauto sh', 'show'),
    @('rauto show obj', 'object'),
    @('rauto show object se', 'set'),
    @('rauto show object set --pro', '--profile'),
    @('rauto show version --dev', '--device'),
    @('rauto exec id --dev', '--device'),
    @('rauto exec template cr', 'create'),
    @('rauto exec --template inspect --dev', '--device'),
    @('rauto interactive template cr', 'create'),
    @('rauto interactive --template inspect --dev', '--device'),
    @('rauto exec id --shell fi', 'fish'),
    @('rauto --ssh-security sec', 'secure'),
    @('rauto --security=sec', '--security=secure'),
    @('rauto --shell fi', 'fish'),
    @('rauto exec id --security sec', 'secure'),
    @('rauto -C credential exec id --security sec', 'secure'),
    @('rauto --cred credential exec id --shell fi', 'fish'),
    @('rauto exec id --security=sec', '--security=secure'),
    @('rauto exec id --ex', '--excel'),
    @('rauto show version --par', '--parallel'),
    @('rauto exec id --ssh-security sec', 'secure'),
    @('rauto -d core exec id --ssh-security sec', 'secure'),
    @('rauto -d credential exec id --ssh-security sec', 'secure'),
    @('rauto -d core -D linux exec id --ssh-security sec', 'secure'),
    @('rauto -D credential exec id --ssh-security sec', 'secure'),
    @('rauto exec ''$(throw "must not execute")'' --ssh-security sec', 'secure'),
    @('rauto exec id --ssh-security=sec', '--ssh-security=secure'),
    @('rauto completion p', 'powershell')
)) {
    $line, $expected = $case
    $matches = [Management.Automation.CommandCompletion]::CompleteInput($line, $line.Length, $null).CompletionMatches
    if (@($matches | Where-Object CompletionText -eq $expected).Count -ne 1) { throw "Missing $expected in: $line" }
}
foreach ($line in @('rauto --dev', 'rauto --ssh', 'rauto --cre', 'rauto credential list --ssh', 'rauto exec template list --tf', 'rauto exec template list --dev', 'rauto interactive template list --dev', 'rauto show object list --dev', 'rauto tx-workflow template list --dev', 'rauto session replay --host')) {
    $matches = [Management.Automation.CommandCompletion]::CompleteInput($line, $line.Length, $null).CompletionMatches
    if (@($matches | Where-Object { $_.CompletionText.StartsWith('--') }).Count -ne 0) { throw "Unexpected option in: $line" }
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
