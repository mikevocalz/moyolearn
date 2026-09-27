import type { ChromeRuntime } from './chrome-runtime.types.ts';

/** Only presentation properties are cached. Command acknowledgements stay immediate. */
export function chromePresentation(runtime: ChromeRuntime) {
  const sent = new Map<string, unknown>();
  let dirty = false;
  const write = (name: string, value: unknown, send: () => void) => {
    if (sent.has(name) && Object.is(sent.get(name), value)) return;
    send();
    sent.set(name, value);
    dirty = true;
  };
  return {
    setNumber: (name: string, value: number) => write(name, value, () => runtime.setNumber(name, value)),
    setBoolean: (name: string, value: boolean) => write(name, value, () => runtime.setBoolean(name, value)),
    setString: (name: string, value: string) => write(name, value, () => runtime.setString(name, value)),
    commit() {
      if (!dirty) return;
      runtime.setNumber('revision', runtime.getNumber('revision') + 1);
      dirty = false;
    },
  };
}
