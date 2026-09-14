'use client';
import type { ImportRunStatus, ImportSource } from '@/lib/imports/types';
import { Button } from '@/components/ui/Button';
export function ImportSourceStatus({ source, run, pending, onRun }: { source: ImportSource; run?: ImportRunStatus; pending: boolean; onRun: () => void }) {
  return <section className="flex items-center justify-between border-b border-line py-3"><div><h2 className="font-medium">{source === 'KOPIS' ? 'KOPIS 공연' : '대학 공지'}</h2><p className="text-xs text-ink-muted">{run?.result ?? '실행 기록 없음'}{run?.newCount !== undefined ? ` · 새 항목 ${run.newCount}건` : ''}</p></div><Button type="button" variant="secondary" loading={pending} onClick={onRun}>{pending ? '실행 중' : '지금 가져오기'}</Button></section>;
}
