'use client';

import {Boxes, House, LayoutGrid, Settings} from 'lucide-react';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import type {ReactNode} from 'react';
import {useHomeData} from './HomeDataContext';
import {HomeMenu} from './HomeMenu';
import styles from './AppShell.module.css';

const NAV = [
  {href: '/', label: 'Главная', icon: House},
  {href: '/devices', label: 'Устройства', icon: Boxes},
  {href: '/wall', label: 'Стены', icon: LayoutGrid},
  {href: '/settings', label: 'Настройки', icon: Settings},
];

type Props = {
  children: ReactNode;
};

export function AppShell({children}: Props) {
  const pathname = usePathname();
  const {error} = useHomeData();

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <strong>Smartosa</strong>
          <HomeMenu />
        </div>
        <nav className={styles.nav}>
          {NAV.map((item) => {
            const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link className={active ? styles.active : undefined} href={item.href} key={item.href}>
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className={styles.main}>
        {error ? <p className={styles.error}>{error}</p> : null}
        {children}
      </main>
    </div>
  );
}
