#include "CanvasInViroCore.h"
#include <cassert>
#include <limits>
#include <thread>

using namespace nitrocanvasinVision;

int main() {
    assert(!CanvasInViroCore::allocate(0, 10, true, BackingRoute::SurfaceTexture));
    auto core = CanvasInViroCore::allocate(32, 32, true, BackingRoute::SurfaceTexture);
    SharedHandlePayload frame;
    frame.width = frame.height = 32;
    frame.surfaceTextureGLId = 12;
    core->submitFrame(frame);
    assert(core->consumeIfDirty()->surfaceTextureGLId == 12);
    assert(!core->consumeIfDirty());
    core->markDirty();
    assert(core->consumeIfDirty());

    core->resize(64, 64);
    assert(!core->consumeIfDirty());
    core->submitFrame(frame); // old producer dimensions must be rejected
    assert(!core->consumeIfDirty());
    frame.width = frame.height = 64;
    frame.surfaceTextureGLId = 24;
    core->submitFrame(frame);
    assert(core->consumeIfDirty()->surfaceTextureGLId == 24);
    core->resize(-1, 64);
    assert(core->width() == 64);

    core->dispatchInput(PointerPhase::Move, std::numeric_limits<float>::quiet_NaN(), 0);
    core->dispatchInput(static_cast<PointerPhase>(255), 0, 0);
    assert(core->drainInputs().empty());
    auto send = [&] {
        for (int i = 0; i < 10000; ++i) core->dispatchInput(PointerPhase::Move, 0.5f, 0.5f);
    };
    std::thread a(send), b(send);
    a.join(); b.join();
    auto events = core->drainInputs();
    assert(events.size() == 20000);
    for (size_t i = 1; i < events.size(); ++i) assert(events[i].seq > events[i - 1].seq);

    // Exactly one consumer acknowledges each publication, even with two readers.
    core->submitFrame(frame);
    std::atomic<int> consumed {0};
    auto consume = [&] { if (core->consumeIfDirty()) ++consumed; };
    std::thread c(consume), d(consume);
    c.join(); d.join();
    assert(consumed == 1);

    auto publish = [&] {
        for (int i = 0; i < 10000; ++i) {
            core->submitFrame(frame);
            core->dispatchInput(PointerPhase::Move, 0.25f, 0.75f);
        }
    };
    std::thread producer(publish);
    core->dispose();
    producer.join();
    assert(!CanvasInViroCore::lookup(core->id()));
    assert(!core->consumeIfDirty());
    assert(core->drainInputs().empty());
    core->resize(128, 128);
    assert(core->width() == 64);
    core->dispose();
}
