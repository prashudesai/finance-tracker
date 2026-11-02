/** What an error report may contain. Nothing here can identify a person or a record. */
export interface ErrorReport {
  name: string;
  message: string;
  source: string;
  route: string;
  version: string;
  day: string;
  device: 'phone' | 'desktop';
}

const MAX_MESSAGE = 160;

/** Removes anything from an error message that could carry someone's data. */
export function sanitizeMessage(message: string) {
  return message
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]')
    .replace(/(["'`]).*?\1/g, '[text]')
    .replace(/[₹$]\s*[\d,.]+/g, '[amount]')
    .replace(/\d[\d,.:/-]*/g, '#')
    .slice(0, MAX_MESSAGE);
}

/** The app's file and line, without browser paths or query strings. */
export function firstAppFrame(stack: string | undefined) {
  const match = stack?.match(/\/assets\/([\w.-]+\.js):(\d+)/);
  return match ? `${match[1]}:${match[2]}` : '';
}

/** Records can have ids in their paths, so only the page's shape is kept. */
export const safeRoute = (path: string) => path.split(/[?#]/)[0]?.slice(0, 40) ?? '/';

export const errorKey = ({ name, message, source }: ErrorReport) => `${name}|${message}|${source}`;
