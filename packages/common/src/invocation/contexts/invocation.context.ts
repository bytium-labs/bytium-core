import { InvalidArgumentException } from "@core/exceptions/invalid-argument.exception";
import { BOUNDARY_BUCKET_NAMES } from "@invocation/consts/boundary-bucket-names.const";
import { RESERVED_BUCKET_NAMES } from "@invocation/consts/reserved-bucket-names.const";
import { InvocationContextInterface } from "@invocation/interfaces/invocation-context.interface";
import { invocationContextManagerInstance } from "@invocation/managers/invocation-context.manager";

/**
 * Read and enrich the invocation context of the currently running handler.
 */
export class InvocationContext {
  /**
   * Snapshot of the active invocation context, or `undefined` outside a handler invocation (and always on the client).
   */
  static current(): InvocationContextInterface | undefined {
    const context = invocationContextManagerInstance.getContext();

    if (!context) {
      return undefined;
    }

    const snapshot: InvocationContextInterface = { ...context };

    if (context.__bytiumMetadata) {
      snapshot.__bytiumMetadata = {};

      for (const [bucket, fields] of Object.entries(context.__bytiumMetadata)) {
        snapshot.__bytiumMetadata[bucket] = Array.isArray(fields) ? [...fields] : { ...fields };
      }
    }

    if (context.__bytiumHandlerArgs) {
      snapshot.__bytiumHandlerArgs = [...context.__bytiumHandlerArgs];
    }

    return snapshot;
  }

  /**
   * Merges fields into a named bucket carried by every JSON log line of the invocation; repeated calls extend the bucket.
   * Returns `false` when no invocation context is active.
   */
  static assign(bucket: string, fields: Record<string, unknown>): boolean {
    this.#assertBucketName(bucket);

    if (BOUNDARY_BUCKET_NAMES.has(bucket)) {
      throw new InvalidArgumentException(`Bucket name "${bucket}" is reserved for the boundary access lines.`);
    }

    const context = invocationContextManagerInstance.getContext();

    if (!context) {
      return false;
    }

    context.__bytiumMetadata = {
      ...context.__bytiumMetadata,
      [bucket]: { ...context.__bytiumMetadata?.[bucket], ...fields },
    };

    return true;
  }

  /** Runs the callback with extra buckets visible only for its duration; outside an invocation the callback runs without a context. */
  static scoped<T>(metadata: Record<string, Record<string, unknown>>, callback: () => T): T {
    for (const bucket of Object.keys(metadata)) {
      this.#assertBucketName(bucket);
    }

    const context = invocationContextManagerInstance.getContext();

    if (!context) {
      return callback();
    }

    return invocationContextManagerInstance.run(
      () => ({ ...context, __bytiumMetadata: { ...context.__bytiumMetadata, ...metadata } }),
      callback,
    );
  }

  static #assertBucketName(bucket: string): void {
    if (!bucket) {
      throw new InvalidArgumentException("Bucket name is required.");
    }

    if (RESERVED_BUCKET_NAMES.has(bucket)) {
      throw new InvalidArgumentException(`Bucket name "${bucket}" is reserved by the framework.`);
    }
  }
}
