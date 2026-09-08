import { describe, it, expect } from 'vitest';
import {
  buildMonthGrid,
  dayOf,
  formatDayLabel,
  markersByDay,
  monthRange,
  safeNext,
  shiftMonth,
  slideLabel,
  toCalendarEntries,
  toLocalIso,
  toSlides,
} from '@/lib/home/logic';
import type { PublicNotice, PublicPerformance } from '@/lib/home/types';

function performance(id: number, title: string, performedAt: string): PublicPerformance {
  return {
    id,
    organizer: { nickname: '주최자', verified: true },
    title,
    description: '소개',
    performedAt,
    venue: '한강아트홀',
    program: null,
    ticketInfo: null,
    ticketUrl: null,
    posterImageUrl: null,
    createdAt: '2026-09-01T00:00:00',
  };
}

function notice(id: number, title: string, scheduledAt: string | null): PublicNotice {
  return {
    id,
    type: scheduledAt ? 'EVENT' : 'NOTICE',
    title,
    content: '본문',
    scheduledAt,
    place: scheduledAt ? '온라인' : null,
    coverImageUrl: null,
    createdAt: '2026-09-01T00:00:00',
  };
}

describe('toLocalIso', () => {
  it('타임존 없이 로컬 시각 그대로 찍는다', () => {
    // toISOString()을 쓰면 UTC로 밀려 월 경계가 어긋난다 — 그걸 쓰지 않는다는 회귀.
    expect(toLocalIso(new Date(2026, 8, 1, 0, 0, 0))).toBe('2026-09-01T00:00:00');
    expect(toLocalIso(new Date(2026, 0, 5, 9, 3, 7))).toBe('2026-01-05T09:03:07');
  });
});

describe('monthRange', () => {
  it('그 달 1일부터 다음 달 1일까지(끝 미포함)를 준다', () => {
    expect(monthRange(2026, 9)).toEqual({
      from: '2026-09-01T00:00:00',
      to: '2026-10-01T00:00:00',
    });
  });

  it('12월은 다음 해 1월로 넘어간다', () => {
    expect(monthRange(2026, 12).to).toBe('2027-01-01T00:00:00');
  });
});

describe('shiftMonth', () => {
  it('연도 경계를 넘는다', () => {
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
  });
});

describe('buildMonthGrid', () => {
  it('2026년 9월은 화요일에 시작하고 30일까지다', () => {
    const cells = buildMonthGrid(2026, 9);
    expect(cells.slice(0, 3)).toEqual([null, null, 1]); // 일·월 빈칸 뒤 화요일에 1일
    expect(cells.filter((c) => c !== null)).toHaveLength(30);
    expect(cells[cells.length - 1]).toBeNull();
  });

  it('항상 주 단위로 떨어진다', () => {
    for (const month of [1, 2, 5, 9, 12]) {
      expect(buildMonthGrid(2026, month).length % 7).toBe(0);
    }
  });

  it('윤년 2월도 29일까지 담는다', () => {
    expect(buildMonthGrid(2028, 2).filter((c) => c !== null)).toHaveLength(29);
  });
});

describe('dayOf', () => {
  it('파싱 없이 자릿수로 일을 읽는다', () => {
    expect(dayOf('2026-09-26T19:30:00')).toBe(26);
    expect(dayOf('2026-09-02T00:00:00')).toBe(2);
  });
});

describe('toCalendarEntries', () => {
  it('공연과 일정을 합쳐 시각순으로 준다', () => {
    const entries = toCalendarEntries(
      [performance(1, '늦은 공연', '2026-09-26T19:30:00')],
      [notice(2, '이른 일정', '2026-09-02T10:00:00')],
    );
    expect(entries.map((e) => e.title)).toEqual(['이른 일정', '늦은 공연']);
    expect(entries.map((e) => e.kind)).toEqual(['NOTICE', 'PERFORMANCE']);
  });

  it('날짜 없는 공지는 달력에 오르지 않는다', () => {
    const entries = toCalendarEntries([], [notice(1, '날짜없음', null)]);
    expect(entries).toHaveLength(0);
  });

  it('공연만 링크를 갖는다(공지 상세 화면이 아직 없다)', () => {
    const entries = toCalendarEntries(
      [performance(7, '공연', '2026-09-10T19:00:00')],
      [notice(8, '일정', '2026-09-11T10:00:00')],
    );
    expect(entries[0].href).toBe('/performances/7');
    expect(entries[1].href).toBeNull();
  });
});

describe('markersByDay', () => {
  it('같은 날 같은 종류는 한 번만 센다', () => {
    const entries = toCalendarEntries(
      [
        performance(1, 'A', '2026-09-12T17:00:00'),
        performance(2, 'B', '2026-09-12T20:00:00'),
      ],
      [notice(3, '일정', '2026-09-12T10:00:00')],
    );
    expect(markersByDay(entries).get(12)).toEqual(['NOTICE', 'PERFORMANCE']);
  });

  it('일정이 없는 날은 비어 있다', () => {
    expect(markersByDay([]).get(5)).toBeUndefined();
  });
});

describe('toSlides', () => {
  it('공연을 앞에, 공지를 뒤에 놓고 최대 장수로 자른다', () => {
    const slides = toSlides(
      [performance(1, '공연', '2026-09-26T19:30:00')],
      [notice(2, '공지', null), notice(3, '공지2', null)],
      2,
    );
    expect(slides.map((s) => s.title)).toEqual(['공연', '공지']);
    expect(slides[0].kind).toBe('PERFORMANCE');
    expect(slides[0].href).toBe('/performances/1');
  });

  it('공연 슬라이드의 부제에 일시와 장소가 들어간다', () => {
    const [slide] = toSlides([performance(1, '공연', '2026-09-26T19:30:00')], []);
    expect(slide.caption).toBe('2026.09.26 (토) 19:30 · 한강아트홀');
  });

  // 다가오는 공연이 없으면 홈의 주 영역이 통째로 사라졌다(2026-09-09).
  // 지난 공연이라도 태워 화면을 채우되, **지난 것임을 감추지 않는다**.
  it('다가오는 공연이 없으면 지난 공연을 태운다', () => {
    const slides = toSlides([], [], 5, [performance(9, '지난공연', '2024-06-24T19:30:00')]);

    expect(slides.map((s) => s.title)).toEqual(['지난공연']);
    expect(slides[0].kind).toBe('PAST_PERFORMANCE');
    expect(slides[0].href).toBe('/performances/9');
  });

  it('다가오는 공연이 있으면 지난 공연은 태우지 않는다', () => {
    const slides = toSlides(
      [performance(1, '다가오는', '2026-12-01T19:00:00')],
      [],
      5,
      [performance(9, '지난공연', '2024-06-24T19:30:00')],
    );

    expect(slides.map((s) => s.title)).toEqual(['다가오는']);
  });

  it('지난 공연은 공지 뒤에 놓는다', () => {
    const slides = toSlides([], [notice(2, '공지', null)], 5,
      [performance(9, '지난공연', '2024-06-24T19:30:00')]);

    expect(slides.map((s) => s.title)).toEqual(['공지', '지난공연']);
  });
});

describe('slideLabel', () => {
  it('종류를 한글 배지 문구로 바꾼다', () => {
    expect(slideLabel('PERFORMANCE')).toBe('공연');
    expect(slideLabel('NOTICE')).toBe('공지');
    expect(slideLabel('NEWS')).toBe('뉴스');
    expect(slideLabel('EVENT')).toBe('일정');
    // 지난 공연을 '공연'으로 적으면 다가오는 것처럼 읽힌다.
    expect(slideLabel('PAST_PERFORMANCE')).toBe('지난 공연');
  });
});

describe('formatDayLabel', () => {
  it('요일을 붙여 짧게 찍는다', () => {
    expect(formatDayLabel('2026-09-26T19:30:00')).toBe('09.26 (토)');
  });
});

describe('safeNext', () => {
  it('내부 경로는 그대로 쓴다', () => {
    expect(safeNext('/performances/12')).toBe('/performances/12');
    expect(safeNext('/feed?tab=1')).toBe('/feed?tab=1');
  });

  it('없으면 기본 경로로 보낸다', () => {
    expect(safeNext(null)).toBe('/feed');
    expect(safeNext(undefined)).toBe('/feed');
    expect(safeNext('')).toBe('/feed');
  });

  it('외부로 나가는 값은 막는다', () => {
    // //evil.com 은 프로토콜 상대 URL이라 그대로 두면 열린 리다이렉트가 된다.
    expect(safeNext('//evil.com')).toBe('/feed');
    expect(safeNext('https://evil.com')).toBe('/feed');
    expect(safeNext('evil.com')).toBe('/feed');
  });
});
