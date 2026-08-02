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
        <span className="text-gray-500">공연명</span>
        <input aria-label="공연명" value={v.title} maxLength={100} onChange={field('title')}
          className="rounded border px-3 py-2" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-gray-500">공연 일시</span>
        <input aria-label="공연 일시" type="datetime-local" value={v.performedAt} onChange={field('performedAt')}
          className="rounded border px-3 py-2" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-gray-500">장소</span>
        <input aria-label="장소" value={v.venue} maxLength={200} onChange={field('venue')}
          className="rounded border px-3 py-2" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-gray-500">소개</span>
        <textarea aria-label="소개" value={v.description} maxLength={2000} onChange={field('description')}
          className="h-24 rounded border px-3 py-2" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-gray-500">프로그램</span>
        <textarea aria-label="프로그램" value={v.program} maxLength={2000} onChange={field('program')}
          className="h-24 rounded border px-3 py-2" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-gray-500">관람료 안내</span>
        <input aria-label="관람료 안내" value={v.ticketInfo} maxLength={200} onChange={field('ticketInfo')}
          className="rounded border px-3 py-2" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-gray-500">티켓 링크</span>
        <input aria-label="티켓 링크" value={v.ticketUrl} maxLength={500} onChange={field('ticketUrl')}
          className="rounded border px-3 py-2" />
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button type="button" onClick={submit} disabled={submitting}
        className="rounded bg-black px-4 py-2 text-white disabled:opacity-40">
        {submitting ? '처리 중...' : submitLabel}
      </button>
    </div>
  );
}
