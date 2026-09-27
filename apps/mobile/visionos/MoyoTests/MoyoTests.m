#import <XCTest/XCTest.h>

@interface MoyoTests : XCTestCase
@end

@implementation MoyoTests

// These are native packaging prerequisites, not a substitute for headset tests.
// The template previously waited ten minutes for a React welcome screen that
// this Expo application never renders.
- (void)testSpatialInputModuleIsLinked
{
  XCTAssertNotNil(NSClassFromString(@"VRTVisionOSModule"),
                  @"The visionOS renderer and stylus event module must be linked into Moyo.");
}

- (void)testRequiredPermissionsHavePurposeStrings
{
  for (NSString *key in @[@"NSMicrophoneUsageDescription",
                         @"NSAccessoryTrackingUsageDescription",
                         @"NSHandsTrackingUsageDescription",
                         @"NSWorldSensingUsageDescription"]) {
    id value = [[NSBundle mainBundle] objectForInfoDictionaryKey:key];
    XCTAssertTrue([value isKindOfClass:[NSString class]] && [value length] > 0,
                  @"Missing purpose string for %@", key);
  }
}
@end
