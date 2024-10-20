import { ThreadMessage, WorkerTask } from "./thread";

export type OnMessageCallback<T> = (message: ThreadMessage<T>) => void;
export type OnErrorCallback = (error: Error) => void;
export type OnCompletedCallback = () => void;
export type _OnNotifyCallback = () => void;

export default class ThreadTask<T> {
  private onMessageCallback: OnMessageCallback<T> | null;
  private onErrorCallback: OnErrorCallback | null;
  private onCompletedCallback: OnCompletedCallback | null;
  private onNotifyCallback: _OnNotifyCallback | null;
  private workerTask: WorkerTask;
  private pendingMessages: ThreadMessage<T>[];
  private cancelled: boolean;

  constructor(workerTask: WorkerTask) {
    this.onMessageCallback = null;
    this.onErrorCallback = null;
    this.onCompletedCallback = null;
    this.onNotifyCallback = null;
    this.workerTask = workerTask;
    this.pendingMessages = [];
    this.cancelled = false;
  }

  notify(message: ThreadMessage<T>) {
    this.pendingMessages.push(message);

    if (this.onNotifyCallback) {
      this.onNotifyCallback();
    }
  }

  tryCancel() {
    this.cancelled = true;
  }

  isCancelled() {
    return this.cancelled;
  }

  hasPendingNotify() {
    return this.pendingMessages.length > 0;
  }

  _readNextPendingNotify() {
    return this.pendingMessages.shift();
  }

  _onNotify(callback: _OnNotifyCallback) {
    this.onNotifyCallback = callback;
    
    return this;
  }

  onMessage(callback: OnMessageCallback<T>) {
    this.onMessageCallback = callback;

    return this;
  }

  onError(callback: OnErrorCallback) {
    this.onErrorCallback = callback;

    return this;
  }

  onCompleted(callback: OnCompletedCallback) {
    this.onCompletedCallback = callback;

    return this;
  }

  get onMessageCallbackFn() {
    return this.onMessageCallback;
  }

  get onErrorCallbackFn() {
    return this.onErrorCallback;
  }

  get onCompletedCallbackFn() {
    return this.onCompletedCallback;
  }

  get task() {
    return this.workerTask;
  }

}