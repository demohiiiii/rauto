"""Update Homebrew from the checksums produced by a completed release build."""

from pathlib import Path
import re
import sys
import tomllib


def update_formula(root, tag, checksum_directory):
    version = tag.removeprefix("v")
    if re.fullmatch(r"(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)", version) is None:
        raise ValueError("Homebrew updates require a stable release version")
    manifest = tomllib.loads((root / "Cargo.toml").read_text())
    if manifest["package"]["version"] != version:
        raise ValueError("Release tag does not match the default branch package version")

    formula_path = root / "Formula" / "rauto.rb"
    formula = formula_path.read_text()
    formula, count = re.subn(r'^  version "[^"]+"$', f'  version "{version}"', formula, flags=re.MULTILINE)
    if count != 1:
        raise ValueError("Expected one Homebrew version declaration")
    for architecture, platform in (("arm64", "arm"), ("amd64", "intel")):
        asset = f"rauto-macos-{architecture}.tar.gz"
        checksum = (checksum_directory / f"{asset}.sha256").read_text().strip()
        match = re.fullmatch(r"([0-9a-fA-F]{64})[ \t]+\*?" + re.escape(asset), checksum)
        if match is None:
            raise ValueError(f"Invalid release checksum for {asset}")
        pattern = rf'(  on_{platform} do\n    url [^\n]+\n    sha256 ")[^"]+("\n  end)'
        formula, count = re.subn(pattern, lambda field: field[1] + match[1].lower() + field[2], formula)
        if count != 1:
            raise ValueError(f"Expected one Homebrew {platform} download declaration")
    formula_path.write_text(formula)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("Usage: python3 scripts/update_homebrew.py RELEASE_TAG CHECKSUM_DIRECTORY")
    update_formula(Path(__file__).resolve().parents[1], sys.argv[1], Path(sys.argv[2]))
