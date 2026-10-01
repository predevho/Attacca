'use client';

import { useHomePageData } from '@/features/home/hooks/useHomePageData';
import Link from 'next/link';
import { EmptyHero } from '@/components/home/EmptyHero';
import { HeroCarousel } from '@/components/home/HeroCarousel';
import { MonthCalendar } from '@/components/home/MonthCalendar';
import { PostWidget } from '@/components/home/PostWidget';
import { PageContainer } from '@/components/layout/PageContainer';

/**
 * 홈. 로그인 없이도 열린다 — 공개 조회(`/api/bff/public/**`)만 쓴다.
 * 카드를 눌러 상세로 들어가는 순간부터는 인증 경로라 미들웨어가 로그인으로 보낸다.
 */
export default function HomePage() {
  const {
    year,
    month,
    slides,
    posts,
    sort,
    postsLoading,
    postsError,
    onRetryPosts,
    entries,
    calendarLoading,
    calendarError,
    onRetryCalendar,
    heroError,
    onRetryHero,
    onShiftMonth,
    onSortChange,
  } = useHomePageData();

  const now = new Date();
  const today =
    now.getFullYear() === year && now.getMonth() + 1 === month ? now.getDate() : null;

  return (
    <PageContainer className="py-6 sm:py-8">
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
            <h2 id="community-heading" className="text-base font-semibold text-ink">커뮤니티 피드</h2>
            <span className="text-xs text-ink-faint">새로운 대화</span>
          </div>
          <PostWidget
            posts={posts}
            sort={sort}
            isLoading={postsLoading}
            error={postsError}
            onRetry={onRetryPosts}
            onSortChange={onSortChange}
          />
        </section>
        <section aria-labelledby="schedule-heading">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="schedule-heading" className="text-base font-semibold text-ink">월간 일정</h2>
            <span className="text-xs text-ink-faint">공연 · 공지</span>
          </div>
          <MonthCalendar
            year={year}
            month={month}
            entries={entries}
            today={today}
            isLoading={calendarLoading}
            error={calendarError}
            onRetry={onRetryCalendar}
            onShiftMonth={onShiftMonth}
          />
        </section>
      </div>
    </PageContainer>
  );
}
