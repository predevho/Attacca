import type { ImportedItem } from './types';
import type { NoticeFormValues } from '@/lib/notice/types';
import { isHttpUrl as isSafeHttpUrl } from '@/lib/url';

export function isHttpUrl(value: string | null | undefined): boolean {
  return value ? isSafeHttpUrl(value) : false;
}

export function toNoticeInitial(item: ImportedItem): NoticeFormValues {
  const isEvent = item.source === 'KOPIS';
  return { type: isEvent ? 'EVENT' : 'NOTICE', title: item.title.slice(0, 100),
    content: item.source === 'KOPIS' ? (item.summary ?? '') : `${item.sourceName}에 새 공지가 올라왔습니다. 자세한 내용은 원문을 확인하세요.`,
    scheduledAt: '', place: item.place ?? '', pinned: false };
}
