import { proxyAuthed } from '@/lib/server/bffProxy';
export async function GET(request: Request) { return proxyAuthed('/api/admin/imports' + new URL(request.url).search); }
