# Moyo Learn × Microsoft QDK/Chemistry

## What ships in this PR

The learner's **Subjects → Chemistry Lab** activity runs on Expo and Next.js for the teen/adult grade bands. A learner predicts whether hydrogen atoms 0.74 Å or 1.50 Å apart give a lower electronic energy, then triggers two real QDK/Chemistry Hartree–Fock calculations. The results return with units, method, basis, and provenance. The follow-up asks for a physical explanation rather than supplying one. If computation fails, **no** synthetic result appears.

This is an *advanced, guided computational chemistry experiment*, not a general reaction simulator. The SCF solver is a **classical** electronic-structure calculation provided by Microsoft's QDK/Chemistry. We do not claim an orbital visualization, quantum hardware execution, quantum advantage, chemical-accuracy certification, or fully general molecular simulation.

## Data and authorization flow

```text
Learner (Expo / Next, teen or adult)
  → shared ChemistryLabScreen: prediction first
  → Next POST /api/chemistry/energy (cookies, 2 fixed molecule IDs)
  → protectedOperation(auth, headers, practise) + server-read age band
  → private HTTPS QDK_CHEMISTRY_URL + service token, no learner data
  → Python FastAPI: token + Pydantic strict enumeration + bounded worker
  → qdk_chemistry.data.Structure.from_xyz
  → qdk_chemistry.algorithms.create('scf_solver').run(..., sto-3g)
  → { moleculeId, energyHartree, method, basis, computeEngine, note }
```

Backend is server-only; no new Python native dependencies land in the Expo bundle or Next.js deployment. No student identity or session metadata reaches Python. The worker caches only two public non-personal geometries. This endpoint is **not** an agent tool: no AI model receives these results by default, so Moyo's Safety Plane and never-give-answers rule remain intact.

## Setup

See [worker README](../../services/qdk-chemistry/README.md). Configure the two **server-only** variables `QDK_CHEMISTRY_URL` (private HTTPS service URL) and `QDK_CHEMISTRY_TOKEN` (long random token) in the Next app. Do not commit the token. Deploy the private Linux Python worker separately; macOS supports local development. Enable neither external CORS nor a publicly reachable worker port.

In development only, the route also allows loopback HTTP (127.0.0.1:8029). Python dependencies: `qdk-chemistry[all]` (2.2.x), FastAPI, Uvicorn, httpx for tests. Use Python 3.11–3.13.

## Test and acceptance criteria

1. With a learner session (teen/adult), choose a prediction and run the two H₂ calculations; show two **finite** numeric energies in Hartree with method and basis.
2. Verify the worker denies requests without a token and arbitrary XYZ input; route denies bad ids and younger age bands.
3. Stop the worker or omit config; UI must keep the learner's prediction and show an error instead of a fabricated energy.
4. Exercise the same shared view on web, iOS and Android; verify accessibility labels, narrow layouts, offline state and route navigation.
5. Run `python -m unittest discover -s services/qdk-chemistry -p 'test_*.py'`, `pnpm typecheck`, `pnpm test` and `pnpm lint` in CI or a local checkout before merge.

## Deliberate next capabilities (not shipped)

- Molecular/orbital rendering: QDK's `MoleculeViewer` is a Jupyter widget; a universal Moyo-native/WebGPU orbital viewer requires extracting supported orbital grids, validating data transport, and implementing a device-friendly Three/Viro display rather than embedding notebook UI.
- Additional curated curricula: molecules, bond angles and potential-energy scans must be scientifically reviewed and resource-budgeted before opening up free-form geometry.
- True quantum computing: separate guided CASCI/Hamiltonian, Pauli mapping, state preparation, Q# circuit, and resource-estimation lessons, with explicit distinction between **simulation**, **estimated hardware resources**, and actual hardware execution.
- If recording learner progress, use the existing student-model educational data separation and guardian controls; never store raw lab inputs or experiment identifiers in auth profiles.

## Primary references

- [Microsoft QDK/Chemistry quickstart, 2.2](https://microsoft.github.io/qdk-chemistry/user/quickstart.html)
- [QDK/Chemistry source](https://github.com/microsoft/qdk-chemistry)
- [Microsoft QDK molecule visualizer](https://learn.microsoft.com/en-us/azure/quantum/how-to-use-molecule-visualizer)
