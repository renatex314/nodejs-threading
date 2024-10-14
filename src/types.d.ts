/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-function-type */
interface CallSite {
  getThis(): any;
  getTypeName(): string | null;
  getFunction(): Function | null;
  getFunctionName(): string | null;
  getMethodName(): string | null;
  getFileName(): string | null;
  getLineNumber(): number | null;
  getColumnNumber(): number | null;
  getEvalOrigin(): string | null;
  isToplevel(): boolean;
  isEval(): boolean;
  isNative(): boolean;
  isConstructor(): boolean;
  getPromiseIndex(): number | null;
}