import type { Author } from '@/lib/feed/types';

export type PerformanceScope = 'UPCOMING' | 'PAST' | 'ALL';

export type Performance = {
  id: number;
  organizer: Author;
  title: string;
  description: string | null;
  performedAt: string;
  venue: string;
  program: string | null;
  ticketInfo: string | null;
  ticketUrl: string | null;
  posterImageUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

/** 등록/수정 폼 값(모두 문자열, BE PerformanceRequest로 그대로 전송). */
export type PerformanceFormValues = {
  title: string;
  description: string;
  performedAt: string;
  venue: string;
  program: string;
  ticketInfo: string;
  ticketUrl: string;
};

/** Spring Page 응답 중 FE가 쓰는 필드만. */
export type SpringPage<T> = { content: T[]; number: number; totalPages: number; last: boolean };
