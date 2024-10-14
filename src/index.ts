import Thread from "./thread/thread";

const thread = new Thread(async (notify, next, terminate) => {
  const Thread = require("./thread/thread");

  console.log("Teste");

  console.log(Thread);
}).start();

thread.onMessage((message) => {
  console.log(message);
});
thread.onError((error) => {
  console.error(error);
});
