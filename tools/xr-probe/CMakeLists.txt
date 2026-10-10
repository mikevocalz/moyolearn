# xr-probe — minimal desktop OpenXR client that opens a session against
# Meta XR Simulator (Meta VR Glasses profile). Exists to prove the host-side
# runtime path before any Viro desktop-port work is scoped.
# SOT-KEYWORDS: xr-probe, openxr, xrsim, glasses-profile
cmake_minimum_required(VERSION 3.24)
project(xr-probe CXX)

set(CMAKE_CXX_STANDARD 17)

include(FetchContent)
FetchContent_Declare(
  openxr
  GIT_REPOSITORY https://github.com/KhronosGroup/OpenXR-SDK-Source.git
  GIT_TAG release-1.1.41
  GIT_SHALLOW TRUE
)
set(BUILD_LOADER ON CACHE BOOL "" FORCE)
set(BUILD_TESTS OFF CACHE BOOL "" FORCE)
set(BUILD_API_LAYERS OFF CACHE BOOL "" FORCE)
set(BUILD_CONFORMANCE_TESTS OFF CACHE BOOL "" FORCE)
set(DYNAMIC_LOADER ON CACHE BOOL "" FORCE)
FetchContent_MakeAvailable(openxr)

FetchContent_Declare(
  vulkan-headers
  GIT_REPOSITORY https://github.com/KhronosGroup/Vulkan-Headers.git
  GIT_TAG vulkan-sdk-1.4.313.0
  GIT_SHALLOW TRUE
)
FetchContent_MakeAvailable(vulkan-headers)

add_executable(xr-probe main.cpp)
set_source_files_properties(main.cpp PROPERTIES COMPILE_FLAGS "-x objective-c++")
target_include_directories(xr-probe PRIVATE ${vulkan-headers_SOURCE_DIR}/include)
target_link_libraries(xr-probe PRIVATE openxr_loader "-framework Metal" "-framework Foundation" "-framework AppKit" dl)
