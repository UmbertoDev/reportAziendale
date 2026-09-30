export interface RetryPolicy {
  attempts: number;
  baseDelayMs: number;
  /** true se l'errore merita un nuovo tentativo */
  isRetryable: (error: unknown) => boolean;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Esegue `operation` con backoff esponenziale sugli errori ritentabili. */
export async function withRetry<T>(operation: () => Promise<T>, policy: RetryPolicy): Promise<T> {
  const sleep = policy.sleep ?? defaultSleep;
  for (let attempt = 1; ; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt >= policy.attempts || !policy.isRetryable(error)) throw error;
      await sleep(policy.baseDelayMs * 2 ** (attempt - 1));
    }
  }
}
