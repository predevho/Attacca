import { proxyPublic } from '@/lib/server/bffProxy';
import type { IdParams } from '@/lib/server/routeParams';

/**
 * 공개 공연 상세. 로그인하지 않아도 볼 수 있다.
 *
 * 인증 경로(`/api/bff/performances/[id]`)와 응답이 다르다 — 공개 응답에는
 * 주최자의 회원 id가 없다(PublicMemberDisplay). 신원을 공개 화면에 흘리지 않기
 * 위한 의도된 차이이므로, 수정·삭제 버튼은 로그인한 사용자에게만 보인다.
 */
export async function GET(_request: Request, { params }: IdParams) {
  const { id } = await params;
  return proxyPublic(`/api/public/performances/${encodeURIComponent(id)}`);
}
