const SIGNAL_EXIT_CODES = {
  SIGINT: 130,
  SIGTERM: 143,
};

/** Return one shared promise for the first invocation of an async operation. */
export function createOnceAsync(operation) {
  let operationPromise;
  return (...args) => {
    if (!operationPromise) {
      operationPromise = Promise.resolve().then(() => operation(...args));
    }
    return operationPromise;
  };
}

/**
 * Claim ownership before an asynchronous start operation begins, then keep that
 * ownership through a failed or interrupted start so cleanup still invokes the
 * supplied stop operation. A successful stop releases ownership for a later
 * cycle; a failed stop retains ownership and can be retried. Callers should
 * settle/terminate the start command before awaiting stop.
 */
export function createManagedResourceLifecycle({ stop }) {
  let claimed = false;
  let startPromise;
  let stopPromise;

  return {
    start(operation) {
      if (claimed) throw new Error("Managed resource has already been claimed");
      claimed = true;
      startPromise = Promise.resolve().then(operation);
      return startPromise;
    },
    stop() {
      if (!claimed) return Promise.resolve();
      if (!stopPromise) {
        const currentStop = (async () => {
          try {
            await startPromise;
          } catch {
            // A failed/interrupted start may still have launched the managed
            // resource, so the stop operation remains mandatory.
          }
          await stop();
          claimed = false;
          startPromise = undefined;
        })();
        stopPromise = currentStop;
        void currentStop.then(
          () => {
            if (stopPromise === currentStop) stopPromise = undefined;
          },
          () => {
            // Keep ownership after a failed stop, but release the in-flight
            // promise so a later cleanup call can retry the stop operation.
            if (stopPromise === currentStop) stopPromise = undefined;
          },
        );
      }
      return stopPromise;
    },
  };
}

/** Build a testable signal handler that finalizes once before exiting. */
export function createSignalShutdown({ finalize, reportError, exit }) {
  let shutdownPromise;
  return (signal) => {
    if (shutdownPromise) return shutdownPromise;
    const exitCode = SIGNAL_EXIT_CODES[signal] ?? 128;
    const signalFailure = new Error(`E2E runner received ${signal}`);
    shutdownPromise = Promise.resolve()
      .then(() => finalize(signalFailure))
      .catch((error) => reportError(error))
      .finally(() => exit(exitCode));
    return shutdownPromise;
  };
}
