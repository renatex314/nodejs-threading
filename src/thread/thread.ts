import { Worker } from "worker_threads";
import { extractFunctionData, getCallerDirname, JSONCompatible, resolveFilenameOnTsNode } from "./utils";
import ThreadTask from "./thread.task";

export type WorkerFirstMessage = {
  callerDirname: string;
  keepAlive: boolean;
}
export type WorkerTask = {
  functionParameters: string;
  functionBody: string;
}
export type ThreadMessage<T> = string | number | Uint32Array | JSONCompatible<T> | object;
export type NotifyFunction<T> = (message: ThreadMessage<T>) => void;
export type NextFunction<T> = () => Promise<ThreadMessage<T>>;
export type TerminateFunction = () => void;
export type ImportModuleFunction = <T = unknown>(relativePath: string) => Promise<T>;

export type OnExitCallback = () => void;

/**
 * @noExternalVars
*/
export type ThreadFunction<T> = (
  notify: NotifyFunction<T>, 
  next: NextFunction<T>, 
  terminate: TerminateFunction,
  importModule: ImportModuleFunction
) => void;

export default class Thread<T> {
  private static _MESSAGE_TYPE = {
    STRING: 0,
    NUMBER: 1,
    BYTEARRAY: 2,
    JSON: 3,
    OTHER: 4
  };
  private threadTasks: ThreadTask<T>[];
  private runningWorker: Worker | null;
  private onExitCallback: OnExitCallback | null;
  private instatiationDirname: string;
  private keepAlive: boolean;

  constructor(fn?: ThreadFunction<T> | null, keepAlive?: boolean) {
    this.threadTasks = [];
    this.runningWorker = null;
    this.onExitCallback = null;
    this.instatiationDirname = getCallerDirname(1);
    this.keepAlive = keepAlive || false;

    if (fn) {
      this.enqueueTask(fn);
    }
  }

  enqueueTask<T>(fn: ThreadFunction<T>): ThreadTask<T> {
    const tasksLength = this.threadTasks.length;

    const task = new ThreadTask<T>({
      functionParameters: extractFunctionData(fn).parameters.join(","),
      functionBody: extractFunctionData(fn).body
    });

    this.threadTasks.push(task);

    if (tasksLength === 0) {
      this.sendCurrentTaskToWorker();
    }

    return task;
  }

  getPendingTasksCount() {
    return this.threadTasks.length;
  }

  private sendCurrentTaskToWorker() {
    if (this.runningWorker && this.threadTasks.length > 0) {
      const currentTask = this.getCurrentTask();

      if (currentTask.isCancelled()) {
        currentTask?.onCompletedCallbackFn?.();

        this.threadTasks.shift();

        this.sendCurrentTaskToWorker();

        return;
      }

      this.runningWorker.postMessage(currentTask.task);

      currentTask._onNotify(() => {
        const message = currentTask._readNextPendingNotify()!;

        this.runningWorker?.postMessage(Thread.parseSendMessage(message));
      })

      while (this.getCurrentTask().hasPendingNotify()) {
        this.runningWorker.postMessage(Thread.parseSendMessage(this.getCurrentTask()._readNextPendingNotify()!));
      }
    }
  }

  private getCurrentTask() {
    return this.threadTasks[0];
  }

  static parseSendMessage<T>(message: ThreadMessage<T>): Uint32Array | object {
    if (typeof message === 'string') {
      return new Uint32Array([this._MESSAGE_TYPE.STRING, ...Buffer.from(message)]);
    } else if (typeof message === 'number') {
      return new Uint32Array([this._MESSAGE_TYPE.NUMBER, message]);
    } else if (Array.isArray(message) || message instanceof Uint32Array) {
      return new Uint32Array([this._MESSAGE_TYPE.BYTEARRAY, ...message]);
    } else {
      return message;
    }
  }

  static parseReceivedMessage<T>(message: Uint32Array | object): ThreadMessage<T> {
    if (message instanceof Uint32Array) {
      const messageType = message[0];
      const data = message.slice(1);
  
      switch (messageType) {
        case this._MESSAGE_TYPE.STRING:
          return Buffer.from(data).toString();
  
        case this._MESSAGE_TYPE.NUMBER:
          return data[0];
  
        case this._MESSAGE_TYPE.BYTEARRAY:
          return data;
  
        case this._MESSAGE_TYPE.JSON:
          return JSON.parse(Buffer.from(data).toString());
      }
    }

    return message;
  }

  onExit(callback: OnExitCallback) {
    this.onExitCallback = callback;

    return this;
  }

  start(): ThreadTask<T> | null {
    const worker = new Worker(`
      require('ts-node/register');
      require(require('worker_threads').workerData.runThisFileInTheWorker);
    `, {
      eval: true,
      workerData: {
        runThisFileInTheWorker: __dirname + resolveFilenameOnTsNode("/worker.ts")
      }
    });

    worker.on('message', (message: Uint32Array | string | Error) => {
      if (typeof message === "string") {
        if (message === "terminate") {
          worker.terminate();

          this.runningWorker = null;
        }

        if (message === "completed") {
          const currentTask = this.getCurrentTask();
          currentTask?.onCompletedCallbackFn?.();

          this.threadTasks.shift();

          this.sendCurrentTaskToWorker();
        }

        return;
      }

      const currentTask = this.getCurrentTask();

      if (typeof message === "object" && message instanceof Error) {
        this.getCurrentTask()?.onErrorCallbackFn?.(message);
        
        return;
      }

      if (currentTask.onErrorCallbackFn) {
        currentTask.onMessageCallbackFn?.(Thread.parseReceivedMessage(message));
      }
    });

    worker.on("exit", () => {
      this.runningWorker = null;

      for (const task of this.threadTasks) {
        task?.onCompletedCallbackFn?.();
      }

      this.onExitCallback?.();
    });

    this.runningWorker = worker;
    this.runningWorker.postMessage({
      callerDirname: this.instatiationDirname,
      keepAlive: this.keepAlive
    } as WorkerFirstMessage);
    this.sendCurrentTaskToWorker();

    return this.getCurrentTask();
  }

  terminate() {
    if (this.runningWorker) {
      this.runningWorker.terminate();
    }
  }

  isRunning() {
    return this.runningWorker !== null
  }

}
