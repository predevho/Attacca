export type PerformanceScope = 'UPCOMING' | 'PAST' | 'ALL';

/**
 * 주최자 표시. **공개 조회에는 회원 id가 없다** — 공개 응답이 신원을 흘리지 않기
 * 위해 PublicMemberDisplay 를 쓰기 때문이다(BE). 그래서 id는 선택이고,
 * 수정·삭제 판정(canEdit)은 id가 없으면 자연히 false가 된다.
 */
export type OrganizerDisplay = { id?: number; nickname: string; verified: boolean };

export type Performance = {
  id: number;
  organizer: OrganizerDisplay;
  title: string;
  description: string | null;
  performedAt: string;
  venue: string;
  program: string | null;
  ticketInfo: string | null;
  ticketUrl: string | null;
  posterImageUrl: string | null;
  createdAt: string;
  /** 공개 조회에는 없다. */
  updatedAt?: string;
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
