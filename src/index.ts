import ThreadedPromise from "./thread/threaded.promise";

const isPrime = async (num: number, cores = 4): Promise<boolean> => new Promise(async (resolve) => {
  const testNumbers = Array.from({ length: Math.floor(Math.sqrt(num)) }, (_, i) => i + 2);

  const testNumbersChunks = Array.from({ length: cores }, (_, i) => {
    const chunkSize = Math.ceil(testNumbers.length / cores);

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
    }, param);

    promise
      .then((isPrime) => {
        promises.splice(promises.indexOf(promise), 1);

        if (!isPrime) {
          resolve(false);

          for (const promise of promises) {
            promise.cancel();
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
  // const start = 1E6;
  // const end = 1E6 + 1000;
  // const primes: Array<number> = [];

  // for (let i = start; i <= end; i++) {
  //   const isAPrimeNumber = await isPrime(i, 10);
    
  //   if (isAPrimeNumber) {
  //     primes.push(i);
  //   }

  //   console.log(`${((i - start) / (end - start) * 100).toFixed(1)}%`)
  // }

  // console.log(primes);

  for (let numCores = 1; numCores <= 15; numCores++) {
    performance.mark("start");
    await isPrime(1E16, numCores);
    performance.mark("end");
  
    const duration = performance.measure("isPrime", "start", "end").duration;
  
    console.log(`With ${numCores} cores took: ${duration}ms`);
  }
}

main();
