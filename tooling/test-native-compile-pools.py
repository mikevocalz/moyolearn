#!/usr/bin/env python3
"""Exercise real CMake/Ninja scheduling without building the mobile app.

SOT: apps/mobile/android/build.gradle; verify-native-compile-pools.mjs
SOT-KEYWORDS: android native ci memory ninja compile link pool execution tests
"""
import argparse
import json
from pathlib import Path
import subprocess
import sys
import tempfile


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cmake", required=True)
    parser.add_argument("--ninja", required=True)
    args = parser.parse_args()
    with tempfile.TemporaryDirectory(prefix="moyo-native-pool-execution-") as temporary:
        root = Path(temporary)
        source = root / "source"
        source.mkdir()
        (source / "CMakeLists.txt").write_text("""cmake_minimum_required(VERSION 3.22)
project(MoyoNativePoolFixture LANGUAGES CXX)
add_library(parts STATIC part1.cpp part2.cpp part3.cpp part4.cpp part5.cpp part6.cpp)
add_executable(pool_fixture main.cpp)
target_link_libraries(pool_fixture PRIVATE parts)
""")
        for value in range(1, 7):
            (source / f"part{value}.cpp").write_text(f"int part{value}() {{ return {value}; }}\n")
        declarations = "\n".join(f"int part{value}();" for value in range(1, 7))
        addition = "+".join(f"part{value}()" for value in range(1, 7))
        (source / "main.cpp").write_text(f'#include <iostream>\n{declarations}\nint main() {{ std::cout << ({addition}) << "\\n"; }}\n')
        launcher = root / "launcher.py"
        launcher.write_text("""import fcntl, json, subprocess, sys, time
def change(delta):
    with open(sys.argv[1], 'r+') as state:
        fcntl.flock(state, fcntl.LOCK_EX)
        value = json.load(state)
        value['active'] += delta
        value['peak'] = max(value['peak'], value['active'])
        state.seek(0); json.dump(value, state); state.truncate()
change(1)
try:
    time.sleep(0.1)
    result = subprocess.run(sys.argv[2:])
finally:
    change(-1)
sys.exit(result.returncode)
""")
        results = {}
        for mode in ["unbounded", "bounded"]:
            build = root / mode
            state = root / f"{mode}.json"
            state.write_text(json.dumps({"active": 0, "peak": 0}))
            command = [args.cmake, "-S", str(source), "-B", str(build), "-G", "Ninja",
                       f"-DCMAKE_MAKE_PROGRAM={args.ninja}", "-DCMAKE_BUILD_TYPE=Debug",
                       f"-DCMAKE_CXX_COMPILER_LAUNCHER={sys.executable};{launcher};{state}"]
            if mode == "bounded":
                command += ["-DCMAKE_JOB_POOLS=moyo_native=2", "-DCMAKE_JOB_POOL_COMPILE=moyo_native", "-DCMAKE_JOB_POOL_LINK=moyo_native"]
            subprocess.run(command, check=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
            # AGP launches Ninja directly too: the pool must override this higher job limit.
            subprocess.run([args.ninja, "-C", str(build), "-j8"], check=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
            output = subprocess.check_output([str(build / "pool_fixture")], text=True)
            results[mode] = {**json.loads(state.read_text()), "output": output}
            if mode == "bounded":
                verifier = (Path(__file__).parent / "verify-native-compile-pools.mjs").resolve().as_uri()
                program = f"import {{ inspectBuildProvenance, verifyBuildNinja }} from {json.dumps(verifier)}; console.log(JSON.stringify({{ edges: verifyBuildNinja(process.argv[1]), provenance: inspectBuildProvenance(process.argv[2], process.argv[1]) }}));"
                checked = subprocess.check_output(["node", "--input-type=module", "-e", program, str(build / "build.ninja"), str(root)], text=True)
                results[mode]["verifiedEdges"] = json.loads(checked)["edges"]
                results[mode]["provenance"] = json.loads(checked)["provenance"]
        assert results["unbounded"]["output"] == results["bounded"]["output"] == "21\n", results
        assert results["unbounded"]["peak"] > 2, results
        assert results["bounded"]["peak"] == 2, results
        assert results["bounded"]["active"] == results["unbounded"]["active"] == 0, results
        assert results["bounded"]["verifiedEdges"] == {"compile": 7, "link": 2}, results
        assert results["bounded"]["provenance"] == {"kind": "current", "buildDirectory": "bounded", "sourceDirectory": "source"}, results
        print(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()
