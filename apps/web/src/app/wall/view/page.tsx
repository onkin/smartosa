import {WallViewScreen} from '@/domains/wall';
import {Suspense} from 'react';

export default function WallViewPage() {
  return (
    <Suspense fallback={<p>Загрузка…</p>}>
      <WallViewScreen />
    </Suspense>
  );
}
