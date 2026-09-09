import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { authedBeFetch } from '@/lib/server/session';

/** 어드민 공지 목록/등록. 권한 판정은 BE가 한다(쿠키만으로는 role을 알 수 없다). */
export async function GET(request: Request) {
  const search = new URL(request.url).search; // ?page=&size=
  const res = await authedBeFetch(await cookies(), '/api/admin/notices' + search);
  return NextResponse.json({ ok: res.ok, data: res.data, message: res.message },
    { status: res.status || 200 });
}

export async function POST(request: Request) {
  const body = await request.text();
  const res = await authedBeFetch(await cookies(), '/api/admin/notices',
    { method: 'POST', body });
  return NextResponse.json({ ok: res.ok, data: res.data, message: res.message },
    { status: res.status || 200 });
}
