'use client';

import { useCallback, useEffect, useState } from 'react';
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

export function useHomePageData() {
  const [{ year, month }, setMonth] = useState(thisMonth);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [posts, setPosts] = useState<PublicPost[]>([]);
  const [sort, setSort] = useState<PostSort>('LATEST');
  const [postsLoading, setPostsLoading] = useState(true);
  const [postsError, setPostsError] = useState<string | null>(null);
  const [postsRetryKey, setPostsRetryKey] = useState(0);
  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(true);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [calendarRetryKey, setCalendarRetryKey] = useState(0);
  const [heroError, setHeroError] = useState(false);
  const [heroRetryKey, setHeroRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const content = <T,>(response: { ok: boolean; data?: unknown }) =>
      (response.ok ? (response.data as PageResponse<T>).content : []);

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

    return () => { cancelled = true; };
  }, [heroRetryKey]);

  useEffect(() => {
    let cancelled = false;
    getBff<PageResponse<PublicPost>>(`/api/bff/public/feed/posts?sort=${sort}&size=8`)
      .then((response) => {
        if (cancelled) return;
        if (response.ok && response.data) {
          setPosts(response.data.content);
          setPostsError(null);
        } else {
          setPosts([]);
          setPostsError(response.message ?? '게시글을 불러오지 못했습니다.');
        }
      })
      .catch(() => {
        if (cancelled) return;
        setPosts([]);
        setPostsError('게시글을 불러오지 못했습니다.');
      })
      .finally(() => {
        if (!cancelled) setPostsLoading(false);
      });
    return () => { cancelled = true; };
  }, [sort, postsRetryKey]);

  useEffect(() => {
    let cancelled = false;
    const { from, to } = monthRange(year, month);
    const query = `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
    getBff<CalendarEntry[]>(`/api/bff/public/calendar?${query}`)
      .then((response) => {
        if (cancelled) return;
        if (response.ok && response.data) {
          setEntries(response.data);
          setCalendarError(null);
        } else {
          setEntries([]);
          setCalendarError(response.message ?? '일정을 불러오지 못했습니다.');
        }
      })
      .catch(() => {
        if (cancelled) return;
        setEntries([]);
        setCalendarError('일정을 불러오지 못했습니다.');
      })
      .finally(() => {
        if (!cancelled) setCalendarLoading(false);
      });
    return () => { cancelled = true; };
  }, [year, month, calendarRetryKey]);

  const onRetryHero = useCallback(() => {
    setHeroError(false);
    setHeroRetryKey((key) => key + 1);
  }, []);

  const onShiftMonth = useCallback((delta: number) => {
    setCalendarLoading(true);
    setCalendarError(null);
    setEntries([]);
    setMonth((current) => shiftMonth(current.year, current.month, delta));
  }, []);

  const onSortChange = useCallback((next: PostSort) => {
    if (next === sort) return;
    setPostsLoading(true);
    setPostsError(null);
    setPosts([]);
    setSort(next);
  }, [sort]);

  const onRetryPosts = useCallback(() => {
    setPostsError(null);
    setPostsLoading(true);
    setPostsRetryKey((key) => key + 1);
  }, []);

  const onRetryCalendar = useCallback(() => {
    setCalendarError(null);
    setCalendarLoading(true);
    setCalendarRetryKey((key) => key + 1);
  }, []);

  return {
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
  };
}
