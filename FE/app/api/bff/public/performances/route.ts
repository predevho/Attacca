import { proxyPublic } from '@/lib/server/bffProxy';

/** 공개 공연 목록. ?scope=UPCOMING|PAST|ALL|SCHEDULED&from=&to=&page=&size= */
export async function GET(request: Request) {
  const search = new URL(request.url).search;
  return proxyPublic('/api/public/performances' + search);
}
