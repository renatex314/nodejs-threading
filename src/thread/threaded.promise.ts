import Thread, { ThreadMessage } from "./thread";
import { extractFunctionData, JSONCompatible } from "./utils";

type PromiseExecutor<T> = (accept: (value: T) => void, reject: (reason: unknown) => void) => void;

/**
 * @noExternalVars
 */
export type ThreadedPromiseExecutor<T, E> = (accept: (value: T) => void, reject: (reason: unknown) => void, params: JSONCompatible<E>) => void;

export default class ThreadedPromise<E, T> {
  private _promise: Promise<ThreadMessage<T>>;
  private _runningThread: Thread<T | E> | null;
  private _cancelled: boolean;

  constructor(executor: ThreadedPromiseExecutor<T, E>, params: ThreadMessage<E> | null = null) {
    this._runningThread = null;
    this._cancelled = false;

    const middlewareExecutor: PromiseExecutor<ThreadMessage<T>> = async (accept, reject) => {
      function createThreadFunction(): string {
        const executorData = extractFunctionData(executor);
  
        return `(async function (${executorData.parameters.join(",")}) { delete globalThis.notify; delete globalThis.abort; delete globalThis.next; delete globalThis.terminate; delete globalThis.notify; ${executorData.body} })(notify, abort, params)`;
      }
      
      let gotResponse = false;
      const thread = new Thread<T | E>(async (notify, next) => {
         
         
        const params = await next() as JSONCompatible<E>;
        const functionCode = await next() as string;
        let resultError: Error | null = null;
  
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any)["params"] = params;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any)["notify"] = notify;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any)["abort"] = (reason: any) => { resultError = new Error(reason) };
  
        await eval(functionCode);

        if (resultError) {
          throw resultError;
        }
      });
      thread.onMessage((message) => {
        accept(message as ThreadMessage<T>);
  
        gotResponse = true;
      });
      thread.onError((error) => {
        reject(error);
  
        gotResponse = true;
      });
      thread.onExit(() => {
        if (!gotResponse) {
          reject(new Error(this._cancelled ? "The task was cancelled" : "Thread exited without any response"));
        }
      });
      thread.start();

      thread.notify(params as ThreadMessage<T | E>);
      thread.notify(createThreadFunction());

      this._runningThread = thread;
    }
  
    this._promise = new Promise(middlewareExecutor);
  }

  cancel() {
    this._cancelled = true;
    this._runningThread?.terminate();
  }

  get then() {
    return this._promise.then.bind(this._promise);
  }

  get catch() {
    return this._promise.catch.bind(this._promise);
  }

  get finally() {
    return this._promise.finally.bind(this._promise);
  }

  get promise() {
    return this._promise;
  }

}
