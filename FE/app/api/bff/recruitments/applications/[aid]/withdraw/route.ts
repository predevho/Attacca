import { proxyAuthed } from '@/lib/server/bffProxy';
import type { AidParams } from '@/lib/server/routeParams';

export async function POST(_request: Request, { params }: AidParams) {
  const { aid } = await params;
  return proxyAuthed(`/api/recruitments/applications/${aid}/withdraw`, { method: 'POST' });
}
