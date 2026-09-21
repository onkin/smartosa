'use client';

import {CameraSessionProvider} from '@/domains/devices/CameraSession';
import {createIndexedDbRepository} from '@/domains/localData';
import {useMemo, type ReactNode} from 'react';
import {AppShell} from './AppShell';
import {HomeDataProvider} from './HomeDataContext';
import {PinGate} from './PinGate';

type Props = {
  children: ReactNode;
};

export function AppProviders({children}: Props) {
  const repo = useMemo(() => createIndexedDbRepository(), []);

  return (
    <PinGate>
      <HomeDataProvider repo={repo}>
        <CameraSessionProvider>
          <AppShell>{children}</AppShell>
        </CameraSessionProvider>
      </HomeDataProvider>
    </PinGate>
  );
}
