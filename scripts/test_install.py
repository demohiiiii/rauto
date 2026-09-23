"""Offline installer tests: python3 -B -m unittest discover -s scripts -p 'test_*.py'."""

import hashlib
import io
import os
from pathlib import Path
import shutil
import subprocess
import tarfile
import tempfile
import unittest


INSTALLER = Path(__file__).resolve().parents[1] / "install.sh"


class InstallTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="rauto-install-test-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.bin = self.root / "installed bin"
        self.bin.mkdir()
        self.destination = self.bin / "rauto"
        self.destination.write_text("previous installation")
        self.mock = self.root / "mock"
        self.mock.mkdir()
        (self.root / "tmp").mkdir()
        self.env = {
            **os.environ,
            "PATH": f"{self.mock}{os.pathsep}{os.environ['PATH']}",
            "TMPDIR": str(self.root / "tmp"),
            "RAUTO_INSTALL_TEST_ROOT": str(self.root),
            "RAUTO_INSTALL_TEST_OS": "Linux",
            "RAUTO_INSTALL_TEST_ARCH": "x86_64",
        }
        self.write_mock("uname", """#!/bin/sh
case "$1" in
  -s) printf '%s\\n' "$RAUTO_INSTALL_TEST_OS" ;;
  -m) printf '%s\\n' "$RAUTO_INSTALL_TEST_ARCH" ;;
esac
""")
        self.write_mock("curl", """#!/usr/bin/env python3
import os, pathlib, shutil, sys
root = pathlib.Path(os.environ['RAUTO_INSTALL_TEST_ROOT'])
args = sys.argv[1:]
url = args[-1]
with (root / 'requests').open('a') as log:
    log.write(url + '\\n')
if '--head' in args:
    print('https://github.com/demohiiiii/rauto/releases/tag/v9.8.7', end='')
    sys.exit(0)
if os.environ.get('RAUTO_INSTALL_TEST_DOWNLOAD_FAIL'):
    sys.exit(22)
destination = args[args.index('--output') + 1]
if url.endswith('.sha256'):
    if os.environ.get('RAUTO_INSTALL_TEST_NO_CHECKSUM'):
        sys.exit(22)
    source = root / 'checksum'
else:
    source = root / 'archive.tar.gz'
shutil.copyfile(source, destination)
""")
        self.archive()

    def write_mock(self, name, source):
        path = self.mock / name
        path.write_text(source)
        path.chmod(0o755)

    def archive(self, content=None, name="rauto"):
        if content is None:
            content = (
                b'#!/bin/sh\n'
                b'case "$RAUTO_HOME" in "$TMPDIR"/*/data) ;; *) exit 1 ;; esac\n'
                b'printf "rauto 9.8.7\\n"\n'
            )
        path = self.root / "archive.tar.gz"
        with tarfile.open(path, "w:gz") as archive:
            member = tarfile.TarInfo(name)
            member.size = len(content)
            member.mode = 0o755
            archive.addfile(member, io.BytesIO(content))
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        (self.root / "checksum").write_text(f"{digest}  archive.tar.gz\n")

    def run_installer(self, *args, success=True, piped=False):
        result = subprocess.run(
            [
                "sh", *(["-s", "--"] if piped else [str(INSTALLER)]),
                "--install-dir", str(self.bin), *args,
            ],
            env=self.env, cwd=self.root, capture_output=True, text=True,
            input=INSTALLER.read_text() if piped else None,
        )
        if success:
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        else:
            self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
            self.assertEqual(self.destination.read_text(), "previous installation")
        self.assertEqual(list((self.root / "tmp").iterdir()), [])
        self.assertEqual(list(self.bin.glob(".rauto-install.*")), [])
        return result

    def test_latest_and_platform_assets(self):
        for system, arch, asset in (
            ("Linux", "x86_64", "rauto-linux-amd64"),
            ("Darwin", "arm64", "rauto-macos-arm64"),
            ("Darwin", "x86_64", "rauto-macos-amd64"),
        ):
            with self.subTest(system=system, arch=arch):
                self.env.update(RAUTO_INSTALL_TEST_OS=system, RAUTO_INSTALL_TEST_ARCH=arch)
                self.run_installer()
                self.assertTrue(os.access(self.destination, os.X_OK))
                self.assertIn(f"/v9.8.7/{asset}.tar.gz.sha256", (self.root / "requests").read_text())

    def test_explicit_version_skips_latest_lookup(self):
        self.run_installer("--version", "v9.8.7")
        self.assertNotIn("/latest", (self.root / "requests").read_text())

    def test_script_from_stdin(self):
        self.run_installer("--version", "9.8.7", piped=True)
        self.assertTrue(os.access(self.destination, os.X_OK))

    @unittest.skipUnless(shutil.which("shasum"), "shasum is not installed")
    def test_shasum_fallback(self):
        for command in (
            "sh", "python3", "tar", "gzip", "mktemp", "shasum", "awk",
            "chmod", "mkdir", "cp", "mv", "rm",
        ):
            (self.mock / command).symlink_to(shutil.which(command))
        self.env["PATH"] = str(self.mock)
        self.run_installer("--version", "9.8.7")
        self.assertTrue(os.access(self.destination, os.X_OK))

    def test_relative_install_directory(self):
        self.run_installer("--version", "9.8.7", "--install-dir", "relative bin")
        self.assertTrue((self.root / "relative bin" / "rauto").is_file())

    def test_wrong_checksum_preserves_installation(self):
        (self.root / "checksum").write_text("0" * 64)
        result = self.run_installer(success=False)
        self.assertIn("checksum mismatch", result.stderr)

    def test_invalid_checksum_preserves_installation(self):
        (self.root / "checksum").write_text("not a checksum")
        self.run_installer(success=False)

    def test_missing_checksum_preserves_installation(self):
        self.env["RAUTO_INSTALL_TEST_NO_CHECKSUM"] = "1"
        self.run_installer(success=False)

    def test_download_failure_preserves_installation(self):
        self.env["RAUTO_INSTALL_TEST_DOWNLOAD_FAIL"] = "1"
        self.run_installer(success=False)

    def test_unrunnable_binary_preserves_installation(self):
        self.archive(b"#!/bin/sh\nexit 126\n")
        self.run_installer(success=False)

    def test_wrong_binary_version_preserves_installation(self):
        self.archive(b"#!/bin/sh\nprintf 'rauto 1.0.0\\n'\n")
        self.run_installer(success=False)

    def test_missing_binary_preserves_installation(self):
        self.archive(name="wrong-file")
        self.run_installer(success=False)

    def test_unsupported_architecture_does_not_download(self):
        self.env["RAUTO_INSTALL_TEST_ARCH"] = "aarch64"
        self.run_installer(success=False)
        self.assertFalse((self.root / "requests").exists())

    def test_invalid_arguments_do_not_download(self):
        for args in (("--version", "../bad"), ("--version",), ("--unknown",)):
            with self.subTest(args=args):
                self.run_installer(*args, success=False)
                self.assertFalse((self.root / "requests").exists())

    def test_help_does_not_download(self):
        result = self.run_installer("--help")
        self.assertIn("Usage:", result.stdout)
        self.assertFalse((self.root / "requests").exists())


if __name__ == "__main__":
    unittest.main()
