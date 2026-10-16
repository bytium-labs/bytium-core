import { ParsedMultipart } from "@multipart/interfaces/parsed-multipart.interface";
import { MultipartFile } from "@multipart/models/multipart-file.model";

/**
 * Byte-level parser for `multipart/form-data` bodies.
 */
export class MultipartParser {
  static readonly #CR = 0x0d;
  static readonly #LF = 0x0a;
  static readonly #DASH = 0x2d;

  /**
   * Parses a `multipart/form-data` body into its fields and files at the byte level, so binary file
   * contents are preserved (a UTF-8 decode of the whole body would corrupt them).
   */
  static parse(body: ArrayBuffer, boundary: string): ParsedMultipart {
    const bytes = new Uint8Array(body);
    const decoder = new TextDecoder();
    const delimiter = this.#asciiBytes(`--${boundary}`);
    const headerSeparator = this.#asciiBytes("\r\n\r\n");
    const fields: Record<string, string> = {};
    const files: MultipartFile[] = [];
    let position = this.#indexOfBytes(bytes, delimiter, 0);

    while (position >= 0) {
      let partStart = position + delimiter.length;

      if (bytes[partStart] === this.#DASH && bytes[partStart + 1] === this.#DASH) break;

      if (bytes[partStart] === this.#CR && bytes[partStart + 1] === this.#LF) partStart += 2;

      const nextDelimiter = this.#indexOfBytes(bytes, delimiter, partStart);

      if (nextDelimiter < 0) break;

      let partEnd = nextDelimiter;

      if (bytes[partEnd - 2] === this.#CR && bytes[partEnd - 1] === this.#LF) partEnd -= 2;

      const headerEnd = this.#indexOfBytes(bytes, headerSeparator, partStart);

      if (headerEnd < 0 || headerEnd >= partEnd) {
        position = nextDelimiter;

        continue;
      }

      const headers = this.#parsePartHeaders(decoder.decode(bytes.subarray(partStart, headerEnd)));
      const partBody = bytes.subarray(headerEnd + headerSeparator.length, partEnd);

      if (headers.name) {
        if (headers.filename !== undefined) {
          const data = partBody.slice().buffer;

          files.push(new MultipartFile(headers.name, headers.filename, headers.contentType, data));
        } else {
          fields[headers.name] = decoder.decode(partBody);
        }
      }

      position = nextDelimiter;
    }

    return { fields, files };
  }

  static #parsePartHeaders(text: string): { name?: string; filename?: string; contentType: string } {
    let name: string | undefined;
    let filename: string | undefined;
    let contentType = "application/octet-stream";

    for (const line of text.split("\r\n")) {
      const lower = line.toLowerCase();

      if (lower.startsWith("content-disposition:")) {
        name = this.#matchParameter(line, "name");
        filename = this.#matchParameter(line, "filename");
      } else if (lower.startsWith("content-type:")) {
        contentType = line.slice(line.indexOf(":") + 1).trim();
      }
    }

    return { name, filename, contentType };
  }

  static #matchParameter(line: string, key: string): string | undefined {
    const match = line.match(new RegExp(`\\b${key}="([^"]*)"`, "i"));

    return match ? match[1] : undefined;
  }

  static #asciiBytes(text: string): Uint8Array {
    const bytes = new Uint8Array(text.length);

    for (let index = 0; index < text.length; index++) bytes[index] = text.charCodeAt(index);

    return bytes;
  }

  static #indexOfBytes(haystack: Uint8Array, needle: Uint8Array, from: number): number {
    const limit = haystack.length - needle.length;

    for (let index = from; index <= limit; index++) {
      let matched = true;

      for (let offset = 0; offset < needle.length; offset++) {
        if (haystack[index + offset] !== needle[offset]) {
          matched = false;
          break;
        }
      }

      if (matched) return index;
    }

    return -1;
  }
}
