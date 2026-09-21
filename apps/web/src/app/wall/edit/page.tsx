import {WallEditScreen} from '@/domains/wall';
import {Suspense} from 'react';

export default function WallEditPage() {
  return (
    <Suspense fallback={<p>Загрузка…</p>}>
      <WallEditScreen />
    </Suspense>
  );
}
