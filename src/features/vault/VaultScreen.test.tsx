import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { DeviceAsk, VaultAccess, VaultGate } from '../../data/vault';
import { VaultScreen, WaitingForApproval } from './VaultScreen';

const open = { status: 'open' } as VaultAccess;

function gate(overrides: Partial<VaultGate>): VaultGate {
  return {
    hasKeyring: true,
    canUsePasskey: false,
    autoPasskey: false,
    newDevice: false,
    askSavedDevice: vi.fn(() => () => undefined),
    unlockWithPasskey: vi.fn(),
    create: vi.fn(),
    unlock: vi.fn(),
    recover: vi.fn(),
    startOver: vi.fn(),
    ...overrides,
  };
}

const agree = () => {
  fireEvent.click(screen.getByRole('checkbox', { name: /agree to the privacy page/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Agree and continue' }));
};

const show = (value: VaultGate, onAccess = vi.fn(), onStartOver = vi.fn()) => {
  render(
    <MemoryRouter>
      <VaultScreen gate={value} onAccess={onAccess} onSignOut={vi.fn()} onStartOver={onStartOver} />
    </MemoryRouter>,
  );
  return { onAccess, onStartOver };
};

afterEach(cleanup);

test('a first-time user must save their recovery code before continuing', async () => {
  const enter = vi.fn(async () => open);
  const create = vi.fn(async () => ({
    recoveryCode: 'ABCD-EFGH',
    passkeyAvailable: false,
    enablePasskey: vi.fn(),
    enter,
  }));
  const { onAccess } = show(gate({ hasKeyring: false, create }));
  agree();
  const submit = screen.getByRole('button', { name: 'Create passphrase' });
  fireEvent.change(screen.getByLabelText('Passphrase'), { target: { value: 'short' } });
  expect(screen.getByText('Use at least 12 characters.')).toBeDefined();
  fireEvent.change(screen.getByLabelText('Passphrase'), { target: { value: 'a long passphrase' } });
  fireEvent.change(screen.getByLabelText('Repeat passphrase'), { target: { value: 'different' } });
  expect(submit).toHaveProperty('disabled', true);
  fireEvent.change(screen.getByLabelText('Repeat passphrase'), {
    target: { value: 'a long passphrase' },
  });
  fireEvent.click(submit);
  expect(await screen.findByText('ABCD-EFGH')).toBeDefined();
  const next = screen.getByRole('button', { name: 'Continue' });
  expect(next).toHaveProperty('disabled', true);
  fireEvent.click(screen.getByLabelText("I've saved my recovery code"));
  fireEvent.click(next);
  await waitFor(() => expect(onAccess).toHaveBeenCalledWith(open));
});

test('a wrong passphrase says so', async () => {
  const unlock = vi.fn(async () => {
    throw new Error('That passphrase is not correct.');
  });
  show(gate({ unlock }));
  fireEvent.change(screen.getByLabelText('Passphrase'), { target: { value: 'wrong' } });
  fireEvent.click(screen.getByRole('button', { name: /Unlock/ }));
  expect((await screen.findByRole('alert')).textContent).toBe('That passphrase is not correct.');
});

test('starting over needs the exact phrase', async () => {
  const startOver = vi.fn(async () => undefined);
  const { onStartOver } = show(gate({ startOver }));
  const button = screen.getByRole('button', { name: 'Delete and start again', hidden: true });
  expect(button).toHaveProperty('disabled', true);
  fireEvent.change(screen.getByLabelText('Type DELETE MY DATA to confirm'), {
    target: { value: 'DELETE MY DATA' },
  });
  fireEvent.click(button);
  await waitFor(() => expect(onStartOver).toHaveBeenCalled());
  expect(startOver).toHaveBeenCalledTimes(1);
});

test('someone waiting sees their code and is told when not yet approved', async () => {
  const watch = () => () => undefined;
  const retry = vi.fn(async (): Promise<VaultAccess> => ({
    status: 'waiting',
    code: '1',
    retry,
    watch,
  }));
  render(
    <WaitingForApproval
      access={{
        status: 'waiting',
        code: '1234 5678 9012',
        retry,
        watch: () => () => undefined,
      }}
      onAccess={vi.fn()}
      onSignOut={vi.fn()}
    />,
  );
  expect(screen.getByText('1234 5678 9012')).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: 'Check again' }));
  expect(await screen.findByText('Not approved yet.')).toBeDefined();
});

test('Face ID is offered only when this account has it', async () => {
  const unlockWithPasskey = vi.fn(async () => open);
  const { onAccess } = show(gate({ canUsePasskey: true, unlockWithPasskey }));
  fireEvent.click(screen.getByRole('button', { name: /Face ID or fingerprint/ }));
  await waitFor(() => expect(onAccess).toHaveBeenCalledWith(open));
  cleanup();
  show(gate({}));
  expect(screen.queryByRole('button', { name: /Face ID/ })).toBeNull();
});

test('a device with Face ID on starts the check without a tap', async () => {
  const unlockWithPasskey = vi.fn(async () => open);
  const { onAccess } = show(gate({ canUsePasskey: true, autoPasskey: true, unlockWithPasskey }));
  await waitFor(() => expect(onAccess).toHaveBeenCalledWith(open));
  expect(unlockWithPasskey).toHaveBeenCalledTimes(1);
});

test('a blocked or cancelled check leaves the button, with no error', async () => {
  const unlockWithPasskey = vi.fn(async (): Promise<VaultAccess> => {
    throw new Error('The request is not allowed.');
  });
  show(gate({ canUsePasskey: true, autoPasskey: true, unlockWithPasskey }));
  await waitFor(() => expect(unlockWithPasskey).toHaveBeenCalledTimes(1));
  expect(screen.getByRole('button', { name: /Face ID or fingerprint/ })).toBeDefined();
  expect(screen.queryByRole('alert')).toBeNull();
});

test('a device without Face ID on never starts the check by itself', () => {
  const unlockWithPasskey = vi.fn(async () => open);
  show(gate({ canUsePasskey: true, unlockWithPasskey }));
  expect(unlockWithPasskey).not.toHaveBeenCalled();
});

describe('setup offers Face ID after the recovery code', () => {
  const reachOffer = async (passkeyAvailable: boolean) => {
    const enter = vi.fn(async () => open);
    const enablePasskey = vi.fn(async () => undefined);
    const create = vi.fn(async () => ({
      recoveryCode: 'ABCD-EFGH',
      passkeyAvailable,
      enablePasskey,
      enter,
    }));
    const { onAccess } = show(gate({ hasKeyring: false, create }));
    agree();
    const value = { target: { value: 'a long passphrase' } };
    fireEvent.change(screen.getByLabelText('Passphrase'), value);
    fireEvent.change(screen.getByLabelText('Repeat passphrase'), value);
    fireEvent.click(screen.getByRole('button', { name: 'Create passphrase' }));
    await screen.findByText('ABCD-EFGH');
    fireEvent.click(screen.getByLabelText("I've saved my recovery code"));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    return { enablePasskey, enter, onAccess };
  };

  test('turning it on enables it, then opens the app', async () => {
    const { enablePasskey, onAccess } = await reachOffer(true);
    await screen.findByText('Use Face ID or fingerprint?');
    fireEvent.click(screen.getByRole('button', { name: /Turn on/ }));
    await waitFor(() => expect(onAccess).toHaveBeenCalledWith(open));
    expect(enablePasskey).toHaveBeenCalledTimes(1);
  });

  test('Not now opens the app without it', async () => {
    const { enablePasskey, onAccess } = await reachOffer(true);
    fireEvent.click(await screen.findByRole('button', { name: 'Not now' }));
    await waitFor(() => expect(onAccess).toHaveBeenCalledWith(open));
    expect(enablePasskey).not.toHaveBeenCalled();
  });

  test('a failure explains itself and still lets them continue', async () => {
    const { enablePasskey, onAccess } = await reachOffer(true);
    enablePasskey.mockRejectedValueOnce(new Error("This device can't use it."));
    fireEvent.click(await screen.findByRole('button', { name: /Turn on/ }));
    expect((await screen.findByRole('alert')).textContent).toContain("can't use it");
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
    await waitFor(() => expect(onAccess).toHaveBeenCalledWith(open));
  });

  test('a device without support skips the question', async () => {
    const { onAccess } = await reachOffer(false);
    await waitFor(() => expect(onAccess).toHaveBeenCalledWith(open));
    expect(screen.queryByText('Use Face ID or fingerprint?')).toBeNull();
  });
});

describe('copying the recovery code', () => {
  const showCode = async () => {
    const enter = vi.fn(async () => open);
    const create = vi.fn(async () => ({
      recoveryCode: 'ABCD-EFGH',
      passkeyAvailable: false,
      enablePasskey: vi.fn(),
      enter,
    }));
    show(gate({ hasKeyring: false, create }));
    agree();
    const value = { target: { value: 'a long passphrase' } };
    fireEvent.change(screen.getByLabelText('Passphrase'), value);
    fireEvent.change(screen.getByLabelText('Repeat passphrase'), value);
    fireEvent.click(screen.getByRole('button', { name: 'Create passphrase' }));
    await screen.findByText('ABCD-EFGH');
  };
  const clipboard = (writeText?: () => Promise<void>) =>
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: writeText ? { writeText } : undefined,
    });

  test('confirms on screen when it worked', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    clipboard(writeText);
    await showCode();
    fireEvent.click(screen.getByRole('button', { name: 'Copy code' }));
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeDefined();
    expect(writeText).toHaveBeenCalledWith('ABCD-EFGH');
  });

  test('says so when the browser refuses', async () => {
    clipboard(() => Promise.reject(new Error('denied')));
    await showCode();
    fireEvent.click(screen.getByRole('button', { name: 'Copy code' }));
    expect((await screen.findByRole('alert')).textContent).toContain('blocked copying');
    clipboard();
  });
});

describe('a new device', () => {
  const asking = (answer: DeviceAsk) =>
    gate({
      newDevice: true,
      askSavedDevice: vi.fn((onChange) => {
        onChange(answer);
        return () => undefined;
      }),
    });

  test('shows the code to check on the saved device, and the passphrase stays', async () => {
    show(asking({ status: 'waiting', code: '1111 2222 3333' }));
    expect(await screen.findByText('1111 2222 3333')).toBeDefined();
    expect(screen.getByLabelText('Passphrase')).toBeDefined();
  });

  test('says so when the saved device denies it', async () => {
    show(asking({ status: 'denied' }));
    expect((await screen.findByRole('alert')).textContent).toContain('did not approve');
    expect(screen.getByLabelText('Passphrase')).toBeDefined();
  });

  test('opens when the saved device approves', async () => {
    const onAccess = vi.fn();
    show(asking({ status: 'approved', access: open }), onAccess);
    await waitFor(() => expect(onAccess).toHaveBeenCalledWith(open));
  });

  test('a device that has unlocked before asks nobody', () => {
    const value = gate({ newDevice: false });
    show(value);
    expect(value.askSavedDevice).not.toHaveBeenCalled();
  });
});

describe('first-time setup', () => {
  test('asks for agreement first, and needs the box ticked', () => {
    show(gate({ hasKeyring: false }));
    expect(screen.queryByRole('button', { name: 'Create passphrase' })).toBeNull();
    const next = screen.getByRole('button', { name: 'Agree and continue' });
    expect((next as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('link', { name: 'Read the full privacy page' })).toBeDefined();
    agree();
    expect(screen.getByRole('button', { name: 'Create passphrase' })).toBeDefined();
  });

  test('someone who already has a passphrase is not asked', () => {
    show(gate({ hasKeyring: true }));
    expect(screen.queryByRole('button', { name: 'Agree and continue' })).toBeNull();
  });
});

test('someone waiting moves on by themselves once approved', async () => {
  const onAccess = vi.fn();
  const stop = vi.fn();
  const { unmount } = render(
    <WaitingForApproval
      access={{
        status: 'waiting',
        code: '1234 5678 9012',
        retry: vi.fn(),
        watch: (onOpen) => {
          onOpen(open);
          return stop;
        },
      }}
      onAccess={onAccess}
      onSignOut={vi.fn()}
    />,
  );
  expect(onAccess).toHaveBeenCalledWith(open);
  unmount();
  expect(stop).toHaveBeenCalled();
});
