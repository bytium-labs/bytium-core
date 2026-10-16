import { HandlerArgsLogModeEnum } from "@invocation/enums/handler-args-log-mode.enum";

type ManagerModule = typeof import("@invocation/managers/handler-args-log.manager");

describe("Handler args log manager", () => {
  afterAll(() => {
    jest.restoreAllMocks();
  });

  const withConvar = (value: string | undefined): HandlerArgsLogModeEnum => {
    jest
      .spyOn(globalThis, "GetConvar")
      .mockImplementation((key, defaultValue) =>
        value !== undefined && key.includes("bytium-core:logHandlerArgs") ? value : defaultValue,
      );

    let mode: HandlerArgsLogModeEnum | undefined;

    jest.isolateModules(() => {
      const managerModule: ManagerModule = jest.requireActual("@invocation/managers/handler-args-log.manager");

      mode = managerModule.handlerArgsLogManagerInstance.getMode();
    });

    return mode!;
  };

  it("should default to OFF when the convar is unset", () => {
    expect(withConvar(undefined)).toBe(HandlerArgsLogModeEnum.OFF);
  });

  it("should resolve the modes case-insensitively", () => {
    expect(withConvar("errors")).toBe(HandlerArgsLogModeEnum.ERRORS);
    expect(withConvar("ALL")).toBe(HandlerArgsLogModeEnum.ALL);
  });

  it("should fall back to OFF for an unknown value", () => {
    expect(withConvar("yes please")).toBe(HandlerArgsLogModeEnum.OFF);
  });
});
