import type { CursorPage } from '@/lib/feed/types';
import type { ApplicationStatus, Posting, PostingFormValues, SpringPage } from '@/lib/recruitment/types';

/** Spring Page(오프셋)를 커서 페이지 계약으로 변환 → useInfiniteList 재사용. cursor=페이지 번호. */
export function toCursorPage<T>(page: SpringPage<T>): CursorPage<T> {
  return { items: page.content, nextCursor: page.last ? null : page.number + 1 };
}

/** 클라이언트 폼 검증. 첫 에러 메시지 또는 null. BE RecruitmentPostingRequest 규칙과 일치. */
export function validatePosting(v: PostingFormValues): string | null {
  if (!v.title.trim()) return '제목을 입력해 주세요.';
  if (v.title.length > 100) return '제목은 100자를 넘을 수 없습니다.';
  if (v.instruments.length === 0) return '모집 파트를 하나 이상 선택해 주세요.';
  if (v.description.length > 2000) return '설명은 2000자를 넘을 수 없습니다.';
  if (v.location.length > 200) return '활동 지역/장소는 200자를 넘을 수 없습니다.';
  if (v.fee.length > 200) return '보수 안내는 200자를 넘을 수 없습니다.';
  if (v.recruitCount.trim() !== '') {
    const n = Number(v.recruitCount);
    if (!Number.isInteger(n) || n < 1) return '모집 인원은 1명 이상이어야 합니다.';
  }
  return null;
}

/** 폼 값 → BE 요청 본문. 빈 문자열은 null, 인원은 숫자 또는 null, deadline 빈 값은 null(상시모집). */
export function toPostingRequest(v: PostingFormValues) {
  return {
    title: v.title,
    description: v.description.trim() === '' ? null : v.description,
    instruments: v.instruments,
    recruitCount: v.recruitCount.trim() === '' ? null : Number(v.recruitCount),
    location: v.location.trim() === '' ? null : v.location,
    fee: v.fee.trim() === '' ? null : v.fee,
    deadline: v.deadline === '' ? null : v.deadline,
  };
}

/** Posting → 폼 값(수정 페이지 초기값). null은 빈 문자열, deadline은 datetime-local용 16자. */
export function toFormValues(p: Posting): PostingFormValues {
  return {
    title: p.title,
    description: p.description ?? '',
    instruments: p.instruments,
    recruitCount: p.recruitCount == null ? '' : String(p.recruitCount),
    location: p.location ?? '',
    fee: p.fee ?? '',
    deadline: p.deadline ? p.deadline.slice(0, 16) : '',
  };
}

/** 마감일 표시. null=상시모집, 값이면 "YYYY.MM.DD"(타임존 없음, 문자열 파싱). */
export function formatDeadline(iso: string | null): string {
  if (!iso) return '상시모집';
  const [d] = iso.split('T');
  const [y, m, day] = d.split('-');
  return `${y}.${m}.${day}`;
}

export function applicationStatusLabel(status: ApplicationStatus): string {
  switch (status) {
    case 'PENDING': return '대기 중';
    case 'ACCEPTED': return '수락됨';
    case 'REJECTED': return '거절됨';
    case 'WITHDRAWN': return '철회됨';
  }
}
