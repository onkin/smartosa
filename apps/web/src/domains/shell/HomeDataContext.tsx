'use client';

import {
  go2rtcBaseUrl,
  type CameraWall,
  type Device,
  type HomeAccount,
  type HomeRepository,
  type NetworkSettings,
  type Visit,
} from '@smartosa/core';
import {createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode} from 'react';

export type HomeData = {
  ready: boolean;
  error: string | null;
  homes: HomeAccount[];
  activeHome: HomeAccount | null;
  devices: Device[];
  walls: CameraWall[];
  visits: Visit[];
  settings: NetworkSettings;
  go2rtcOnline: boolean | null;
  repo: HomeRepository;
  reload: () => Promise<void>;
};

const HomeDataContext = createContext<HomeData | null>(null);

type Props = {
  repo: HomeRepository;
  children: ReactNode;
};

export function HomeDataProvider({repo, children}: Props) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [homes, setHomes] = useState<HomeAccount[]>([]);
  const [activeHome, setActiveHome] = useState<HomeAccount | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [walls, setWalls] = useState<CameraWall[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [settings, setSettings] = useState<NetworkSettings>({
    lanHost: '',
    wanHost: '',
    go2rtcUrl: 'http://127.0.0.1:1984',
  });
  const [go2rtcOnline, setGo2rtcOnline] = useState<boolean | null>(null);

  const reload = useCallback(async () => {
    try {
      const [nextHomes, nextActive, nextDevices, nextWalls, nextVisits, nextSettings] = await Promise.all([
        repo.listHomes(),
        repo.activeHome(),
        repo.listDevices(),
        repo.listWalls(),
        repo.listVisits(200),
        repo.getSettings(),
      ]);
      setHomes(nextHomes);
      setActiveHome(nextActive);
      setDevices(nextDevices);
      setWalls(nextWalls);
      setVisits(nextVisits);
      setSettings(nextSettings);
      setError(null);
      setReady(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось открыть локальные данные');
      setReady(true);
    }
  }, [repo]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const base = go2rtcBaseUrl(settings);
    let cancelled = false;
    let misses = 0;
    const ping = async () => {
      try {
        const response = await fetch(`${base}/api`, {method: 'GET'});
        if (cancelled) {
          return;
        }
        misses = response.ok ? 0 : misses + 1;
        const online = misses < 2;
        setGo2rtcOnline((current) => (current === online ? current : online));
      } catch {
        if (cancelled) {
          return;
        }
        misses += 1;
        if (misses >= 2) {
          setGo2rtcOnline((current) => (current === false ? current : false));
        }
      }
    };
    void ping();
    const timer = window.setInterval(() => {
      void ping();
    }, 8000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [settings]);

  const value = useMemo(
    () => ({ready, error, homes, activeHome, devices, walls, visits, settings, go2rtcOnline, repo, reload}),
    [ready, error, homes, activeHome, devices, walls, visits, settings, go2rtcOnline, repo, reload],
  );

  return <HomeDataContext.Provider value={value}>{children}</HomeDataContext.Provider>;
}

export function useHomeData(): HomeData {
  const value = useContext(HomeDataContext);
  if (!value) {
    throw new Error('useHomeData must be used inside HomeDataProvider');
  }
  return value;
}
