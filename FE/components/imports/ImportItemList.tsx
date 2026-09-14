'use client';
import type { ImportedItem } from '@/lib/imports/types';
import { isHttpUrl } from '@/lib/imports/logic';
export function ImportItemList({ items, onApprove, onReject }: { items: ImportedItem[]; onApprove: (item: ImportedItem) => void; onReject: (item: ImportedItem) => void }) {
  return <ul className="flex flex-col gap-3">{items.map((item) => <li key={item.id} className="flex gap-3 border-b border-line py-3">
    {item.posterUrl && <img src={item.posterUrl} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-16 w-12 object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />}
    <div className="min-w-0 flex-1"><h3 className="truncate font-medium">{item.title}</h3><p className="text-xs text-ink-muted">{item.sourceName}{item.place ? ` · ${item.place}` : ''}</p>{isHttpUrl(item.sourceUrl) && <a href={item.sourceUrl!} target="_blank" rel="noopener noreferrer" className="text-xs text-brand underline">원문 보기</a>}</div>
    {item.status === 'NEW' && <div className="flex gap-2"><button type="button" onClick={() => onApprove(item)} className="text-xs text-brand">승인</button><button type="button" onClick={() => onReject(item)} className="text-xs text-danger">거절</button></div>}
  </li>)}</ul>;
}
