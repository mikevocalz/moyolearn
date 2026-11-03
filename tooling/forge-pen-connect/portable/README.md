# Portable pen connection overrides

These four source files adapt pinned Forge pen-connect commit
`c213f1ca3f1d604a27ccf922362f0de3e4605831`. The vendor generator copies them
after its baseline patches. Keep native resources in the injected Android port;
the controller owns Zustand state and invalidates asynchronous selections.

The optional Android system chooser returns only a validated OS selection.
Selection transitions to `found`; a separate connect action establishes the
link, and only verified native input can establish readiness. Unknown RSSI is
omitted. Existing visionOS system pairing remains available.

Run the controller and adapter regression checks with:

```sh
node --test tooling/forge-pen-connect/portable/tests/system-chooser.test.ts
```

The adapter test runs its actual source with a React Native boundary shim. It
does not establish physical chooser behavior or pen compatibility.

Native artifact 14 accepts the documented `onAssociationCreated` callback or a
successful activity result through shared verified completion. Both paths must
validate the actual association owned by this application; an association alone
does not establish a Bluetooth bond or verified pen input. This portable layer
continues to transition a selection only to `found`.

Portable artifact 9 also offers an explicit `Previously associated Muse` action
when the injected native transport supports reading current application-owned
association records. These are labeled as history, omit historical RSSI, and
require an explicit reconnect. They do not establish nearby availability,
Bluetooth bonding, or pen input readiness.
