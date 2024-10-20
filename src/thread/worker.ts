import type { NotifyFunction, NextFunction, TerminateFunction, ImportModuleFunction, WorkerFirstMessage, WorkerTask } from "./thread";

type ExecutionContext = {
  notify: NotifyFunction<unknown>;
  next: NextFunction<unknown>;
  terminate: TerminateFunction;
  importModule: ImportModuleFunction;
  keepAlive: boolean;
};

(function() {
  const { parentPort } = require('worker_threads') as typeof import('worker_threads');

  const Thread = require('./thread').default;
  const path = require('path');

  function _parseSendMessage(message: unknown) { 
    return Thread.parseSendMessage(message); 
  }

  function _parseReceivedMessage(message: unknown) { 
    return Thread.parseReceivedMessage(message); 
  }

  const notify = (message: unknown) => parentPort!.postMessage(_parseSendMessage(message));
  const next = () => new Promise((resolve) => parentPort!.once('message', (message) => resolve(_parseReceivedMessage(message))));
  const terminate = () => parentPort!.postMessage('terminate');

  return new Promise((resolve) => {
    parentPort!.once('message', (message: WorkerFirstMessage) => {
      const importModule = (relativePath: string) => require(path.resolve(message.callerDirname, relativePath));

      resolve({
        notify,
        next,
        importModule,
        terminate,
        keepAlive: message.keepAlive
      } as ExecutionContext);
    });
  })
})().then((executionContext) => {
  const { parentPort } = require('worker_threads') as typeof import('worker_threads');
  const { notify, next, terminate, importModule, keepAlive } = executionContext as ExecutionContext;

  const processQueue = async (task: WorkerTask | null) => {
    const waitNextTask = () => {
      parentPort!.once('message', (message: WorkerTask | null) => processQueue(message));
    }

    if (!task) {
      waitNextTask();

      return;
    }

    try {
      const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;

      const promise = new AsyncFunction(...task.functionParameters.split(","), task.functionBody)(notify, next, terminate, importModule);
  
      await promise;
    } catch (err) {
      parentPort!.postMessage(err);
    }

    parentPort!.postMessage('completed');
  
    if (!keepAlive) {
      terminate();

      return;
    }

    waitNextTask();
  };

  processQueue(null);
});
