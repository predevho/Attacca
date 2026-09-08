import { proxyPublic } from '@/lib/server/bffProxy';

/** 공개 게시글 목록. ?sort=LATEST|POPULAR&page=&size= */
export async function GET(request: Request) {
  const search = new URL(request.url).search;
  return proxyPublic('/api/public/feed/posts' + search);
}
