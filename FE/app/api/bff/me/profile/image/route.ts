import { NextResponse } from 'next/server';
import { proxyAuthed } from '@/lib/server/bffProxy';

export async function PUT(request: Request) {
  const incoming = await request.formData();
  const file = incoming.get('file');
  if (!(file instanceof Blob)) {
    return NextResponse.json({ ok: false, message: '이미지 파일이 필요합니다.' }, { status: 400 });
  }

  // 들어온 폼을 그대로 넘기지 않고 file 하나만 다시 담는다 — 클라이언트가 끼워 넣은
  // 다른 필드가 BE로 흘러가지 않게.
  const forward = new FormData();
  forward.append('file', file, (file as File).name ?? 'upload');

  return proxyAuthed('/api/members/me/profile/image', { method: 'PUT', body: forward });
}
