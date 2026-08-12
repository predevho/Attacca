import { proxyAuthed } from '@/lib/server/bffProxy';

export async function GET(request: Request) {
  const search = new URL(request.url).search; // ?scope=&instrument=&page=&size=
  return proxyAuthed('/api/recruitments' + search);
}

export async function POST(request: Request) {
  const body = await request.text();
  return proxyAuthed('/api/recruitments', { method: 'POST', body });
}
