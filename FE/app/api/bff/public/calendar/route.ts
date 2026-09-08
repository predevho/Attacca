import { NextResponse } from 'next/server';
import { toCalendarEntries } from '@/lib/home/logic';
import type { PageResponse, PublicNotice, PublicPerformance } from '@/lib/home/types';
import { beFetch } from '@/lib/server/beClient';

/**
 * 홈 달력용 합본. 공연과 공지 일정을 각각 공개 조회로 받아 한 벌로 합친다.
 *
 * 이 합성이 BE가 아니라 여기 있는 이유는 ARCHITECTURE-CONSTITUTION §2 —
 * "BE는 화면(뷰) 로직을 갖지 않는다". BE는 도메인별 범위 조회만 제공하고,
 * 화면 형태로 엮는 일은 FE 쪽 계층인 BFF가 한다.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  if (!from || !to) {
    return NextResponse.json(
      { ok: false, data: null, message: '조회 범위(from, to)가 필요합니다.' },
      { status: 400 },
    );
  }

  const range = `scope=SCHEDULED&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&size=50`;
  const [performances, notices] = await Promise.all([
    beFetch(`/api/public/performances?${range}`),
    beFetch(`/api/public/notices?${range}`),
  ]);

  // 한쪽만 실패해도 반쪽짜리 달력을 그리지 않는다 — 빠진 일정이 "없는 일정"으로 보이면 안 된다.
  const failed = !performances.ok ? performances : !notices.ok ? notices : null;
  if (failed) {
    return NextResponse.json(
      { ok: false, data: null, message: failed.message ?? '일정을 불러오지 못했습니다.' },
      { status: failed.status || 502 },
    );
  }

  const entries = toCalendarEntries(
    (performances.data as PageResponse<PublicPerformance>).content,
    (notices.data as PageResponse<PublicNotice>).content,
  );
  return NextResponse.json({ ok: true, data: entries, message: null }, { status: 200 });
}
