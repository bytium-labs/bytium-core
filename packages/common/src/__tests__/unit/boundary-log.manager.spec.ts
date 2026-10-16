type ManagerModule = typeof import("@invocation/managers/boundary-log.manager");

describe("Boundary log manager", () => {
  afterAll(() => {
    jest.restoreAllMocks();
  });

  const withConvar = (value: string | undefined, type: string): boolean => {
    jest
      .spyOn(globalThis, "GetConvar")
      .mockImplementation((key, defaultValue) =>
        value !== undefined && key.includes("bytium-core:logBoundaryExclude") ? value : defaultValue,
      );

    let logged: boolean | undefined;

    jest.isolateModules(() => {
      const managerModule: ManagerModule = jest.requireActual("@invocation/managers/boundary-log.manager");

      logged = managerModule.boundaryLogManagerInstance.shouldLog(type);
    });

    return logged!;
  };

  it("should log every boundary type when the convar is unset", () => {
    expect(withConvar(undefined, "COMMAND")).toBe(true);
    expect(withConvar(undefined, "TRANSFERABLE")).toBe(true);
  });

  it("should exclude the listed types and keep the rest", () => {
    expect(withConvar("TRANSFERABLE,CRON", "TRANSFERABLE")).toBe(false);
    expect(withConvar("TRANSFERABLE,CRON", "CRON")).toBe(false);
    expect(withConvar("TRANSFERABLE,CRON", "COMMAND")).toBe(true);
  });

  it("should trim entries and match them case-insensitively", () => {
    expect(withConvar(" transferable , http ", "TRANSFERABLE")).toBe(false);
    expect(withConvar(" transferable , http ", "HTTP")).toBe(false);
  });

  it("should ignore empty entries", () => {
    expect(withConvar(",,", "COMMAND")).toBe(true);
  });
});
