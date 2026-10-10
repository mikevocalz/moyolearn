// OpenXR session probe for Meta XR Simulator — glasses profile.
// Creates an instance, binds a Metal graphics session, runs the session
// state machine to RUNNING, and locates views. Exits non-zero on failure
// so it can gate CI.
// SOT-KEYWORDS: xr-probe, openxr, metal, session, glasses

#define XR_USE_GRAPHICS_API_METAL 1
#define XR_USE_GRAPHICS_API_VULKAN 1
#define VK_NO_PROTOTYPES 1
#include <vulkan/vulkan.h>
#include <dlfcn.h>
#include <openxr/openxr.h>
#include <openxr/openxr_platform.h>
#include <cstdio>
#include <cstring>
#include <cstdlib>
#include <atomic>
#include <thread>
#include <vector>

#import <Metal/Metal.h>
#import <AppKit/AppKit.h>

// The sim's compositor is Vulkan; Metal clients cross an interop seam where
// the compositor can sample a different backing image than the one the app
// wrote (verified: app-side texture reads magenta, composited capture reads
// black). XR_PROBE_API=vulkan binds the session with XR_KHR_vulkan_enable so
// the app renders into the very VkImages the compositor samples.
static bool useVulkan() {
  const char* v = std::getenv("XR_PROBE_API");
  return v && std::strcmp(v, "vulkan") == 0;
}

static PFN_xrVoidFunction xrExt(XrInstance inst, const char* name) {
  PFN_xrVoidFunction fn = nullptr;
  xrGetInstanceProcAddr(inst, name, &fn);
  return fn;
}

#define XR_CHECK(expr)                                          \
  do {                                                          \
    XrResult r_ = (expr);                                       \
    if (XR_FAILED(r_)) {                                        \
      std::fprintf(stderr, "%s failed: %d\n", #expr, (int)r_);  \
      return 1;                                                 \
    }                                                           \
  } while (0)

static PFN_xrGetMetalGraphicsRequirementsKHR pfnGetMetalReqs = nullptr;

// ---- Vulkan path -------------------------------------------------------------
// Loads the Vulkan loader bundled inside MetaXRSimulator.app (MoltenVK ICD).
// Rendering happens via vkCmdClearColorImage on the swapchain VkImage — the
// same VkDevice the compositor samples, so no interop copy can lose the frame.

#define VK_FN(name) static PFN_##name name = nullptr
VK_FN(vkGetInstanceProcAddr);
VK_FN(vkCreateInstance);
VK_FN(vkEnumeratePhysicalDevices);
VK_FN(vkGetPhysicalDeviceQueueFamilyProperties);
VK_FN(vkGetDeviceProcAddr);
VK_FN(vkCreateDevice);
VK_FN(vkGetDeviceQueue);
VK_FN(vkCreateCommandPool);
VK_FN(vkAllocateCommandBuffers);
VK_FN(vkBeginCommandBuffer);
VK_FN(vkEndCommandBuffer);
VK_FN(vkCmdPipelineBarrier);
VK_FN(vkCmdClearColorImage);
VK_FN(vkQueueSubmit);
VK_FN(vkQueueWaitIdle);
VK_FN(vkCreateBuffer);
VK_FN(vkGetBufferMemoryRequirements);
VK_FN(vkAllocateMemory);
VK_FN(vkBindBufferMemory);
VK_FN(vkMapMemory);
VK_FN(vkUnmapMemory);
VK_FN(vkCmdCopyImageToBuffer);
VK_FN(vkGetPhysicalDeviceMemoryProperties);
VK_FN(vkCreateShaderModule);
VK_FN(vkCreateRenderPass);
VK_FN(vkCreateImageView);
VK_FN(vkCreateFramebuffer);
VK_FN(vkCreatePipelineLayout);
VK_FN(vkCreateGraphicsPipelines);
VK_FN(vkCmdBeginRenderPass);
VK_FN(vkCmdBindPipeline);
VK_FN(vkCmdDraw);
VK_FN(vkCmdEndRenderPass);
VK_FN(vkDestroyShaderModule);
VK_FN(vkDestroyRenderPass);
VK_FN(vkDestroyImageView);
VK_FN(vkDestroyFramebuffer);
VK_FN(vkDestroyPipelineLayout);
VK_FN(vkDestroyPipeline);

static bool loadVulkan() {
  // SIMULATOR.so embeds its own MoltenVK statically; routing through the
  // Vulkan loader drags in a second MoltenVK and the ObjC class clash breaks
  // driver init (vkCreateInstance -> VK_ERROR_INCOMPATIBLE_DRIVER). Load
  // libMoltenVK.dylib directly — it exports vkGetInstanceProcAddr and serves
  // as loader+driver in one.
  const char* lib =
      "/Applications/MetaXRSimulator.app/Contents/Frameworks/libMoltenVK.dylib";
  void* h = dlopen(lib, RTLD_NOW | RTLD_LOCAL);
  if (!h) { std::fprintf(stderr, "dlopen libMoltenVK failed: %s\n", dlerror()); return false; }
  std::puts("libMoltenVK loaded");
  vkGetInstanceProcAddr = (PFN_vkGetInstanceProcAddr)dlsym(h, "vkGetInstanceProcAddr");
  if (!vkGetInstanceProcAddr) { std::fputs("no vkGetInstanceProcAddr\n", stderr); return false; }
  std::puts("gpa ok");
  vkCreateInstance = (PFN_vkCreateInstance)vkGetInstanceProcAddr(nullptr, "vkCreateInstance");
  return vkCreateInstance != nullptr;
}

#define VK_DFN(name) name = (PFN_##name)vkGetDeviceProcAddr(dev, #name)
static void loadDeviceFns(VkDevice dev) {
  VK_DFN(vkGetDeviceQueue);
  VK_DFN(vkCreateCommandPool);
  VK_DFN(vkAllocateCommandBuffers);
  VK_DFN(vkBeginCommandBuffer);
  VK_DFN(vkEndCommandBuffer);
  VK_DFN(vkCmdPipelineBarrier);
  VK_DFN(vkCmdClearColorImage);
  VK_DFN(vkQueueSubmit);
  VK_DFN(vkQueueWaitIdle);
  VK_DFN(vkCreateBuffer);
  VK_DFN(vkGetBufferMemoryRequirements);
  VK_DFN(vkAllocateMemory);
  VK_DFN(vkBindBufferMemory);
  VK_DFN(vkMapMemory);
  VK_DFN(vkUnmapMemory);
  VK_DFN(vkCmdCopyImageToBuffer);
  VK_DFN(vkCreateShaderModule);
  VK_DFN(vkCreateRenderPass);
  VK_DFN(vkCreateImageView);
  VK_DFN(vkCreateFramebuffer);
  VK_DFN(vkCreatePipelineLayout);
  VK_DFN(vkCreateGraphicsPipelines);
  VK_DFN(vkCmdBeginRenderPass);
  VK_DFN(vkCmdBindPipeline);
  VK_DFN(vkCmdDraw);
  VK_DFN(vkCmdEndRenderPass);
  VK_DFN(vkDestroyShaderModule);
  VK_DFN(vkDestroyRenderPass);
  VK_DFN(vkDestroyImageView);
  VK_DFN(vkDestroyFramebuffer);
  VK_DFN(vkDestroyPipelineLayout);
  VK_DFN(vkDestroyPipeline);
}

// SPIR-V for the triangle pipeline — compiled with the glslangValidator bundled
// in MetaXRSimulator.app (--target-env vulkan1.0). Vertex shader generates a
// centered triangle from gl_VertexIndex (no vertex buffer); fragment writes a
// near-white gradient so the composited capture can distinguish a landed draw
// from the flat magenta vkCmdClearColorImage underneath.
//
//   tri.vert:  pos = vec2[](vec2(-0.8,-0.8), vec2(0.8,-0.8), vec2(0.0,0.8))
//              uv  = pos[gl_VertexIndex] * 0.5 + 0.5
//              gl_Position = vec4(pos[gl_VertexIndex], 0, 1)
//   tri.frag:  outColor = vec4(1.0, 1.0, 0.7 + 0.3*uv.y, 1.0)
static const uint32_t kTriVertSpv[] = {
    0x07230203, 0x00010000, 0x0008000b, 0x00000031, 0x00000000, 0x00020011, 0x00000001, 0x0006000b,
    0x00000001, 0x4c534c47, 0x6474732e, 0x3035342e, 0x00000000, 0x0003000e, 0x00000000, 0x00000001,
    0x0008000f, 0x00000000, 0x00000004, 0x6e69616d, 0x00000000, 0x00000018, 0x0000001d, 0x00000028,
    0x00030003, 0x00000002, 0x000001c2, 0x00040005, 0x00000004, 0x6e69616d, 0x00000000, 0x00030005,
    0x0000000c, 0x00736f70, 0x00030005, 0x00000015, 0x00000070, 0x00060005, 0x00000018, 0x565f6c67,
    0x65747265, 0x646e4978, 0x00007865, 0x00030005, 0x0000001d, 0x00007675, 0x00060005, 0x00000026,
    0x505f6c67, 0x65567265, 0x78657472, 0x00000000, 0x00060006, 0x00000026, 0x00000000, 0x505f6c67,
    0x7469736f, 0x006e6f69, 0x00070006, 0x00000026, 0x00000001, 0x505f6c67, 0x746e696f, 0x657a6953,
    0x00000000, 0x00070006, 0x00000026, 0x00000002, 0x435f6c67, 0x4470696c, 0x61747369, 0x0065636e,
    0x00070006, 0x00000026, 0x00000003, 0x435f6c67, 0x446c6c75, 0x61747369, 0x0065636e, 0x00030005,
    0x00000028, 0x00000000, 0x00040047, 0x00000018, 0x0000000b, 0x0000002a, 0x00040047, 0x0000001d,
    0x0000001e, 0x00000000, 0x00030047, 0x00000026, 0x00000002, 0x00050048, 0x00000026, 0x00000000,
    0x0000000b, 0x00000000, 0x00050048, 0x00000026, 0x00000001, 0x0000000b, 0x00000001, 0x00050048,
    0x00000026, 0x00000002, 0x0000000b, 0x00000003, 0x00050048, 0x00000026, 0x00000003, 0x0000000b,
    0x00000004, 0x00020013, 0x00000002, 0x00030021, 0x00000003, 0x00000002, 0x00030016, 0x00000006,
    0x00000020, 0x00040017, 0x00000007, 0x00000006, 0x00000002, 0x00040015, 0x00000008, 0x00000020,
    0x00000000, 0x0004002b, 0x00000008, 0x00000009, 0x00000003, 0x0004001c, 0x0000000a, 0x00000007,
    0x00000009, 0x00040020, 0x0000000b, 0x00000007, 0x0000000a, 0x0004002b, 0x00000006, 0x0000000d,
    0xbf4ccccd, 0x0005002c, 0x00000007, 0x0000000e, 0x0000000d, 0x0000000d, 0x0004002b, 0x00000006,
    0x0000000f, 0x3f4ccccd, 0x0005002c, 0x00000007, 0x00000010, 0x0000000f, 0x0000000d, 0x0004002b,
    0x00000006, 0x00000011, 0x00000000, 0x0005002c, 0x00000007, 0x00000012, 0x00000011, 0x0000000f,
    0x0006002c, 0x0000000a, 0x00000013, 0x0000000e, 0x00000010, 0x00000012, 0x00040020, 0x00000014,
    0x00000007, 0x00000007, 0x00040015, 0x00000016, 0x00000020, 0x00000001, 0x00040020, 0x00000017,
    0x00000001, 0x00000016, 0x0004003b, 0x00000017, 0x00000018, 0x00000001, 0x00040020, 0x0000001c,
    0x00000003, 0x00000007, 0x0004003b, 0x0000001c, 0x0000001d, 0x00000003, 0x0004002b, 0x00000006,
    0x0000001f, 0x3f000000, 0x00040017, 0x00000023, 0x00000006, 0x00000004, 0x0004002b, 0x00000008,
    0x00000024, 0x00000001, 0x0004001c, 0x00000025, 0x00000006, 0x00000024, 0x0006001e, 0x00000026,
    0x00000023, 0x00000006, 0x00000025, 0x00000025, 0x00040020, 0x00000027, 0x00000003, 0x00000026,
    0x0004003b, 0x00000027, 0x00000028, 0x00000003, 0x0004002b, 0x00000016, 0x00000029, 0x00000000,
    0x0004002b, 0x00000006, 0x0000002b, 0x3f800000, 0x00040020, 0x0000002f, 0x00000003, 0x00000023,
    0x00050036, 0x00000002, 0x00000004, 0x00000000, 0x00000003, 0x000200f8, 0x00000005, 0x0004003b,
    0x0000000b, 0x0000000c, 0x00000007, 0x0004003b, 0x00000014, 0x00000015, 0x00000007, 0x0003003e,
    0x0000000c, 0x00000013, 0x0004003d, 0x00000016, 0x00000019, 0x00000018, 0x00050041, 0x00000014,
    0x0000001a, 0x0000000c, 0x00000019, 0x0004003d, 0x00000007, 0x0000001b, 0x0000001a, 0x0003003e,
    0x00000015, 0x0000001b, 0x0004003d, 0x00000007, 0x0000001e, 0x00000015, 0x0005008e, 0x00000007,
    0x00000020, 0x0000001e, 0x0000001f, 0x00050050, 0x00000007, 0x00000021, 0x0000001f, 0x0000001f,
    0x00050081, 0x00000007, 0x00000022, 0x00000020, 0x00000021, 0x0003003e, 0x0000001d, 0x00000022,
    0x0004003d, 0x00000007, 0x0000002a, 0x00000015, 0x00050051, 0x00000006, 0x0000002c, 0x0000002a,
    0x00000000, 0x00050051, 0x00000006, 0x0000002d, 0x0000002a, 0x00000001, 0x00070050, 0x00000023,
    0x0000002e, 0x0000002c, 0x0000002d, 0x00000011, 0x0000002b, 0x00050041, 0x0000002f, 0x00000030,
    0x00000028, 0x00000029, 0x0003003e, 0x00000030, 0x0000002e, 0x000100fd, 0x00010038,
};

static const uint32_t kTriFragSpv[] = {
    0x07230203, 0x00010000, 0x0008000b, 0x00000018, 0x00000000, 0x00020011, 0x00000001, 0x0006000b,
    0x00000001, 0x4c534c47, 0x6474732e, 0x3035342e, 0x00000000, 0x0003000e, 0x00000000, 0x00000001,
    0x0007000f, 0x00000004, 0x00000004, 0x6e69616d, 0x00000000, 0x00000009, 0x0000000f, 0x00030010,
    0x00000004, 0x00000007, 0x00030003, 0x00000002, 0x000001c2, 0x00040005, 0x00000004, 0x6e69616d,
    0x00000000, 0x00050005, 0x00000009, 0x4374756f, 0x726f6c6f, 0x00000000, 0x00030005, 0x0000000f,
    0x00007675, 0x00040047, 0x00000009, 0x0000001e, 0x00000000, 0x00040047, 0x0000000f, 0x0000001e,
    0x00000000, 0x00020013, 0x00000002, 0x00030021, 0x00000003, 0x00000002, 0x00030016, 0x00000006,
    0x00000020, 0x00040017, 0x00000007, 0x00000006, 0x00000004, 0x00040020, 0x00000008, 0x00000003,
    0x00000007, 0x0004003b, 0x00000008, 0x00000009, 0x00000003, 0x0004002b, 0x00000006, 0x0000000a,
    0x3f800000, 0x0004002b, 0x00000006, 0x0000000b, 0x3f333333, 0x0004002b, 0x00000006, 0x0000000c,
    0x3e99999a, 0x00040017, 0x0000000d, 0x00000006, 0x00000002, 0x00040020, 0x0000000e, 0x00000001,
    0x0000000d, 0x0004003b, 0x0000000e, 0x0000000f, 0x00000001, 0x00040015, 0x00000010, 0x00000020,
    0x00000000, 0x0004002b, 0x00000010, 0x00000011, 0x00000001, 0x00040020, 0x00000012, 0x00000001,
    0x00000006, 0x00050036, 0x00000002, 0x00000004, 0x00000000, 0x00000003, 0x000200f8, 0x00000005,
    0x00050041, 0x00000012, 0x00000013, 0x0000000f, 0x00000011, 0x0004003d, 0x00000006, 0x00000014,
    0x00000013, 0x00050085, 0x00000006, 0x00000015, 0x0000000c, 0x00000014, 0x00050081, 0x00000006,
    0x00000016, 0x0000000b, 0x00000015, 0x00070050, 0x00000007, 0x00000017, 0x0000000a, 0x0000000a,
    0x00000016, 0x0000000a, 0x0003003e, 0x00000009, 0x00000017, 0x000100fd, 0x00010038,
};

// ---- Hand tracking (XR_EXT_hand_tracking) -----------------------------------
// Optional: the sim's operator layer flags sessions where "the application
// never observed" tracking state. Every step is guarded on extension presence
// and successful tracker creation so unsupported runtimes degrade silently.

struct HandTrackers {
  PFN_xrLocateHandJointsEXT locate = nullptr;
  PFN_xrDestroyHandTrackerEXT destroy = nullptr;
  XrHandTrackerEXT left = XR_NULL_HANDLE;
  XrHandTrackerEXT right = XR_NULL_HANDLE;
  bool ok = false;
};

static void handTrackersInit(HandTrackers& ht, XrInstance instance,
                             XrSession session, bool extEnabled) {
  if (!extEnabled) { std::puts("hand_tracking ext: absent"); return; }
  std::puts("hand_tracking ext: enabled");
  auto create = (PFN_xrCreateHandTrackerEXT)xrExt(instance, "xrCreateHandTrackerEXT");
  ht.destroy = (PFN_xrDestroyHandTrackerEXT)xrExt(instance, "xrDestroyHandTrackerEXT");
  ht.locate = (PFN_xrLocateHandJointsEXT)xrExt(instance, "xrLocateHandJointsEXT");
  if (!create || !ht.destroy || !ht.locate) {
    std::puts("hand_tracking: entry points missing");
    return;
  }
  XrHandTrackerCreateInfoEXT ci{XR_TYPE_HAND_TRACKER_CREATE_INFO_EXT};
  ci.handJointSet = XR_HAND_JOINT_SET_DEFAULT_EXT;
  ci.hand = XR_HAND_LEFT_EXT;
  XrResult rl = create(session, &ci, &ht.left);
  ci.hand = XR_HAND_RIGHT_EXT;
  XrResult rr = create(session, &ci, &ht.right);
  ht.ok = XR_SUCCEEDED(rl) || XR_SUCCEEDED(rr);
  std::printf("hand trackers: L=%d R=%d\n", (int)rl, (int)rr);
}

static void handTrackersPoll(const HandTrackers& ht, XrSpace space, XrTime time) {
  if (!ht.ok) return;
  int active[2] = {-1, -1};
  XrHandJointLocationEXT joints[XR_HAND_JOINT_COUNT_EXT];
  XrHandTrackerEXT t[2] = {ht.left, ht.right};
  for (int h = 0; h < 2; ++h) {
    if (t[h] == XR_NULL_HANDLE) continue;
    XrHandJointsLocateInfoEXT li{XR_TYPE_HAND_JOINTS_LOCATE_INFO_EXT};
    li.baseSpace = space;
    li.time = time;
    XrHandJointLocationsEXT loc{XR_TYPE_HAND_JOINT_LOCATIONS_EXT};
    loc.jointCount = XR_HAND_JOINT_COUNT_EXT;
    loc.jointLocations = joints;
    if (XR_SUCCEEDED(ht.locate(t[h], &li, &loc))) active[h] = loc.isActive ? 1 : 0;
  }
  std::printf("hand L active=%d R active=%d\n", active[0], active[1]);
}

static void handTrackersDestroy(HandTrackers& ht) {
  if (ht.destroy) {
    if (ht.left != XR_NULL_HANDLE) ht.destroy(ht.left);
    if (ht.right != XR_NULL_HANDLE) ht.destroy(ht.right);
  }
  ht = HandTrackers{};
}

static int runVulkan() {
  const char* wanted[] = {
      "XR_KHR_vulkan_enable",
      "XR_KHR_vulkan_enable2",
      "XR_EXT_user_presence",
      "XR_EXT_eye_gaze_interaction",
      "XR_EXT_hand_interaction",
      "XR_EXT_hand_tracking",
  };
  uint32_t extCount = 0;
  XR_CHECK(xrEnumerateInstanceExtensionProperties(nullptr, 0, &extCount, nullptr));
  std::vector<XrExtensionProperties> avail(extCount, {XR_TYPE_EXTENSION_PROPERTIES});
  XR_CHECK(xrEnumerateInstanceExtensionProperties(nullptr, extCount, &extCount, avail.data()));
  std::vector<const char*> enabled;
  for (const char* w : wanted) {
    bool found = false;
    for (const auto& p : avail)
      if (std::strcmp(p.extensionName, w) == 0) found = true;
    std::printf("ext %s: %s\n", w, found ? "yes" : "NO");
    if (found) enabled.push_back(w);
  }
  bool handExtEnabled = false, gazeExtPresent = false;
  for (const auto& p : avail)
    if (!std::strcmp(p.extensionName, "XR_EXT_eye_gaze_interaction"))
      gazeExtPresent = true;
  for (auto* e : enabled)
    if (!std::strcmp(e, "XR_EXT_hand_tracking")) handExtEnabled = true;
  std::printf("eye_gaze ext: %s\n", gazeExtPresent ? "present" : "absent");
  XrInstanceCreateInfo createInfo{XR_TYPE_INSTANCE_CREATE_INFO};
  std::strcpy(createInfo.applicationInfo.applicationName, "moyo-xr-probe");
  createInfo.applicationInfo.applicationVersion = 1;
  std::strcpy(createInfo.applicationInfo.engineName, "viro-desktop-probe");
  createInfo.applicationInfo.apiVersion = XR_MAKE_VERSION(1, 1, 0);
  createInfo.enabledExtensionCount = (uint32_t)enabled.size();
  createInfo.enabledExtensionNames = enabled.data();
  XrInstance instance = XR_NULL_HANDLE;
  XR_CHECK(xrCreateInstance(&createInfo, &instance));
  XrInstanceProperties props{XR_TYPE_INSTANCE_PROPERTIES};
  XR_CHECK(xrGetInstanceProperties(instance, &props));
  std::printf("runtime: %s\n", props.runtimeName);
  XrSystemGetInfo sysInfo{XR_TYPE_SYSTEM_GET_INFO};
  sysInfo.formFactor = XR_FORM_FACTOR_HEAD_MOUNTED_DISPLAY;
  XrSystemId system = XR_NULL_SYSTEM_ID;
  XR_CHECK(xrGetSystem(instance, &sysInfo, &system));
  XrSystemProperties sysProps{XR_TYPE_SYSTEM_PROPERTIES};
  XR_CHECK(xrGetSystemProperties(instance, system, &sysProps));
  std::printf("system: %s\n", sysProps.systemName);

  if (!loadVulkan()) return 1;
  std::puts("vulkan loader ok");
  auto pfnVkInstExts = (PFN_xrGetVulkanInstanceExtensionsKHR)
      xrExt(instance, "xrGetVulkanInstanceExtensionsKHR");
  auto pfnVkDevExts = (PFN_xrGetVulkanDeviceExtensionsKHR)
      xrExt(instance, "xrGetVulkanDeviceExtensionsKHR");
  auto pfnVkGfxDev = (PFN_xrGetVulkanGraphicsDeviceKHR)
      xrExt(instance, "xrGetVulkanGraphicsDeviceKHR");
  auto pfnVkGfxReqs = (PFN_xrGetVulkanGraphicsRequirementsKHR)
      xrExt(instance, "xrGetVulkanGraphicsRequirementsKHR");
  auto pfnCreateVkInst = (PFN_xrCreateVulkanInstanceKHR)
      xrExt(instance, "xrCreateVulkanInstanceKHR");
  auto pfnCreateVkDev = (PFN_xrCreateVulkanDeviceKHR)
      xrExt(instance, "xrCreateVulkanDeviceKHR");
  std::printf("vk xr fns: %p %p %p %p create=%p,%p\n", (void*)pfnVkInstExts,
              (void*)pfnVkDevExts, (void*)pfnVkGfxDev, (void*)pfnVkGfxReqs,
              (void*)pfnCreateVkInst, (void*)pfnCreateVkDev);
  if (!pfnVkInstExts || !pfnVkDevExts || !pfnVkGfxDev || !pfnVkGfxReqs ||
      !pfnCreateVkInst || !pfnCreateVkDev) {
    std::fputs("missing XR_KHR_vulkan_enable entry points\n", stderr);
    return 1;
  }
  XrGraphicsRequirementsVulkanKHR vkReqs{XR_TYPE_GRAPHICS_REQUIREMENTS_VULKAN_KHR};
  XR_CHECK(pfnVkGfxReqs(instance, system, &vkReqs));
  std::printf("vk reqs: %llu-%llu\n",
              (unsigned long long)vkReqs.minApiVersionSupported,
              (unsigned long long)vkReqs.maxApiVersionSupported);

  // Instance extensions the runtime requires.
  uint32_t n = 0;
  XR_CHECK(pfnVkInstExts(instance, system, 0, &n, nullptr));
  std::vector<char> buf(n);
  XR_CHECK(pfnVkInstExts(instance, system, n, &n, buf.data()));
  std::vector<const char*> vkInstExts;
  for (char* p = buf.data(); p < buf.data() + n; p += std::strlen(p) + 1)
    vkInstExts.push_back(p);
  std::printf("vk instance exts:");
  for (auto* e : vkInstExts) std::printf(" %s", e);
  std::putchar('\n');

  // Filter runtime-required extensions down to what the driver actually
  // exposes — loader-level extensions (VK_KHR_surface, debug_utils) don't
  // exist when calling MoltenVK directly.
  {
    auto pfnEnumInstExt = (PFN_vkEnumerateInstanceExtensionProperties)
        vkGetInstanceProcAddr(nullptr, "vkEnumerateInstanceExtensionProperties");
    uint32_t ec = 0;
    pfnEnumInstExt(nullptr, &ec, nullptr);
    std::vector<VkExtensionProperties> eps(ec);
    pfnEnumInstExt(nullptr, &ec, eps.data());
    std::vector<const char*> filtered;
    for (auto* e : vkInstExts) {
      for (auto& a : eps)
        if (!std::strcmp(e, a.extensionName)) { filtered.push_back(e); break; }
    }
    vkInstExts = filtered;
    std::printf("vk filtered inst exts:");
    for (auto* e : vkInstExts) std::printf(" %s", e);
    std::putchar('\n');
  }

  VkApplicationInfo appInfo{VK_STRUCTURE_TYPE_APPLICATION_INFO};
  appInfo.apiVersion = VK_API_VERSION_1_1;
  VkInstanceCreateInfo vici{VK_STRUCTURE_TYPE_INSTANCE_CREATE_INFO};
  vici.pApplicationInfo = &appInfo;

  {
    VkInstanceCreateInfo bare = vici;  // zero extensions — isolates ICD health
    VkInstance bareInst = VK_NULL_HANDLE;
    VkResult br = vkCreateInstance(&bare, nullptr, &bareInst);
    std::printf("bare vkCreateInstance: %d (inst=%p)\n", (int)br, (void*)bareInst);
  }

  vici.enabledExtensionCount = (uint32_t)vkInstExts.size();
  vici.ppEnabledExtensionNames = vkInstExts.data();
  vici.flags = VK_INSTANCE_CREATE_ENUMERATE_PORTABILITY_BIT_KHR;

  XrVulkanInstanceCreateInfoKHR xrvi{XR_TYPE_VULKAN_INSTANCE_CREATE_INFO_KHR};
  xrvi.systemId = system;
  xrvi.pfnGetInstanceProcAddr = vkGetInstanceProcAddr;
  xrvi.vulkanCreateInfo = &vici;
  VkInstance vkInst = VK_NULL_HANDLE;
  VkResult vres = VK_SUCCESS;
  XR_CHECK(pfnCreateVkInst(instance, &xrvi, &vkInst, &vres));
  if (vres != VK_SUCCESS) { std::fprintf(stderr, "vkCreateInstance: %d\n", (int)vres); return 1; }
  std::puts("vk instance created");
  // Instance-scoped functions resolve only once an instance exists.
  vkEnumeratePhysicalDevices = (PFN_vkEnumeratePhysicalDevices)vkGetInstanceProcAddr(vkInst, "vkEnumeratePhysicalDevices");
  vkGetPhysicalDeviceQueueFamilyProperties = (PFN_vkGetPhysicalDeviceQueueFamilyProperties)vkGetInstanceProcAddr(vkInst, "vkGetPhysicalDeviceQueueFamilyProperties");
  vkGetPhysicalDeviceMemoryProperties = (PFN_vkGetPhysicalDeviceMemoryProperties)vkGetInstanceProcAddr(vkInst, "vkGetPhysicalDeviceMemoryProperties");
  vkGetDeviceProcAddr = (PFN_vkGetDeviceProcAddr)vkGetInstanceProcAddr(vkInst, "vkGetDeviceProcAddr");
  vkCreateDevice = (PFN_vkCreateDevice)vkGetInstanceProcAddr(vkInst, "vkCreateDevice");
  if (!vkEnumeratePhysicalDevices || !vkGetPhysicalDeviceQueueFamilyProperties || !vkGetDeviceProcAddr || !vkCreateDevice) {
    std::fputs("instance-level vk fns missing\n", stderr);
    return 1;
  }

  VkPhysicalDevice phys = VK_NULL_HANDLE;
  XR_CHECK(pfnVkGfxDev(instance, system, vkInst, &phys));

  uint32_t devExtLen = 0;
  XR_CHECK(pfnVkDevExts(instance, system, 0, &devExtLen, nullptr));
  std::vector<char> dbuf(devExtLen);
  XR_CHECK(pfnVkDevExts(instance, system, devExtLen, &devExtLen, dbuf.data()));
  std::vector<const char*> vkDevExts;
  for (char* p = dbuf.data(); p < dbuf.data() + devExtLen; p += std::strlen(p) + 1)
    vkDevExts.push_back(p);
  std::printf("vk dev exts required:");
  for (auto* e : vkDevExts) std::printf(" %s", e);
  std::putchar('\n');
  {
    auto pfnEnumDevExt = (PFN_vkEnumerateDeviceExtensionProperties)
        vkGetInstanceProcAddr(vkInst, "vkEnumerateDeviceExtensionProperties");
    uint32_t dc = 0;
    pfnEnumDevExt(phys, nullptr, &dc, nullptr);
    std::vector<VkExtensionProperties> dps(dc);
    pfnEnumDevExt(phys, nullptr, &dc, dps.data());
    std::vector<const char*> filtered;
    for (auto* e : vkDevExts)
      for (auto& a : dps)
        if (!std::strcmp(e, a.extensionName)) { filtered.push_back(e); break; }
    vkDevExts = filtered;
    std::printf("vk filtered dev exts:");
    for (auto* e : vkDevExts) std::printf(" %s", e);
    std::putchar('\n');
  }

  uint32_t qfCount = 0;
  vkGetPhysicalDeviceQueueFamilyProperties(phys, &qfCount, nullptr);
  std::vector<VkQueueFamilyProperties> qfs(qfCount);
  vkGetPhysicalDeviceQueueFamilyProperties(phys, &qfCount, qfs.data());
  uint32_t qf = UINT32_MAX;
  for (uint32_t i = 0; i < qfCount; ++i)
    if (qfs[i].queueFlags & VK_QUEUE_GRAPHICS_BIT) { qf = i; break; }
  if (qf == UINT32_MAX) { std::fputs("no graphics queue\n", stderr); return 1; }

  float prio = 1.0f;
  VkDeviceQueueCreateInfo qci{VK_STRUCTURE_TYPE_DEVICE_QUEUE_CREATE_INFO};
  qci.queueFamilyIndex = qf;
  qci.queueCount = 1;
  qci.pQueuePriorities = &prio;
  VkDeviceCreateInfo dci{VK_STRUCTURE_TYPE_DEVICE_CREATE_INFO};
  dci.queueCreateInfoCount = 1;
  dci.pQueueCreateInfos = &qci;
  dci.enabledExtensionCount = (uint32_t)vkDevExts.size();
  dci.ppEnabledExtensionNames = vkDevExts.data();

  std::printf("creating device on qf %u\n", qf);
  XrVulkanDeviceCreateInfoKHR xrvd{XR_TYPE_VULKAN_DEVICE_CREATE_INFO_KHR};
  xrvd.systemId = system;
  xrvd.pfnGetInstanceProcAddr = vkGetInstanceProcAddr;
  xrvd.vulkanPhysicalDevice = phys;
  xrvd.vulkanCreateInfo = &dci;
  VkDevice vkDev = VK_NULL_HANDLE;
  XR_CHECK(pfnCreateVkDev(instance, &xrvd, &vkDev, &vres));
  if (vres != VK_SUCCESS) { std::fprintf(stderr, "vkCreateDevice: %d\n", (int)vres); return 1; }
  std::puts("vk device created");
  loadDeviceFns(vkDev);
  VkQueue vkQueue = VK_NULL_HANDLE;
  vkGetDeviceQueue(vkDev, qf, 0, &vkQueue);

  XrGraphicsBindingVulkanKHR gb{XR_TYPE_GRAPHICS_BINDING_VULKAN_KHR};
  gb.instance = vkInst;
  gb.physicalDevice = phys;
  gb.device = vkDev;
  gb.queueFamilyIndex = qf;
  gb.queueIndex = 0;
  XrSessionCreateInfo sessionInfo{XR_TYPE_SESSION_CREATE_INFO};
  sessionInfo.systemId = system;
  sessionInfo.next = &gb;
  XrSession session = XR_NULL_HANDLE;
  XR_CHECK(xrCreateSession(instance, &sessionInfo, &session));
  std::puts("session created (Vulkan-bound)");

  HandTrackers hands;
  handTrackersInit(hands, instance, session, handExtEnabled);

  uint32_t bmCount = 0;
  XR_CHECK(xrEnumerateEnvironmentBlendModes(instance, system,
      XR_VIEW_CONFIGURATION_TYPE_PRIMARY_STEREO, 0, &bmCount, nullptr));
  std::vector<XrEnvironmentBlendMode> blendModes(bmCount);
  XR_CHECK(xrEnumerateEnvironmentBlendModes(instance, system,
      XR_VIEW_CONFIGURATION_TYPE_PRIMARY_STEREO, bmCount, &bmCount, blendModes.data()));
  // Use the runtime's preferred blend mode (blendModes[0]) — on a see-through
  // glasses profile that is ADDITIVE, and forcing OPAQUE may discard pixels.
  XrEnvironmentBlendMode blendMode = blendModes.empty()
      ? XR_ENVIRONMENT_BLEND_MODE_OPAQUE : blendModes[0];
  std::printf("vk blend modes:");
  for (auto b : blendModes) std::printf(" %d", (int)b);
  std::printf(" -> using %d\n", (int)blendMode);

  uint32_t viewCount = 0;
  XR_CHECK(xrEnumerateViewConfigurationViews(instance, system,
      XR_VIEW_CONFIGURATION_TYPE_PRIMARY_STEREO, 0, &viewCount, nullptr));
  std::vector<XrViewConfigurationView> views(viewCount, {XR_TYPE_VIEW_CONFIGURATION_VIEW});
  XR_CHECK(xrEnumerateViewConfigurationViews(instance, system,
      XR_VIEW_CONFIGURATION_TYPE_PRIMARY_STEREO, viewCount, &viewCount, views.data()));

  uint32_t fmtCount = 0;
  XR_CHECK(xrEnumerateSwapchainFormats(session, 0, &fmtCount, nullptr));
  std::vector<int64_t> formats(fmtCount);
  XR_CHECK(xrEnumerateSwapchainFormats(session, fmtCount, &fmtCount, formats.data()));
  std::printf("vk swapchain formats:");
  for (int64_t f : formats) std::printf(" %lld", (long long)f);
  std::putchar('\n');

  XrSwapchainCreateInfo scInfo{XR_TYPE_SWAPCHAIN_CREATE_INFO};
  scInfo.format = formats[0];
  scInfo.width = views[0].recommendedImageRectWidth;
  scInfo.height = views[0].recommendedImageRectHeight;
  scInfo.arraySize = 1;
  scInfo.mipCount = 1;
  scInfo.faceCount = 1;
  scInfo.sampleCount = views[0].recommendedSwapchainSampleCount;
  scInfo.usageFlags = XR_SWAPCHAIN_USAGE_COLOR_ATTACHMENT_BIT |
                      XR_SWAPCHAIN_USAGE_TRANSFER_DST_BIT;
  XrSwapchain swapchain = XR_NULL_HANDLE;
  XR_CHECK(xrCreateSwapchain(session, &scInfo, &swapchain));
  uint32_t imgCount = 0;
  XR_CHECK(xrEnumerateSwapchainImages(swapchain, 0, &imgCount, nullptr));
  std::vector<XrSwapchainImageVulkanKHR> vkImages(imgCount, {XR_TYPE_SWAPCHAIN_IMAGE_VULKAN_KHR});
  XR_CHECK(xrEnumerateSwapchainImages(swapchain, imgCount, &imgCount,
      (XrSwapchainImageBaseHeader*)vkImages.data()));
  std::printf("vk swapchain: %ux%u x%u\n", scInfo.width, scInfo.height, imgCount);

  VkCommandPoolCreateInfo cpci{VK_STRUCTURE_TYPE_COMMAND_POOL_CREATE_INFO};
  cpci.queueFamilyIndex = qf;
  VkCommandPool cmdPool = VK_NULL_HANDLE;
  vkCreateCommandPool(vkDev, &cpci, nullptr, &cmdPool);
  VkCommandBufferAllocateInfo cbai{VK_STRUCTURE_TYPE_COMMAND_BUFFER_ALLOCATE_INFO};
  cbai.commandPool = cmdPool;
  cbai.level = VK_COMMAND_BUFFER_LEVEL_PRIMARY;
  cbai.commandBufferCount = 1;
  VkCommandBuffer cmdBuf = VK_NULL_HANDLE;
  vkAllocateCommandBuffers(vkDev, &cbai, &cmdBuf);

  // Triangle pipeline over the swapchain format. The render pass uses
  // loadOp=LOAD so the magenta vkCmdClearColorImage remains visible outside
  // the triangle — "clear landed but draw didn't" stays distinguishable.
  VkRenderPass vkRp = VK_NULL_HANDLE;
  VkPipelineLayout vkPl = VK_NULL_HANDLE;
  VkPipeline vkPipe = VK_NULL_HANDLE;
  std::vector<VkImageView> vkViews(imgCount, VK_NULL_HANDLE);
  std::vector<VkFramebuffer> vkFbs(imgCount, VK_NULL_HANDLE);
  bool vkPipeOK = false;
  {
    VkShaderModule vert = VK_NULL_HANDLE, frag = VK_NULL_HANDLE;
    VkShaderModuleCreateInfo smci{VK_STRUCTURE_TYPE_SHADER_MODULE_CREATE_INFO};
    smci.codeSize = sizeof(kTriVertSpv);
    smci.pCode = kTriVertSpv;
    VkResult r1 = vkCreateShaderModule(vkDev, &smci, nullptr, &vert);
    smci.codeSize = sizeof(kTriFragSpv);
    smci.pCode = kTriFragSpv;
    VkResult r2 = vkCreateShaderModule(vkDev, &smci, nullptr, &frag);

    VkAttachmentDescription att{};
    att.format = (VkFormat)scInfo.format;
    att.samples = (VkSampleCountFlagBits)scInfo.sampleCount;
    att.loadOp = VK_ATTACHMENT_LOAD_OP_LOAD;
    att.storeOp = VK_ATTACHMENT_STORE_OP_STORE;
    att.stencilLoadOp = VK_ATTACHMENT_LOAD_OP_DONT_CARE;
    att.stencilStoreOp = VK_ATTACHMENT_STORE_OP_DONT_CARE;
    att.initialLayout = VK_IMAGE_LAYOUT_COLOR_ATTACHMENT_OPTIMAL;
    att.finalLayout = VK_IMAGE_LAYOUT_COLOR_ATTACHMENT_OPTIMAL;
    VkAttachmentReference attRef{0, VK_IMAGE_LAYOUT_COLOR_ATTACHMENT_OPTIMAL};
    VkSubpassDescription sub{};
    sub.pipelineBindPoint = VK_PIPELINE_BIND_POINT_GRAPHICS;
    sub.colorAttachmentCount = 1;
    sub.pColorAttachments = &attRef;
    VkSubpassDependency dep{};
    dep.srcSubpass = VK_SUBPASS_EXTERNAL;
    dep.dstSubpass = 0;
    dep.srcStageMask = VK_PIPELINE_STAGE_COLOR_ATTACHMENT_OUTPUT_BIT;
    dep.dstStageMask = VK_PIPELINE_STAGE_COLOR_ATTACHMENT_OUTPUT_BIT;
    dep.srcAccessMask = VK_ACCESS_COLOR_ATTACHMENT_WRITE_BIT;
    dep.dstAccessMask = VK_ACCESS_COLOR_ATTACHMENT_READ_BIT |
                        VK_ACCESS_COLOR_ATTACHMENT_WRITE_BIT;
    VkRenderPassCreateInfo rpci{VK_STRUCTURE_TYPE_RENDER_PASS_CREATE_INFO};
    rpci.attachmentCount = 1;
    rpci.pAttachments = &att;
    rpci.subpassCount = 1;
    rpci.pSubpasses = &sub;
    rpci.dependencyCount = 1;
    rpci.pDependencies = &dep;
    VkResult r3 = vkCreateRenderPass(vkDev, &rpci, nullptr, &vkRp);

    VkResult r4 = VK_SUCCESS;
    for (uint32_t v = 0; v < imgCount && r4 == VK_SUCCESS; ++v) {
      VkImageViewCreateInfo ivci{VK_STRUCTURE_TYPE_IMAGE_VIEW_CREATE_INFO};
      ivci.image = vkImages[v].image;
      ivci.viewType = VK_IMAGE_VIEW_TYPE_2D;
      ivci.format = (VkFormat)scInfo.format;
      ivci.subresourceRange = {VK_IMAGE_ASPECT_COLOR_BIT, 0, 1, 0, 1};
      r4 = vkCreateImageView(vkDev, &ivci, nullptr, &vkViews[v]);
      if (r4 != VK_SUCCESS) break;
      VkFramebufferCreateInfo fbci{VK_STRUCTURE_TYPE_FRAMEBUFFER_CREATE_INFO};
      fbci.renderPass = vkRp;
      fbci.attachmentCount = 1;
      fbci.pAttachments = &vkViews[v];
      fbci.width = scInfo.width;
      fbci.height = scInfo.height;
      fbci.layers = 1;
      r4 = vkCreateFramebuffer(vkDev, &fbci, nullptr, &vkFbs[v]);
    }

    VkPipelineLayoutCreateInfo plci{VK_STRUCTURE_TYPE_PIPELINE_LAYOUT_CREATE_INFO};
    VkResult r5 = vkCreatePipelineLayout(vkDev, &plci, nullptr, &vkPl);

    VkPipelineShaderStageCreateInfo stages[2]{};
    stages[0].sType = VK_STRUCTURE_TYPE_PIPELINE_SHADER_STAGE_CREATE_INFO;
    stages[0].stage = VK_SHADER_STAGE_VERTEX_BIT;
    stages[0].module = vert;
    stages[0].pName = "main";
    stages[1].sType = VK_STRUCTURE_TYPE_PIPELINE_SHADER_STAGE_CREATE_INFO;
    stages[1].stage = VK_SHADER_STAGE_FRAGMENT_BIT;
    stages[1].module = frag;
    stages[1].pName = "main";
    VkPipelineVertexInputStateCreateInfo vi{VK_STRUCTURE_TYPE_PIPELINE_VERTEX_INPUT_STATE_CREATE_INFO};
    VkPipelineInputAssemblyStateCreateInfo ia{VK_STRUCTURE_TYPE_PIPELINE_INPUT_ASSEMBLY_STATE_CREATE_INFO};
    ia.topology = VK_PRIMITIVE_TOPOLOGY_TRIANGLE_LIST;
    VkViewport viewport{0.f, 0.f, (float)scInfo.width, (float)scInfo.height, 0.f, 1.f};
    VkRect2D scissor{{0, 0}, {scInfo.width, scInfo.height}};
    VkPipelineViewportStateCreateInfo vp{VK_STRUCTURE_TYPE_PIPELINE_VIEWPORT_STATE_CREATE_INFO};
    vp.viewportCount = 1;
    vp.pViewports = &viewport;
    vp.scissorCount = 1;
    vp.pScissors = &scissor;
    VkPipelineRasterizationStateCreateInfo rs{VK_STRUCTURE_TYPE_PIPELINE_RASTERIZATION_STATE_CREATE_INFO};
    rs.polygonMode = VK_POLYGON_MODE_FILL;
    rs.cullMode = VK_CULL_MODE_NONE;
    rs.lineWidth = 1.f;
    VkPipelineMultisampleStateCreateInfo ms{VK_STRUCTURE_TYPE_PIPELINE_MULTISAMPLE_STATE_CREATE_INFO};
    ms.rasterizationSamples = (VkSampleCountFlagBits)scInfo.sampleCount;
    VkPipelineColorBlendAttachmentState cba{};
    cba.colorWriteMask = VK_COLOR_COMPONENT_R_BIT | VK_COLOR_COMPONENT_G_BIT |
                         VK_COLOR_COMPONENT_B_BIT | VK_COLOR_COMPONENT_A_BIT;
    VkPipelineColorBlendStateCreateInfo cb{VK_STRUCTURE_TYPE_PIPELINE_COLOR_BLEND_STATE_CREATE_INFO};
    cb.attachmentCount = 1;
    cb.pAttachments = &cba;
    VkGraphicsPipelineCreateInfo gpci{VK_STRUCTURE_TYPE_GRAPHICS_PIPELINE_CREATE_INFO};
    gpci.stageCount = 2;
    gpci.pStages = stages;
    gpci.pVertexInputState = &vi;
    gpci.pInputAssemblyState = &ia;
    gpci.pViewportState = &vp;
    gpci.pRasterizationState = &rs;
    gpci.pMultisampleState = &ms;
    gpci.pColorBlendState = &cb;
    gpci.layout = vkPl;
    gpci.renderPass = vkRp;
    VkResult r6 = vkCreateGraphicsPipelines(vkDev, VK_NULL_HANDLE, 1, &gpci,
                                          nullptr, &vkPipe);

    vkPipeOK = r1 == VK_SUCCESS && r2 == VK_SUCCESS && r3 == VK_SUCCESS &&
               r4 == VK_SUCCESS && r5 == VK_SUCCESS && r6 == VK_SUCCESS;
    std::printf("vk pipeline setup: shaders=%d,%d rp=%d views/fbs=%d layout=%d "
                "pipe=%d -> %s\n", (int)r1, (int)r2, (int)r3, (int)r4, (int)r5,
                (int)r6, vkPipeOK ? "ok" : "FAILED");
    if (vert != VK_NULL_HANDLE) vkDestroyShaderModule(vkDev, vert, nullptr);
    if (frag != VK_NULL_HANDLE) vkDestroyShaderModule(vkDev, frag, nullptr);
  }

  std::vector<XrCompositionLayerProjectionView> pvViews(viewCount,
      {XR_TYPE_COMPOSITION_LAYER_PROJECTION_VIEW});
  for (uint32_t v = 0; v < viewCount; ++v) {
    pvViews[v].subImage.swapchain = swapchain;
    pvViews[v].subImage.imageRect = {{0, 0}, {(int32_t)scInfo.width, (int32_t)scInfo.height}};
    pvViews[v].subImage.imageArrayIndex = 0;
    pvViews[v].pose.orientation = {0, 0, 0, 1};
    pvViews[v].fov = {-1.f, 1.f, 1.f, -1.f};
  }
  XrReferenceSpaceCreateInfo refSpace{XR_TYPE_REFERENCE_SPACE_CREATE_INFO};
  refSpace.referenceSpaceType = XR_REFERENCE_SPACE_TYPE_LOCAL;
  refSpace.poseInReferenceSpace.orientation = {0, 0, 0, 1};
  XrSpace space = XR_NULL_HANDLE;
  XR_CHECK(xrCreateReferenceSpace(session, &refSpace, &space));
  XrCompositionLayerProjection proj{XR_TYPE_COMPOSITION_LAYER_PROJECTION};
  proj.space = space;
  proj.viewCount = viewCount;
  proj.views = pvViews.data();
  XrCompositionLayerBaseHeader* layers[] = {(XrCompositionLayerBaseHeader*)&proj};
  std::vector<XrView> locatedViews(viewCount, {XR_TYPE_VIEW});

  XrSessionBeginInfo beginInfo{XR_TYPE_SESSION_BEGIN_INFO};
  beginInfo.primaryViewConfigurationType = XR_VIEW_CONFIGURATION_TYPE_PRIMARY_STEREO;
  bool running = false, frameRendered = false;
  int frames = 0;
  int frameBudget = 900;
  if (const char* fb = getenv("XR_PROBE_FRAMES")) frameBudget = atoi(fb);
  for (int i = 0; i < 10000 && !frameRendered; ++i) {
    XrEventDataBuffer ev{XR_TYPE_EVENT_DATA_BUFFER};
    while (xrPollEvent(instance, &ev) == XR_SUCCESS) {
      if (ev.type == XR_TYPE_EVENT_DATA_SESSION_STATE_CHANGED) {
        auto* sc = (XrEventDataSessionStateChanged*)&ev;
        std::printf("session state -> %d\n", (int)sc->state);
        if (sc->state == XR_SESSION_STATE_READY && !running) {
          XR_CHECK(xrBeginSession(session, &beginInfo));
          running = true;
        } else if (sc->state == XR_SESSION_STATE_EXITING ||
                   sc->state == XR_SESSION_STATE_LOSS_PENDING) {
          i = 10000;
        }
      }
      ev = XrEventDataBuffer{XR_TYPE_EVENT_DATA_BUFFER};
    }
    @autoreleasepool {
      NSEvent* nsev = nil;
      while ((nsev = [NSApp nextEventMatchingMask:NSEventMaskAny
                     untilDate:[NSDate distantPast]
                     inMode:NSDefaultRunLoopMode dequeue:YES])) {
        [NSApp sendEvent:nsev];
      }
      [NSApp updateWindows];
    }
    if (!running) { usleep(1000); continue; }
    XrFrameWaitInfo waitInfo{XR_TYPE_FRAME_WAIT_INFO};
    XrFrameState frameState{XR_TYPE_FRAME_STATE};
    if (XR_FAILED(xrWaitFrame(session, &waitInfo, &frameState))) { usleep(1000); continue; }
    XrFrameBeginInfo bi{XR_TYPE_FRAME_BEGIN_INFO};
    xrBeginFrame(session, &bi);
    XrFrameEndInfo ei{XR_TYPE_FRAME_END_INFO};
    ei.displayTime = frameState.predictedDisplayTime;
    ei.environmentBlendMode = blendMode;
    if (frameState.shouldRender) {
      XrViewLocateInfo vli{XR_TYPE_VIEW_LOCATE_INFO};
      vli.viewConfigurationType = XR_VIEW_CONFIGURATION_TYPE_PRIMARY_STEREO;
      vli.displayTime = frameState.predictedDisplayTime;
      vli.space = space;
      XrViewState vs{XR_TYPE_VIEW_STATE};
      uint32_t located = viewCount;
      if (XR_SUCCEEDED(xrLocateViews(session, &vli, &vs, viewCount, &located,
                                     locatedViews.data()))) {
        for (uint32_t v = 0; v < located && v < viewCount; ++v) {
          pvViews[v].pose = locatedViews[v].pose;
          pvViews[v].fov = locatedViews[v].fov;
        }
      }
      if (frames % 60 == 0)
        handTrackersPoll(hands, space, frameState.predictedDisplayTime);
      uint32_t imgIndex = 0;
      XrSwapchainImageAcquireInfo ai{XR_TYPE_SWAPCHAIN_IMAGE_ACQUIRE_INFO};
      if (XR_SUCCEEDED(xrAcquireSwapchainImage(swapchain, &ai, &imgIndex))) {
        XrSwapchainImageWaitInfo wi{XR_TYPE_SWAPCHAIN_IMAGE_WAIT_INFO};
        wi.timeout = 1000000000;
        if (XR_SUCCEEDED(xrWaitSwapchainImage(swapchain, &wi))) {
          VkImage img = vkImages[imgIndex].image;
          VkCommandBufferBeginInfo cbbi{VK_STRUCTURE_TYPE_COMMAND_BUFFER_BEGIN_INFO};
          vkBeginCommandBuffer(cmdBuf, &cbbi);
          VkImageMemoryBarrier bar{VK_STRUCTURE_TYPE_IMAGE_MEMORY_BARRIER};
          bar.srcQueueFamilyIndex = VK_QUEUE_FAMILY_IGNORED;
          bar.dstQueueFamilyIndex = VK_QUEUE_FAMILY_IGNORED;
          bar.image = img;
          bar.subresourceRange = {VK_IMAGE_ASPECT_COLOR_BIT, 0, 1, 0, 1};
          bar.oldLayout = VK_IMAGE_LAYOUT_UNDEFINED;
          bar.newLayout = VK_IMAGE_LAYOUT_TRANSFER_DST_OPTIMAL;
          bar.srcAccessMask = 0;
          bar.dstAccessMask = VK_ACCESS_TRANSFER_WRITE_BIT;
          vkCmdPipelineBarrier(cmdBuf, VK_PIPELINE_STAGE_TOP_OF_PIPE_BIT,
              VK_PIPELINE_STAGE_TRANSFER_BIT, 0, 0, nullptr, 0, nullptr, 1, &bar);
          VkClearColorValue magenta{{1.f, 0.f, 1.f, 1.f}};
          VkImageSubresourceRange range{VK_IMAGE_ASPECT_COLOR_BIT, 0, 1, 0, 1};
          vkCmdClearColorImage(cmdBuf, img, VK_IMAGE_LAYOUT_TRANSFER_DST_OPTIMAL,
                               &magenta, 1, &range);
          bar.oldLayout = VK_IMAGE_LAYOUT_TRANSFER_DST_OPTIMAL;
          bar.newLayout = VK_IMAGE_LAYOUT_COLOR_ATTACHMENT_OPTIMAL;
          bar.srcAccessMask = VK_ACCESS_TRANSFER_WRITE_BIT;
          bar.dstAccessMask = VK_ACCESS_COLOR_ATTACHMENT_READ_BIT |
                              VK_ACCESS_COLOR_ATTACHMENT_WRITE_BIT;
          vkCmdPipelineBarrier(cmdBuf, VK_PIPELINE_STAGE_TRANSFER_BIT,
              VK_PIPELINE_STAGE_COLOR_ATTACHMENT_OUTPUT_BIT, 0, 0, nullptr,
              0, nullptr, 1, &bar);
          if (vkPipeOK) {
            VkRenderPassBeginInfo rpbi{VK_STRUCTURE_TYPE_RENDER_PASS_BEGIN_INFO};
            rpbi.renderPass = vkRp;
            rpbi.framebuffer = vkFbs[imgIndex];
            rpbi.renderArea = {{0, 0}, {scInfo.width, scInfo.height}};
            vkCmdBeginRenderPass(cmdBuf, &rpbi, VK_SUBPASS_CONTENTS_INLINE);
            vkCmdBindPipeline(cmdBuf, VK_PIPELINE_BIND_POINT_GRAPHICS, vkPipe);
            vkCmdDraw(cmdBuf, 3, 1, 0, 0);
            vkCmdEndRenderPass(cmdBuf);
          }
          vkEndCommandBuffer(cmdBuf);
          VkSubmitInfo si{VK_STRUCTURE_TYPE_SUBMIT_INFO};
          si.commandBufferCount = 1;
          si.pCommandBuffers = &cmdBuf;
          vkQueueSubmit(vkQueue, 1, &si, VK_NULL_HANDLE);
          vkQueueWaitIdle(vkQueue);
          static bool drewLogged = false;
          if (vkPipeOK && !drewLogged) {
            drewLogged = true;
            std::puts("vk pipeline: drew triangle");
          }

          // One-time readback: prove the clear actually wrote into the
          // swapchain image (Gate A). A silent no-op here (e.g. missing
          // TRANSFER_DST usage) would make every downstream check misleading.
          static bool verified = false;
          if (!verified) {
            verified = true;
            VkDeviceSize sz = (VkDeviceSize)scInfo.width * scInfo.height * 4;
            VkBufferCreateInfo bci{VK_STRUCTURE_TYPE_BUFFER_CREATE_INFO};
            bci.size = sz;
            bci.usage = VK_BUFFER_USAGE_TRANSFER_DST_BIT;
            VkBuffer buf = VK_NULL_HANDLE;
            if (vkCreateBuffer(vkDev, &bci, nullptr, &buf) == VK_SUCCESS) {
              VkMemoryRequirements mr{};
              vkGetBufferMemoryRequirements(vkDev, buf, &mr);
              VkPhysicalDeviceMemoryProperties mp{};
              vkGetPhysicalDeviceMemoryProperties(phys, &mp);
              uint32_t memType = UINT32_MAX;
              for (uint32_t i = 0; i < mp.memoryTypeCount; ++i)
                if ((mr.memoryTypeBits & (1u << i)) &&
                    (mp.memoryTypes[i].propertyFlags &
                     (VK_MEMORY_PROPERTY_HOST_VISIBLE_BIT | VK_MEMORY_PROPERTY_HOST_COHERENT_BIT)) ==
                        (VK_MEMORY_PROPERTY_HOST_VISIBLE_BIT | VK_MEMORY_PROPERTY_HOST_COHERENT_BIT)) {
                  memType = i;
                  break;
                }
              VkMemoryAllocateInfo mai{VK_STRUCTURE_TYPE_MEMORY_ALLOCATE_INFO};
              mai.allocationSize = mr.size;
              mai.memoryTypeIndex = memType;
              VkDeviceMemory mem = VK_NULL_HANDLE;
              if (memType != UINT32_MAX &&
                  vkAllocateMemory(vkDev, &mai, nullptr, &mem) == VK_SUCCESS &&
                  vkBindBufferMemory(vkDev, buf, mem, 0) == VK_SUCCESS) {
                VkCommandBufferBeginInfo c2{VK_STRUCTURE_TYPE_COMMAND_BUFFER_BEGIN_INFO};
                vkBeginCommandBuffer(cmdBuf, &c2);
                VkImageMemoryBarrier rb{VK_STRUCTURE_TYPE_IMAGE_MEMORY_BARRIER};
                rb.srcQueueFamilyIndex = VK_QUEUE_FAMILY_IGNORED;
                rb.dstQueueFamilyIndex = VK_QUEUE_FAMILY_IGNORED;
                rb.image = img;
                rb.subresourceRange = {VK_IMAGE_ASPECT_COLOR_BIT, 0, 1, 0, 1};
                rb.oldLayout = VK_IMAGE_LAYOUT_COLOR_ATTACHMENT_OPTIMAL;
                rb.newLayout = VK_IMAGE_LAYOUT_TRANSFER_SRC_OPTIMAL;
                rb.srcAccessMask = VK_ACCESS_COLOR_ATTACHMENT_READ_BIT;
                rb.dstAccessMask = VK_ACCESS_TRANSFER_READ_BIT;
                vkCmdPipelineBarrier(cmdBuf, VK_PIPELINE_STAGE_COLOR_ATTACHMENT_OUTPUT_BIT,
                    VK_PIPELINE_STAGE_TRANSFER_BIT, 0, 0, nullptr, 0, nullptr, 1, &rb);
                VkBufferImageCopy region{};
                region.imageSubresource = {VK_IMAGE_ASPECT_COLOR_BIT, 0, 0, 1};
                region.imageExtent = {scInfo.width, scInfo.height, 1};
                vkCmdCopyImageToBuffer(cmdBuf, img, VK_IMAGE_LAYOUT_TRANSFER_SRC_OPTIMAL,
                                       buf, 1, &region);
                rb.oldLayout = VK_IMAGE_LAYOUT_TRANSFER_SRC_OPTIMAL;
                rb.newLayout = VK_IMAGE_LAYOUT_COLOR_ATTACHMENT_OPTIMAL;
                rb.srcAccessMask = VK_ACCESS_TRANSFER_READ_BIT;
                rb.dstAccessMask = VK_ACCESS_COLOR_ATTACHMENT_READ_BIT;
                vkCmdPipelineBarrier(cmdBuf, VK_PIPELINE_STAGE_TRANSFER_BIT,
                    VK_PIPELINE_STAGE_COLOR_ATTACHMENT_OUTPUT_BIT, 0, 0, nullptr,
                    0, nullptr, 1, &rb);
                vkEndCommandBuffer(cmdBuf);
                vkQueueSubmit(vkQueue, 1, &si, VK_NULL_HANDLE);
                vkQueueWaitIdle(vkQueue);
                void* mapped = nullptr;
                if (vkMapMemory(vkDev, mem, 0, sz, 0, &mapped) == VK_SUCCESS) {
                  const uint8_t* px = (const uint8_t*)mapped;
                  size_t center = ((size_t)scInfo.height / 2 * scInfo.width + scInfo.width / 2) * 4;
                  std::printf("vk readback center pixel = %02x %02x %02x %02x (fmt %lld)\n",
                              px[center], px[center + 1], px[center + 2], px[center + 3],
                              (long long)scInfo.format);
                  vkUnmapMemory(vkDev, mem);
                }
              }
            }
          }
        }
        XrSwapchainImageReleaseInfo ri{XR_TYPE_SWAPCHAIN_IMAGE_RELEASE_INFO};
        xrReleaseSwapchainImage(swapchain, &ri);
      }
      ei.layerCount = 1;
      ei.layers = layers;
      if (++frames >= frameBudget) frameRendered = true;
    }
    XrResult er = xrEndFrame(session, &ei);
    if (XR_FAILED(er)) {
      static int erLogs = 0;
      if (++erLogs <= 5) std::printf("xrEndFrame failed: %d\n", (int)er);
    }
  }

  if (!frameRendered) {
    std::fputs("session never reached RUNNING\n", stderr);
    handTrackersDestroy(hands);
    xrDestroySwapchain(swapchain);
    xrDestroySession(session);
    xrDestroyInstance(instance);
    return 1;
  }
  std::puts("reached RUNNING, submitted vulkan frames");
  xrRequestExitSession(session);
  for (int i = 0; i < 200; ++i) {
    XrEventDataBuffer ev{XR_TYPE_EVENT_DATA_BUFFER};
    bool ended = false;
    while (xrPollEvent(instance, &ev) == XR_SUCCESS) {
      if (ev.type == XR_TYPE_EVENT_DATA_SESSION_STATE_CHANGED) {
        auto* sc = (XrEventDataSessionStateChanged*)&ev;
        std::printf("session state -> %d\n", (int)sc->state);
        if (sc->state == XR_SESSION_STATE_STOPPING) xrEndSession(session);
        if (sc->state == XR_SESSION_STATE_EXITING) ended = true;
      }
      ev = XrEventDataBuffer{XR_TYPE_EVENT_DATA_BUFFER};
    }
    if (ended) break;
    usleep(4000);
  }
  xrDestroySwapchain(swapchain);
  handTrackersDestroy(hands);
  xrDestroySession(session);
  if (vkPipe != VK_NULL_HANDLE) vkDestroyPipeline(vkDev, vkPipe, nullptr);
  if (vkPl != VK_NULL_HANDLE) vkDestroyPipelineLayout(vkDev, vkPl, nullptr);
  for (auto fb : vkFbs)
    if (fb != VK_NULL_HANDLE) vkDestroyFramebuffer(vkDev, fb, nullptr);
  for (auto v : vkViews)
    if (v != VK_NULL_HANDLE) vkDestroyImageView(vkDev, v, nullptr);
  if (vkRp != VK_NULL_HANDLE) vkDestroyRenderPass(vkDev, vkRp, nullptr);
  xrDestroyInstance(instance);
  std::puts("vulkan session probe ok");
  return 0;
}

int main() {
  setvbuf(stdout, nullptr, _IONBF, 0);
  if (useVulkan()) return runVulkan();
  const char* wanted[] = {
      XR_KHR_METAL_ENABLE_EXTENSION_NAME,
      "XR_EXT_user_presence",
      XR_EXT_EYE_GAZE_INTERACTION_EXTENSION_NAME,
      XR_EXT_HAND_INTERACTION_EXTENSION_NAME,
      XR_EXT_HAND_TRACKING_EXTENSION_NAME,
  };

  uint32_t extCount = 0;
  XR_CHECK(xrEnumerateInstanceExtensionProperties(nullptr, 0, &extCount, nullptr));
  std::vector<XrExtensionProperties> avail(extCount, {XR_TYPE_EXTENSION_PROPERTIES});
  XR_CHECK(xrEnumerateInstanceExtensionProperties(nullptr, extCount, &extCount, avail.data()));

  std::vector<const char*> enabled;
  for (const char* w : wanted) {
    bool found = false;
    for (const auto& p : avail)
      if (std::strcmp(p.extensionName, w) == 0) found = true;
    std::printf("ext %s: %s\n", w, found ? "yes" : "NO");
    if (found) enabled.push_back(w);
  }
  bool handExtEnabled = false, gazeExtPresent = false;
  for (const auto& p : avail)
    if (!std::strcmp(p.extensionName, XR_EXT_EYE_GAZE_INTERACTION_EXTENSION_NAME))
      gazeExtPresent = true;
  for (auto* e : enabled)
    if (!std::strcmp(e, XR_EXT_HAND_TRACKING_EXTENSION_NAME))
      handExtEnabled = true;
  std::printf("eye_gaze ext: %s\n", gazeExtPresent ? "present" : "absent");

  XrInstanceCreateInfo createInfo{XR_TYPE_INSTANCE_CREATE_INFO};
  std::strcpy(createInfo.applicationInfo.applicationName, "moyo-xr-probe");
  createInfo.applicationInfo.applicationVersion = 1;
  std::strcpy(createInfo.applicationInfo.engineName, "viro-desktop-probe");
  createInfo.applicationInfo.apiVersion = XR_MAKE_VERSION(1, 1, 0);
  createInfo.enabledExtensionCount = (uint32_t)enabled.size();
  createInfo.enabledExtensionNames = enabled.data();

  XrInstance instance = XR_NULL_HANDLE;
  XR_CHECK(xrCreateInstance(&createInfo, &instance));

  XrInstanceProperties props{XR_TYPE_INSTANCE_PROPERTIES};
  XR_CHECK(xrGetInstanceProperties(instance, &props));
  std::printf("runtime: %s %u.%u.%u\n", props.runtimeName,
              XR_VERSION_MAJOR(props.runtimeVersion),
              XR_VERSION_MINOR(props.runtimeVersion),
              XR_VERSION_PATCH(props.runtimeVersion));

  XrSystemGetInfo sysInfo{XR_TYPE_SYSTEM_GET_INFO};
  sysInfo.formFactor = XR_FORM_FACTOR_HEAD_MOUNTED_DISPLAY;
  XrSystemId system = XR_NULL_SYSTEM_ID;
  XR_CHECK(xrGetSystem(instance, &sysInfo, &system));

  XrSystemProperties sysProps{XR_TYPE_SYSTEM_PROPERTIES};
  XR_CHECK(xrGetSystemProperties(instance, system, &sysProps));
  std::printf("system: %s\n", sysProps.systemName);

  // Metal graphics binding — the risky seam for a Viro desktop port.
  XR_CHECK(xrGetInstanceProcAddr(instance, "xrGetMetalGraphicsRequirementsKHR",
                                 (PFN_xrVoidFunction*)&pfnGetMetalReqs));
  id<MTLDevice> device = MTLCreateSystemDefaultDevice();
  if (!device) {
    std::fputs("no Metal device\n", stderr);
    return 1;
  }
  XrGraphicsRequirementsMetalKHR reqs{XR_TYPE_GRAPHICS_REQUIREMENTS_METAL_KHR};
  XR_CHECK(pfnGetMetalReqs(instance, system, &reqs));
  std::printf("metal reqs: device=%p\n", (void*)reqs.metalDevice);

  id<MTLCommandQueue> queue = [device newCommandQueue];
  XrGraphicsBindingMetalKHR binding{XR_TYPE_GRAPHICS_BINDING_METAL_KHR};
  binding.commandQueue = (__bridge void*)queue;

  XrSessionCreateInfo sessionInfo{XR_TYPE_SESSION_CREATE_INFO};
  sessionInfo.systemId = system;
  sessionInfo.next = &binding;
  XrSession session = XR_NULL_HANDLE;
  XR_CHECK(xrCreateSession(instance, &sessionInfo, &session));
  std::puts("session created (Metal-bound)");

  HandTrackers hands;
  handTrackersInit(hands, instance, session, handExtEnabled);

  // Blend modes: a see-through glasses profile may not support OPAQUE.
  uint32_t bmCount = 0;
  XR_CHECK(xrEnumerateEnvironmentBlendModes(instance, system,
      XR_VIEW_CONFIGURATION_TYPE_PRIMARY_STEREO, 0, &bmCount, nullptr));
  std::vector<XrEnvironmentBlendMode> blendModes(bmCount);
  XR_CHECK(xrEnumerateEnvironmentBlendModes(instance, system,
      XR_VIEW_CONFIGURATION_TYPE_PRIMARY_STEREO, bmCount, &bmCount, blendModes.data()));
  std::printf("blend modes:");
  for (auto b : blendModes) std::printf(" %d", (int)b);
  std::putchar('\n');
  XrEnvironmentBlendMode blendMode = blendModes.empty()
      ? XR_ENVIRONMENT_BLEND_MODE_OPAQUE : blendModes[0];
  std::printf("using blend mode %d\n", (int)blendMode);

  // View config + Metal swapchain so we can submit real projection layers —
  // some runtimes only promote READY->RUNNING once frames are flowing.
  uint32_t viewCount = 0;
  XR_CHECK(xrEnumerateViewConfigurationViews(instance, system,
      XR_VIEW_CONFIGURATION_TYPE_PRIMARY_STEREO, 0, &viewCount, nullptr));
  std::vector<XrViewConfigurationView> views(viewCount, {XR_TYPE_VIEW_CONFIGURATION_VIEW});
  XR_CHECK(xrEnumerateViewConfigurationViews(instance, system,
      XR_VIEW_CONFIGURATION_TYPE_PRIMARY_STEREO, viewCount, &viewCount, views.data()));

  uint32_t fmtCount = 0;
  XR_CHECK(xrEnumerateSwapchainFormats(session, 0, &fmtCount, nullptr));
  std::vector<int64_t> formats(fmtCount);
  XR_CHECK(xrEnumerateSwapchainFormats(session, fmtCount, &fmtCount, formats.data()));
  std::printf("swapchain formats:");
  for (int64_t f : formats) std::printf(" %lld", (long long)f);
  std::putchar('\n');

  XrSwapchainCreateInfo scInfo{XR_TYPE_SWAPCHAIN_CREATE_INFO};
  scInfo.format = formats.empty() ? 80 : formats[0];
  scInfo.width = views[0].recommendedImageRectWidth;
  scInfo.height = views[0].recommendedImageRectHeight;
  scInfo.arraySize = 1;
  scInfo.mipCount = 1;
  scInfo.faceCount = 1;
  scInfo.sampleCount = views[0].recommendedSwapchainSampleCount;
  scInfo.usageFlags = XR_SWAPCHAIN_USAGE_COLOR_ATTACHMENT_BIT;
  XrSwapchain swapchain = XR_NULL_HANDLE;
  XR_CHECK(xrCreateSwapchain(session, &scInfo, &swapchain));
  uint32_t imgCount = 0;
  XR_CHECK(xrEnumerateSwapchainImages(swapchain, 0, &imgCount, nullptr));
  std::vector<XrSwapchainImageMetalKHR> images(imgCount, {XR_TYPE_SWAPCHAIN_IMAGE_METAL_KHR});
  XR_CHECK(xrEnumerateSwapchainImages(swapchain, imgCount, &imgCount,
      (XrSwapchainImageBaseHeader*)images.data()));
  std::printf("swapchain: %ux%u x%u images\n", scInfo.width, scInfo.height, imgCount);

  std::vector<XrCompositionLayerProjectionView> pvViews(viewCount,
      {XR_TYPE_COMPOSITION_LAYER_PROJECTION_VIEW});
  for (uint32_t v = 0; v < viewCount; ++v) {
    pvViews[v].subImage.swapchain = swapchain;
    pvViews[v].subImage.imageRect = {{0, 0}, {(int32_t)scInfo.width, (int32_t)scInfo.height}};
    pvViews[v].subImage.imageArrayIndex = 0;
    pvViews[v].pose.orientation = {0, 0, 0, 1};
    pvViews[v].fov = {-1.f, 1.f, 1.f, -1.f};
  }
  XrReferenceSpaceCreateInfo refSpace{XR_TYPE_REFERENCE_SPACE_CREATE_INFO};
  refSpace.referenceSpaceType = XR_REFERENCE_SPACE_TYPE_LOCAL;
  refSpace.poseInReferenceSpace.orientation = {0, 0, 0, 1};
  XrSpace space = XR_NULL_HANDLE;
  XR_CHECK(xrCreateReferenceSpace(session, &refSpace, &space));

  XrCompositionLayerProjection proj{XR_TYPE_COMPOSITION_LAYER_PROJECTION};
  proj.space = space;
  proj.viewCount = viewCount;
  proj.views = pvViews.data();
  XrCompositionLayerBaseHeader* layers[] = {(XrCompositionLayerBaseHeader*)&proj};
  std::vector<XrView> locatedViews(viewCount, {XR_TYPE_VIEW});

  // Drive the state machine to RUNNING.
  XrSessionBeginInfo beginInfo{XR_TYPE_SESSION_BEGIN_INFO};
  beginInfo.primaryViewConfigurationType = XR_VIEW_CONFIGURATION_TYPE_PRIMARY_STEREO;

  bool running = false, frameRendered = false;
  int frames = 0;
  int frameBudget = 1800;
  if (const char* fb = getenv("XR_PROBE_FRAMES")) frameBudget = atoi(fb);
  // Single-threaded: the sim's in-process debug window needs frame calls on
  // the main thread. xrWaitFrame returns quickly while the session isn't
  // running, so one loop can pump events and frames together.
  for (int i = 0; i < 10000 && !frameRendered; ++i) {
    XrEventDataBuffer ev{XR_TYPE_EVENT_DATA_BUFFER};
    while (xrPollEvent(instance, &ev) == XR_SUCCESS) {
      if (ev.type == XR_TYPE_EVENT_DATA_SESSION_STATE_CHANGED) {
        auto* sc = (XrEventDataSessionStateChanged*)&ev;
        std::printf("session state -> %d\n", (int)sc->state);
        if (sc->state == XR_SESSION_STATE_READY && !running) {
          XR_CHECK(xrBeginSession(session, &beginInfo));
          running = true;
        } else if (sc->state == XR_SESSION_STATE_EXITING ||
                   sc->state == XR_SESSION_STATE_LOSS_PENDING) {
          i = 10000;
        }
      }
      ev = XrEventDataBuffer{XR_TYPE_EVENT_DATA_BUFFER};
    }
    @autoreleasepool {
      NSEvent* nsev = nil;
      while ((nsev = [NSApp nextEventMatchingMask:NSEventMaskAny
                     untilDate:[NSDate distantPast]
                     inMode:NSDefaultRunLoopMode dequeue:YES])) {
        [NSApp sendEvent:nsev];
      }
      [NSApp updateWindows];
    }
    if (running) {
      XrFrameWaitInfo waitInfo{XR_TYPE_FRAME_WAIT_INFO};
      XrFrameState frameState{XR_TYPE_FRAME_STATE};
      XrResult wr = xrWaitFrame(session, &waitInfo, &frameState);
      if (XR_SUCCEEDED(wr)) {
        XrFrameBeginInfo bi{XR_TYPE_FRAME_BEGIN_INFO};
        xrBeginFrame(session, &bi);
        XrFrameEndInfo ei{XR_TYPE_FRAME_END_INFO};
        ei.displayTime = frameState.predictedDisplayTime;
        ei.environmentBlendMode = blendMode;
        if (frameState.shouldRender) {
          XrViewLocateInfo vli{XR_TYPE_VIEW_LOCATE_INFO};
          vli.viewConfigurationType = XR_VIEW_CONFIGURATION_TYPE_PRIMARY_STEREO;
          vli.displayTime = frameState.predictedDisplayTime;
          vli.space = space;
          XrViewState vs{XR_TYPE_VIEW_STATE};
          uint32_t located = viewCount;
          if (XR_SUCCEEDED(xrLocateViews(session, &vli, &vs, viewCount, &located,
                                         locatedViews.data()))) {
            for (uint32_t v = 0; v < located && v < viewCount; ++v) {
              pvViews[v].pose = locatedViews[v].pose;
              pvViews[v].fov = locatedViews[v].fov;
            }
          }
          if (frames % 60 == 0)
            handTrackersPoll(hands, space, frameState.predictedDisplayTime);
          uint32_t imgIndex = 0;
          XrSwapchainImageAcquireInfo ai{XR_TYPE_SWAPCHAIN_IMAGE_ACQUIRE_INFO};
          if (XR_SUCCEEDED(xrAcquireSwapchainImage(swapchain, &ai, &imgIndex))) {
            XrSwapchainImageWaitInfo wi{XR_TYPE_SWAPCHAIN_IMAGE_WAIT_INFO};
            wi.timeout = 1000000000;
            if (XR_SUCCEEDED(xrWaitSwapchainImage(swapchain, &wi))) {
              // Render into the sim-owned Metal texture — the same binding
              // VRODriverMetal will use for a Viro desktop port.
              id<MTLTexture> tex = (__bridge id<MTLTexture>)images[imgIndex].texture;
              static bool loggedDev = false;
              if (!loggedDev) {
                loggedDev = true;
                std::printf("tex.device=%p our device=%p same=%d\n",
                            (void*)tex.device, (void*)device,
                            tex.device == device);
              }
              // Second attachment: our own shared texture for readback —
              // the sim's swapchain textures are private-storage.
              MTLTextureDescriptor* rd = [MTLTextureDescriptor
                  texture2DDescriptorWithPixelFormat:tex.pixelFormat
                  width:tex.width height:tex.height mipmapped:NO];
              rd.usage = MTLTextureUsageShaderRead | MTLTextureUsageRenderTarget;
              rd.storageMode = MTLStorageModeShared;
              id<MTLTexture> copy = [device newTextureWithDescriptor:rd];

              id<MTLCommandBuffer> cmd = [queue commandBuffer];
              MTLRenderPassDescriptor* rp = [MTLRenderPassDescriptor renderPassDescriptor];
              for (int a = 0; a < 2; ++a) {
                rp.colorAttachments[a].texture = a == 0 ? tex : copy;
                rp.colorAttachments[a].loadAction = MTLLoadActionClear;
                rp.colorAttachments[a].storeAction = MTLStoreActionStore;
                rp.colorAttachments[a].clearColor =
                    MTLClearColorMake(1.0, 0.0, 1.0, 1.0);
              }
              id<MTLRenderCommandEncoder> enc =
                  [cmd renderCommandEncoderWithDescriptor:rp];
              [enc endEncoding];
              [cmd commit];
              [cmd waitUntilCompleted];

              static bool dumped = false;
              if (!dumped) {
                dumped = true;
                std::printf("mtl cmd status=%ld error=%s\n", (long)cmd.status,
                            cmd.error ? cmd.error.localizedDescription.UTF8String : "none");
                size_t bpr = tex.width * 4;
                std::vector<uint8_t> px(bpr * tex.height);
                [copy getBytes:px.data() bytesPerRow:bpr
                    fromRegion:MTLRegionMake2D(0, 0, tex.width, tex.height)
                    mipmapLevel:0];
                size_t off = (tex.height / 2) * bpr + (tex.width / 2) * 4;
                std::printf("center pixel = %02x %02x %02x %02x\n",
                            px[off], px[off+1], px[off+2], px[off+3]);
                FILE* f = std::fopen("/tmp/xr-probe-frame.ppm", "wb");
                if (f) {
                  std::fprintf(f, "P6\n%zu %zu\n255\n",
                               (size_t)tex.width, (size_t)tex.height);
                  for (size_t i = 0; i < px.size(); i += 4) {
                    uint8_t rgb[3] = {px[i+2], px[i+1], px[i]};
                    std::fwrite(rgb, 1, 3, f);
                  }
                  std::fclose(f);
                  std::puts("dumped /tmp/xr-probe-frame.ppm");
                }
              }
            }
            XrSwapchainImageReleaseInfo ri{XR_TYPE_SWAPCHAIN_IMAGE_RELEASE_INFO};
            xrReleaseSwapchainImage(swapchain, &ri);
          }
          ei.layerCount = 1;
          ei.layers = layers;
          if (++frames >= frameBudget) frameRendered = true;
        }
        XrResult er = xrEndFrame(session, &ei);
        if (XR_FAILED(er)) {
          static int erLogs = 0;
          if (++erLogs <= 5) std::printf("xrEndFrame failed: %d\n", (int)er);
        }
      }
    }
    usleep(1000);
  }

  if (frameRendered) {
    std::puts("reached XR_SESSION_STATE_RUNNING and rendered a frame");
  } else {
    std::fputs("session never reached RUNNING\n", stderr);
    handTrackersDestroy(hands);
    xrDestroySwapchain(swapchain);
    xrDestroySession(session);
    xrDestroyInstance(instance);
    return 1;
  }

  // Clean teardown: request exit, drain to EXITING, then destroy. Skipping
  // this leaves the sim's session hanging and crashpad aborts the process.
  xrRequestExitSession(session);
  for (int i = 0; i < 200; ++i) {
    XrEventDataBuffer ev{XR_TYPE_EVENT_DATA_BUFFER};
    bool ended = false;
    while (xrPollEvent(instance, &ev) == XR_SUCCESS) {
      if (ev.type == XR_TYPE_EVENT_DATA_SESSION_STATE_CHANGED) {
        auto* sc = (XrEventDataSessionStateChanged*)&ev;
        std::printf("session state -> %d\n", (int)sc->state);
        if (sc->state == XR_SESSION_STATE_STOPPING)
          xrEndSession(session);
        if (sc->state == XR_SESSION_STATE_EXITING) ended = true;
      }
      ev = XrEventDataBuffer{XR_TYPE_EVENT_DATA_BUFFER};
    }
    if (ended) break;
    usleep(4000);
  }
  xrDestroySwapchain(swapchain);
  handTrackersDestroy(hands);
  xrDestroySession(session);
  xrDestroyInstance(instance);

  std::puts("session probe ok");
  return 0;
}
