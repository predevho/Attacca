import type { NoticeType } from '@/lib/home/types';

export type { NoticeType };

/**
 * 어드민이 보는 공지. 공개 응답(`PublicNotice`)과 달리 `pinned` 와 수정 시각이 있다.
 * 공개 응답에 없는 이유는 §DOMAIN-NOTICE-STATUTE — 운영 내부 상태이기 때문이다.
 */
export type AdminNotice = {
  id: number;
  type: NoticeType;
  title: string;
  content: string;
  scheduledAt: string | null;
  place: string | null;
  pinned: boolean;
  coverImageUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

/** 등록·수정 폼 값. 모두 문자열로 쥐고 보낼 때만 변환한다(빈 칸 = null). */
export type NoticeFormValues = {
  type: NoticeType;
  title: string;
  content: string;
  /** `datetime-local` 값. 비우면 달력에 뜨지 않는다. */
  scheduledAt: string;
  place: string;
  pinned: boolean;
};

/** Spring Page 중 FE가 쓰는 것만. */
export type SpringPage<T> = { content: T[]; number: number; totalPages: number; last: boolean };
