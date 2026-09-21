import {DeviceViewScreen} from '@/domains/devices';
import {Suspense} from 'react';

export default function DeviceViewPage() {
  return (
    <Suspense fallback={<p>Загрузка…</p>}>
      <DeviceViewScreen />
    </Suspense>
  );
}
