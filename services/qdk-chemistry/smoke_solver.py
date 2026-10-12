"""Exercise the installed QDK solver on both admitted geometries, without mocks.

SOT-KEYWORDS: chemistry qdk real solver smoke total molecular energy verification
Run explicitly on a supported Python host; the lightweight HTTP suite stays separate.
"""
import json
import math
from importlib.metadata import version

from app import compute_hartree_fock


def main() -> None:
    # Independent known HF/STO-3G totals, including nuclear repulsion. A loose
    # numerical tolerance permits solver changes while detecting unit/API mistakes.
    expected = {
        "h2-equilibrium": -1.116759307480,
        "h2-stretched": -0.910873555078,
    }
    results = {}
    for molecule_id, reference in expected.items():
        value = compute_hartree_fock(molecule_id)
        if not math.isfinite(value) or not math.isclose(value, reference, abs_tol=1e-5):
            raise RuntimeError(f"Unexpected HF/STO-3G total for {molecule_id}: {value}")
        results[molecule_id] = value
    if results["h2-equilibrium"] >= results["h2-stretched"]:
        raise RuntimeError("The equilibrium geometry must have the lower total energy")
    print(json.dumps({"qdkChemistryVersion": version("qdk-chemistry"), "energyHartree": results}))


if __name__ == "__main__":
    main()
