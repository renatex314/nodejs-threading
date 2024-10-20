import ThreadPool from "./thread/thread.pool";
import ThreadedPromise from "./thread/threaded.promise";

const pool = new ThreadPool(7);
pool.start();

const isPrime = async (num: number, cores = 7, partitions = 7): Promise<boolean> => new Promise(async (resolve) => {

  const testNumbers = Array.from({ length: Math.floor(Math.sqrt(num)) }, (_, i) => i + 2);

  const testNumbersChunks = Array.from({ length: partitions }, (_, i) => {
    const chunkSize = Math.ceil(testNumbers.length / partitions);

    return testNumbers.slice(i * chunkSize, (i + 1) * chunkSize);
  }).filter(chunk => chunk.length > 0);

  const promises: Array<ThreadedPromise<{ num: number, chunk: number[] }, boolean>> = [];

  for (const chunk of testNumbersChunks) {
    const param = {
      num,
      chunk
    }

    const promise = new ThreadedPromise<typeof param, boolean>((accept, _, params) => {
      const { num, chunk } = params;

      for (const testNumber of chunk) {
        if (num % testNumber === 0) {
          accept(false);

          return;
        }
      }

      accept(true);
    }, param, pool);

    promise
      .then((isPrime) => {
        promises.splice(promises.indexOf(promise), 1);

        if (!isPrime) {
          resolve(false);

          for (const promise of promises) {
            promise.tryCancel();
          }
        }

        if (promises.length === 0) {
          resolve(true);
        }
      })
      .catch(() => {});

    promises.push(promise);
  }
});

async function main() {
  const primes = Array.from({ length: 100000 }, (_, i) => i + 1).map((i) => [i, isPrime(i, 1, 1)]);

  const results = (await Promise.all(primes.map(async ([_, prom]) => prom))).map((isPrime, i) => isPrime ? i + 1 : -1).filter((i) => i !== -1);

  console.log(results);

  pool.terminate();
}

main();