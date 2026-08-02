import { proxyAuthed } from '@/lib/server/bffProxy';

export async function GET(request: Request) {
  const search = new URL(request.url).search; // ?cursor=&size=
  return proxyAuthed('/api/feed/posts' + search);
}

export async function POST(request: Request) {
  const body = await request.text();
  return proxyAuthed('/api/feed/posts', { method: 'POST', body });
}
