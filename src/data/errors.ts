/** Firestore's free plan stops answering for the rest of the day once its limit is reached. */
export const DAILY_LIMIT_MESSAGE =
  "The app has reached today's free usage limit. Your records are safe, and it'll work again within a day.";

/** Firebase and browser errors carry a code and aren't written for people. The app's own are. */
export function plainError(error: unknown, fallback: string) {
  if (error instanceof Error && 'code' in error && error.code === 'resource-exhausted') {
    return DAILY_LIMIT_MESSAGE;
  }
  return error instanceof Error && !('code' in error) ? error.message : fallback;
}
