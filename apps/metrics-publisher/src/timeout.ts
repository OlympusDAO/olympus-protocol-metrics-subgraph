export const DEFAULT_EXTERNAL_REQUEST_TIMEOUT_MS = 60_000;

export class OperationTimeoutError extends Error {
  constructor(operation: string, timeoutMs: number) {
    super(`${operation} timed out after ${timeoutMs}ms.`);
    this.name = "OperationTimeoutError";
  }
}

export async function withTimeout<T>(
  operation: Promise<T>,
  input: { operation: string; timeoutMs: number },
): Promise<T> {
  // The operation may already be in flight before timeout validation runs.
  void operation.catch(() => {});
  validateTimeoutMs(input.timeoutMs);
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => {
          reject(new OperationTimeoutError(input.operation, input.timeoutMs));
        }, input.timeoutMs);
      }),
    ]);
  } finally {
    if (timeout !== undefined) {
      clearTimeout(timeout);
    }
  }
}

export function validateTimeoutMs(timeoutMs: number): void {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1) {
    throw new Error("timeoutMs must be a positive integer.");
  }
}
