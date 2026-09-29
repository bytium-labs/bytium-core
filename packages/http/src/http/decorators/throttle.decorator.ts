import { SetMetadata } from "@bytium-core/common";
import { THROTTLE_METADATA } from "@http/consts/throttle-metadata.const";

/** Limits a handler to `limit` requests per IP within `ttlMs`, enforced by {@link ThrottleGuard}. */
export function Throttle(limit: number, ttlMs: number): MethodDecorator {
  return SetMetadata(THROTTLE_METADATA, { limit, ttlMs });
}
