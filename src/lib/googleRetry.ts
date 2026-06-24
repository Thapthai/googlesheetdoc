function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getErrorCode(error: unknown): number | undefined {
  const err = error as {
    code?: number;
    cause?: { code?: number };
    response?: { status?: number };
  };
  return err.code ?? err.cause?.code ?? err.response?.status;
}

function getErrorMessage(error: unknown): string {
  const err = error as {
    message?: string;
    cause?: { message?: string };
    response?: { data?: unknown };
  };
  const data = err.response?.data;
  if (typeof data === "string") return data;
  return err.cause?.message ?? err.message ?? String(error);
}

export function isRetryableGoogleError(error: unknown): boolean {
  const code = getErrorCode(error);
  const msg = getErrorMessage(error);

  if (code === 429 || code === 500 || code === 502 || code === 503) {
    return true;
  }

  return (
    msg.includes("Error 502") ||
    msg.includes("Error 503") ||
    msg.includes("429") ||
    msg.includes("ECONNRESET") ||
    msg.includes("ETIMEDOUT") ||
    msg.includes("temporarily unavailable") ||
    msg.includes("backendError")
  );
}

export async function withGoogleRetry<T>(
  fn: () => Promise<T>,
  options?: { maxAttempts?: number; label?: string }
): Promise<T> {
  const maxAttempts = options?.maxAttempts ?? 4;
  const delays = [2000, 5000, 10000];
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts || !isRetryableGoogleError(error)) {
        throw error;
      }

      const delay = delays[attempt - 1] ?? 10000;
      const label = options?.label ?? "request";
      console.warn(
        `[Google API] ${label} ล้มเหลว (ครั้งที่ ${attempt}/${maxAttempts}) — ลองใหม่ใน ${delay / 1000}s`
      );
      await sleep(delay);
    }
  }

  throw lastError;
}
