import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createContext, runInContext } from 'node:vm';

/** Runs the older app's frozen formulas, so parity tests keep a fixed reference. */
export function loadLegacyFunctions(globals: Record<string, unknown> = {}) {
  const source = readFileSync(resolve(process.cwd(), 'src/domain/reference/core.js'), 'utf8');
  const context = createContext({ ...globals });
  runInContext(source, context);
  return context as unknown as Record<string, (...args: unknown[]) => never>;
}
