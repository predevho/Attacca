import { proxyAuthed } from '@/lib/server/bffProxy';

export async function GET(request: Request) {
  const search = new URL(request.url).search; // ?scope=&page=&size=
  return proxyAuthed('/api/performances' + search);
}

export async function POST(request: Request) {
  const body = await request.text();
  return proxyAuthed('/api/performances', { method: 'POST', body });
}
