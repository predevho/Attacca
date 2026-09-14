import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeControl } from '@/components/theme/ThemeControl';
import { ThemeProvider, useTheme } from '@/components/theme/ThemeProvider';

function Probe() {
  const { mode } = useTheme();
  return <span data-testid="mode">{mode}</span>;
}

describe('테마 시스템', () => {
  beforeEach(() => {
    const storage = new Map<string, string>();
    Object.defineProperty(window, 'localStorage', { configurable: true, value: {
      clear: () => storage.clear(),
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    } satisfies Pick<Storage, 'clear' | 'getItem' | 'setItem'> });
    window.localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('기본값은 system이고 선택값을 복원한다', async () => {
    render(<ThemeProvider><Probe /></ThemeProvider>);
    expect(screen.getByTestId('mode')).toHaveTextContent('system');

    window.localStorage.setItem('attacca-theme', 'dark');
    render(<ThemeProvider><Probe /></ThemeProvider>);
    await waitFor(() => expect(screen.getAllByTestId('mode').at(-1)).toHaveTextContent('dark'));
  });

  it('명시 테마 선택 시 문서 속성과 저장값을 갱신한다', async () => {
    const user = userEvent.setup();
    render(<ThemeProvider><ThemeControl /></ThemeProvider>);
    const control = screen.getByRole('button', { name: /시스템 테마/ });
    await user.click(control);
    await user.click(screen.getByRole('button', { name: /라이트 테마/ }));
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(window.localStorage.getItem('attacca-theme')).toBe('dark');
  });
});
