export const APP_URL = 'https://finance-trackerp.web.app';

export interface ShareMessage {
  title: string;
  text: string;
}

export type ShareResult = 'shared' | 'copied' | 'cancelled' | 'failed';

/** The invite a family member gets: how to join, in plain words. */
export const familyInvite = (name: string | null, email: string): ShareMessage => ({
  title: 'Join our family finance tracker',
  text: [
    `Hi${name ? ` ${name}` : ''}, I've added you to our family finance tracker 😊`,
    '',
    `1. Open ${APP_URL}`,
    `2. Sign in with Google using ${email}`,
    "3. I'll approve you from my phone",
    '',
    'Our records are encrypted, so only family can see them.',
  ].join('\n'),
});

/** For friends who'd like their own tracker. */
export const appInvite: ShareMessage = {
  title: 'Finance Tracker',
  text: `I've been using Finance Tracker to keep track of our family's money: income, expenses, investments and loans in one place. It's free, and encrypted on your phone. Try it: ${APP_URL}`,
};

/** Opens the phone's share menu, or copies the message where there isn't one. */
export async function shareMessage({ title, text }: ShareMessage): Promise<ShareResult> {
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, text });
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'failed';
  }
}

/** What to tell the person afterwards, if anything. */
export const shareStatus = (result: ShareResult) =>
  result === 'copied'
    ? 'Copied. Paste it into WhatsApp or any message.'
    : result === 'failed'
      ? 'This couldn’t be shared. Copy the link instead: ' + APP_URL
      : '';
