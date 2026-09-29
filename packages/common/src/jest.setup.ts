/**
 * Mock all used FiveM globals before any module is imported. This file runs via jest.config.js
 * `setupFiles`, before module loading.
 */
import "reflect-metadata";

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

(global as any).IsDuplicityVersion = () => false;
(global as any).GetCurrentResourceName = () => "test-resource";
(global as any).GetConvar = (_key: string, defaultValue: string) => defaultValue;
(global as any).GetResourceState = () => "started";
(global as any).IsPlayerAceAllowed = () => true;
(global as any).GetRegisteredCommands = (): unknown[] => [];
(global as any).source = 0;

(global as any).on = () => {};
(global as any).onNet = () => {};
(global as any).emit = () => {};
(global as any).emitNet = () => {};
(global as any).RegisterConsoleListener = () => {};
(global as any).AddConvarChangeListener = () => {};
(global as any).SetTick = () => 0;
(global as any).setTick = () => 0;
(global as any).ClearTick = () => {};
(global as any).clearTick = () => {};
(global as any).RegisterCommand = () => {};
