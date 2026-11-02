/** Firebase and browser errors carry a code and aren't written for people. The app's own are. */
export const plainError = (error: unknown, fallback: string) =>
  error instanceof Error && !('code' in error) ? error.message : fallback;
