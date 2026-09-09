import { proxyAuthed } from '@/lib/server/bffProxy';

export async function PUT(request: Request) {
  return proxyAuthed('/api/members/me/profile', { method: 'PUT', body: await request.text() });
}
