import unittest
from admission import source_pin, workspace_contract, build_commands, TARGETS, CRATES

PIN = "fa2fe1c90fa77235d648a2d21428491593e1c2d9"

def lock(**changes):
    return {"sources": [{"name": "PhotoCraft", "repository": "https://github.com/storytold/photocraft", "commit": PIN, "license": "MIT OR Apache-2.0", **changes}]}

class AdmissionTest(unittest.TestCase):
    def test_immutable_pin(self):
        self.assertEqual(source_pin(lock()), PIN)
    def test_missing_pin(self):
        with self.assertRaises(ValueError): source_pin({"sources": []})
    def test_duplicate_pin(self):
        with self.assertRaises(ValueError): source_pin({"sources": lock()["sources"] * 2})
    def test_moving_ref(self):
        with self.assertRaises(ValueError): source_pin(lock(commit="main"))
    def test_wrong_repository(self):
        with self.assertRaises(ValueError): source_pin(lock(repository="https://example.com/editor"))
    def test_changed_license(self):
        with self.assertRaises(ValueError): source_pin(lock(license="proprietary"))
    def test_exact_manifest_toolchain(self):
        self.assertEqual(workspace_contract({"workspace": {"package": {"license": "MIT OR Apache-2.0", "rust-version": "1.95"}}}), "1.95")
    def test_moving_toolchain(self):
        with self.assertRaises(ValueError): workspace_contract({"workspace": {"package": {"license": "MIT OR Apache-2.0", "rust-version": "nightly"}}})
    def test_all_targets_are_locked_and_select_engine_crates(self):
        for target in TARGETS:
            command = build_commands(target)[0]
            self.assertIn("--locked", command)
            for package in CRATES: self.assertIn(package, command)
            self.assertNotIn("photocraft-ui-egui", command)
            self.assertNotIn("photocraft-gpu", command)
            if target != "host": self.assertEqual(command[-2:], ["--target", target])
    def test_host_runs_actual_engine_fixture(self):
        self.assertEqual(build_commands("host")[1][-2:], ["--test", "moyo_studio_admission"])
    def test_cross_targets_not_claimed_as_execution(self):
        for target in TARGETS[1:]: self.assertEqual(len(build_commands(target)), 1)
    def test_arbitrary_target_rejected(self):
        with self.assertRaises(ValueError): build_commands("host; curl bad")

if __name__ == "__main__": unittest.main()
