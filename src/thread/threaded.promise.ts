import Thread, { ThreadFunction, ThreadMessage } from "./thread";
import ThreadPool from "./thread.pool";
import ThreadTask from "./thread.task";
import { extractFunctionData, JSONCompatible } from "./utils";

type PromiseExecutor<T> = (accept: (value: T) => void, reject: (reason: unknown) => void) => void;

/**
 * @noExternalVars
 */
export type ThreadedPromiseExecutor<T, E> = (accept: (value: T) => void, reject: (reason: unknown) => void, params: JSONCompatible<E>) => void;

export default class ThreadedPromise<E, T> {
  private _promise: Promise<ThreadMessage<T>>;
  private currentTask: ThreadTask<T | E> | null = null;

  constructor(executor: ThreadedPromiseExecutor<T, E>, params: ThreadMessage<E> | null = null, pool?: ThreadPool<T>) {
    const middlewareExecutor: PromiseExecutor<ThreadMessage<T>> = async (accept, reject) => {
      function createThreadFunction(): string {
        const executorData = extractFunctionData(executor);
  
        return `(async function (${executorData.parameters.join(",")}) { delete globalThis.notify; delete globalThis.abort; delete globalThis.next; delete globalThis.terminate; delete globalThis.notify; ${executorData.body} })(notify, abort, params)`;
      }
      
      const taskFunction: ThreadFunction<T> = (async (notify, next) => {
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

      let gotResponse = false;
      let task;

      if (pool) {
        task = pool.enqueueTask(taskFunction);
      } else {
        task = new Thread(taskFunction).start();
      }

      task!.onMessage((message) => {
        accept(message as ThreadMessage<T>);
  
        gotResponse = true;
      });
      task!.onError((error) => {
        reject(error);
  
        gotResponse = true;
      });
      task!.onCompleted(() => {
        if (!gotResponse) {
          reject(new Error("Task exited without any response"));
        }
      });
      task!.notify(params as ThreadMessage<T | E>);
      task!.notify(createThreadFunction());

      this.currentTask = task;
    }
  
    this._promise = new Promise(middlewareExecutor);
  }

  tryCancel() {
    this.currentTask?.tryCancel();
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
