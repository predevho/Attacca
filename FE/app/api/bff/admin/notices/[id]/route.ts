import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { authedBeFetch } from '@/lib/server/session';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  const { id } = await params;
  const res = await authedBeFetch(await cookies(), `/api/admin/notices/${encodeURIComponent(id)}`);
  return NextResponse.json({ ok: res.ok, data: res.data, message: res.message },
    { status: res.status || 200 });
}

export async function PUT(request: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await request.text();
  const res = await authedBeFetch(await cookies(),
    `/api/admin/notices/${encodeURIComponent(id)}`, { method: 'PUT', body });
  return NextResponse.json({ ok: res.ok, data: res.data, message: res.message },
    { status: res.status || 200 });
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const { id } = await params;
  const res = await authedBeFetch(await cookies(),
    `/api/admin/notices/${encodeURIComponent(id)}`, { method: 'DELETE' });
  return NextResponse.json({ ok: res.ok, message: res.message }, { status: res.status || 200 });
}
