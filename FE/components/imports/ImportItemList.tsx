'use client';
import type { ImportedItem } from '@/lib/imports/types';
import { isHttpUrl } from '@/lib/imports/logic';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatDateTime } from '@/lib/home/logic';

const statusLabel: Record<ImportedItem['status'], string> = { NEW: '검토 대기', APPROVED: '승인됨', REJECTED: '거절됨' };
export function ImportItemList({ items, onApprove, onReject }: { items: ImportedItem[]; onApprove: (item: ImportedItem) => void; onReject: (item: ImportedItem) => void }) {
  if (items.length === 0) return <EmptyState title="반입 항목이 없습니다." description="현재 조건에 해당하는 항목이 없습니다." />;
  return <ul className="flex flex-col divide-y divide-line">{items.map((item) => <li key={item.id} className="flex min-w-0 flex-col gap-4 py-4 sm:flex-row sm:items-start">
    {item.posterUrl && <img src={item.posterUrl} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-20 w-16 shrink-0 object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />}
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-start gap-2"><h3 className="min-w-0 flex-1 font-medium leading-6">{item.title}</h3><span className="shrink-0 rounded-full border border-line px-2 py-0.5 text-xs text-ink-muted">{statusLabel[item.status]}</span></div>
      <dl className="mt-2 grid min-w-0 grid-cols-1 gap-x-4 gap-y-1 text-xs text-ink-muted sm:grid-cols-2">
        <div><dt className="inline">원천 </dt><dd className="inline text-ink">{item.sourceName}{item.place ? ` · ${item.place}` : ''}</dd></div>
        {item.postedAt && <div><dt className="inline">게시일 </dt><dd className="inline text-ink">{formatDateTime(item.postedAt)}</dd></div>}
        {item.startsAt && <div><dt className="inline">일정 </dt><dd className="inline text-ink">{formatDateTime(item.startsAt)}</dd></div>}
      </dl>
      {isHttpUrl(item.sourceUrl) && <a href={item.sourceUrl!} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-xs text-brand underline">원문 보기</a>}
    </div>
    {item.status === 'NEW' && <div className="flex w-full shrink-0 flex-wrap gap-2 sm:w-auto"><Button type="button" onClick={() => onApprove(item)} className="flex-1 px-3 py-1.5 text-xs sm:flex-none">승인</Button><Button type="button" variant="danger" onClick={() => onReject(item)} className="flex-1 px-3 py-1.5 text-xs sm:flex-none">거절</Button></div>}
  </li>)}</ul>;
}
