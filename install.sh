#!/bin/sh
set -eu

fail() {
    printf 'Error: %s\n' "$*" >&2
    exit 1
}

download() {
    curl --fail --silent --show-error --location --retry 2 \
        --connect-timeout 15 --max-time 300 \
        --proto '=https' --proto-redir '=https' "$@"
}

cleanup() {
    [ -z "$rauto_tmp" ] || rm -rf "$rauto_tmp"
    [ -z "$rauto_staged" ] || rm -f "$rauto_staged"
}

main() {
    rauto_version=latest
    rauto_dir=${HOME:?HOME must be set}/.local/bin
    while [ "$#" -gt 0 ]; do
        case "$1" in
            --version|--install-dir)
                [ "$#" -ge 2 ] && [ -n "$2" ] || fail "$1 requires a value"
                case "$1" in
                    --version) rauto_version=$2 ;;
                    --install-dir) rauto_dir=$2 ;;
                esac
                shift 2
                ;;
            -h|--help)
                printf '%s\n' 'Usage: sh install.sh [--version VERSION] [--install-dir DIRECTORY]' \
                    'Defaults: latest release, ~/.local/bin. No sudo or shell profile changes.'
                return
                ;;
            *) fail "Unknown option: $1" ;;
        esac
    done

    case "$(uname -s)/$(uname -m)" in
        Linux/x86_64|Linux/amd64) rauto_asset=rauto-linux-amd64 ;;
        Darwin/arm64|Darwin/aarch64) rauto_asset=rauto-macos-arm64 ;;
        Darwin/x86_64|Darwin/amd64) rauto_asset=rauto-macos-amd64 ;;
        *) fail 'Supported platforms: Linux x86_64, macOS Apple Silicon and Intel. Use Cargo for other platforms.' ;;
    esac
    for rauto_tool in curl tar mktemp; do
        command -v "$rauto_tool" >/dev/null 2>&1 || fail "Required command not found: $rauto_tool"
    done
    if command -v sha256sum >/dev/null 2>&1; then
        rauto_hasher=sha256sum
    elif command -v shasum >/dev/null 2>&1; then
        rauto_hasher=shasum
    else
        fail 'Install sha256sum or shasum to verify the download.'
    fi

    rauto_releases=https://github.com/demohiiiii/rauto/releases
    if [ "$rauto_version" = latest ]; then
        rauto_latest=$(download --head --output /dev/null --write-out '%{url_effective}' "$rauto_releases/latest") \
            || fail 'Could not resolve the latest release. Retry or use --version.'
        case "$rauto_latest" in
            "$rauto_releases"/tag/v*) rauto_version=${rauto_latest##*/} ;;
            *) fail 'GitHub did not return a release tag.' ;;
        esac
    fi
    rauto_version=${rauto_version#v}
    case "$rauto_version" in
        ''|*[!0-9A-Za-z.+-]*) fail 'Invalid version. Example: --version 0.5.2' ;;
    esac
    rauto_url=$rauto_releases/download/v$rauto_version/$rauto_asset.tar.gz

    rauto_tmp=$(mktemp -d)
    rauto_staged=
    trap cleanup EXIT
    trap 'exit 130' INT
    trap 'exit 143' TERM
    printf 'Downloading rauto %s (%s)...\n' "$rauto_version" "$rauto_asset"
    download --output "$rauto_tmp/archive.tar.gz" "$rauto_url" || fail 'Download failed; existing installation was not changed.'

    # 0.5.2 predates the per-archive checksum files in the release workflow.
    case "$rauto_version/$rauto_asset" in
        0.5.2/rauto-linux-amd64) rauto_expected=66721954911783776e1d9574333ad89ae2c5f0b856fb0550c956f51f19b6a7b5 ;;
        0.5.2/rauto-macos-amd64) rauto_expected=745fce30a39412743608fac8d2689d49e265323cd92dd34b23c46ab6a4607f17 ;;
        0.5.2/rauto-macos-arm64) rauto_expected=8ecc69d009af8fc1e30b8861bc2f3be5b011910aeed6473abe96dd49fbc15983 ;;
        *)
            download --output "$rauto_tmp/checksum" "$rauto_url.sha256" || fail 'Release checksum is unavailable; installation stopped.'
            rauto_expected=$(awk 'NR == 1 { print $1 }' "$rauto_tmp/checksum")
            ;;
    esac
    case "$rauto_expected" in
        ''|*[!0-9a-f]*) fail 'Invalid SHA-256 checksum in release metadata.' ;;
    esac
    [ "${#rauto_expected}" -eq 64 ] || fail 'Invalid SHA-256 checksum length.'
    if [ "$rauto_hasher" = sha256sum ]; then
        rauto_actual=$(sha256sum "$rauto_tmp/archive.tar.gz")
    else
        rauto_actual=$(shasum -a 256 "$rauto_tmp/archive.tar.gz")
    fi
    rauto_actual=${rauto_actual%% *}
    [ "$rauto_actual" = "$rauto_expected" ] || fail 'SHA-256 checksum mismatch; existing installation was not changed.'

    tar -xzf "$rauto_tmp/archive.tar.gz" -C "$rauto_tmp" rauto || fail 'Could not extract the release binary.'
    [ -f "$rauto_tmp/rauto" ] && [ ! -L "$rauto_tmp/rauto" ] || fail 'Archive does not contain a regular rauto binary.'
    chmod 755 "$rauto_tmp/rauto"
    rauto_reported=$(RAUTO_HOME="$rauto_tmp/data" "$rauto_tmp/rauto" --version) \
        || fail 'The binary cannot run on this system. Check the error above. The original 0.5.2 Linux binary requires glibc 2.39; subsequent releases use static musl. Existing installation was not changed.'
    [ "$rauto_reported" = "rauto $rauto_version" ] || fail 'Downloaded binary version does not match the requested release.'

    case "$rauto_dir" in
        /*) ;;
        *) rauto_dir=$PWD/$rauto_dir ;;
    esac
    mkdir -p "$rauto_dir" || fail 'Cannot create install directory. Use --install-dir with a writable directory.'
    [ ! -d "$rauto_dir/rauto" ] || fail 'Install destination is a directory.'
    rauto_staged=$(mktemp "$rauto_dir/.rauto-install.XXXXXX")
    cp "$rauto_tmp/rauto" "$rauto_staged"
    chmod 755 "$rauto_staged"
    mv -f "$rauto_staged" "$rauto_dir/rauto"
    rauto_staged=
    printf 'Installed rauto %s to %s/rauto\n' "$rauto_version" "$rauto_dir"
    case ":${PATH:-}:" in
        *":$rauto_dir:"*) ;;
        *) printf 'Add %s to PATH in your shell profile to run rauto by name.\n' "$rauto_dir" ;;
    esac
}

# Invoke only after the entire script has been read when used with curl | sh.
main "$@"
