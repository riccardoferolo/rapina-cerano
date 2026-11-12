const INTERVALLO_MS = 12;

setInterval(() => postMessage(performance.now()), INTERVALLO_MS);
