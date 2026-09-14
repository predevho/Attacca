'use client';
import { NoticeForm } from '@/components/notice/NoticeForm';
import { toNoticeInitial } from '@/lib/imports/logic';
import type { ImportedItem } from '@/lib/imports/types';
import type { NoticeFormValues } from '@/lib/notice/types';
export function ImportReviewDialog({ item, pending, onSubmit, onCancel }: { item: ImportedItem; pending: boolean; onSubmit: (v: NoticeFormValues) => void; onCancel: () => void }) {
  return <div role="dialog" className="fixed inset-0 overflow-y-auto bg-surface p-5"><div className="mx-auto max-w-xl"><button type="button" onClick={onCancel} className="mb-4 text-sm text-ink-muted">← 목록</button><h1 className="mb-5 text-xl font-bold">반입 항목 승인</h1><NoticeForm initial={toNoticeInitial(item)} submitLabel="승인하고 공지 등록" pending={pending} onSubmit={onSubmit} onCancel={onCancel} /></div></div>;
}
