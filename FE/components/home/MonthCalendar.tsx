'use client';

import Link from 'next/link';
import { buildMonthGrid, formatDayLabel, markersByDay } from '@/lib/home/logic';
import type { CalendarEntry } from '@/lib/home/types';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/** 종류별 점 색. 공연은 브랜드색, 공지 일정은 경고색으로 구분한다. */
const DOT_CLASS: Record<CalendarEntry['kind'], string> = {
  PERFORMANCE: 'bg-brand',
  NOTICE: 'bg-warn',
};

/**
 * 월간 달력 + 이번 달 일정.
 * 올라오는 것은 두 가지뿐이다 — 인증 연주자가 등록한 공연, 어드민이 올린 공지 일정.
 * (구인 마감은 달력에 넣지 않는다. 2026-09-08 결정)
 */
export function MonthCalendar({
  year,
  month,
  entries,
  today,
  isLoading,
  onShiftMonth,
}: {
  year: number;
  month: number;
  entries: CalendarEntry[];
  /** 오늘이 이 달에 속할 때의 '일'. 아니면 null. */
  today: number | null;
  isLoading: boolean;
  onShiftMonth: (delta: number) => void;
}) {
  const cells = buildMonthGrid(year, month);
  const markers = markersByDay(entries);

  return (
    <div className="flex flex-col gap-4">
      <section aria-label="월간 일정" className="rounded-lg border border-line bg-surface p-4">
        <div className="flex items-center justify-between pb-3">
          <button
            type="button"
            aria-label="이전 달"
            onClick={() => onShiftMonth(-1)}
            className="px-2 text-ink-muted"
          >
            ‹
          </button>
          <h2 className="font-semibold">
            {year}년 {month}월
          </h2>
          <button
            type="button"
            aria-label="다음 달"
            onClick={() => onShiftMonth(1)}
            className="px-2 text-ink-muted"
          >
            ›
          </button>
        </div>

        <div className="grid grid-cols-7 gap-0.5 pb-1">
          {WEEKDAYS.map((w) => (
            <span key={w} className="text-center text-xs text-ink-faint">
              {w}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-0.5">
          {cells.map((day, i) => (
            <span
              key={i}
              className="flex h-10 flex-col items-center justify-center gap-1 text-sm"
            >
              {day !== null && (
                <>
                  <span className={day === today ? 'font-bold text-brand-strong' : undefined}>
                    {day}
                  </span>
                  <span className="flex gap-0.5">
                    {(markers.get(day) ?? []).map((kind) => (
                      <span
                        key={kind}
                        aria-hidden
                        className={`h-1 w-1 rounded-full ${DOT_CLASS[kind]}`}
                      />
                    ))}
                  </span>
                </>
              )}
            </span>
          ))}
        </div>

        <div className="mt-3 flex items-center gap-4 border-t border-line pt-3 text-xs text-ink-muted">
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="h-1 w-1 rounded-full bg-brand" />
            공연
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="h-1 w-1 rounded-full bg-warn" />
            공지 일정
          </span>
        </div>
      </section>

      <section aria-label="이번 달 일정" className="rounded-lg border border-line bg-surface">
        <h2 className="p-4 font-semibold">이번 달 일정</h2>
        {isLoading && <p className="px-4 pb-4 text-sm text-ink-faint">불러오는 중...</p>}
        {!isLoading && entries.length === 0 && (
          <p className="px-4 pb-6 text-sm text-ink-faint">이번 달 일정이 없습니다.</p>
        )}
        <ul>
          {entries.map((entry) => {
            const row = (
              <>
                <span
                  aria-hidden
                  className={`mt-1.5 h-1 w-1 shrink-0 rounded-full ${DOT_CLASS[entry.kind]}`}
                />
                <span className="min-w-0">
                  <span className="block truncate text-sm">{entry.title}</span>
                  <span className="text-xs text-ink-faint">
                    {formatDayLabel(entry.at)}
                    {entry.place ? ` · ${entry.place}` : ''}
                  </span>
                </span>
              </>
            );
            return (
              <li key={`${entry.kind}-${entry.id}`} className="border-t border-line">
                {entry.href ? (
                  <Link href={entry.href} className="flex items-start gap-2.5 px-4 py-3">
                    {row}
                  </Link>
                ) : (
                  <span className="flex items-start gap-2.5 px-4 py-3">{row}</span>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
