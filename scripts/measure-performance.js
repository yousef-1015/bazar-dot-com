const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const BOOK_ID = process.env.BOOK_ID || "1";
const RUNS = Number.parseInt(process.env.RUNS || "20", 10);

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

async function timedRequest(url, options = {}) {
  const start = performance.now();
  await fetch(url, options);
  const end = performance.now();
  return (end - start) / 1000;
}

async function printExperiment(title, run) {
  console.log(title);

  const times = [];
  for (let i = 0; i < RUNS; i += 1) {
    const seconds = await run();
    times.push(seconds);
    console.log(seconds.toFixed(7));
  }

  console.log("Average response time:");
  console.log(average(times).toFixed(7));
  console.log();
}

async function main() {
  console.log("Bazar.com Phase 2 performance measurement");
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Book ID: ${BOOK_ID}`);
  console.log(`Runs per experiment: ${RUNS}`);
  console.log();

  console.log(`Warming cache with GET /info/${BOOK_ID}...`);
  await fetch(`${BASE_URL}/info/${BOOK_ID}`);
  console.log();

  await printExperiment(
    `Experiment 1: GET /info/${BOOK_ID} with cache`,
    () => timedRequest(`${BASE_URL}/info/${BOOK_ID}`)
  );

  await printExperiment(
    `Experiment 2: GET /info/${BOOK_ID} after cache invalidation`,
    async () => {
      await fetch(`${BASE_URL}/cache/${BOOK_ID}`, { method: "DELETE" });
      return timedRequest(`${BASE_URL}/info/${BOOK_ID}`);
    }
  );

  await printExperiment(
    `Experiment 3: DELETE /cache/${BOOK_ID} invalidation overhead`,
    () => timedRequest(`${BASE_URL}/cache/${BOOK_ID}`, { method: "DELETE" })
  );
}

main().catch((error) => {
  console.error("Performance measurement failed.");
  console.error(error);
  process.exit(1);
});
