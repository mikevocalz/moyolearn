# QDK/Chemistry worker

This private Python service computes **real, classical Hartree–Fock/SCF energies** using Microsoft's open-source `qdk-chemistry` library. It does **not** claim to execute on quantum hardware.

The Next.js route `POST /api/chemistry/energy` authenticates and age-gates learners through `protectedOperation`, then forwards a strictly enumerated molecule id, **not** any student identifiers, messages, or homework, to this worker over a private network with a shared service token.

## Run locally

Use Python 3.11–3.13 and a supported architecture with QDK/Chemistry wheels. From this directory:

```sh
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
export QDK_CHEMISTRY_TOKEN="$(openssl rand -hex 32)"
uvicorn app:app --host 127.0.0.1 --port 8029 --workers 1
```

Set these in the **Next.js server** environment (never `NEXT_PUBLIC_*` or `EXPO_PUBLIC_*`):

```sh
QDK_CHEMISTRY_URL=http://127.0.0.1:8029
QDK_CHEMISTRY_TOKEN=<same long random token>
```

The worker must remain private (bind to loopback locally, private service address in production). Deploy it separately on Linux Python infrastructure; do not bundle large QDK/PySCF binaries with the Next.js app or an Expo device. Outside local development, use private networking and TLS. Set a low worker count, CPU and memory limits, and an outbound network deny policy. Do not expose `QDK_CHEMISTRY_TOKEN` to client bundles.

## Verify

```sh
python -m unittest discover -s . -p 'test_*.py'
curl -s http://127.0.0.1:8029/health
```

Use the authenticated web/mobile Chemistry Lab to run two real calculations and compare the result. The first request may be slower because the QDK solver must initialize. Failure displays a retry state, not a fake energy. The test suite stubs the solver solely to exercise HTTP and authorization contracts.

## Deliberate bounds

- Only H₂ at 0.74 Å and H₂ at 1.50 Å, both neutral singlets; no free-form molecular uploads or arbitrary jobs.
- Fixed `sto-3g` basis; bounded concurrency and a two-item cache for reusable *non-personal* computations.
- Values in Hartree, paired with method and provenance; meaningful **within-molecule** comparisons only.
- QDK's orbital visualization, CASCI, Hamiltonians, qubit mapping, quantum phase estimation and hardware resource estimation are **not** enabled by this first slice. Add them as separately costed, age-appropriate, teacher-reviewed lessons, never implying quantum advantage or chemistry accuracy by default.

Source: https://microsoft.github.io/qdk-chemistry/user/quickstart.html (QDK/Chemistry 2.2).
