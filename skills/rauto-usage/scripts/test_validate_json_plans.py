#!/usr/bin/env python3
"""Behavior checks; set RAUTO_BIN to a current binary for native integration."""

from __future__ import annotations

import argparse
import copy
import json
import os
import shlex
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

import validate_json_plans as checker

OPERATION = {"kind": "command", "mode": "Root,User", "command": "id"}
BLOCK = {
    "name": "block",
    "fail_fast": True,
    "rollback_policy": "per_step",
    "steps": [{"run": OPERATION, "rollback": None}],
}
WORKFLOW = {"name": "workflow", "fail_fast": True, "blocks": [BLOCK]}
PLAN = {
    "name": "plan",
    "stages": [
        {
            "name": "stage",
            "strategy": "serial",
            "jobs": [
                {
                    "strategy": "serial",
                    "targets": ["offline-fixture"],
                    "action": {"kind": "tx_workflow", "workflow": WORKFLOW},
                }
            ],
        }
    ],
}


class HelperTests(unittest.TestCase):
    def test_inference_and_unwrapping(self):
        for kind, key, payload in [
            ("tx-block", "tx_block", BLOCK),
            ("tx-workflow", "workflow", WORKFLOW),
            ("orchestration", "plan", PLAN),
        ]:
            with self.subTest(kind=kind):
                wrapped = {key: payload, "dry_run": True}
                self.assertEqual(checker.infer_kind(wrapped), kind)
                self.assertEqual(checker.unwrap_payload(wrapped, kind), payload)
                self.assertEqual(checker.infer_kind(payload), kind)

    def test_timeout_validation(self):
        for value in ("0", "-1", "abc"):
            with (
                self.subTest(value=value),
                self.assertRaises((ValueError, argparse.ArgumentTypeError)),
            ):
                checker.positive_seconds(value)
        self.assertEqual(checker.positive_seconds("2"), 2)

    def test_native_subprocess_is_bounded(self):
        with self.assertRaises(subprocess.TimeoutExpired):
            checker.run_cmd([sys.executable, "-c", "import time; time.sleep(5)"], 1)


@unittest.skipUnless(os.environ.get("RAUTO_BIN"), "set RAUTO_BIN for native checks")
class NativeTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="rauto-skill-test-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.env = {**os.environ, "RAUTO_HOME": str(self.root / "runtime")}
        self.prefix = shlex.join(checker.resolve_rauto_prefix("auto"))

    def check(self, data, *, code=0):
        path = self.root / "input.json"
        path.write_text(json.dumps(data), encoding="utf-8")
        result = subprocess.run(
            [
                sys.executable,
                str(Path(checker.__file__)),
                "--file",
                str(path),
                "--rauto-bin",
                self.prefix,
                "--json",
            ],
            env=self.env,
            capture_output=True,
            text=True,
            timeout=30,
        )
        self.assertEqual(result.returncode, code, result.stdout + result.stderr)
        return json.loads(result.stdout)

    def test_bare_workflow(self):
        result = self.check(WORKFLOW)
        self.assertEqual(result["scope"], "workflow_parse_preview")
        self.assertEqual(json.loads(result["stdout"])["name"], "workflow")

    def test_wrapped_workflow(self):
        result = self.check({"workflow": WORKFLOW, "dry_run": True})
        self.assertIn("blocks", json.loads(result["stdout"]))

    def test_wrapped_block(self):
        result = self.check({"tx_block": BLOCK})
        self.assertEqual(json.loads(result["stdout"])["blocks"][0]["name"], "block")

    def test_wrapped_plan(self):
        result = self.check({"plan": PLAN, "dry_run": True})
        self.assertEqual(result["scope"], "orchestration_plan_and_selectors")
        self.assertEqual(json.loads(result["stdout"])["name"], "plan")

    def test_invalid_operation_kind(self):
        data = copy.deepcopy(WORKFLOW)
        data["blocks"][0]["steps"][0]["run"]["kind"] = "interactive"
        self.assertFalse(self.check(data, code=1)["ok"])

    def test_native_flow_wire_format_is_still_accepted(self):
        data = copy.deepcopy(WORKFLOW)
        data["blocks"][0]["steps"][0]["run"] = {
            "kind": "flow",
            "steps": [OPERATION],
            "stop_on_error": True,
        }
        self.assertTrue(self.check(data)["ok"])

    def test_empty_workflow_is_only_a_parse_preview(self):
        result = self.check({"name": "empty", "fail_fast": True, "blocks": []})
        self.assertEqual(result["scope"], "workflow_parse_preview")
        self.assertTrue(
            any("TxWorkflow.validate()" in note for note in result["notes"])
        )

    def test_rollback_bounds_are_not_checked_by_cli_preview(self):
        data = copy.deepcopy(WORKFLOW)
        data["blocks"][0]["rollback_policy"] = {
            "whole_resource": {"rollback": OPERATION, "trigger_step_index": 9},
        }
        self.assertTrue(self.check(data)["ok"])

    def test_workflow_mode_is_required_in_native_json(self):
        data = copy.deepcopy(WORKFLOW)
        del data["blocks"][0]["steps"][0]["run"]["mode"]
        self.assertFalse(self.check(data, code=1)["ok"])

    def test_orchestration_missing_group_has_state_guidance(self):
        data = copy.deepcopy(PLAN)
        job = data["stages"][0]["jobs"][0]
        job["targets"] = []
        job["target_groups"] = ["missing-fixture-group"]
        result = self.check(data, code=1)
        self.assertTrue(any("RAUTO_HOME" in note for note in result["notes"]))

    def test_inline_targets_are_rejected(self):
        data = copy.deepcopy(PLAN)
        data["stages"][0]["jobs"][0]["targets"] = [{"host": "192.0.2.10"}]
        self.assertFalse(self.check(data, code=1)["ok"])

    def test_nested_workflow_is_not_checked_in_plan_preview(self):
        data = copy.deepcopy(PLAN)
        data["stages"][0]["jobs"][0]["action"]["workflow"] = {"invalid": True}
        result = self.check(data)
        self.assertTrue(any("nested workflows" in note for note in result["notes"]))

    def test_cli_rejects_invalid_json_before_running_rauto(self):
        path = self.root / "invalid.json"
        path.write_text("{", encoding="utf-8")
        result = subprocess.run(
            [sys.executable, str(Path(checker.__file__)), "--file", str(path)],
            env={**self.env, "RAUTO_BIN": "/nonexistent-fixture/rauto"},
            capture_output=True,
            text=True,
            timeout=5,
        )
        self.assertEqual(result.returncode, 2)
        self.assertIn("invalid JSON", result.stderr)


if __name__ == "__main__":
    unittest.main()
