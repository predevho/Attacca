'use client';
import type { ImportRunStatus, ImportSource } from '@/lib/imports/types';
export function ImportSourceStatus({ source, run, pending, onRun }: { source: ImportSource; run?: ImportRunStatus; pending: boolean; onRun: () => void }) {
  return <section className="flex items-center justify-between border-b border-line py-3"><div><h2 className="font-medium">{source === 'KOPIS' ? 'KOPIS 공연' : '대학 공지'}</h2><p className="text-xs text-ink-muted">{run?.result ?? '실행 기록 없음'}{run?.newCount !== undefined ? ` · 새 항목 ${run.newCount}건` : ''}</p></div><button type="button" disabled={pending} onClick={onRun} className="rounded border border-line px-3 py-1.5 text-sm disabled:opacity-50">{pending ? '실행 중...' : '지금 가져오기'}</button></section>;
}
