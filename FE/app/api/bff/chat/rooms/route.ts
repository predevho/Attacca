import { proxyAuthed } from '@/lib/server/bffProxy';

export async function GET(request: Request) {
  const search = new URL(request.url).search; // ?page=&size=
  return proxyAuthed('/api/chat/rooms' + search);
}

export async function POST(request: Request) {
  const body = await request.text();
  return proxyAuthed('/api/chat/rooms', { method: 'POST', body });
}
