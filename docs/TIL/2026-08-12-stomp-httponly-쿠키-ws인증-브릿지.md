# STOMP를 httpOnly 쿠키 환경에서 인증하기 — ws-token 브릿지

- 날짜: 2026-08-12
- 카테고리: FE / 인증 / WebSocket
- 태그: STOMP, WebSocket, httpOnly, BFF, 보안

## 문제

이 프로젝트 FE는 **토큰을 httpOnly 쿠키에 격리**한다. 클라이언트 JS는 access/refresh 토큰을 절대 읽지 못하고, 모든 API는 same-origin BFF(`/api/bff/**`)를 거친다. BFF가 서버측에서 쿠키를 붙여 Spring을 호출하므로 토큰이 브라우저 JS에 노출되지 않는다(XSS 토큰 탈취 방어).

그런데 CHAT의 실시간은 **STOMP over WebSocket**이고, BE는 STOMP `CONNECT` 프레임의 네이티브 헤더 `Authorization: Bearer <accessToken>`으로 인증한다. 여기서 충돌이 생긴다:

1. CONNECT 프레임에 넣을 토큰을 **JS가 읽어야 하는데** httpOnly라 못 읽는다.
2. WebSocket 핸드셰이크는 BFF(같은 오리진)가 아니라 **BE(다른 오리진)로 직접** 가야 한다. httpOnly 쿠키는 FE 오리진 것이라 BE로 전송되지도 않고, BE는 쿠키가 아닌 Authorization 헤더를 본다.

즉 REST에서 쓰던 "BFF가 쿠키를 대신 붙인다" 패턴이 WebSocket에는 그대로 통하지 않는다.

## 해결 — ws-token 브릿지

BE는 완성돼 있어 **FE만** 바꿀 수 있었다. 현실적인 유일 경로:

- BFF에 특수 라우트 `GET /api/bff/chat/ws-token`을 두고, 서버측에서 httpOnly access 쿠키를 읽어 `{ token }`으로 **클라이언트에 반환**한다(프록시 아님).
- 클라이언트는 이 토큰을 STOMP `CONNECT`의 `Authorization` 헤더에 넣어 `NEXT_PUBLIC_BE_WS_URL`(BE)로 직접 연결한다.

```ts
// BFF: 쿠키 → 토큰
export async function GET() {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) return NextResponse.json({ ok:false, message:'로그인이 필요합니다.' }, { status:401 });
  return NextResponse.json({ ok:true, data:{ token }, message:null });
}

// 클라이언트: @stomp/stompjs beforeConnect에서 토큰 취득
const client = new Client({
  brokerURL: WS_URL,
  beforeConnect: async () => {
    const token = await fetchWsToken();               // BFF 호출
    client.connectHeaders = { Authorization: `Bearer ${token}` };
  },
});
```

## 트레이드오프 (핵심)

이 방식은 **WS 연결 동안 access 토큰이 JS에 노출**된다 — httpOnly가 주던 보호를 그 순간만큼 포기하는 것이다. XSS가 있으면 토큰을 탈취당할 수 있다. 완화책:

- 노출되는 건 짧은 TTL의 **access** 토큰뿐(refresh는 여전히 httpOnly). 30분 만료.
- 대화창 진입 시 **REST(상세·이력)를 먼저 호출**해 필요하면 reissue를 태운 뒤 ws-token을 받으므로 신선한 토큰이 나간다.

더 깨끗한 대안은 BE에 **일회용·단수명 WS 티켓** 엔드포인트를 두어 access 토큰 자체를 노출하지 않는 것. 그러나 이는 BE 변경이라 이번 FE-only 범위 밖으로 미뤘다(BACKLOG).

## 배운 것

- "토큰을 UI에서 격리한다"는 BFF 철학은 **HTTP 요청/응답 모델을 전제**한다. WebSocket처럼 클라이언트가 직접 지속 연결을 맺고, 인증 정보를 프레임에 실어야 하는 프로토콜에는 그대로 이식되지 않는다.
- 서버(BE)를 못 바꾸는 제약이 설계를 강하게 좁힌다. "가장 안전한 방법"이 아니라 "주어진 계약에서 가능한 방법 중 트레이드오프를 문서화하고 사용자 승인을 받는 것"이 현실적 결론이었다.
- 실시간 로직(연결/구독/전송/재연결/토큰 취득)은 `lib/chat/stompClient.ts` **한 파일에 캡슐화**해 페이지가 `@stomp/stompjs`를 직접 다루지 않게 했다. 덕분에 페이지 테스트는 이 래퍼를 목으로 대체해 실제 WS 없이 검증할 수 있었다(단, 실제 브라우저↔BE 왕복은 수동 검증 몫으로 남음).
- 브로드캐스트 구조의 부수효과: 내가 보낸 메시지도 `/topic`으로 되돌아오므로 낙관적 업데이트가 아니라 **id 기준 중복 제거**(`mergeMessages`)로 처리하면 자기 에코가 자연스럽게 합쳐진다. typing 프레임(숫자 id 없음)은 같은 토픽으로 오므로 `typeof id === 'number'`로 걸러냈다.
