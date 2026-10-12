"""Contract and security regressions without requiring QDK to run in CI."""
import os
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from app import app, cached_energy


class ChemistryWorkerTests(unittest.TestCase):
    def setUp(self):
        cached_energy.cache_clear()
        self.client = TestClient(app)

    def tearDown(self):
        cached_energy.cache_clear()

    def test_requires_secret(self):
        with patch.dict(os.environ, {"QDK_CHEMISTRY_TOKEN": "local-secret"}):
            result = self.client.post(
                "/v1/chemistry/energy", json={"moleculeId": "h2-equilibrium"}
            )
            self.assertEqual(result.status_code, 401)

    def test_missing_worker_secret_fails_closed(self):
        with patch.dict(os.environ, {}, clear=True):
            result = self.client.post(
                "/v1/chemistry/energy", json={"moleculeId": "h2-equilibrium"}
            )
            self.assertEqual(result.status_code, 503)

    def test_disallows_arbitrary_or_unbounded_molecules(self):
        with patch.dict(os.environ, {"QDK_CHEMISTRY_TOKEN": "local-secret"}):
            for payload in (
                {"moleculeId": "custom", "xyz": "bad"},
                {"moleculeId": "h2-equilibrium", "learnerId": "another-person"},
            ):
                result = self.client.post(
                    "/v1/chemistry/energy",
                    json=payload,
                    headers={"X-Chemistry-Worker-Token": "local-secret"},
                )
                self.assertEqual(result.status_code, 422)

    def test_real_solver_is_called_and_result_carries_provenance(self):
        with patch.dict(os.environ, {"QDK_CHEMISTRY_TOKEN": "local-secret"}):
            with patch("app.compute_hartree_fock", return_value=-1.125) as engine:
                response = self.client.post(
                    "/v1/chemistry/energy",
                    json={"moleculeId": "h2-stretched"},
                    headers={"X-Chemistry-Worker-Token": "local-secret"},
                )
                self.assertEqual(response.status_code, 200)
                data = response.json()
                self.assertEqual(data["energyHartree"], -1.125)
                self.assertEqual(data["method"], "Hartree-Fock/SCF")
                self.assertEqual(data["basis"], "sto-3g")
                self.assertIn("Classical", data["note"])
                engine.assert_called_once_with("h2-stretched")


if __name__ == "__main__":
    unittest.main()
