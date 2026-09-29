/**
 * Mocks all FiveM globals for Jest - covers all natives used by `@bytium-core/common`. Add this file
 * to `setupFiles` in your jest.config.js.
 */

const exportsStore: Record<string, any> = {};

(global as any).exports = new Proxy(
  function exportsFunc(name: string, fn: any) {
    exportsStore[name] = fn;
  } as any,
  {
    get(_target: any, prop: string) {
      return exportsStore[prop];
    },
    set(_target: any, prop: string, value: any) {
      exportsStore[prop] = value;

      return true;
    },
  },
);

(global as any).IsDuplicityVersion = jest.fn(() => false);
(global as any).GetCurrentResourceName = jest.fn(() => "test-resource");
(global as any).GetResourceState = jest.fn(() => "started");
(global as any).GetConvar = jest.fn((_key: string, defaultValue: string) => defaultValue);
(global as any).GetConvarInt = jest.fn((_key: string, defaultValue: number) => defaultValue);
(global as any).LoadResourceFile = jest.fn((_resourceName: string, _fileName: string): string | null => null);
(global as any).IsPlayerAceAllowed = jest.fn(() => true);
(global as any).GetRegisteredCommands = jest.fn((): unknown[] => []);
(global as any).source = 0;

(global as any).on = jest.fn();
(global as any).onNet = jest.fn();
(global as any).emit = jest.fn();
(global as any).emitNet = jest.fn();
(global as any).RegisterConsoleListener = jest.fn();
(global as any).AddConvarChangeListener = jest.fn();
(global as any).SetTick = jest.fn(() => 0);
(global as any).setTick = jest.fn(() => 0);
(global as any).ClearTick = jest.fn();
(global as any).clearTick = jest.fn();
(global as any).RegisterCommand = jest.fn();
