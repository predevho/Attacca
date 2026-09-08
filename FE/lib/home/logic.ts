import type {
  CalendarEntry,
  NoticeType,
  PublicNotice,
  PublicPerformance,
  Slide,
} from '@/lib/home/types';

const WEEK = 7;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * BE의 LocalDateTime이 기대하는 형식(타임존 없음)으로 찍는다.
 * `toISOString()`을 쓰면 UTC로 밀려 월 경계가 어긋나므로 쓰지 않는다.
 */
export function toLocalIso(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    + `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/**
 * 해당 달의 조회 범위. BE 규약이 [from, to) 이므로 to는 다음 달 1일 0시다.
 * month는 1-12.
 */
export function monthRange(year: number, month: number): { from: string; to: string } {
  return {
    from: toLocalIso(new Date(year, month - 1, 1)),
    to: toLocalIso(new Date(year, month, 1)),
  };
}

/** 이전/다음 달. month는 1-12이며 경계를 넘으면 연도가 함께 바뀐다. */
export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const base = new Date(year, month - 1 + delta, 1);
  return { year: base.getFullYear(), month: base.getMonth() + 1 };
}

/**
 * 달력 격자. 앞의 빈칸(null)은 1일 이전 요일 수만큼, 뒤는 주 단위로 채운다.
 * 일요일 시작.
 */
export function buildMonthGrid(year: number, month: number): (number | null)[] {
  const lead = new Date(year, month - 1, 1).getDay();
  const days = new Date(year, month, 0).getDate();
  const cells: (number | null)[] = Array<number | null>(lead).fill(null);
  for (let d = 1; d <= days; d += 1) {
    cells.push(d);
  }
  while (cells.length % WEEK !== 0) {
    cells.push(null);
  }
  return cells;
}

/** LocalDateTime 문자열에서 '일'만 뽑는다. 파싱 없이 자릿수로 읽어 타임존 영향이 없다. */
export function dayOf(at: string): number {
  return Number(at.slice(8, 10));
}

/**
 * 공연과 일정을 달력용 한 벌로 눕힌다.
 *
 * <p>이 합성이 BE가 아니라 여기(BFF/FE)에 있는 이유는 ARCHITECTURE-CONSTITUTION §2 —
 * BE는 화면 로직을 갖지 않는다. BE는 도메인별 공개 범위 조회만 준다.
 */
export function toCalendarEntries(
  performances: PublicPerformance[],
  notices: PublicNotice[],
): CalendarEntry[] {
  const fromPerformances: CalendarEntry[] = performances.map((p) => ({
    kind: 'PERFORMANCE',
    id: p.id,
    title: p.title,
    at: p.performedAt,
    place: p.venue,
    href: `/performances/${p.id}`,
  }));
  // scheduledAt이 없는 공지는 애초에 달력에 오르지 않는다(BE가 걸러 주지만 방어적으로 한 번 더).
  const fromNotices: CalendarEntry[] = notices
    .filter((n) => n.scheduledAt !== null)
    .map((n) => ({
      kind: 'NOTICE',
      id: n.id,
      title: n.title,
      at: n.scheduledAt as string,
      place: n.place,
      href: null, // 공지 상세 화면이 아직 없다.
    }));

  return [...fromPerformances, ...fromNotices].sort(
    (a, b) => a.at.localeCompare(b.at) || a.title.localeCompare(b.title),
  );
}

/** 날짜(일) → 그 날 있는 일정 종류들. 달력 점을 찍는 데 쓴다. */
export function markersByDay(entries: CalendarEntry[]): Map<number, CalendarEntry['kind'][]> {
  const map = new Map<number, CalendarEntry['kind'][]>();
  for (const entry of entries) {
    const day = dayOf(entry.at);
    const kinds = map.get(day) ?? [];
    if (!kinds.includes(entry.kind)) {
      kinds.push(entry.kind);
    }
    map.set(day, kinds);
  }
  return map;
}

const NOTICE_LABEL: Record<NoticeType, string> = {
  NOTICE: '공지',
  NEWS: '뉴스',
  EVENT: '일정',
};

export function noticeLabel(type: NoticeType): string {
  return NOTICE_LABEL[type];
}

/** 2026-09-26T19:30:00 → 2026.09.26 (토) 19:30 */
export function formatDateTime(at: string): string {
  const [date, time] = at.split('T');
  const [y, m, d] = date.split('-');
  const weekday = ['일', '월', '화', '수', '목', '금', '토'][
    new Date(Number(y), Number(m) - 1, Number(d)).getDay()
  ];
  return `${y}.${m}.${d} (${weekday}) ${(time ?? '').slice(0, 5)}`.trim();
}

/** 2026-09-26T19:30:00 → 09.26 (토) */
export function formatDayLabel(at: string): string {
  const [y, m, d] = at.slice(0, 10).split('-');
  const weekday = ['일', '월', '화', '수', '목', '금', '토'][
    new Date(Number(y), Number(m) - 1, Number(d)).getDay()
  ];
  return `${m}.${d} (${weekday})`;
}

/**
 * 캐러셀 슬라이드. 다가오는 공연을 먼저, 그 뒤에 고정 공지를 붙이고 max장으로 자른다.
 * 공연을 앞에 두는 이유는 홈의 목적이 연주회 홍보이기 때문이다.
 */
export function toSlides(
  performances: PublicPerformance[],
  notices: PublicNotice[],
  max = 5,
): Slide[] {
  const fromPerformances: Slide[] = performances.map((p) => ({
    kind: 'PERFORMANCE',
    id: p.id,
    title: p.title,
    caption: `${formatDateTime(p.performedAt)} · ${p.venue}`,
    body: p.description,
    imageUrl: p.posterImageUrl,
    href: `/performances/${p.id}`,
  }));
  const fromNotices: Slide[] = notices.map((n) => ({
    kind: n.type,
    id: n.id,
    title: n.title,
    caption: n.scheduledAt ? formatDateTime(n.scheduledAt) : formatDayLabel(n.createdAt),
    body: n.content,
    imageUrl: n.coverImageUrl,
    href: null,
  }));
  return [...fromPerformances, ...fromNotices].slice(0, max);
}

/** 슬라이드 배지 문구. */
export function slideLabel(kind: Slide['kind']): string {
  return kind === 'PERFORMANCE' ? '공연' : noticeLabel(kind);
}

/**
 * 로그인 후 돌아갈 경로를 안전하게 고른다.
 * 내부 절대경로만 허용한다 — `//evil.com` 같은 프로토콜 상대 URL은 외부로 나가므로 막는다.
 */
export function safeNext(next: string | null | undefined, fallback = '/feed'): string {
  if (!next || !next.startsWith('/') || next.startsWith('//')) {
    return fallback;
  }
  return next;
}
