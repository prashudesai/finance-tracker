import { fromBase64, toBase64 } from './crypto';

/**
 * Face ID or fingerprint unlock, through a passkey's PRF extension. The device turns a biometric
 * check into a secret that never leaves it, and that secret opens the private key. No biometric
 * data reaches the app.
 */

export interface PasskeySecret {
  id: string;
  salt: string;
  secret: Uint8Array;
}

interface PrfOutput {
  prf?: { enabled?: boolean; results?: { first?: BufferSource } };
}

const toUrlSafe = (base64: string) =>
  base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const buffer = (bytes: Uint8Array) => bytes.slice().buffer;

/** True when this device has a built-in biometric check the browser can use. */
export async function passkeysAvailable() {
  try {
    return (
      typeof PublicKeyCredential !== 'undefined' &&
      (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable())
    );
  } catch {
    return false;
  }
}

async function requestSecret(entries: { id: string; salt: string }[]) {
  const evalByCredential = Object.fromEntries(
    entries.map(({ id, salt }) => [toUrlSafe(id), { first: buffer(fromBase64(salt)) }]),
  );
  const credential = (await navigator.credentials.get({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      allowCredentials: entries.map(({ id }) => ({
        id: buffer(fromBase64(id)),
        type: 'public-key',
      })),
      userVerification: 'required',
      extensions: { prf: { evalByCredential } } as AuthenticationExtensionsClientInputs,
    },
  })) as PublicKeyCredential | null;
  const first = (credential?.getClientExtensionResults() as PrfOutput | undefined)?.prf?.results
    ?.first;
  if (!credential || !first) throw new Error('This device could not unlock the tracker.');
  const id = toBase64(new Uint8Array(credential.rawId));
  const salt = entries.find((entry) => entry.id === id)?.salt;
  if (!salt) throw new Error('This device could not unlock the tracker.');
  return { id, salt, secret: new Uint8Array(first as ArrayBuffer) } as PasskeySecret;
}

export async function createPasskey(user: { uid: string; email: string }) {
  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: 'Finance Tracker' },
      user: {
        id: new TextEncoder().encode(user.uid),
        name: user.email,
        displayName: user.email,
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        residentKey: 'preferred',
        userVerification: 'required',
      },
      extensions: { prf: {} } as AuthenticationExtensionsClientInputs,
    },
  })) as PublicKeyCredential | null;
  const output = credential?.getClientExtensionResults() as PrfOutput | undefined;
  if (!credential || !output?.prf?.enabled) {
    throw new Error("This device or browser can't use Face ID or fingerprint unlock yet.");
  }
  const id = toBase64(new Uint8Array(credential.rawId));
  const salt = toBase64(crypto.getRandomValues(new Uint8Array(32)));
  return requestSecret([{ id, salt }]);
}

export const usePasskey = requestSecret;
