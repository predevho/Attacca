'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type ThemeMode = 'system' | 'light' | 'dark';
const STORAGE_KEY = 'attacca-theme';
const ThemeContext = createContext<{ mode: ThemeMode; setMode: (mode: ThemeMode) => void } | null>(null);

function readMode(): ThemeMode {
  if (typeof window === 'undefined') return 'system';
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
  } catch {
    return 'system';
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // 서버와 첫 클라이언트 렌더를 system으로 맞춰 저장된 테마 때문에 hydration이
  // 어긋나지 않게 한다. 저장값은 마운트 후 복원한다.
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const storedMode = readMode();
      if (storedMode !== mode) setModeState(storedMode);
      setRestored(true);
    }, 0);
    return () => window.clearTimeout(timer);
  // 최초 마운트에서만 저장값을 읽는다.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!restored) return;
    document.documentElement.dataset.theme = mode;
    try {
      window.localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // 저장소가 차단된 환경에서도 테마 전환 자체는 계속 허용한다.
    }
  }, [mode, restored]);

  function setMode(next: ThemeMode) {
    setModeState(next);
  }

  return <ThemeContext.Provider value={{ mode, setMode }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  return context ?? { mode: 'system' as ThemeMode, setMode: () => undefined };
}
