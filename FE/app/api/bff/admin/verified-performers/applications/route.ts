import { proxyAuthed } from '@/lib/server/bffProxy';

export async function GET(request: Request) {
  const search = new URL(request.url).search; // ?status=&page=&size=
  return proxyAuthed('/api/admin/verified-performers/applications' + search);
}
