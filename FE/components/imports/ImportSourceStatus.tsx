'use client';
import type { ImportRunStatus, ImportSource } from '@/lib/imports/types';
import { Button } from '@/components/ui/Button';
export function ImportSourceStatus({ source, run, pending, onRun }: { source: ImportSource; run?: ImportRunStatus; pending: boolean; onRun: () => void }) {
  const running = pending || run?.running === true || (!!run && !run.finishedAt);
  const result = running ? '실행 중' : run?.result === 'SUCCESS' ? '완료' : run?.result === 'PARTIAL' ? '일부 완료' : run?.result === 'FAILED' ? '실패' : run?.result === 'SKIPPED' ? '건너뜀' : '실행 기록 없음';
  return <section className="flex flex-col gap-3 border-b border-line py-4 sm:flex-row sm:items-center sm:justify-between">
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2"><h2 className="font-medium">{source === 'KOPIS' ? 'KOPIS 공연' : '대학 공지'}</h2><span className="rounded-full border border-line px-2 py-0.5 text-xs text-ink-muted">{result}</span></div>
      <p className="mt-1 text-xs text-ink-muted">{run?.newCount !== undefined ? `새 항목 ${run.newCount}건` : '최근 실행 기록 없음'}{run?.message ? ` · ${run.message}` : ''}</p>
    </div>
    <Button type="button" variant="secondary" loading={running} onClick={onRun} className="w-full shrink-0 sm:w-auto">{running ? '실행 중' : '지금 가져오기'}</Button>
  </section>;
}
