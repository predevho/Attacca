import { proxyPublic } from '@/lib/server/bffProxy';

/** 공개 공지 목록. ?scope=PINNED|SCHEDULED|ALL&from=&to=&page=&size= */
export async function GET(request: Request) {
  const search = new URL(request.url).search;
  return proxyPublic('/api/public/notices' + search);
}
