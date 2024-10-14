import { Worker } from "worker_threads";
import { extractFunctionData, JSONCompatible } from "./utils";
import { isTypedArray } from "util/types";

export type ThreadMessage<T> = string | number | Uint32Array | JSONCompatible<T> | object;

/**
 * @noExternalVars
*/
export type ThreadFunction<T> = (
  notify: (message: ThreadMessage<T>) => void, 
  next: () => Promise<ThreadMessage<T>>, 
  terminate: () => void
) => void;

export type OnMessageCallback<T> = (message: ThreadMessage<T>) => void;
export type OnErrorCallback = (error: Error) => void;
export type OnExitCallback = () => void;

export default class Thread<T> {
  private _MESSAGE_TYPE = {
    STRING: 0,
    NUMBER: 1,
    BYTEARRAY: 2,
    JSON: 3,
    OTHER: 4
  };
  private threadFunction: ThreadFunction<T>;
  private runningWorker: Worker | null;
  private onMessageCallback: OnMessageCallback<T> | null;
  private onErrorCallback: OnErrorCallback | null;
  private onExitCallback: OnExitCallback | null;

  constructor(fn: ThreadFunction<T>) {
    this.threadFunction = fn;
    this.runningWorker = null;
    this.onMessageCallback = null;
    this.onErrorCallback = null;
    this.onExitCallback = null;
  }

  private parseSendMessage(message: ThreadMessage<T>): Uint32Array | object {
    if (typeof message === 'string') {
      return new Uint32Array([this._MESSAGE_TYPE.STRING, ...Buffer.from(message)]);
    } else if (typeof message === 'number') {
      return new Uint32Array([this._MESSAGE_TYPE.NUMBER, message]);
    } else if (Array.isArray(message) || isTypedArray(message)) {
      return new Uint32Array([this._MESSAGE_TYPE.BYTEARRAY, ...message]);
    } else {
      return message;
    }
  }

  private parseReceivedMessage(message: Uint32Array | object): ThreadMessage<T> {
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

  private createWorkerFunction(): string {
    const functionData = extractFunctionData(this.threadFunction);

    return `
      let notify;
      let next;
      let terminate;

      (function() {
        const { parentPort } = require('worker_threads');
  
        function _${this.parseSendMessage.toString().replace(/this\._MESSAGE_TYPE/g, JSON.stringify(this._MESSAGE_TYPE))}
        function _${this.parseReceivedMessage.toString().replace(/this\._MESSAGE_TYPE/g, JSON.stringify(this._MESSAGE_TYPE))}
  
        notify = (message) => parentPort.postMessage(_parseSendMessage(message));
        next = () => new Promise((resolve) => parentPort.once('message', (message) => resolve(_parseReceivedMessage(message))));
        terminate = () => parentPort.postMessage('terminate');
      })();

      (async function() {
        const promise = (async function (${functionData.parameters.join(",")}) { ${functionData.body} })(notify, next, terminate);

        try {
          await promise;
        } catch (err) {
          const { parentPort } = require('worker_threads');

          parentPort.postMessage(err);
        }

        terminate();
      })();
    `;
  }

  onMessage(callback: OnMessageCallback<T>) {
    this.onMessageCallback = callback;

    return this;
  }

  onError(callback: OnErrorCallback) {
    this.onErrorCallback = callback;

    return this;
  }

  onExit(callback: OnExitCallback) {
    this.onExitCallback = callback;

    return this;
  }

  start() {
    const worker = new Worker(this.createWorkerFunction(), { eval: true });

    worker.on('message', (message: Uint32Array | string | Error) => {
      if (typeof message === "string") {
        if (message === "terminate") {
          worker.terminate();

          this.runningWorker = null;
        }

        return;
      }

      if (typeof message === "object" && message instanceof Error) {
        this.onErrorCallback?.(message);
        
        return;
      }

      if (this.onMessageCallback) {
        this.onMessageCallback?.(this.parseReceivedMessage(message));
      }
    });

    worker.on("exit", () => {
      this.runningWorker = null;

      this.onExitCallback?.();
    });

    this.runningWorker = worker;

    return this;
  }

  notify(message: ThreadMessage<T>) {
    if (this.runningWorker) {
      this.runningWorker.postMessage(this.parseSendMessage(message));
    }
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
