import { AnyExecutionContext, CanActivate, Injectable } from "@bytium-core/common";
import { THROTTLE_METADATA } from "@http/consts/throttle-metadata.const";
import { TooManyRequestsException } from "@http/exceptions/too-many-requests.exception";
import { HttpExecutionContext } from "@http/interfaces/http-execution-context.interface";
import { ThrottleOptions } from "@http/interfaces/throttle-options.interface";

const SWEEP_INTERVAL_MS = 60_000;

interface HitWindow {
  count: number;
  resetAt: number;
}

/** Enforces the per-IP rate limit declared by {@link Throttle}; handlers without it pass through untouched. */
@Injectable()
export class ThrottleGuard implements CanActivate {
  private readonly windows = new Map<string, HitWindow>();
  private nextSweepAt = 0;

  canActivate(context: AnyExecutionContext): boolean {
    const options = Reflect.getMetadata(
      THROTTLE_METADATA,
      Object.getPrototypeOf(context.provider),
      context.methodName,
    ) as ThrottleOptions | undefined;

    if (!options) return true;

    const httpContext = context as unknown as HttpExecutionContext;

    if (httpContext.type !== "HTTP") return true;

    const now = Date.now();

    this.sweep(now);

    const key = `${context.provider.constructor.name}#${context.methodName}:${httpContext.request.address}`;
    const window = this.windows.get(key);

    if (!window || now >= window.resetAt) {
      this.windows.set(key, { count: 1, resetAt: now + options.ttlMs });

      return true;
    }

    if (window.count >= options.limit) throw new TooManyRequestsException();

    window.count++;

    return true;
  }

  private sweep(now: number): void {
    if (now < this.nextSweepAt) return;

    for (const [key, window] of this.windows) {
      if (now >= window.resetAt) this.windows.delete(key);
    }

    this.nextSweepAt = now + SWEEP_INTERVAL_MS;
  }
}
