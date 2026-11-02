import type { Account, DeviceApproval, FamilyMember, FamilyRequest } from '../Shell';
import type { VaultAccess, VaultGate } from './vault';

/**
 * Stand-ins for the signed-in features, so `dev:preview` shows every screen. They only change
 * memory, and never reach Firebase.
 */
const DEMO_CODE = 'ABCD-EFGH-JKLM-NPQR-STUV-WXYZ-2345';

let members: FamilyMember[] = [
  { email: 'jamie@example.test', role: 'editor', accepted: true },
  { email: 'sam@example.test', role: 'viewer', accepted: false },
  { email: 'riya@example.test', role: 'viewer', accepted: true },
];
let requests: FamilyRequest[] = [
  { uid: 'preview-member', email: 'riya@example.test', code: '4827 1936 5504' },
];
let faceId = false;
let requestListener: (rows: FamilyRequest[]) => void = () => undefined;

// Add ?new-device to the address to see what a saved device is asked.
let devices: DeviceApproval[] = window.location.search.includes('new-device')
  ? [{ id: 'preview-device', device: 'iPhone · Safari', code: '7310 2268 9145' }]
  : [];
let deviceListener: (rows: DeviceApproval[]) => void = () => undefined;

function closeDevice(id: string) {
  devices = devices.filter((row) => row.id !== id);
  deviceListener(devices);
  return Promise.resolve();
}

function closeRequest(uid: string) {
  requests = requests.filter((row) => row.uid !== uid);
  requestListener(requests);
}

export const previewAccount: Account = {
  name: 'Preview',
  email: 'preview@example.test',
  role: 'owner',
  signOut: () => window.location.assign('/signin'),
  deleteAccount: () => Promise.reject(new Error('Deleting is turned off in this preview.')),
  security: {
    changePassphrase: () => Promise.resolve(),
    newRecoveryCode: () => Promise.resolve(DEMO_CODE),
    watchDevices(onChange) {
      deviceListener = onChange;
      onChange(devices);
      return () => {
        deviceListener = () => undefined;
      };
    },
    approveDevice: ({ id }) => closeDevice(id),
    denyDevice: ({ id }) => closeDevice(id),
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
    watchRequests(onChange) {
      requestListener = onChange;
      onChange(requests);
      return () => {
        requestListener = () => undefined;
      };
    },
    approve({ uid }) {
      closeRequest(uid);
      return Promise.resolve();
    },
    deny({ uid, email }) {
      closeRequest(uid);
      members = members.filter((row) => row.email !== email);
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
  newDevice: hasKeyring,
  askSavedDevice(onChange) {
    onChange({ status: 'waiting', code: '7310 2268 9145' });
    return () => undefined;
  },
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
  watch: () => () => undefined,
};
