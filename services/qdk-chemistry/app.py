"""Bounded, private QDK/Chemistry Hartree-Fock service for Moyo Chemistry Lab.

SOT-KEYWORDS: chemistry quantum qdk Hartree Fock molecular energy server worker
Do not pass a learner identity, free-form structure, or model prompt to this worker.
"""
from __future__ import annotations

import math
import os
import secrets
from functools import lru_cache
from threading import BoundedSemaphore
from typing import Literal

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, ConfigDict

MoleculeId = Literal["h2-equilibrium", "h2-stretched"]
BASIS = "sto-3g"
# Bond lengths are in Angstroms: the XYZ reader converts to atomic units.
STRUCTURES = {
    "h2-equilibrium": "2\nH2 0.74 angstrom\nH 0.0 0.0 0.0\nH 0.0 0.0 0.74\n",
    "h2-stretched": "2\nH2 1.50 angstrom\nH 0.0 0.0 0.0\nH 0.0 0.0 1.50\n",
}
# Limit concurrent calculations even if the HTTP server accepts more requests.
_SLOTS = BoundedSemaphore(value=2)

app = FastAPI(
    title="Moyo QDK Chemistry Worker",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)


class EnergyRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    moleculeId: MoleculeId


class EnergyResult(BaseModel):
    moleculeId: MoleculeId
    energyHartree: float
    method: Literal["Hartree-Fock/SCF"] = "Hartree-Fock/SCF"
    basis: Literal["sto-3g"] = BASIS
    computeEngine: Literal["Microsoft QDK/Chemistry"] = "Microsoft QDK/Chemistry"
    note: str = (
        "Classical electronic-structure calculation, not a quantum-hardware measurement. "
        "Compare energies only for the same molecule at the same computational method and basis."
    )


def compute_hartree_fock(molecule_id: MoleculeId) -> float:
    """Run the QDK/Chemistry SCF solver; no hard-coded or estimated energies."""
    from qdk_chemistry.algorithms import create
    from qdk_chemistry.data import Structure

    structure = Structure.from_xyz(STRUCTURES[molecule_id])
    solver = create("scf_solver")
    energy, _wavefunction = solver.run(
        structure, charge=0, spin_multiplicity=1, basis_or_guess=BASIS
    )
    result = float(energy)
    if not math.isfinite(result):
        raise RuntimeError("QDK returned a non-finite energy")
    return result


@lru_cache(maxsize=2)
def cached_energy(molecule_id: MoleculeId) -> float:
    # Only two fixed, non-personal molecular geometries; cache cannot retain student work.
    with _SLOTS:
        return compute_hartree_fock(molecule_id)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/v1/chemistry/energy", response_model=EnergyResult)
def energy(
    request: EnergyRequest,
    x_chemistry_worker_token: str | None = Header(default=None),
) -> EnergyResult:
    # Worker is private and has no browser CORS. Next.js authenticates the learner;
    # this second check prevents bypassing the learner safety/entitlement wall.
    expected = os.environ.get("QDK_CHEMISTRY_TOKEN", "")
    if not expected:
        raise HTTPException(status_code=503, detail="Worker not configured")
    if not x_chemistry_worker_token or not secrets.compare_digest(
        expected, x_chemistry_worker_token
    ):
        raise HTTPException(status_code=401, detail="Unauthorized")
    try:
        value = cached_energy(request.moleculeId)
    except Exception as exc:
        # Never serialize numerical library internals or input data to callers.
        raise HTTPException(status_code=503, detail="Calculation unavailable") from exc
    return EnergyResult(moleculeId=request.moleculeId, energyHartree=value)
