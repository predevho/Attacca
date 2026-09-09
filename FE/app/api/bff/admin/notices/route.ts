import { proxyAuthed } from '@/lib/server/bffProxy';

/** 어드민 공지 목록/등록. 권한 판정은 BE가 한다(쿠키만으로는 role을 알 수 없다). */
export async function GET(request: Request) {
  const search = new URL(request.url).search; // ?page=&size=
  return proxyAuthed('/api/admin/notices' + search);
}

export async function POST(request: Request) {
  return proxyAuthed('/api/admin/notices', { method: 'POST', body: await request.text() });
}
