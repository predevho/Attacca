import type { NoticeFormValues, SpringPage } from '@/lib/notice/types';

export type ImportSource = 'KOPIS' | 'UNIV_NOTICE';
export type ImportStatus = 'NEW' | 'APPROVED' | 'REJECTED';
export type ImportedItem = {
  id: number; source: ImportSource; sourceKey: string; sourceName: string; sourceUrl: string | null;
  title: string; startsAt: string | null; endsAt: string | null; postedAt: string | null;
  place: string | null; summary: string | null; posterUrl: string | null; status: ImportStatus;
  noticeId: number | null; lastSeenAt: string; createdAt: string;
};
export type ImportPage = SpringPage<ImportedItem>;
export type ImportRunStatus = { id: number | null; source: ImportSource; trigger: string; result: string;
  startedAt: string | null; finishedAt: string | null; newCount: number; message: string | null; running?: boolean };

export type ImportNoticeFormValues = NoticeFormValues;
