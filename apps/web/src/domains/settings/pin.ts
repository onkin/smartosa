const HASH_KEY = 'smartosa.pinHash';
const UNLOCKED_KEY = 'smartosa.unlocked';

export async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode(pin);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export function getPinHash(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.localStorage.getItem(HASH_KEY);
}

export function hasPin(): boolean {
  return Boolean(getPinHash());
}

export async function setPin(pin: string): Promise<void> {
  window.localStorage.setItem(HASH_KEY, await hashPin(pin));
  window.sessionStorage.setItem(UNLOCKED_KEY, '1');
}

export function clearPin(): void {
  window.localStorage.removeItem(HASH_KEY);
  window.sessionStorage.setItem(UNLOCKED_KEY, '1');
}

export function isUnlocked(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  if (!hasPin()) {
    return true;
  }
  return window.sessionStorage.getItem(UNLOCKED_KEY) === '1';
}

export async function unlockWithPin(pin: string): Promise<boolean> {
  const stored = getPinHash();
  if (!stored) {
    return true;
  }
  const ok = stored === (await hashPin(pin));
  if (ok) {
    window.sessionStorage.setItem(UNLOCKED_KEY, '1');
  }
  return ok;
}

export function lockSession(): void {
  window.sessionStorage.removeItem(UNLOCKED_KEY);
}
