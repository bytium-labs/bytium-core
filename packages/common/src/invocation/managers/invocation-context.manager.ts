import { InvocationContextInterface } from "@invocation/interfaces/invocation-context.interface";
import { InvocationStorageInterface } from "@invocation/interfaces/invocation-storage.interface";

export class InvocationContextManager {
  #storage?: InvocationStorageInterface;
  #storageUnavailable = false;

  run<T>(contextFactory: () => InvocationContextInterface, callback: () => T): T {
    const storage = this.#ensureStorage();

    return storage ? storage.run(contextFactory(), callback) : callback();
  }

  getContext(): InvocationContextInterface | undefined {
    return this.#storage?.getStore();
  }

  #ensureStorage(): InvocationStorageInterface | undefined {
    if (this.#storage) {
      return this.#storage;
    }

    if (this.#storageUnavailable) {
      return undefined;
    }

    // the client scripting runtime is plain V8 without node builtins; on the server node's
    // getBuiltinModule reaches async_hooks without a require, which bundlers would rewrite
    if (typeof process === "undefined" || !IsDuplicityVersion()) {
      this.#storageUnavailable = true;

      return undefined;
    }

    const getBuiltinModule = Reflect.get(process, "getBuiltinModule") as
      ((specifier: string) => { AsyncLocalStorage: new () => InvocationStorageInterface }) | undefined;

    if (typeof getBuiltinModule !== "function") {
      this.#storageUnavailable = true;

      return undefined;
    }

    this.#storage = new (getBuiltinModule("node:async_hooks").AsyncLocalStorage)();

    return this.#storage;
  }
}

export const invocationContextManagerInstance = new InvocationContextManager();
