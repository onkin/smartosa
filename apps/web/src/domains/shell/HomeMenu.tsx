'use client';

import {useHomeData} from './HomeDataContext';
import {ChevronDown} from 'lucide-react';
import {usePathname, useRouter} from 'next/navigation';
import {useEffect, useRef, useState, type FormEvent} from 'react';
import styles from './HomeMenu.module.css';

export function HomeMenu() {
  const pathname = usePathname();
  const router = useRouter();
  const {homes, activeHome, repo, reload} = useHomeData();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onPointer(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  async function onSwitch(homeId: string) {
    setOpen(false);
    if (homeId === activeHome?.id) {
      return;
    }
    await repo.switchHome(homeId);
    await reload();
    if (pathname !== '/') {
      router.push('/');
    }
  }

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      return;
    }
    await repo.createHome(trimmed);
    setName('');
    setOpen(false);
    await reload();
    if (pathname !== '/') {
      router.push('/');
    }
  }

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        className={styles.trigger}
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span>{activeHome?.name ?? 'Дом'}</span>
        <ChevronDown size={16} />
      </button>
      {open ? (
        <div className={styles.menu} role="menu">
          {homes.map((home) => (
            <button
              className={home.id === activeHome?.id ? styles.current : undefined}
              key={home.id}
              onClick={() => void onSwitch(home.id)}
              role="menuitem"
              type="button"
            >
              {home.name}
            </button>
          ))}
          <form className={styles.add} onSubmit={(event) => void onCreate(event)}>
            <input
              aria-label="Название нового дома"
              onChange={(event) => setName(event.target.value)}
              placeholder="Новый дом"
              value={name}
            />
            <button type="submit">Добавить</button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
