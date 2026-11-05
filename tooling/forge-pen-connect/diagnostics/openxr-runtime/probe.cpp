#define XR_USE_PLATFORM_ANDROID
#include <jni.h>
#include <openxr/openxr.h>
#include <openxr/openxr_platform.h>
#include <vector>
#include <sstream>
extern "C" JNIEXPORT jstring JNICALL Java_com_moyolearn_musexrprobe_RuntimeProbe_enumerate(JNIEnv* env,jclass,jobject context) {
 JavaVM* vm=nullptr;env->GetJavaVM(&vm);
 PFN_xrVoidFunction raw=nullptr;
 XrResult lookup=xrGetInstanceProcAddr(XR_NULL_HANDLE,"xrInitializeLoaderKHR",&raw);
 XrResult init=XR_ERROR_FUNCTION_UNSUPPORTED;
 if(XR_SUCCEEDED(lookup)&&raw){XrLoaderInitInfoAndroidKHR info{XR_TYPE_LOADER_INIT_INFO_ANDROID_KHR};info.applicationVM=vm;info.applicationContext=context;init=reinterpret_cast<PFN_xrInitializeLoaderKHR>(raw)(reinterpret_cast<XrLoaderInitInfoBaseHeaderKHR*>(&info));}
 uint32_t count=0;XrResult first=XR_ERROR_INITIALIZATION_FAILED,second=XR_ERROR_INITIALIZATION_FAILED;
 std::vector<XrExtensionProperties> props;
 if(XR_SUCCEEDED(init)){first=xrEnumerateInstanceExtensionProperties(nullptr,0,&count,nullptr);if(XR_SUCCEEDED(first)&&count<=4096){props.resize(count);for(auto& p:props)p.type=XR_TYPE_EXTENSION_PROPERTIES;second=xrEnumerateInstanceExtensionProperties(nullptr,count,&count,props.data());}}
 std::ostringstream o;o<<"{\"schemaVersion\":1,\"operation\":\"enumerate-only-no-instance-or-session\",\"lookupResult\":"<<lookup<<",\"initializeResult\":"<<init<<",\"countResult\":"<<first<<",\"enumerateResult\":"<<second<<",\"extensions\":[";
 if(XR_SUCCEEDED(second)){for(uint32_t i=0;i<count&&i<props.size();++i){if(i)o<<",";o<<"{\"name\":\""<<props[i].extensionName<<"\",\"version\":"<<props[i].extensionVersion<<"}";}}
 o<<"]}";return env->NewStringUTF(o.str().c_str());
}
