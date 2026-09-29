/**
 * Restores the real timer globals after every test.
 *
 * On Node 26, jest 30's `jest.useRealTimers()` fails to restore `setTimeout` and friends,
 * leaving them `undefined` for subsequent tests. Import this module in any spec that uses
 * fake timers to keep the real globals intact across tests.
 */
const realTimers = {
  setTimeout: globalThis.setTimeout,
  clearTimeout: globalThis.clearTimeout,
  setInterval: globalThis.setInterval,
  clearInterval: globalThis.clearInterval,
  setImmediate: globalThis.setImmediate,
  clearImmediate: globalThis.clearImmediate,
  queueMicrotask: globalThis.queueMicrotask,
};

afterEach(() => {
  Object.assign(globalThis, realTimers);
});
