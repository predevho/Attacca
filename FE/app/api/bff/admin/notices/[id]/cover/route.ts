import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { authedBeFetch } from '@/lib/server/session';

/** 커버 이미지 교체. multipart 는 beFetch 가 content-type 을 붙이지 않는다(경계 문자열 때문). */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const form = await request.formData();
  const res = await authedBeFetch(await cookies(),
    `/api/admin/notices/${encodeURIComponent(id)}/cover`, { method: 'PUT', body: form });
  return NextResponse.json({ ok: res.ok, data: res.data, message: res.message },
    { status: res.status || 200 });
}
