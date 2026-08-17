import { finished } from "node:stream/promises";

/**
 * Merge a child process's two output streams without letting the first stream
 * to finish close the shared destination. The returned promise settles only
 * after both inputs and the destination itself have finished.
 */
export function pipeProcessOutputToWritable({ stdout, stderr }, destination) {
  if (!stdout || !stderr) {
    throw new Error("A logged process must expose both stdout and stderr streams");
  }

  // Attach the rejection handler immediately: the destination may fail while
  // one of the process streams is still open, long before we are ready to end
  // and await it.
  const destinationResultPromise = Promise.allSettled([finished(destination)]).then(
    (results) => {
      if (results.some((result) => result.status === "rejected")) {
        // A failed destination makes pipe() detach and pause its readable. Keep
        // draining both process streams so their close/end lifecycle can settle
        // after the process is stopped.
        stdout.unpipe(destination);
        stderr.unpipe(destination);
        stdout.resume();
        stderr.resume();
      }
      return results;
    },
  );
  stdout.pipe(destination, { end: false });
  stderr.pipe(destination, { end: false });

  return (async () => {
    const inputResults = await Promise.allSettled([finished(stdout), finished(stderr)]);
    destination.end();
    const destinationResult = await destinationResultPromise;
    const failures = [...inputResults, ...destinationResult]
      .filter((result) => result.status === "rejected")
      .map((result) => result.reason);

    if (failures.length === 1) throw failures[0];
    if (failures.length > 1) {
      throw new AggregateError(failures, "Service output could not be completely persisted");
    }
  })();
}
