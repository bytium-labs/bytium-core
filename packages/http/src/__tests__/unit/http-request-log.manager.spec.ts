import { HttpRequestLogLevelEnum } from "@http/enums/http-request-log-level.enum";

type ManagerModule = typeof import("@http/managers/http-request-log.manager");

describe("Http request log manager", () => {
  let getConvarSpy: jest.SpyInstance<string, [string, string]>;

  beforeAll(() => {
    getConvarSpy = jest.spyOn(globalThis, "GetConvar");
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  const withConvars = (values: Record<string, string>): ManagerModule["httpRequestLogManagerInstance"] => {
    getConvarSpy.mockImplementation((key: string, defaultValue: string) => {
      const match = Object.entries(values).find(([suffix]) => key.includes(suffix));

      return match ? match[1] : defaultValue;
    });

    let manager: ManagerModule["httpRequestLogManagerInstance"] | undefined;

    jest.isolateModules(() => {
      manager = (jest.requireActual("@http/managers/http-request-log.manager") as ManagerModule)
        .httpRequestLogManagerInstance;
    });

    return manager!;
  };

  it("should default to LEAN with empty mask lists", () => {
    const manager = withConvars({});

    expect(manager.getLevel()).toBe(HttpRequestLogLevelEnum.LEAN);
    expect(manager.getMaskedHeaders()).toEqual([]);
    expect(manager.getMaskedKeys()).toEqual([]);
  });

  it("should resolve the level case-insensitively and fall back to LEAN for unknown values", () => {
    expect(withConvars({ "bytium-core:logHttpRequests": "full" }).getLevel()).toBe(HttpRequestLogLevelEnum.FULL);
    expect(withConvars({ "bytium-core:logHttpRequests": "META" }).getLevel()).toBe(HttpRequestLogLevelEnum.META);
    expect(withConvars({ "bytium-core:logHttpRequests": "yes" }).getLevel()).toBe(HttpRequestLogLevelEnum.LEAN);
  });

  it("should parse the mask lists as trimmed lowercased names", () => {
    const manager = withConvars({
      "bytium-core:logHttpMaskHeaders": " X-Session , x-trace ",
      "bytium-core:logHttpMaskKeys": "SSN,, license ",
    });

    expect(manager.getMaskedHeaders()).toEqual(["x-session", "x-trace"]);
    expect(manager.getMaskedKeys()).toEqual(["ssn", "license"]);
  });
});
