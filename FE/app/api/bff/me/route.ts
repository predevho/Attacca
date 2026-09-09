import { proxyAuthed } from '@/lib/server/bffProxy';

export const GET = () => proxyAuthed('/api/members/me/profile');
