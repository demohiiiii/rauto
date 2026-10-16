"""Release checksum and version contracts for the Homebrew updater."""

from pathlib import Path
import tempfile
import unittest

from update_homebrew import update_formula


class HomebrewUpdateTests(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory(prefix="rauto-homebrew-test-")
        self.addCleanup(directory.cleanup)
        self.root = Path(directory.name)
        (self.root / "Formula").mkdir()
        (self.root / "Cargo.toml").write_text('[package]\nversion = "0.5.3"\n')
        self.formula_path = self.root / "Formula" / "rauto.rb"
        self.original = (Path(__file__).resolve().parents[1] / "Formula" / "rauto.rb").read_text()
        self.formula_path.write_text(self.original)
        self.checksums = self.root / "checksums"
        self.checksums.mkdir()
        for architecture, digest in (("arm64", "a" * 64), ("amd64", "b" * 64)):
            asset = f"rauto-macos-{architecture}.tar.gz"
            (self.checksums / f"{asset}.sha256").write_text(f"{digest}  {asset}\n")

    def test_updates_matching_architectures_and_is_idempotent(self):
        update_formula(self.root, "v0.5.3", self.checksums)
        formula = self.formula_path.read_text()
        self.assertIn('version "0.5.3"', formula)
        self.assertRegex(formula, 'on_arm do\n    url [^\n]+\n    sha256 "' + "a" * 64)
        self.assertRegex(formula, 'on_intel do\n    url [^\n]+\n    sha256 "' + "b" * 64)
        self.assertIn('generate_completions_from_executable', formula)
        update_formula(self.root, "0.5.3", self.checksums)
        self.assertEqual(self.formula_path.read_text(), formula)

    def test_invalid_or_wrong_asset_checksums_preserve_formula(self):
        checksum = self.checksums / "rauto-macos-amd64.tar.gz.sha256"
        for value in ("invalid", "b" * 64 + "  rauto-macos-arm64.tar.gz"):
            with self.subTest(value=value):
                checksum.write_text(value)
                with self.assertRaisesRegex(ValueError, "Invalid release checksum"):
                    update_formula(self.root, "v0.5.3", self.checksums)
                self.assertEqual(self.formula_path.read_text(), self.original)

    def test_missing_checksums_preserve_formula(self):
        (self.checksums / "rauto-macos-amd64.tar.gz.sha256").unlink()
        with self.assertRaises(FileNotFoundError):
            update_formula(self.root, "v0.5.3", self.checksums)
        self.assertEqual(self.formula_path.read_text(), self.original)

    def test_wrong_or_unstable_release_preserves_formula(self):
        for tag in ("v0.5.2", "v0.5.3-rc.1", "../0.5.3", "v00.5.3"):
            with self.subTest(tag=tag), self.assertRaises(ValueError):
                update_formula(self.root, tag, self.checksums)
            self.assertEqual(self.formula_path.read_text(), self.original)

    def test_unrecognized_formula_preserves_formula(self):
        original = self.original.replace("on_intel do", "on_unknown do")
        self.formula_path.write_text(original)
        with self.assertRaisesRegex(ValueError, "intel download declaration"):
            update_formula(self.root, "v0.5.3", self.checksums)
        self.assertEqual(self.formula_path.read_text(), original)


if __name__ == "__main__":
    unittest.main()
