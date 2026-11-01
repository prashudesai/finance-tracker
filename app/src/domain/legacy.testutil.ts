import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createContext, runInContext } from 'node:vm';

/**
 * Loads named top-level functions from the legacy classic scripts, for parity tests.
 * Legacy keeps them in one shared scope, so they cannot be imported. Delete at cutover.
 */
export function loadLegacyFunctions(
  files: string[],
  names: string[],
  globals: Record<string, unknown> = {},
) {
  const source = files
    .map((file) => readFileSync(resolve(process.cwd(), '../src/core', file), 'utf8'))
    .join('\n');
  const body = names.map((name) => {
    const match = new RegExp(`^    (?:async )?function ${name}\\(`, 'm').exec(source);
    if (!match) throw new Error(`Legacy function not found: ${name}`);
    const lineEnd = source.indexOf('\n', match.index);
    const line = source.slice(match.index, lineEnd).trimEnd();
    return line.endsWith('}')
      ? line
      : source.slice(match.index, source.indexOf('\n    }', match.index) + 6);
  });
  const context = createContext({ ...globals });
  runInContext(body.join('\n'), context);
  return context as unknown as Record<string, (...args: unknown[]) => never>;
}
