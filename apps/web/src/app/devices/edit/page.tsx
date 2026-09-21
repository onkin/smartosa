import {DeviceEditScreen} from '@/domains/devices';
import {Suspense} from 'react';

export default function DeviceEditPage() {
  return (
    <Suspense fallback={<p>Загрузка…</p>}>
      <DeviceEditScreen />
    </Suspense>
  );
}
