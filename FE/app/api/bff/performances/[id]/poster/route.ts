import { NextResponse } from 'next/server';
import { proxyAuthed } from '@/lib/server/bffProxy';
import type { IdParams } from '@/lib/server/routeParams';

export async function PUT(request: Request, { params }: IdParams) {
  const { id } = await params;
  const incoming = await request.formData();
  const file = incoming.get('file');
  if (!(file instanceof Blob)) {
    return NextResponse.json({ ok: false, message: '이미지 파일이 필요합니다.' }, { status: 400 });
  }
  const forward = new FormData();
  forward.append('file', file, (file as File).name ?? 'upload');
  return proxyAuthed(`/api/performances/${id}/poster`, { method: 'PUT', body: forward });
}
