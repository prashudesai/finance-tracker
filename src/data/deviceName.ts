const SYSTEMS: [RegExp, string][] = [
  [/iPhone/, 'iPhone'],
  [/iPad/, 'iPad'],
  [/Android/, 'Android'],
  [/Macintosh/, 'Mac'],
  [/Windows/, 'Windows'],
  [/Linux|CrOS/, 'Computer'],
];

const BROWSERS: [RegExp, string][] = [
  [/Edg/, 'Edge'],
  [/Firefox|FxiOS/, 'Firefox'],
  [/Chrome|CriOS/, 'Chrome'],
  [/Safari/, 'Safari'],
];

const nameFrom = (list: [RegExp, string][], agent: string) =>
  list.find(([pattern]) => pattern.test(agent))?.[1];

/** A rough description, so someone can recognise their own device in an approval. */
export function deviceName(agent: string) {
  const parts = [nameFrom(SYSTEMS, agent), nameFrom(BROWSERS, agent)].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : 'A new device';
}
