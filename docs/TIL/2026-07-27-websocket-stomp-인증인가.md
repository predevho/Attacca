# TIL — WebSocket/STOMP 인증·인가: CONNECT 프레임 JWT와 "브로커 목적지 우회" 막기

> 작성일: 2026-07-27
> 목적: REST와 다른 WebSocket에서 **인증을 어디서 하고(CONNECT 프레임 JWT)**, **인가를 어떻게 거는지(방 참여자 검증)**, 그리고 실시간 채팅에서 조용히 뚫리는 **브로커 목적지 우회**를 왜 막아야 하는지 이 문서 하나로 이해한다.
> 관련 코드: `global.websocket.StompAuthChannelInterceptor` / `global.websocket.WebSocketConfig` / 규칙: `docs/DOMAIN-CHAT-STATUTE.md §3`

---

## 1. REST와 무엇이 다른가

지금까지 도메인(FEED/PERFORMANCE/RECRUITMENT)은 전부 **요청-응답(REST)**이었다. 클라가 물으면 서버가 답하고 연결은 끝난다. 그래서 인증은 **요청마다** `Authorization: Bearer` 헤더를 필터가 검사했다(`JwtAuthenticationFilter`).

채팅은 다르다. **연결을 한 번 맺어두고 오래 유지**하며 서버가 먼저 클라에게 메시지를 밀어넣는다(WebSocket). 그러면 인증을 **연결할 때 딱 한 번** 하고, 그 신원(Principal)이 세션 내내 따라붙는다.

- **WebSocket**: 양방향 지속 연결(REST처럼 매번 끊지 않음).
- **STOMP**: WebSocket 위에 "구독(SUBSCRIBE)/발행(SEND)" 규칙을 얹은 메시징 프로토콜. `CONNECT`/`SUBSCRIBE`/`SEND`/`ERROR` 같은 프레임이 오간다.

---

## 2. 인증은 어디서? — 핸드셰이크 vs CONNECT 프레임

토큰을 꽂을 수 있는 지점이 둘이다.

| 지점 | 특징 | 한계 |
|---|---|---|
| **HTTP 핸드셰이크**(업그레이드 직전) | 쿠키가 자동으로 실림 → 브라우저 친화 | 브라우저 기본 `WebSocket` API는 **커스텀 헤더를 못 붙임** → `Authorization` 헤더가 어색 |
| **STOMP CONNECT 프레임**(소켓 열린 직후 첫 STOMP 명령) | 여기엔 **커스텀 헤더를 자유롭게** 넣을 수 있음 | — |

우리는 **CONNECT 프레임에 access token**을 실었다. 이유: ① 기존 REST의 `Bearer` JWT와 **개념·`JwtProvider`가 동일**(재사용), ② BE가 특정 FE에 종속되지 않음(모바일도 그대로). 브라우저-쿠키 연동은 나중 FE/BFF의 관심사다.

검증은 **인바운드 채널 인터셉터**(`ChannelInterceptor`)가 한다. CONNECT 프레임을 가로채 토큰을 파싱하고, 성공하면 인증된 신원을 세션에 바인딩한다.

```java
// StompAuthChannelInterceptor#preSend, command == CONNECT 일 때
String bearer = accessor.getFirstNativeHeader("Authorization");   // CONNECT 프레임 헤더
Claims claims = jwtProvider.parse(bearer.substring("Bearer ".length())); // 실패 시 예외 → 연결 거절
Long memberId = Long.valueOf(claims.getSubject());
accessor.setUser(new UsernamePasswordAuthenticationToken(memberId, null, authorities)); // 세션에 Principal 고정
```

`accessor.setUser(...)`로 세팅한 Principal은 이후 그 세션의 **모든 프레임에서 재사용**된다. 핸드셰이크 경로(`/ws`)는 SecurityConfig에서 `permitAll` — 인증은 HTTP가 아니라 STOMP CONNECT에서 하기 때문이다.

---

## 3. 인가는 어떻게? — SUBSCRIBE/SEND를 방 참여자로 제한

인증(누구인가)과 인가(무엇을 해도 되나)는 별개다. 같은 인터셉터가 **SUBSCRIBE/SEND 프레임**도 가로채, 그 목적지 방의 **활성 참여자인지** 검사한다.

```java
// SUBSCRIBE /topic/rooms/{id}, SEND /app/rooms/{id}/... 일 때
Long roomId = parseRoomId(destination);
Long memberId = ((UsernamePasswordAuthenticationToken) accessor.getUser()).getPrincipal(); // 세션 Principal
if (!participantRepository.existsByRoomIdAndMemberIdAndLeftAtIsNull(roomId, memberId)) {
    throw new IllegalArgumentException("채팅방 참여자만 접근할 수 있습니다."); // → STOMP ERROR 프레임
}
```

핵심 두 가지:
- **신원은 클라가 보낸 per-message 헤더가 아니라 서버가 CONNECT 때 세팅한 `accessor.getUser()`에서만** 읽는다. 그래서 클라가 "나 memberId=1이야" 같은 헤더를 위조해도 소용없다(스푸핑 벡터 차단).
- **fail-closed**: 참여자가 아니거나, roomId 파싱 실패, Principal 없음 — 모든 경우 예외를 던져 거절한다. "확실히 허용될 때만 통과".

---

## 4. 함정 — "브로커 목적지 우회" (최종 리뷰가 잡은 실제 구멍)

여기가 이 TIL의 진짜 포인트다. 처음 구현은 SEND 인가를 **`/app/rooms/`로 시작하는 목적지에 대해서만** 했다. 그런데 STOMP엔 두 종류의 목적지가 있다.

```
/app/**    → 애플리케이션 목적지. @MessageMapping 핸들러(=우리 코드)로 라우팅
/topic/**  → 브로커 목적지. SimpleBroker가 구독자에게 그대로 중계
```

클라이언트가 `SEND`를 **브로커 목적지 `/topic/rooms/5`로 직접** 보내면?

```
정상 경로:  클라 --SEND /app/rooms/5/send--> [인터셉터 인가 OK] --> @MessageMapping --> DB 저장 --> convertAndSend --> /topic/rooms/5 구독자
우회 경로:  클라 --SEND /topic/rooms/5------> [인터셉터: /app/ 아님 → 그냥 통과] --> SimpleBroker가 /topic/rooms/5 구독자에게 그대로 중계
```

우회 경로는 **참여자 검증·`@MessageMapping` 핸들러·DB 영속화를 전부 건너뛴다.** 인증만 된 아무나가 `{"content":"...","sender":{"nickname":"관리자"}}` 같은 `ChatMessageResponse` 모양의 페이로드를 임의의 방에 **주입**하고, 그 방 구독자(=참여자) 전원이 진짜 메시지처럼 받는다. 발신자 위조까지 가능한 인가·무결성 우회다.

**해결**: 클라이언트 SEND는 **`/app/`로 시작하는 목적지만 허용**한다. 브로커 목적지(`/topic`,`/user`)는 **구독 전용**이지 클라가 SEND할 곳이 아니다.

```java
case SEND -> {
    String dest = accessor.getDestination();
    if (dest == null || !dest.startsWith("/app/")) {
        throw new IllegalArgumentException("허용되지 않은 전송 대상입니다."); // 브로커 목적지로의 SEND 거절
    }
    authorize(accessor, dest, ROOM_PREFIX_APP);  // 그다음 방 참여자 인가
}
```

> 교훈: STOMP에서 **"클라는 `/app`으로 보내고, `/topic`은 구독만 한다"**가 규칙이다. SEND 인가를 애플리케이션 목적지에만 걸면 브로커 목적지로 새는 문을 못 본다. 서버→클라 방송은 우리 코드의 `convertAndSend`(신뢰된 경로)이지 클라 SEND가 아니다.

(참고로 Spring Security의 message-broker authorization을 쓰면 이 문을 프레임워크 레벨에서 닫을 수도 있다. 우리는 이미 있는 인터셉터에 한 줄 가드를 더하는 최소 변경을 택했다.)

---

## 5. 왜 이걸 태스크별 리뷰가 아니라 최종 리뷰가 잡았나

- STOMP 컨트롤러 태스크의 리뷰는 **그 diff(=핸들러 코드)**만 봤다. 핸들러 자체는 정상이었다.
- 인터셉터 태스크의 리뷰는 **인터셉터 diff**만 봤고, "SEND는 /app/rooms를 인가한다"는 맞았다.
- 구멍은 **두 조각의 상호작용**(브로커가 /topic SEND를 중계 + 인가가 /app만 검사)에서 났다. 그래서 **전체 브랜치를 함께 보는 최종 리뷰**가 잡았다.

교훈: 보안 경계는 **컴포넌트 경계를 가로질러** 뚫린다. 조각별로 맞아도 조합에서 샐 수 있으니, 실시간/인가처럼 cross-cutting한 건 넓게 한 번 더 봐야 한다.

---

## 6. 한 줄 정리

- WebSocket은 연결이 오래 유지되므로 **인증은 CONNECT 프레임에서 1회**, Principal을 세션에 고정한다(REST의 요청마다 검사와 다름).
- 인가(SUBSCRIBE/SEND)는 **서버가 세팅한 세션 Principal**로만 판단한다(클라 헤더 신뢰 금지 → 스푸핑 차단), fail-closed.
- 실시간의 숨은 함정: **클라 SEND를 브로커 목적지(`/topic`)로 보내면 인가·핸들러·영속화가 우회**된다. **클라 SEND는 `/app`만 허용**하라.
- 보안 구멍은 컴포넌트 조합에서 나므로 **넓은(whole-branch) 리뷰**가 필요하다.

---

## 7. 더 공부할 것 (study pointers)

1. **Spring Security Messaging** (`AbstractSecurityWebSocketMessageBrokerConfigurer` / `MessageMatcherDelegatingAuthorizationManager`): 목적지별 인가를 프레임워크로 선언하는 법. 우리처럼 인터셉터로 직접 짜는 것과의 트레이드오프.
2. **인메모리 Simple Broker vs Redis/RabbitMQ 릴레이**: 단일 서버는 SimpleBroker로 충분하지만, 서버 여러 대면 A·B가 다른 인스턴스에 붙어 메시지가 안 닿는다. `enableStompBrokerRelay`로 교체(설정만 바뀌고 도메인 코드는 불변)하는 이유와, 그때 presence·세션 상태를 어디에 두는지.
3. **CONNECT 시 토큰 type 검증**: 우리 `parse`는 서명·만료만 본다(HTTP 필터와 동일). refresh 토큰으로 WS 연결이 되는 표면을 막으려면 `type == "access"`도 확인해야 할지.
4. **동시성·트랜잭션 곁가지**: 같은 CHAT 작업에서 1:1 방 동시 생성 경합을 `REQUIRES_NEW`로 격리했는데, MySQL 기본 격리(REPEATABLE READ)에선 **바깥 트랜잭션의 스냅샷**이 경합 상대가 커밋한 행을 못 봐서 복구 재조회가 실패했다 → 재조회도 새 트랜잭션에서 해야 한다. (별도 TIL감. `[[동시성-멱등-유니크제약]]`과 이어짐)
5. **STOMP 프레임 계층**: CONNECT/SUBSCRIBE/SEND/MESSAGE/ERROR/RECEIPT의 의미와, 인가 실패가 왜 `ERROR` 프레임으로 오는지. 통합 테스트에서 `WebSocketStompClient`로 실제 프레임을 주고받아 검증하는 법.
