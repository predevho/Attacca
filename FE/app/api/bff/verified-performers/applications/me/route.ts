import { proxyAuthed } from '@/lib/server/bffProxy';

export async function GET() {
  return proxyAuthed('/api/verified-performers/applications/me');
}
