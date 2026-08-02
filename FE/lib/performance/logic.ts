import type { CursorPage } from '@/lib/feed/types';
import type { Performance, PerformanceFormValues, SpringPage } from '@/lib/performance/types';

/** Spring Page(오프셋)를 커서 페이지 계약으로 변환 → useInfiniteList 재사용. cursor=페이지 번호. */
export function toCursorPage(page: SpringPage<Performance>): CursorPage<Performance> {
  return { items: page.content, nextCursor: page.last ? null : page.number + 1 };
}

/** 클라이언트 측 폼 검증. 첫 에러 메시지 또는 null. BE PerformanceRequest 규칙과 일치. */
export function validatePerformance(v: PerformanceFormValues): string | null {
  if (!v.title.trim()) return '공연명을 입력해 주세요.';
  if (v.title.length > 100) return '공연명은 100자를 넘을 수 없습니다.';
  if (!v.performedAt) return '공연 일시를 입력해 주세요.';
  if (!v.venue.trim()) return '장소를 입력해 주세요.';
  if (v.venue.length > 200) return '장소는 200자를 넘을 수 없습니다.';
  if (v.description.length > 2000) return '소개는 2000자를 넘을 수 없습니다.';
  if (v.program.length > 2000) return '프로그램은 2000자를 넘을 수 없습니다.';
  if (v.ticketInfo.length > 200) return '관람료 안내는 200자를 넘을 수 없습니다.';
  if (v.ticketUrl.length > 500) return '링크는 500자를 넘을 수 없습니다.';
  return null;
}

/** ISO LocalDateTime("2026-09-01T19:30[:ss]")을 "YYYY.MM.DD HH:mm"로. 타임존 없음(문자열 파싱). */
export function formatDateTime(iso: string): string {
  const [d, t = ''] = iso.split('T');
  const [y, m, day] = d.split('-');
  const [hh = '00', mm = '00'] = t.split(':');
  return `${y}.${m}.${day} ${hh}:${mm}`;
}
