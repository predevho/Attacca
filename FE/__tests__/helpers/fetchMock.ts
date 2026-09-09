import { vi } from 'vitest';

/**
 * BFF 라우트 테스트용 fetch 목.
 *
 * ⚠️ 인자를 반드시 선언해야 한다. `vi.fn(async () => ...)`처럼 비워 두면 호출 시그니처가
 * `() => ...`로 추론돼 **`mock.calls`가 빈 튜플**이 되고, `calls[0][0]`(요청 URL)이나
 * `calls[0][1]`(RequestInit) 접근이 전부 타입 오류가 된다. 2026-09-09 기준 그렇게 쌓인
 * 오류가 100건이었다 — CI에 타입 검사가 없어 아무도 보지 못했다.
 *
 * 6개 파일에 같은 헬퍼가 복붙돼 있던 것을 여기로 모았다.
 */
export function fetchMockOf(
  impl: (url?: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
) {
  return vi.fn(impl);
}

/** JSON 응답 하나를 만든다. BE 공통 응답 봉투를 그대로 쓴다. */
export function beJson(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** `{success:true, data:null}`만 돌려주는 fetch 목. 경로·메서드만 단언할 때 쓴다. */
export function okFetch() {
  return fetchMockOf(async () => beJson({ success: true, data: null, error: null }));
}
