import type { ReactNode } from 'react';

export function StatusMessage({ tone, children }: { tone: 'info' | 'success' | 'warning' | 'danger'; children: ReactNode }) {
  const toneClass = {
    info: 'text-info',
    success: 'text-success',
    warning: 'text-warning',
    danger: 'text-danger',
  }[tone];
  return <p role={tone === 'danger' ? 'alert' : 'status'} data-tone={tone} className={`rounded border border-line px-3 py-2 text-sm ${toneClass}`}>{children}</p>;
}
