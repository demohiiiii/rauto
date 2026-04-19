#!/usr/bin/env python3
"""
CLI-backed validator for rauto JSON plans.

Validation is delegated to rauto itself via --dry-run so schema/validation
changes in rauto are picked up automatically.
"""

from __future__ import annotations

import argparse
import json
import os
import shlex
import shutil
import subprocess
import sys
import tempfile
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


@dataclass
class ValidateResult:
    ok: bool
    kind: str
    command: List[str]
    exit_code: int
    stdout: str
    stderr: str
    notes: List[str]

    def to_json(self) -> Dict[str, Any]:
        return asdict(self)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Validate tx/workflow/orchestration JSON using rauto dry-run."
    )
    parser.add_argument(
        "--kind",
        choices=["auto", "tx-block", "tx-workflow", "orchestration"],
        default="auto",
        help="Plan kind. Use auto for inference.",
    )
    parser.add_argument(
        "--file",
        required=True,
        help="Path to JSON file to validate.",
    )
    parser.add_argument(
        "--rauto-bin",
        default="auto",
        help=(
            "rauto command prefix. "
            "auto: use $RAUTO_BIN if set, else `rauto`, else `cargo run --quiet --`."
        ),
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Print machine-readable validation report.",
    )
    return parser.parse_args()


def load_json(path: Path) -> Any:
    text = path.read_text(encoding="utf-8")
    return json.loads(text)


def infer_kind(data: Any) -> Optional[str]:
    if not isinstance(data, dict):
        return None
    if "plan" in data and isinstance(data["plan"], dict):
        return "orchestration"
    if "workflow" in data and isinstance(data["workflow"], dict):
        return "tx-workflow"
    if "tx_block" in data and isinstance(data["tx_block"], dict):
        return "tx-block"
    if isinstance(data.get("stages"), list):
        return "orchestration"
    if isinstance(data.get("blocks"), list):
        return "tx-workflow"
    if isinstance(data.get("steps"), list):
        return "tx-block"
    return None


def unwrap_payload(data: Any, kind: str) -> Any:
    if not isinstance(data, dict):
        return data
    if kind == "tx-block" and "tx_block" in data and isinstance(data["tx_block"], dict):
        return data["tx_block"]
    if kind == "tx-workflow" and "workflow" in data and isinstance(data["workflow"], dict):
        return data["workflow"]
    if kind == "orchestration" and "plan" in data and isinstance(data["plan"], dict):
        return data["plan"]
    return data


def resolve_rauto_prefix(raw: str) -> List[str]:
    if raw != "auto":
        prefix = shlex.split(raw)
        if not prefix:
            raise ValueError("--rauto-bin cannot be empty")
        return prefix

    env = os.environ.get("RAUTO_BIN", "").strip()
    if env:
        prefix = shlex.split(env)
        if prefix:
            return prefix

    if shutil.which("rauto"):
        return ["rauto"]

    # Fallback to local source execution.
    return ["cargo", "run", "--quiet", "--"]


def run_cmd(command: List[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        command,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding="utf-8",
        errors="replace",
    )


def validate_via_dry_run(
    kind: str,
    input_path: Path,
    payload: Any,
    rauto_prefix: List[str],
) -> ValidateResult:
    notes: List[str] = []
    actual_path = input_path

    with tempfile.TemporaryDirectory(prefix="rauto-validate-") as tmp_dir:
        if kind == "tx-block":
            # rauto CLI does not accept tx-block JSON file directly.
            # Wrap into TxWorkflow to reuse the native workflow parser/validator.
            workflow_payload = {
                "name": "__validate_tx_block__",
                "fail_fast": True,
                "blocks": [payload],
            }
            actual_path = Path(tmp_dir) / "wrapped-tx-workflow.json"
            actual_path.write_text(
                json.dumps(workflow_payload, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
            notes.append(
                "tx-block validation is executed through tx-workflow dry-run with one wrapped block"
            )
            command = [*rauto_prefix, "tx-workflow", str(actual_path), "--dry-run", "--json"]
            proc = run_cmd(command)
            return ValidateResult(
                ok=proc.returncode == 0,
                kind=kind,
                command=command,
                exit_code=proc.returncode,
                stdout=proc.stdout,
                stderr=proc.stderr,
                notes=notes,
            )

        if kind == "tx-workflow":
            command = [*rauto_prefix, "tx-workflow", str(actual_path), "--dry-run", "--json"]
            proc = run_cmd(command)
            return ValidateResult(
                ok=proc.returncode == 0,
                kind=kind,
                command=command,
                exit_code=proc.returncode,
                stdout=proc.stdout,
                stderr=proc.stderr,
                notes=notes,
            )

        if kind == "orchestration":
            command = [*rauto_prefix, "orchestrate", str(actual_path), "--dry-run", "--json"]
            proc = run_cmd(command)
            return ValidateResult(
                ok=proc.returncode == 0,
                kind=kind,
                command=command,
                exit_code=proc.returncode,
                stdout=proc.stdout,
                stderr=proc.stderr,
                notes=notes,
            )

        raise ValueError(f"unsupported kind: {kind}")


def print_human(result: ValidateResult) -> None:
    status = "PASS" if result.ok else "FAIL"
    print(f"[{status}] kind={result.kind}")
    print(f"command: {' '.join(shlex.quote(x) for x in result.command)}")
    print(f"exit_code: {result.exit_code}")
    for note in result.notes:
        print(f"note: {note}")
    if result.stderr.strip():
        print("stderr:")
        print(result.stderr.rstrip())
    if result.stdout.strip():
        print("stdout:")
        print(result.stdout.rstrip())


def main() -> int:
    args = parse_args()
    file_path = Path(args.file).expanduser().resolve()
    if not file_path.exists():
        print(f"[FAIL] file not found: {file_path}", file=sys.stderr)
        return 2

    try:
        raw = load_json(file_path)
    except json.JSONDecodeError as exc:
        print(
            f"[FAIL] invalid JSON at line {exc.lineno}, col {exc.colno}: {exc.msg}",
            file=sys.stderr,
        )
        return 2
    except Exception as exc:
        print(f"[FAIL] cannot read json: {exc}", file=sys.stderr)
        return 2

    kind = args.kind
    if kind == "auto":
        detected = infer_kind(raw)
        if not detected:
            print(
                "[FAIL] cannot infer kind from JSON; use --kind explicitly",
                file=sys.stderr,
            )
            return 2
        kind = detected

    payload = unwrap_payload(raw, kind)
    try:
        rauto_prefix = resolve_rauto_prefix(args.rauto_bin)
    except Exception as exc:
        print(f"[FAIL] invalid --rauto-bin: {exc}", file=sys.stderr)
        return 2

    try:
        result = validate_via_dry_run(kind, file_path, payload, rauto_prefix)
    except Exception as exc:
        print(f"[FAIL] validation failed to execute: {exc}", file=sys.stderr)
        return 2

    if args.json:
        print(json.dumps(result.to_json(), ensure_ascii=False, indent=2))
    else:
        print_human(result)

    return 0 if result.ok else 1


if __name__ == "__main__":
    raise SystemExit(main())

