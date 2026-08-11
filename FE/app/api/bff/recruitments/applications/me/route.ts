import { proxyAuthed } from '@/lib/server/bffProxy';

export async function GET(request: Request) {
  const search = new URL(request.url).search; // ?page=&size=
  return proxyAuthed('/api/recruitments/applications/me' + search);
}
