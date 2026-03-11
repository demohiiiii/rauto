# Rauto Install / Upgrade / Verify

Use this file when the user asks to install, upgrade, verify, or bootstrap `rauto` on the current machine.

Default policy:
- prefer official GitHub Releases binaries
- use source builds only when the user explicitly wants the current checkout or release download is not workable

## Table of Contents

1. Inspect current state
2. Preferred path: GitHub Releases binary
3. Source-build fallback
4. Verify after install
5. Common PATH and extraction issues
6. Missing prerequisites

## 1) Inspect current state

Run these first:

```bash
command -v rauto || true
rauto --version
uname -s
uname -m
pwd
test -f Cargo.toml && rg '^name = "rauto"' Cargo.toml
```

Interpretation:
- If `rauto` already exists, determine whether the user wants to reuse it, upgrade it, or replace it.
- Detect OS/arch before choosing a release asset.
- If the current directory is this repo, keep source build as a fallback, not the default.

## 2) Preferred path: GitHub Releases binary

Use when the user wants a normal installation on the current machine.

### A. Resolve the latest release

Prefer official release metadata over guessing asset names:

```text
https://github.com/demohiiiii/rauto/releases/latest
https://api.github.com/repos/demohiiiii/rauto/releases/latest
```

Choose the asset that matches the detected OS/arch.

### B. Download and install to a user-local path

Prefer a user-local binary path such as `~/.local/bin` or `~/bin` unless the user explicitly asks for a shared/system path.

Typical flow:

```bash
mkdir -p ~/.local/bin
```

Then:
- download the selected release asset
- extract it according to format (`tar -xzf`, `unzip`, or direct binary)
- copy/install the `rauto` binary into `~/.local/bin/rauto`
- make it executable

Typical final install step:

```bash
install -m 0755 ./rauto ~/.local/bin/rauto
```

### C. Upgrade from GitHub Releases

Use only with explicit user intent if an existing binary will be replaced.

Workflow:
- resolve latest matching release asset
- download and extract it
- replace the existing user-local `rauto` binary
- verify new version immediately

## 3) Source-build fallback

Use only when:
- the user explicitly wants the current checkout
- GitHub release download is unavailable
- the user is doing local development on this repo

Repo-local build without replacing another install:

```bash
cargo build --release
./target/release/rauto --version
```

## 4) Verify after install

Always verify with both path and version:

```bash
command -v rauto
rauto --version
rauto --help
```

If the binary was installed into a user-local path not yet on `PATH`, verify directly:

```bash
~/.local/bin/rauto --version
~/bin/rauto --version
```

## 5) Common PATH and extraction issues

If install succeeded but `rauto` is still not found:

```bash
echo "$PATH"
ls ~/.local/bin/rauto
ls ~/bin/rauto
```

Typical issues:
- the install path is not in `PATH`
- the wrong asset was downloaded for the current OS/arch
- the archive was extracted incorrectly and the `rauto` binary was not actually installed

## 6) Missing prerequisites

If release download is blocked:
- prefer the source-build fallback from the current checkout
- avoid assuming GitHub access will work

If `cargo` is missing:
- that only blocks the source-build fallback
- it does not block GitHub Releases binary installation
