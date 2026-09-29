/** A single file received in a `multipart/form-data` request. */
export class MultipartFile {
  constructor(
    /** The form field the file was sent under. */
    public readonly fieldName: string,

    /** The original filename reported by the client. */
    public readonly filename: string,

    /** The file's declared MIME type. */
    public readonly mimetype: string,

    /** The raw file bytes. */
    public readonly data: ArrayBuffer,
  ) {}

  /** The file size in bytes. */
  get size(): number {
    return this.data.byteLength;
  }
}
