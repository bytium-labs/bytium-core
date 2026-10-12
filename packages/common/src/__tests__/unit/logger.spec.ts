import { Logger } from "@logger/logger";
import { LogLevelEnum } from "@logger/enums/log-level.enum";

describe("Logger", () => {
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it("should emit verbose only when the verbose level is active", () => {
    new Logger("test", [LogLevelEnum.INFO]).verbose("message");

    expect(logSpy).not.toHaveBeenCalled();

    new Logger("test", [LogLevelEnum.VERBOSE]).verbose("message");

    expect(logSpy).toHaveBeenCalledTimes(1);
  });

  it("should emit fatal whenever the error level is active, and suppress lower levels below it", () => {
    new Logger("test", [LogLevelEnum.ERROR, LogLevelEnum.FATAL]).fatal("boom");

    expect(logSpy).toHaveBeenCalledTimes(1);

    new Logger("test", [LogLevelEnum.WARN]).fatal("boom");

    expect(logSpy).toHaveBeenCalledTimes(1);
  });

  it("should change the logged context through setContext", () => {
    const logger = new Logger("oldContext", [LogLevelEnum.INFO]);

    logger.setContext("newContext");
    logger.log("message");

    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy.mock.calls[0][0]).toContain("[newContext]");
  });
});
