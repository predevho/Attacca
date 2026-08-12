import { proxyAuthed } from '@/lib/server/bffProxy';

export async function POST(request: Request) {
  const body = await request.text();
  return proxyAuthed('/api/admin/verified-performers/grant', { method: 'POST', body });
}
