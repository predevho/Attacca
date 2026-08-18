'use client';

import { useState } from 'react';
import { validatePerformance } from '@/lib/performance/logic';
import type { PerformanceFormValues } from '@/lib/performance/types';

const EMPTY: PerformanceFormValues = {
  title: '', description: '', performedAt: '', venue: '', program: '', ticketInfo: '', ticketUrl: '',
};

export function PerformanceForm({
  initial, submitting, submitLabel, onSubmit,
}: {
  initial?: Partial<PerformanceFormValues>;
  submitting: boolean;
  submitLabel: string;
  onSubmit: (v: PerformanceFormValues) => void;
}) {
  const [v, setV] = useState<PerformanceFormValues>({ ...EMPTY, ...initial });
  const [error, setError] = useState<string | null>(null);

  function field<K extends keyof PerformanceFormValues>(key: K) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setV((cur) => ({ ...cur, [key]: e.target.value }));
  }

  function submit() {
    const err = validatePerformance(v);
    if (err) { setError(err); return; }
    setError(null);
    onSubmit(v);
  }

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-ink-muted">공연명</span>
        <input aria-label="공연명" value={v.title} maxLength={100} onChange={field('title')}
          className="rounded border border-line px-3 py-2" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-ink-muted">공연 일시</span>
        <input aria-label="공연 일시" type="datetime-local" value={v.performedAt} onChange={field('performedAt')}
          className="rounded border border-line px-3 py-2" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-ink-muted">장소</span>
        <input aria-label="장소" value={v.venue} maxLength={200} onChange={field('venue')}
          className="rounded border border-line px-3 py-2" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-ink-muted">소개</span>
        <textarea aria-label="소개" value={v.description} maxLength={2000} onChange={field('description')}
          className="h-24 rounded border border-line px-3 py-2" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-ink-muted">프로그램</span>
        <textarea aria-label="프로그램" value={v.program} maxLength={2000} onChange={field('program')}
          className="h-24 rounded border border-line px-3 py-2" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-ink-muted">관람료 안내</span>
        <input aria-label="관람료 안내" value={v.ticketInfo} maxLength={200} onChange={field('ticketInfo')}
          className="rounded border border-line px-3 py-2" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-ink-muted">티켓 링크</span>
        <input aria-label="티켓 링크" value={v.ticketUrl} maxLength={500} onChange={field('ticketUrl')}
          className="rounded border border-line px-3 py-2" />
      </label>

      {error && <p className="text-sm text-danger">{error}</p>}

      <button type="button" onClick={submit} disabled={submitting}
        className="rounded bg-brand px-4 py-2 text-on-brand disabled:opacity-40">
        {submitting ? '처리 중...' : submitLabel}
      </button>
    </div>
  );
}
