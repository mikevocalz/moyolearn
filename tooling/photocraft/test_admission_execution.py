"""Exercise admission's CLI, Git checkout and evidence lifecycle.
SOT: docs/business/photocraft-admission.md
SOT-KEYWORDS: photocraft admission cli evidence cleanup regression tests

Cargo is a process-boundary fixture, not a Rust compiler. These tests prove
orchestration only; the separate Actions matrix must execute the real engine.
"""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
import admission

SCRIPT = Path(__file__).with_name("admission.py").resolve()


class AdmissionExecutionTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.source = self.root / "source"
        self.source.mkdir()
        self.env = {
            **os.environ,
            "GIT_CONFIG_GLOBAL": os.devnull,
            "GIT_CONFIG_SYSTEM": os.devnull,
            "GIT_CONFIG_NOSYSTEM": "1",
        }
        (self.source / "Cargo.toml").write_text(
            '[workspace.package]\nlicense = "MIT OR Apache-2.0"\nrust-version = "1.95"\n'
        )
        for name in ("Cargo.lock", "LICENSE-MIT", "LICENSE-APACHE", "NOTICE"):
            (self.source / name).write_text("Test fixture; not upstream source or licensing evidence.\n")
        for name in ("doc", "ops", "compose", "raster", "paint", "io", "psd", "engine"):
            path = self.source / "crates" / name / "Cargo.toml"
            path.parent.mkdir(parents=True)
            path.write_text(f'[package]\nname = "photocraft-{name}"\n')
        self.git("init", "-q")
        self.git("config", "user.name", "Admission Test")
        self.git("config", "user.email", "admission@example.invalid")
        self.git("config", "core.hooksPath", os.devnull)
        self.git("add", ".")
        self.git("-c", "commit.gpgsign=false", "commit", "-qm", "Test source fixture")
        self.lock = self.root / "lock.json"
        self.lock.write_text(json.dumps({"sources": [{
            "name": "PhotoCraft", "repository": "https://github.com/storytold/photocraft",
            "license": "MIT OR Apache-2.0", "commit": self.git("rev-parse", "HEAD").strip(),
        }]}))
        self.output = self.root / "evidence" / "result.json"
        self.fixture = self.source / "crates/engine/tests/moyo_studio_admission.rs"
        self.bin = self.root / "bin"
        self.bin.mkdir()
        self.env["PATH"] = str(self.bin) + os.pathsep + self.env["PATH"]
        self.cargo(0)

    def git(self, *args):
        return subprocess.check_output(
            ["git", *args], cwd=self.source, env=self.env, text=True, stderr=subprocess.PIPE
        )

    def cargo(self, code):
        path = self.bin / "cargo"
        path.write_text(f'#!/bin/sh\nprintf "compiler process fixture\\n"\nexit {code}\n')
        path.chmod(0o755)

    def run_cli(self, *args):
        return subprocess.run(
            [sys.executable, str(SCRIPT), "--source", str(self.source),
             "--lock", str(self.lock), "--output", str(self.output), "--target", "host", *args],
            env=self.env, capture_output=True, text=True, timeout=10,
        )

    def report(self):
        return json.loads(self.output.read_text())

    def test_source_failure_replaces_stale_success_evidence(self):
        self.output.parent.mkdir()
        self.output.write_text('{"status":"build-checks-passed"}')
        data = json.loads(self.lock.read_text())
        data["sources"][0]["commit"] = "0" * 40
        self.lock.write_text(json.dumps(data))
        result = self.run_cli()
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.report()["status"], "failed")
        self.assertEqual(self.report()["commands"], [])
        self.assertIn("Checkout does not match", self.report()["error"])
        self.assertFalse(self.fixture.exists())

    def test_host_admission_can_rerun_without_stale_fixture(self):
        first = self.run_cli()
        self.assertEqual(first.returncode, 0, first.stderr)
        second = self.run_cli()
        self.assertEqual(second.returncode, 0, second.stderr)
        self.assertFalse(self.fixture.exists())
        self.assertEqual(self.report()["status"], "build-checks-passed")
        self.assertEqual(len(self.report()["commands"]), 2)

    def test_untracked_cargo_configuration_is_rejected(self):
        config = self.source / ".cargo/config.toml"
        config.parent.mkdir()
        config.write_text('[build]\nrustc-wrapper = "unreviewed-program"\n')
        result = self.run_cli("--inspect-only")
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.report()["status"], "failed")
        self.assertEqual(self.report()["commands"], [])

    def test_invalid_lock_shapes_produce_failure_evidence(self):
        for data in ([], {"sources": None}, {"sources": [None]}, {"sources": [{
            "name": "PhotoCraft", "repository": "https://github.com/storytold/photocraft",
            "commit": None, "license": "MIT OR Apache-2.0",
        }]}):
            with self.subTest(data=data):
                self.lock.write_text(json.dumps(data))
                result = self.run_cli()
                self.assertNotEqual(result.returncode, 0)
                self.assertEqual(self.report()["status"], "failed")
                self.assertEqual(self.report()["commands"], [])

    def repin(self):
        self.git("add", ".")
        self.git("-c", "commit.gpgsign=false", "commit", "-qm", "Update test source fixture")
        data = json.loads(self.lock.read_text())
        data["sources"][0]["commit"] = self.git("rev-parse", "HEAD").strip()
        self.lock.write_text(json.dumps(data))

    def test_compiler_failure_is_reported_and_can_be_retried(self):
        self.cargo(42)
        result = self.run_cli()
        self.assertNotEqual(result.returncode, 0)
        report = self.report()
        self.assertEqual(report["status"], "failed")
        self.assertEqual(len(report["commands"]), 1)
        self.assertEqual(report["commands"][0]["exitCode"], 42)
        log = self.output.parent / report["commands"][0]["log"]
        self.assertIn("compiler process fixture", log.read_text())
        self.assertFalse(self.fixture.exists())
        self.cargo(0)
        retry = self.run_cli()
        self.assertEqual(retry.returncode, 0, retry.stderr)

    def test_timeouts_record_failed_command_log_and_preserve_cleanup(self):
        real_run = subprocess.run
        for operation in ("check", "test"):
            with self.subTest(operation=operation):
                def timeout_command(command, **kwargs):
                    if command[:2] == ["cargo", operation]:
                        self.assertEqual(kwargs["timeout"], 1800)
                        kwargs["stdout"].write("timed-out compiler process fixture\n")
                        raise subprocess.TimeoutExpired(command, kwargs["timeout"])
                    return real_run(command, **kwargs)

                argv = [str(SCRIPT), "--source", str(self.source), "--lock", str(self.lock),
                        "--output", str(self.output), "--target", "host"]
                with patch.dict(os.environ, self.env, clear=True), patch.object(sys, "argv", argv), \
                        patch.object(admission.subprocess, "run", side_effect=timeout_command):
                    self.assertEqual(admission.main(), 1)
                report = self.report()
                self.assertEqual(report["status"], "failed")
                expected_count = 1 if operation == "check" else 2
                self.assertEqual(len(report["commands"]), expected_count)
                failed = report["commands"][-1]
                self.assertEqual(failed["argv"], admission.build_commands("host")[expected_count - 1])
                self.assertIsNone(failed["exitCode"])
                self.assertIs(failed["timedOut"], True)
                self.assertEqual(failed["log"], f"result.{expected_count - 1}.log")
                self.assertIn("timed-out compiler process fixture", (self.output.parent / failed["log"]).read_text())
                self.assertTrue(all(command["exitCode"] == 0 for command in report["commands"][:-1]))
                self.assertFalse(self.fixture.exists())
                retry = self.run_cli()
                self.assertEqual(retry.returncode, 0, retry.stderr)
                self.assertEqual(self.report()["status"], "build-checks-passed")
                self.assertTrue(all("timedOut" not in command for command in self.report()["commands"]))

    def test_existing_upstream_fixture_is_never_replaced_or_removed(self):
        self.fixture.parent.mkdir(parents=True)
        self.fixture.write_text("// Existing upstream test must be preserved.\n")
        self.repin()
        result = self.run_cli()
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.fixture.read_text(), "// Existing upstream test must be preserved.\n")
        self.assertEqual(self.report()["status"], "failed")
        self.assertEqual(self.report()["commands"], [])

    def test_inspection_only_does_not_invoke_cargo(self):
        self.cargo(99)
        result = self.run_cli("--inspect-only")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.strip(), "1.95")
        self.assertEqual(self.report()["status"], "source-verified")
        self.assertEqual(self.report()["commands"], [])
        self.assertFalse(self.fixture.exists())

    def test_malformed_lock_produces_failure_evidence(self):
        self.lock.write_text("{")
        result = self.run_cli()
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.report()["status"], "failed")
        self.assertFalse(self.fixture.exists())

    def test_modified_tracked_toolchain_is_rejected(self):
        toolchain = self.source / "rust-toolchain.toml"
        toolchain.write_text('[toolchain]\nchannel = "1.95"\n')
        self.repin()
        toolchain.write_text('[toolchain]\nchannel = "nightly"\n')
        result = self.run_cli("--inspect-only")
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.report()["status"], "failed")
        self.assertEqual(self.report()["commands"], [])

    def test_ignored_crate_input_cannot_bypass_source_verification(self):
        (self.source / ".gitignore").write_text("unreviewed.rs\n")
        self.repin()
        (self.source / "crates/engine/unreviewed.rs").write_text("// Not reviewed.\n")
        result = self.run_cli("--inspect-only")
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.report()["status"], "failed")
        self.assertEqual(self.report()["commands"], [])


if __name__ == "__main__":
    unittest.main()
