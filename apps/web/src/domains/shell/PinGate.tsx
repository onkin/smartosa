'use client';

import {Button} from '@/domains/ui';
import {hasPin, isUnlocked, unlockWithPin} from '@/domains/settings/pin';
import {useEffect, useState, type FormEvent, type ReactNode} from 'react';
import styles from './PinGate.module.css';

type Props = {
  children: ReactNode;
};

export function PinGate({children}: Props) {
  const [locked, setLocked] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setLocked(hasPin() && !isUnlocked());
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const ok = await unlockWithPin(pin);
    if (!ok) {
      setError('Неверный PIN');
      return;
    }
    setError('');
    setLocked(false);
  }

  if (!locked) {
    return children;
  }

  return (
    <div className={styles.gate}>
      <form className={styles.card} onSubmit={onSubmit}>
        <h1>Smartosa</h1>
        <p>Введите PIN этой панели. Это не замена VPN.</p>
        <input
          autoFocus
          autoComplete="off"
          inputMode="numeric"
          onChange={(event) => setPin(event.target.value)}
          placeholder="PIN"
          type="password"
          value={pin}
        />
        {error ? <strong className={styles.error}>{error}</strong> : null}
        <Button type="submit">Войти</Button>
      </form>
    </div>
  );
}
