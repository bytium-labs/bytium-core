import { InvocationContextInterface } from "@invocation/interfaces/invocation-context.interface";

export interface InvocationStorageInterface {
  run<T>(store: InvocationContextInterface, callback: () => T): T;
  getStore(): InvocationContextInterface | undefined;
}
