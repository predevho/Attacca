import { proxyAuthed } from '@/lib/server/bffProxy';

export async function GET() {
  return proxyAuthed('/api/members/me');
}
