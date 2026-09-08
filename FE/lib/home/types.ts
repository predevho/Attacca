/** 공개(비인증) API가 돌려주는 모양. BE의 Public*Response와 1:1로 맞춘다. */

/** 공개 응답의 회원 표시. 회원 id가 없다는 것이 인증 응답의 Author와의 차이다. */
export type PublicAuthor = { nickname: string; verified: boolean };

/** BE 공통 PageResponse<T>. */
export type PageResponse<T> = {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
};

export type NoticeType = 'NOTICE' | 'NEWS' | 'EVENT';

export type PublicNotice = {
  id: number;
  type: NoticeType;
  title: string;
  content: string;
  /** null이면 달력에 뜨지 않는다. */
  scheduledAt: string | null;
  place: string | null;
  coverImageUrl: string | null;
  createdAt: string;
};

export type PublicPerformance = {
  id: number;
  organizer: PublicAuthor | null;
  title: string;
  description: string | null;
  performedAt: string;
  venue: string;
  program: string | null;
  ticketInfo: string | null;
  ticketUrl: string | null;
  posterImageUrl: string | null;
  createdAt: string;
};

export type PublicPost = {
  id: number;
  author: PublicAuthor | null;
  content: string;
  likeCount: number;
  commentCount: number;
  createdAt: string;
};

export type PostSort = 'LATEST' | 'POPULAR';

/** 달력 한 칸에 찍히는 일정. 공연과 공지를 같은 모양으로 눕힌 것. */
export type CalendarEntry = {
  kind: 'PERFORMANCE' | 'NOTICE';
  id: number;
  title: string;
  /** LocalDateTime 문자열(2026-09-26T19:30:00). */
  at: string;
  place: string | null;
  /** 눌러서 갈 곳. 없으면 표시만 한다. */
  href: string | null;
};

/** 캐러셀 한 장. */
export type Slide = {
  /**
   * `PAST_PERFORMANCE` 는 다가오는 공연이 없을 때만 쓰는 대체 슬라이드다.
   * `PERFORMANCE` 로 뭉뚱그리면 지난 공연이 다가오는 것처럼 읽히므로 종류를 나눈다.
   */
  kind: 'PERFORMANCE' | 'PAST_PERFORMANCE' | NoticeType;
  id: number;
  title: string;
  /** 부제 한 줄(일시·장소 등). */
  caption: string;
  body: string | null;
  imageUrl: string | null;
  href: string | null;
};
