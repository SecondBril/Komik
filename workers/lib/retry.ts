/**
 * Retries an async task with exponential backoff
 */
export async function retryTask<T>(
  fn: () => Promise<T>,
  retries = 3,
  delayMs = 2000
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries <= 0) {
      throw error;
    }
    console.warn(`[Retry Worker] Task failed, retrying in ${delayMs}ms... (${retries} attempts left)`);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    return retryTask(fn, retries - 1, delayMs * 2);
  }
}
