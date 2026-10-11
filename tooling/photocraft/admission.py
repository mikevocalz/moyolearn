"""Pinned PhotoCraft build admission, not an enabled application bridge.
SOT: docs/business/photocraft-admission.md
SOT-KEYWORDS: photocraft source admission rust native wasm licenses provenance
"""
from __future__ import annotations
import argparse
import hashlib
import json
import re
import subprocess
import sys
import tomllib
from pathlib import Path

TARGETS = ("host", "aarch64-apple-ios", "aarch64-apple-ios-sim", "aarch64-linux-android", "wasm32-unknown-unknown")
CRATES = ("photocraft-doc", "photocraft-ops", "photocraft-compose", "photocraft-raster", "photocraft-paint", "photocraft-io", "photocraft-psd", "photocraft-engine")
MANIFEST_DIRS = ("doc", "ops", "compose", "raster", "paint", "io", "psd", "engine")
REPOSITORY = "https://github.com/storytold/photocraft"
SOURCE_INPUTS = ("Cargo.toml", "Cargo.lock", "crates", ".cargo", "build.rs",
                 "rust-toolchain", "rust-toolchain.toml", "LICENSE-MIT", "LICENSE-APACHE", "NOTICE")


def source_pin(lock: dict) -> str:
    if not isinstance(lock, dict) or not isinstance(lock.get("sources"), list):
        raise ValueError("Source lock must contain a sources array")
    if any(not isinstance(entry, dict) for entry in lock["sources"]):
        raise ValueError("Every source pin must be an object")
    entries = [entry for entry in lock["sources"] if entry.get("name") == "PhotoCraft"]
    if len(entries) != 1:
        raise ValueError("Expected exactly one PhotoCraft source pin")
    entry = entries[0]
    commit = entry.get("commit")
    if (entry.get("repository") != REPOSITORY or not isinstance(commit, str)
            or not re.fullmatch(r"[0-9a-f]{40}", commit)):
        raise ValueError("PhotoCraft must use the reviewed repository and immutable commit")
    if entry.get("license") != "MIT OR Apache-2.0":
        raise ValueError("Re-review the changed PhotoCraft license")
    return entry["commit"]


def workspace_contract(manifest: dict) -> str:
    package = manifest["workspace"]["package"]
    if package.get("license") != "MIT OR Apache-2.0":
        raise ValueError("Unexpected source license")
    version = package.get("rust-version", "")
    if not re.fullmatch(r"\d+\.\d+(?:\.\d+)?", version):
        raise ValueError("Missing exact minimum Rust toolchain")
    return version


def build_commands(target: str) -> list[list[str]]:
    if target not in TARGETS:
        raise ValueError("Unsupported admission target")
    selection = [argument for package in CRATES for argument in ("-p", package)]
    target_args = [] if target == "host" else ["--target", target]
    commands = [["cargo", "check", "--locked", *selection, *target_args]]
    if target == "host":
        commands.append(["cargo", "test", "--locked", "-p", "photocraft-engine", "--test", "moyo_studio_admission"])
    return commands


def inspect_source(root: Path, pin: str) -> dict:
    actual = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=root, text=True).strip()
    if actual != pin:
        raise ValueError("Checkout does not match the reviewed source pin")
    subprocess.run(["git", "diff", "--exit-code", "HEAD", "--", *SOURCE_INPUTS], cwd=root, check=True, stdout=subprocess.DEVNULL)
    # git diff misses untracked (including ignored) Cargo configuration and source.
    untracked = subprocess.check_output(
        ["git", "ls-files", "--others", "-z", "--", *SOURCE_INPUTS], cwd=root
    )
    if untracked:
        raise ValueError("Unreviewed untracked PhotoCraft build inputs; use a clean pinned checkout")
    manifest = tomllib.loads((root / "Cargo.toml").read_text())
    toolchain = workspace_contract(manifest)
    for directory, expected in zip(MANIFEST_DIRS, CRATES, strict=True):
        package = tomllib.loads((root / "crates" / directory / "Cargo.toml").read_text())
        if package["package"]["name"] != expected:
            raise ValueError(f"Unexpected crate identity for {directory}")
    provenance = {}
    for name in ("Cargo.toml", "Cargo.lock", "LICENSE-MIT", "LICENSE-APACHE", "NOTICE"):
        data = (root / name).read_bytes()
        if not data:
            raise ValueError(f"Missing source notice or lock: {name}")
        provenance[name] = hashlib.sha256(data).hexdigest()
    return {"repository": REPOSITORY, "commit": actual, "toolchain": toolchain, "sha256": provenance, "crates": list(CRATES)}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True, type=Path)
    parser.add_argument("--lock", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--target", required=True, choices=TARGETS)
    parser.add_argument("--inspect-only", action="store_true")
    args = parser.parse_args()
    report = dict(repository=REPOSITORY, target=args.target, status="verifying-source",
                  applicationBridge="not-linked", gpuInterop="not-validated", commands=[])
    args.output.parent.mkdir(parents=True, exist_ok=True)
    # Invalidate previous evidence before source verification can fail or be interrupted.
    args.output.write_text(json.dumps(report, indent=2) + "\n")
    owned_fixture = None
    try:
        pin = source_pin(json.loads(args.lock.read_text()))
        report.update(inspect_source(args.source, pin))
        report["status"] = "source-verified"
        if args.inspect_only:
            print(report["toolchain"])
            return 0
        if args.target == "host":
            fixture = args.source / "crates/engine/tests/moyo_studio_admission.rs"
            fixture.parent.mkdir(parents=True, exist_ok=True)
            # Never replace any upstream test or accept source-provided harness code.
            with fixture.open("x") as destination:
                owned_fixture = fixture
                destination.write(Path(__file__).with_name("moyo_studio_admission.rs").read_text())
        for index, command in enumerate(build_commands(args.target)):
            log = args.output.with_suffix(f".{index}.log")
            with log.open("w") as stream:
                result = subprocess.run(command, cwd=args.source, stdout=stream, stderr=subprocess.STDOUT, timeout=1800, check=False)
            report["commands"].append({"argv": command, "exitCode": result.returncode, "log": log.name})
            if result.returncode:
                raise RuntimeError(f"Admission failed: {' '.join(command)}; inspect {log.name}")
        report["status"] = "build-checks-passed"
        return 0
    except (OSError, subprocess.SubprocessError, RuntimeError, ValueError, KeyError) as error:
        report["status"] = "failed"
        report["error"] = str(error)
        print(str(error), file=sys.stderr)
        return 1
    finally:
        try:
            # Clean up only the file created by this invocation, even after Cargo fails.
            if owned_fixture is not None:
                owned_fixture.unlink(missing_ok=True)
        except OSError as error:
            report["status"] = "failed"
            report["error"] = f"Fixture cleanup failed: {error}"
            raise
        finally:
            args.output.write_text(json.dumps(report, indent=2) + "\n")


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, subprocess.SubprocessError, ValueError, KeyError) as error:
        print(str(error), file=sys.stderr)
        raise SystemExit(1) from error
