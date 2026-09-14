import { proxyAuthed } from '@/lib/server/bffProxy';
export async function POST(request: Request) { return proxyAuthed('/api/admin/imports/runs' + new URL(request.url).search, { method: 'POST' }); }
