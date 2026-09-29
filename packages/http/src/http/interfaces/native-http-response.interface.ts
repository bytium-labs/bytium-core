/** Shape of the response object passed by the FiveM `SetHttpHandler` native. */
export interface NativeHttpResponse {
  writeHead(code: number, headers?: Record<string, string | string[]>): void;
  write(data: string): void;
  send(data?: string): void;
}
