'use client';
import type { ImportedItem } from '@/lib/imports/types';
import { isHttpUrl } from '@/lib/imports/logic';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
export function ImportItemList({ items, onApprove, onReject }: { items: ImportedItem[]; onApprove: (item: ImportedItem) => void; onReject: (item: ImportedItem) => void }) {
  if (items.length === 0) return <EmptyState title="반입 항목이 없습니다." description="현재 조건에 해당하는 항목이 없습니다." />;
  return <ul className="flex flex-col gap-3">{items.map((item) => <li key={item.id} className="flex gap-3 border-b border-line py-3">
    {item.posterUrl && <img src={item.posterUrl} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-16 w-12 object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />}
    <div className="min-w-0 flex-1"><h3 className="truncate font-medium">{item.title}</h3><p className="text-xs text-ink-muted">{item.sourceName}{item.place ? ` · ${item.place}` : ''}</p>{isHttpUrl(item.sourceUrl) && <a href={item.sourceUrl!} target="_blank" rel="noopener noreferrer" className="text-xs text-brand underline">원문 보기</a>}</div>
    {item.status === 'NEW' && <div className="flex gap-2"><Button type="button" onClick={() => onApprove(item)} className="px-2 py-1 text-xs">승인</Button><Button type="button" variant="danger" onClick={() => onReject(item)} className="px-2 py-1 text-xs">거절</Button></div>}
  </li>)}</ul>;
}
