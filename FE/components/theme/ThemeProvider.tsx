'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

export type ThemeMode = 'system' | 'light' | 'dark';
const STORAGE_KEY = 'attacca-theme';
const ThemeContext = createContext<{ mode: ThemeMode; setMode: (mode: ThemeMode) => void } | null>(null);

function readMode(): ThemeMode {
  if (typeof window === 'undefined') return 'light';
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'light';
  } catch {
    return 'light';
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // 서버와 첫 클라이언트 렌더를 light로 맞춰 저장된 테마 때문에 hydration이
  // 어긋나지 않게 한다. 저장값은 마운트 후 복원한다.
  const [mode, setModeState] = useState<ThemeMode>('light');
  const [restored, setRestored] = useState(false);
  const userSelected = useRef(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!userSelected.current) setModeState(readMode());
      setRestored(true);
    }, 0);
    return () => window.clearTimeout(timer);
  // 최초 마운트에서만 저장값을 읽는다.
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
    userSelected.current = true;
    setModeState(next);
  }

  return <ThemeContext.Provider value={{ mode, setMode }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  return context ?? { mode: 'system' as ThemeMode, setMode: () => undefined };
}
