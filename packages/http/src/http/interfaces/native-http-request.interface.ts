/** Shape of the request object passed by the FiveM `SetHttpHandler` native. */
export interface NativeHttpRequest {
  address: string;
  path: string;
  method: string;
  headers: Record<string, string>;
  setDataHandler(handler: (data: string) => void): void;
  setDataHandler(handler: (data: ArrayBuffer) => void, binary: "binary"): void;
  setCancelHandler(handler: () => void): void;
}
