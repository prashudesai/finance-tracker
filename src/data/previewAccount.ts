import type { Account, FamilyMember, FamilyRequest } from '../Shell';
import type { VaultAccess, VaultGate } from './vault';

/**
 * Stand-ins for the signed-in features, so `dev:preview` shows every screen. They only change
 * memory, and never reach Firebase.
 */
const DEMO_CODE = 'ABCD-EFGH-JKLM-NPQR-STUV-WXYZ-2345';

let members: FamilyMember[] = [
  { email: 'jamie@example.test', role: 'editor', accepted: true },
  { email: 'sam@example.test', role: 'viewer', accepted: false },
];
let requests: FamilyRequest[] = [
  { uid: 'preview-member', email: 'riya@example.test', code: '4827 1936 5504' },
];
let faceId = false;

export const previewAccount: Account = {
  name: 'Preview',
  email: 'preview@example.test',
  role: 'owner',
  signOut: () => window.location.assign('/signin'),
  deleteAccount: () => Promise.reject(new Error('Deleting is turned off in this preview.')),
  security: {
    changePassphrase: () => Promise.resolve(),
    newRecoveryCode: () => Promise.resolve(DEMO_CODE),
    passkey: {
      available: () => Promise.resolve(true),
      enabled: () => faceId,
      enable: () => {
        faceId = true;
        return Promise.resolve();
      },
      disable: () => {
        faceId = false;
        return Promise.resolve();
      },
    },
  },
  family: {
    list: () => Promise.resolve(members),
    requests: () => Promise.resolve(requests),
    approve({ uid, email }) {
      requests = requests.filter((row) => row.uid !== uid);
      members = [...members, { email, role: 'viewer', accepted: true }];
      return Promise.resolve();
    },
    invite(email, role) {
      members = [...members, { email, role, accepted: false }];
      return Promise.resolve();
    },
    setRole(email, role) {
      members = members.map((row) => (row.email === email ? { ...row, role } : row));
      return Promise.resolve();
    },
    remove(email) {
      members = members.filter((row) => row.email !== email);
      return Promise.resolve();
    },
  },
};

const openApp = () => new Promise<VaultAccess>(() => window.location.assign('/'));

export const previewGate = (hasKeyring: boolean): VaultGate => ({
  hasKeyring,
  canUsePasskey: hasKeyring,
  autoPasskey: false,
  unlockWithPasskey: openApp,
  create: () =>
    Promise.resolve({
      recoveryCode: DEMO_CODE,
      passkeyAvailable: true,
      enablePasskey: () => Promise.resolve(),
      enter: openApp,
    }),
  unlock: (passphrase) =>
    passphrase === 'wrong'
      ? Promise.reject(new Error('That passphrase is not correct.'))
      : openApp(),
  recover: openApp,
  startOver: () => Promise.resolve(),
});

export const previewWaiting: Extract<VaultAccess, { status: 'waiting' }> = {
  status: 'waiting',
  code: '4827 1936 5504',
  retry: () => Promise.resolve(previewWaiting),
};
