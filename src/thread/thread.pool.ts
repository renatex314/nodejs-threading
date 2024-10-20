import Thread, { ThreadFunction } from "./thread";

export default class ThreadPool<T> {
  private threads: Array<Thread<T>>;
  private threadCount: number;
  private terminated: boolean;

  constructor(threadCount: number) {
    this.threads = [];
    this.threadCount = threadCount;
    this.terminated = false;
  }

  start() {
    for (let i = 0; i < this.threadCount; i++) {
      const thread = new Thread(null, true);
      thread.start();

      this.threads.push(thread);
    }
  }

  enqueueTask(fn: ThreadFunction<T>) {
    if (this.terminated) {
      throw new Error("The thread pool has been terminated");
    }

    let thread: Thread<T> | null = null;
    let lessPendingTasksCount = Number.MAX_SAFE_INTEGER;

    for (const t of this.threads) {
      const threadPendingTasksCount = t.getPendingTasksCount();

      if (threadPendingTasksCount < lessPendingTasksCount) {
        thread = t;
        lessPendingTasksCount = threadPendingTasksCount;
      }
    }

    if (!thread) {
      throw new Error("No thread available");
    }

    return thread.enqueueTask(fn);
  }

  terminate() {
    for (const thread of this.threads) {
      thread.terminate();
    }

    this.terminated = true;
  }

}