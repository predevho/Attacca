'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { EmptyHero } from '@/components/home/EmptyHero';
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
  const [heroError, setHeroError] = useState(false);
  const [heroRetryKey, setHeroRetryKey] = useState(0);

  // 히어로: 다가오는 공연 + 고정 공지. 다가오는 공연이 없으면 지난 공연으로 채운다
  // (없으면 히어로가 통째로 사라져 홈 위쪽이 텅 빈다 — toSlides 주석 참고).
  useEffect(() => {
    let cancelled = false;
    const content = <T,>(r: { ok: boolean; data?: unknown }) =>
      (r.ok ? (r.data as PageResponse<T>).content : []);
    Promise.allSettled([
      getBff<PageResponse<PublicPerformance>>('/api/bff/public/performances?scope=UPCOMING&size=3'),
      getBff<PageResponse<PublicNotice>>('/api/bff/public/notices?scope=PINNED&size=5'),
      getBff<PageResponse<PublicPerformance>>('/api/bff/public/performances?scope=PAST&size=3'),
    ]).then((results) => {
      if (cancelled) return;

      const [upcoming, notices, past] = results;
      const resultContent = <T,>(result: PromiseSettledResult<{ ok: boolean; data?: unknown }>) =>
        result.status === 'fulfilled' ? content<T>(result.value) : [];
      setHeroError(
        results.some((result) =>
          result.status === 'rejected' || (result.status === 'fulfilled' && !result.value.ok),
        ),
      );
      setSlides(toSlides(
        resultContent<PublicPerformance>(upcoming),
        resultContent<PublicNotice>(notices),
        5,
        resultContent<PublicPerformance>(past),
      ));
    });
    return () => {
      cancelled = true;
    };
  }, [heroRetryKey]);

  const onRetryHero = useCallback(() => {
    setHeroError(false);
    setHeroRetryKey((key) => key + 1);
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
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:py-8">
      <header className="mb-6 flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-strong">Attacca / 오늘</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">음악 활동을 한눈에</h1>
          <p className="mt-2 max-w-xl text-sm text-ink-muted">
            공연 소식과 연주자 커뮤니티의 새 흐름을 확인하세요.
          </p>
        </div>
        <nav aria-label="빠른 이동" className="flex flex-wrap gap-2 text-sm">
          <Link href="/performances" className="rounded border border-line px-3 py-2 transition-colors hover:bg-surface-muted">
            공연 찾기
          </Link>
          <Link href="/recruitments" className="rounded border border-line px-3 py-2 transition-colors hover:bg-surface-muted">
            구인 보기
          </Link>
          <Link href="/feed" className="rounded bg-brand px-3 py-2 font-semibold text-on-brand transition-opacity hover:opacity-90">
            커뮤니티 열기
          </Link>
        </nav>
      </header>

      {slides.length > 0 ? <HeroCarousel slides={slides} /> : <EmptyHero />}
      {heroError && (
        <div role="alert" className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded border border-line bg-surface-muted px-4 py-3 text-sm">
          <span>주요 소식을 불러오지 못했습니다.</span>
          <button
            type="button"
            onClick={onRetryHero}
            className="rounded border border-line bg-surface px-3 py-2 font-medium hover:bg-surface-muted"
          >
            주요 소식 다시 시도
          </button>
        </div>
      )}

      {/*
        첫 열을 minmax(0,1fr)로 두는 것이 중요하다. 그냥 1fr이면 최소 크기가 auto라
        truncate된 긴 제목의 min-content 폭만큼 열이 부풀어 달력을 화면 밖으로 밀어낸다
        (실화면에서 가로 스크롤로 드러났다).
      */}
      <div className="mt-8 grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section aria-labelledby="community-heading" className="min-w-0">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="community-heading" className="text-sm font-semibold uppercase tracking-wide text-ink-muted">커뮤니티 피드</h2>
            <span className="text-xs text-ink-faint">새로운 대화</span>
          </div>
          <PostWidget
            posts={posts}
            sort={sort}
            isLoading={postsLoading}
            onSortChange={onSortChange}
          />
        </section>
        <section aria-labelledby="schedule-heading">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="schedule-heading" className="text-sm font-semibold uppercase tracking-wide text-ink-muted">월간 일정</h2>
            <span className="text-xs text-ink-faint">공연 · 공지</span>
          </div>
          <MonthCalendar
            year={year}
            month={month}
            entries={entries}
            today={today}
            isLoading={calendarLoading}
            onShiftMonth={onShiftMonth}
          />
        </section>
      </div>
    </main>
  );
}
