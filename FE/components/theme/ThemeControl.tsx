'use client';

import { useTheme, type ThemeMode } from './ThemeProvider';

const modes: ThemeMode[] = ['system', 'light', 'dark'];
const labels: Record<ThemeMode, string> = {
  system: '시스템 테마',
  light: '라이트 테마',
  dark: '다크 테마',
};
const icons: Record<ThemeMode, string> = {
  system: '◒',
  light: '☀',
  dark: '☾',
};

export function ThemeControl() {
  const { mode, setMode } = useTheme();
  const nextMode = modes[(modes.indexOf(mode) + 1) % modes.length];

  return (
    <button
      type="button"
      aria-label={`${labels[mode]} (다음: ${labels[nextMode]})`}
      title={`${labels[mode]} · 클릭하여 ${labels[nextMode]}로 변경`}
      onClick={() => setMode(nextMode)}
      className="inline-flex size-8 items-center justify-center rounded-full text-base opacity-85 hover:bg-on-header/10 hover:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
    >
      <span aria-hidden="true">{icons[mode]}</span>
    </button>
  );
}
