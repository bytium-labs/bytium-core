import { MultipartFile } from "@multipart/models/multipart-file.model";

/** The parsed contents of a `multipart/form-data` body. */
export interface ParsedMultipart {
  /** Text form fields, keyed by field name. */
  fields: Record<string, string>;

  /** Uploaded files, in the order they appeared. */
  files: MultipartFile[];
}
