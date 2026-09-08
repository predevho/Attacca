'use client';

import { useCallback, useEffect, useState } from 'react';
import { HeroCarousel } from '@/components/home/HeroCarousel';
import { MonthCalendar } from '@/components/home/MonthCalendar';
import { PostWidget } from '@/components/home/PostWidget';
import { getBff } from '@/lib/api';
import { monthRange, shiftMonth, toSlides } from '@/lib/home/logic';
import type {
  CalendarEntry,
  PageResponse,
  PostSort,
  PublicNotice,
  PublicPerformance,
  PublicPost,
  Slide,
} from '@/lib/home/types';

function thisMonth(): { year: number; month: number } {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

/**
 * 홈. 로그인 없이도 열린다 — 공개 조회(`/api/bff/public/**`)만 쓴다.
 * 카드를 눌러 상세로 들어가는 순간부터는 인증 경로라 미들웨어가 로그인으로 보낸다.
 */
export default function HomePage() {
  const [{ year, month }, setMonth] = useState(thisMonth);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [posts, setPosts] = useState<PublicPost[]>([]);
  const [sort, setSort] = useState<PostSort>('LATEST');
  const [postsLoading, setPostsLoading] = useState(true);
  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(true);

  // 히어로: 다가오는 공연 + 고정 공지
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getBff<PageResponse<PublicPerformance>>('/api/bff/public/performances?scope=UPCOMING&size=3'),
      getBff<PageResponse<PublicNotice>>('/api/bff/public/notices?scope=PINNED&size=5'),
    ]).then(([performances, notices]) => {
      if (cancelled) return;
      setSlides(toSlides(
        performances.ok ? (performances.data as PageResponse<PublicPerformance>).content : [],
        notices.ok ? (notices.data as PageResponse<PublicNotice>).content : [],
      ));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // 게시글 위젯: 탭이 바뀌면 다시 부른다.
  // 로딩 표시는 effect가 아니라 탭 핸들러에서 켠다 — effect 안의 동기 setState는
  // 연쇄 렌더를 부르고 react-hooks/set-state-in-effect 에 걸린다.
  useEffect(() => {
    let cancelled = false;
    getBff<PageResponse<PublicPost>>(`/api/bff/public/feed/posts?sort=${sort}&size=8`).then((res) => {
      if (cancelled) return;
      setPosts(res.ok ? (res.data as PageResponse<PublicPost>).content : []);
      setPostsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [sort]);

  // 달력: 달이 바뀌면 그 달 범위로 다시 부른다(로딩 표시는 이동 핸들러에서 켠다).
  useEffect(() => {
    let cancelled = false;
    const { from, to } = monthRange(year, month);
    const query = `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
    getBff<CalendarEntry[]>(`/api/bff/public/calendar?${query}`).then((res) => {
      if (cancelled) return;
      setEntries(res.ok ? (res.data as CalendarEntry[]) : []);
      setCalendarLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [year, month]);

  const onShiftMonth = useCallback((delta: number) => {
    setCalendarLoading(true);
    setMonth((current) => shiftMonth(current.year, current.month, delta));
  }, []);

  const onSortChange = useCallback((next: PostSort) => {
    setPostsLoading(true);
    setSort(next);
  }, []);

  const now = new Date();
  const today =
    now.getFullYear() === year && now.getMonth() + 1 === month ? now.getDate() : null;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      {slides.length > 0 && <HeroCarousel slides={slides} />}

      {/*
        첫 열을 minmax(0,1fr)로 두는 것이 중요하다. 그냥 1fr이면 최소 크기가 auto라
        truncate된 긴 제목의 min-content 폭만큼 열이 부풀어 달력을 화면 밖으로 밀어낸다
        (실화면에서 가로 스크롤로 드러났다).
      */}
      <div className="mt-8 grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <PostWidget
          posts={posts}
          sort={sort}
          isLoading={postsLoading}
          onSortChange={onSortChange}
        />
        <MonthCalendar
          year={year}
          month={month}
          entries={entries}
          today={today}
          isLoading={calendarLoading}
          onShiftMonth={onShiftMonth}
        />
      </div>
    </main>
  );
}
