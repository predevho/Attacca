import type { Author } from '@/lib/feed/types';

export type RecruitmentScope = 'OPEN' | 'CLOSED' | 'ALL';
export type RecruitmentStatus = 'OPEN' | 'CLOSED';
export type ApplicationStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN';

export type Posting = {
  id: number;
  author: Author;
  title: string;
  description: string | null;
  instruments: string[]; // 악기 enum명
  recruitCount: number | null;
  location: string | null;
  fee: string | null;
  deadline: string | null; // null=상시모집
  status: RecruitmentStatus;
  closed: boolean; // BE 파생 마감판정
  createdAt: string;
  updatedAt: string;
};

/** 등록/수정 폼 값(모두 문자열/배열). toPostingRequest로 BE 요청으로 변환. */
export type PostingFormValues = {
  title: string;
  description: string;
  instruments: string[];
  recruitCount: string; // 숫자 입력을 문자열로 보관, '' = 미지정
  location: string;
  fee: string;
  deadline: string; // datetime-local, '' = 상시모집
};

export type Application = {
  id: number;
  postingId: number;
  applicant: Author;
  message: string;
  status: ApplicationStatus;
  createdAt: string;
  updatedAt: string;
};

/** Spring Page 응답 중 FE가 쓰는 필드만. */
export type SpringPage<T> = { content: T[]; number: number; totalPages: number; last: boolean };

export type InstrumentOption = { code: string; label: string };
