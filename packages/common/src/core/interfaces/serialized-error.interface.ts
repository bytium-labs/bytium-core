export interface SerializedErrorInterface {
  __bytiumError: {
    __isErrorInstance: boolean;
    __isBytiumException?: boolean;
    name?: string;
    message?: string;
    stack?: string;
    value?: any;
    [key: string | number | symbol]: any;
  };
}
