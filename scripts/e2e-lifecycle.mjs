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
