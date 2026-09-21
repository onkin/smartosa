'use client';

import {useHomeData} from './HomeDataContext';
import {useEffect, useRef} from 'react';

const APP_VISIT_KEY = 'smartosa.appVisit';

export function useAppVisitOnce() {
  const {ready, repo, reload} = useHomeData();
  const logged = useRef(false);

  useEffect(() => {
    if (!ready || logged.current || typeof window === 'undefined') {
      return;
    }
    if (window.sessionStorage.getItem(APP_VISIT_KEY) === '1') {
      return;
    }
    logged.current = true;
    window.sessionStorage.setItem(APP_VISIT_KEY, '1');
    void repo.logVisit({at: Date.now(), kind: 'app', title: 'Открыли панель'}).then(() => reload());
  }, [ready, repo, reload]);
}

export function useTargetVisit(kind: 'device' | 'wall', targetId: string | null, title: string | null) {
  const {ready, repo, reload} = useHomeData();
  const last = useRef<string>('');

  useEffect(() => {
    if (!ready || !targetId || !title) {
      return;
    }
    const key = `${kind}:${targetId}`;
    if (last.current === key) {
      return;
    }
    last.current = key;
    void repo.logVisit({at: Date.now(), kind, targetId, title}).then(() => reload());
  }, [kind, ready, reload, repo, targetId, title]);
}
