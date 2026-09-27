# Opaque Refresh Session + 공용 신원 상태 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** refresh JWT 원문을 브라우저에서 제거하고 Redis TTL 기반 opaque refresh session으로 전환하며, 화면별 신원 조회를 공용 상태로 합친다.

**Architecture:** BE는 무작위 session ID의 SHA-256 해시를 Redis key로 저장하고 TTL 14일을 적용한다. BFF는 access JWT와 opaque session ID를 각각 HttpOnly 쿠키로 보관하며, reissue는 session ID로 새 access JWT만 받는다. FE는 루트 `IdentityProvider`가 identity 조회를 단일화하고 기존 페이지는 공용 상태를 소비한다.

**Tech Stack:** Spring Boot, Spring Security, Spring Data Redis, Redis Lua script, Next.js App Router, React Context, TypeScript, Vitest, MockMvc.

**Spec:** `docs/superpowers/specs/2026-09-27-opaque-refresh-session-design.md`

## Global Constraints

* raw refresh JWT와 `refresh_token` 쿠키를 제거한다.
* `access_token`은 30분 `HttpOnly` 쿠키로 유지한다.
* `refresh_session`은 256-bit 이상 난수 기반 `HttpOnly`·`Secure`(운영)·`SameSite=Lax`·`Path=/` 쿠키이며 Max-Age는 14일이다.
* Redis key는 raw session ID가 아니라 SHA-256 해시를 쓴다. TTL은 14일이고 활동 시 연장하지 않는다.
* Redis 오류는 로그인·재발급에서 fail-closed(503)로 처리한다.
* 로그아웃은 쿠키를 항상 삭제한다. 서버 철회 실패 시 성공으로 위장하지 않고 오류를 반환한다.
* refresh session 회전·grace period는 도입하지 않는다. 재발급은 access JWT만 교체한다.
* 기존 refresh 쿠키 세션은 호환하지 않으며, 배포 뒤 재로그인이 필요하다.
* runtime 비밀값은 EC2 `.env.prod`에만 유지한다. Git, 이미지, CI 출력에 넣지 않는다.
* 커밋과 푸시는 사용자가 별도로 요청할 때만 한다.

## Review Focus

* Redis key에 raw session ID가 포함되거나 Redis value에 access/refresh JWT가 저장되지 않는지 Task 1에서 단위 테스트한다.
* 14일 TTL이 재발급으로 연장되지 않는지 Task 1에서 fake clock 또는 TTL 검증으로 고정한다.
* Redis 장애가 로그인·reissue에는 503이지만 유효 access JWT API에는 영향을 주지 않는지 Task 2에서 MockMvc로 검증한다.
* 로그아웃 철회 실패에도 두 쿠키가 삭제되고 BFF HTTP 실패가 소비자에게 전달되는지 Task 4에서 검증한다.
* 동시에 마운트한 Header와 보호 화면이 identity endpoint를 한 번만 호출하는지 Task 5에서 React 테스트로 검증한다.

---

## File Structure

| 경로 | 책임 |
|---|---|
| `BE/.../security/session/RefreshSessionStore.java` | opaque session 생성·조회·개별/전체 철회 계약 |
| `BE/.../security/session/RedisRefreshSessionStore.java` | 해시 키·TTL·회원 인덱스·Lua 원자 조작 |
| `BE/.../security/session/InMemoryRefreshSessionStore.java` | Redis 없는 테스트용 동일 계약 구현 |
| `BE/.../security/token/TokenIssuer.java` | access JWT + opaque session 발급 조율 |
| `BE/.../security/auth/*` | session 기반 reissue/logout API 계약 |
| `FE/lib/server/cookies.ts` | access/session 쿠키 이름·속성·삭제 |
| `FE/lib/server/session.ts` | BFF의 401→reissue→access 1회 재시도 |
| `FE/components/auth/IdentityProvider.tsx` | 단일 identity 요청과 명시적 갱신 API |
| `FE/components/layout/Header.tsx` | 공용 identity 소비와 로그아웃 실패 표시 |

### Task 1: Opaque Refresh Session 저장소

**Files:**
- Create: `BE/src/main/java/com/back/global/security/session/RefreshSessionStore.java`
- Create: `BE/src/main/java/com/back/global/security/session/RedisRefreshSessionStore.java`
- Create: `BE/src/main/java/com/back/global/security/session/InMemoryRefreshSessionStore.java`
- Create: `BE/src/test/java/com/back/global/security/session/RefreshSessionStoreTest.java`
- Modify: `BE/src/main/resources/application.yaml`
- Delete: `BE/src/main/java/com/back/global/security/token/RefreshTokenStore.java`
- Delete: `BE/src/main/java/com/back/global/security/token/RedisRefreshTokenStore.java`
- Delete: `BE/src/main/java/com/back/global/security/token/InMemoryRefreshTokenStore.java`

**Interfaces:**
- Produces: `RefreshSessionStore#create(Long memberId): String`, `findMemberId(String rawSessionId): Optional<Long>`, `revoke(String rawSessionId): boolean`, `revokeAll(Long memberId): void`.
- Produces: `RefreshSessionStoreUnavailableException` path through existing `TOKEN_STORE_UNAVAILABLE` error code.

- [ ] **Step 1: Write failing session-store tests**

```java
@Test
void 생성한_세션은_회원과_연결되고_원문은_저장키에_포함되지_않는다() {
    String raw = store.create(3L);
    assertThat(store.findMemberId(raw)).contains(3L);
    assertThat(store.debugKeys()).noneMatch(key -> key.contains(raw));
}

@Test
void 재발급_조회는_세션_ttl을_연장하지_않는다() {
    String raw = store.create(3L);
    Duration before = store.remainingTtl(raw);
    store.findMemberId(raw);
    assertThat(store.remainingTtl(raw)).isLessThanOrEqualTo(before);
}
```

- [ ] **Step 2: Run the new test to verify it fails**

Run: `cd BE && ./gradlew test --tests com.back.global.security.session.RefreshSessionStoreTest`

Expected: FAIL because the `security.session` package and `RefreshSessionStore` do not exist.

- [ ] **Step 3: Implement the minimal session contract and stores**

```java
public interface RefreshSessionStore {
    String create(Long memberId);
    Optional<Long> findMemberId(String rawSessionId);
    boolean revoke(String rawSessionId);
    void revokeAll(Long memberId);
}
```

Use `SecureRandom` to create 32 random bytes encoded with URL-safe Base64 without padding. Hash the raw ID with SHA-256; Redis uses `auth:refresh:{hash}` for the record and `auth:refresh:member:{memberId}` for the member index. Apply `Duration.ofMillis(jwtProperties.refreshTokenExpiry())` only on creation. Use a Lua script for create/revoke/revokeAll so session record and member index cannot diverge.

- [ ] **Step 4: Replace the old jti allowlist configuration**

Set the default store selector to Redis and preserve `app.auth.token-store=memory` only for tests. Remove every token `jti` allowlist implementation and its tests; raw refresh JWT no longer exists in the target contract.

- [ ] **Step 5: Run focused storage tests**

Run: `cd BE && ./gradlew test --tests com.back.global.security.session.RefreshSessionStoreTest`

Expected: PASS; covers hash-only keys, fixed TTL, individual revoke, member-wide revoke, and in-memory parity.

### Task 2: BE 발급·재발급·철회 계약 전환

**Files:**
- Modify: `BE/src/main/java/com/back/global/security/token/TokenIssuer.java`
- Modify: `BE/src/main/java/com/back/global/security/auth/controller/AuthController.java`
- Modify: `BE/src/main/java/com/back/global/security/auth/dto/ReissueRequest.java`
- Modify: `BE/src/main/java/com/back/global/security/auth/dto/TokenPairResponse.java`
- Modify: `BE/src/main/java/com/back/global/security/jwt/JwtProvider.java`
- Modify: `BE/src/main/java/com/back/domain/member/service/MemberService.java`
- Modify: `BE/src/main/java/com/back/domain/member/service/MemberOAuthService.java`
- Modify: `BE/src/main/java/com/back/domain/member/service/MemberProfileService.java`
- Modify: `BE/src/main/java/com/back/domain/member/service/MemberPasswordService.java`
- Modify: `BE/src/main/java/com/back/domain/member/service/MemberWithdrawService.java`
- Test: `BE/src/test/java/com/back/global/security/auth/AuthControllerTest.java`
- Test: `BE/src/test/java/com/back/domain/member/controller/MemberAuthControllerTest.java`
- Test: `BE/src/test/java/com/back/domain/member/controller/MemberAuthControllerOAuthTest.java`
- Test: `BE/src/test/java/com/back/domain/member/controller/MemberPasswordChangeTest.java`
- Test: `BE/src/test/java/com/back/domain/member/controller/MemberWithdrawTest.java`

**Interfaces:**
- Consumes: `RefreshSessionStore` from Task 1.
- Produces: login/onboarding/OAuth/password responses `{ accessToken, refreshSession }`.
- Produces: `POST /api/auth/reissue` and `POST /api/auth/logout` body `{ refreshSession }`.

- [ ] **Step 1: Change controller tests first**

```java
@Test
void 유효한_refresh_session은_access만_새로_준다() throws Exception {
    String session = tokenIssuer.issue(1L, Role.USER).refreshSession();
    mockMvc.perform(post("/api/auth/reissue").contentType(APPLICATION_JSON)
            .content(body(session)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.accessToken").isNotEmpty())
        .andExpect(jsonPath("$.data.refreshSession").doesNotExist());
}

@Test
void 없는_refresh_session은_401이고_redis_장애는_503이다() { /* MockMvc cases */ }
```

Also change login, OAuth completion, onboarding completion, and password-change assertions so no `refreshToken` field remains. Add password-change and withdrawal cases that revoke all old sessions before issuing a new one or deleting the account.

- [ ] **Step 2: Run focused BE auth tests to verify failure**

Run: `cd BE && ./gradlew test --tests com.back.global.security.auth.AuthControllerTest --tests com.back.domain.member.controller.MemberAuthControllerTest --tests com.back.domain.member.controller.MemberAuthControllerOAuthTest --tests com.back.domain.member.controller.MemberPasswordChangeTest --tests com.back.domain.member.controller.MemberWithdrawTest`

Expected: FAIL because current API returns `refreshToken` and accepts raw refresh JWT.

- [ ] **Step 3: Implement the target API contract**

* `TokenIssuer.issue(memberId, role)` creates access JWT plus `RefreshSessionStore.create(memberId)`.
* `JwtProvider` no longer creates/parses refresh JWT or `jti`; it retains access JWT and onboarding ticket behavior.
* `AuthController.reissue` resolves the session ID through the store, reloads the role through `MemberRoleProvider`, and returns `TokenResponse(accessToken)` only.
* `AuthController.logout` revokes the supplied session ID and remains idempotent for unknown IDs.
* All issuance services use the renamed `refreshSession` field. Password change calls `revokeAll(memberId)` before issuing the new session; withdrawal calls it before deleting the member.

- [ ] **Step 4: Run focused BE auth tests to verify pass**

Run the command from Step 2.

Expected: PASS; raw refresh JWT is absent from output, expired access does not affect session lookup, unknown sessions are denied, and Redis failure maps to 503.

### Task 3: BFF 쿠키와 재발급 경로 전환

**Files:**
- Modify: `FE/lib/server/cookies.ts`
- Modify: `FE/lib/server/session.ts`
- Modify: `FE/app/api/bff/login/route.ts`
- Modify: `FE/app/api/bff/oauth/kakao/callback/route.ts`
- Modify: `FE/app/api/bff/members/me/route.ts`
- Modify: `FE/app/api/bff/members/me/password/route.ts`
- Modify: `FE/app/api/bff/logout/route.ts`
- Test: `FE/__tests__/cookies.test.ts`
- Test: `FE/__tests__/session.test.ts`
- Test: `FE/__tests__/bff-login.test.ts`
- Test: `FE/__tests__/kakao-callback.test.ts`
- Test: `FE/__tests__/bff-logout.test.ts`

**Interfaces:**
- Consumes: BE `{ accessToken, refreshSession }` issuance responses and `{ accessToken }` reissue response from Task 2.
- Produces: `REFRESH_SESSION_COOKIE = 'refresh_session'`, `setAuthCookies(store, access, refreshSession)` and `clearAuthCookies(store)`.

- [ ] **Step 1: Change BFF tests before implementation**

```ts
expect(jar.refresh_session).toBe('opaque-session');
expect(jar.refresh_token).toBeUndefined();
expect(JSON.parse(String(reissueInit.body))).toEqual({ refreshSession: 'opaque-session' });
expect(jar.access_token).toBe('new-access');
```

Add a logout failure case asserting: BFF calls BE with `{ refreshSession }`, deletes both cookies, returns a non-2xx result, and supplies `서버 세션 철회를 확인하지 못했습니다.`.

- [ ] **Step 2: Run BFF tests to verify failure**

Run: `cd FE && npm test -- --run __tests__/cookies.test.ts __tests__/session.test.ts __tests__/bff-login.test.ts __tests__/kakao-callback.test.ts __tests__/bff-logout.test.ts`

Expected: FAIL because `REFRESH_COOKIE`, `refreshToken`, and logout's unconditional 200 behavior still exist.

- [ ] **Step 3: Implement the target BFF behavior**

* Rename `REFRESH_COOKIE` to `REFRESH_SESSION_COOKIE`; preserve `HttpOnly`, production `Secure`, `SameSite=Lax`, `Path=/`, and 14-day Max-Age.
* `authedBeFetch` sends `{ refreshSession }`, accepts `{ accessToken }`, updates only the access cookie, and retries the original request once.
* Login, OAuth callback, onboarding completion, and password change expect `{ accessToken, refreshSession }` and set both cookies.
* Logout always clears both cookies. If its BE revocation request is not `ok`, return BFF failure with the exact message from the spec instead of 200 success.

- [ ] **Step 4: Run BFF tests to verify pass**

Run the command from Step 2.

Expected: PASS; no BFF test fixture uses `refresh_token` or raw refresh JWT.

### Task 4: 세션 전환 오류를 사용자에게 전달

**Files:**
- Modify: `FE/components/layout/Header.tsx`
- Test: `FE/__tests__/header.test.tsx`

**Interfaces:**
- Consumes: BFF logout `BffResult` from Task 3.
- Produces: local error text while still clearing visible logged-in UI and navigating to login.

- [ ] **Step 1: Add failing Header logout tests**

```tsx
postBff.mockResolvedValue({ ok: false, message: '서버 세션 철회를 확인하지 못했습니다.' });
render(<Header />);
await user.click(await screen.findByRole('button', { name: '로그아웃' }));
expect(await screen.findByText('서버 세션 철회를 확인하지 못했습니다.')).toBeInTheDocument();
expect(replace).toHaveBeenCalledWith('/login');
```

- [ ] **Step 2: Run Header tests to verify failure**

Run: `cd FE && npm test -- --run __tests__/header.test.tsx`

Expected: FAIL because `onLogout` discards the BFF result.

- [ ] **Step 3: Implement minimal logout feedback**

Store `logoutError` in Header. Always set local identity to anonymous and route to login after `postBff`, but retain the exact BFF failure message in an accessible `role="alert"` until the route transition finishes. Clear the error before a new logout attempt.

- [ ] **Step 4: Run Header tests to verify pass**

Run: `cd FE && npm test -- --run __tests__/header.test.tsx`

Expected: PASS; success has no alert and failed server revocation visibly reports the unresolved state.

### Task 5: 공용 IdentityProvider 도입

**Files:**
- Create: `FE/components/auth/IdentityProvider.tsx`
- Create: `FE/components/auth/identity.ts`
- Modify: `FE/app/layout.tsx`
- Modify: `FE/components/layout/Header.tsx`
- Test: `FE/__tests__/identity-provider.test.tsx`
- Test: `FE/__tests__/header.test.tsx`

**Interfaces:**
- Produces: `useIdentity(): { status: 'pending' | 'anonymous' | 'authenticated'; me: Me | null; refreshIdentity(): Promise<void>; setAnonymous(): void }`.
- Consumes: `getBff<Me>('/api/bff/me/identity')` exactly once per provider mount.

- [ ] **Step 1: Write failing provider tests**

```tsx
render(<IdentityProvider><Header /><ProtectedProbe /></IdentityProvider>);
await screen.findByText('스모크1');
expect(getBff).toHaveBeenCalledTimes(1);

await user.click(screen.getByRole('button', { name: '새로고침' }));
await waitFor(() => expect(getBff).toHaveBeenCalledTimes(2));
```

Add the network-reject case and assert it resolves to `anonymous`, not an unhandled rejection or permanent `pending` state.

- [ ] **Step 2: Run provider tests to verify failure**

Run: `cd FE && npm test -- --run __tests__/identity-provider.test.tsx __tests__/header.test.tsx`

Expected: FAIL because no provider or `useIdentity` hook exists.

- [ ] **Step 3: Implement provider and migrate Header**

Use a client component below `ThemeProvider` in `app/layout.tsx`. The provider owns the only identity fetch and cancellation guard. Header reads `me`, `status`, `setAnonymous`, and `refreshIdentity` from the hook; remove its pathname-driven identity effect and local `me` state. Do not change `shouldShowHeader`, navigation markup, or account link permissions.

- [ ] **Step 4: Run provider and Header tests to verify pass**

Run the command from Step 2.

Expected: PASS; Header and a simultaneous consumer share one request, manual refresh works, and visible login states remain stable.

### Task 6: 모든 직접 신원 조회 화면 이전

**Files:**
- Modify: `FE/app/admin/notices/page.tsx`
- Modify: `FE/app/admin/page.tsx`
- Modify: `FE/app/admin/verified-performers/page.tsx`
- Modify: `FE/app/chat/page.tsx`
- Modify: `FE/app/chat/[id]/page.tsx`
- Modify: `FE/app/feed/page.tsx`
- Modify: `FE/app/feed/[id]/page.tsx`
- Modify: `FE/app/feed/new/page.tsx`
- Modify: `FE/app/performances/page.tsx`
- Modify: `FE/app/performances/[id]/page.tsx`
- Modify: `FE/app/performances/[id]/edit/page.tsx`
- Modify: `FE/app/performances/new/page.tsx`
- Modify: `FE/app/profile/page.tsx`
- Modify: `FE/app/recruitments/page.tsx`
- Modify: `FE/app/recruitments/[id]/page.tsx`
- Modify: `FE/app/recruitments/[id]/edit/page.tsx`
- Modify: `FE/app/recruitments/applications/me/page.tsx`
- Modify: `FE/app/recruitments/new/page.tsx`
- Modify: `FE/app/verified-performer/page.tsx`
- Test: existing corresponding files under `FE/__tests__/`

**Interfaces:**
- Consumes: `useIdentity()` from Task 5.
- Preserves: each page's current anonymous redirect, author/admin/verified gating, and non-identity data requests.

- [ ] **Step 1: Change representative page tests first**

Update `feed`, `performances`, `chat`, `profile`, `recruitments`, `verified-performer`, and admin page tests to wrap the page in `IdentityProvider` test helper. Assert protected pages still redirect only after `status === 'anonymous'`; `pending` must not render a false empty state or redirect.

- [ ] **Step 2: Run representative tests to verify failure**

Run: `cd FE && npm test -- --run __tests__/feed-page.test.tsx __tests__/performances-page.test.tsx __tests__/chat-page.test.tsx __tests__/profile-page.test.tsx __tests__/recruitments-page.test.tsx __tests__/verified-performer-page.test.tsx __tests__/admin-verified-performers-page.test.tsx`

Expected: FAIL because the pages still own direct identity fetch mocks and effects.

- [ ] **Step 3: Migrate pages by domain without changing authorization policy**

Replace direct `getBff('/api/bff/me/identity')` effects with `useIdentity()`. Keep each page's existing redirect target and role/ownership logic; only substitute the source of `me`. Trigger `refreshIdentity()` after nickname, verified-performer status, or other identity-changing mutations. Do not move non-identity fetches into the provider.

- [ ] **Step 4: Run representative tests to verify pass**

Run the command from Step 2.

Expected: PASS; no migrated production page directly calls `/api/bff/me/identity`.

- [ ] **Step 5: Check migration completeness**

Run: `cd FE && rg -n '/api/bff/me/identity' app components`

Expected: only `components/auth/IdentityProvider.tsx` matches.

### Task 7: 문서·전체 검증·운영 이행

**Files:**
- Modify: `docs/DOMAIN-COMMON-STATUTE.md`
- Modify: `docs/ARCHITECTURE-STATUTE.md`
- Modify: `docs/CONTEXT.md`
- Modify: `docs/TODO-DOING.md`
- Modify: `docs/TODO-DONE.md`
- Modify: `docs/AI-ACTION-LOGS.md`
- Test: all BE and FE suites

**Interfaces:**
- Consumes: completed Tasks 1-6.
- Produces: current security contract documentation and deploy smoke checklist.

- [ ] **Step 1: Update docs from verified implementation**

Replace the current `rt:{memberId}` jti allowlist description with opaque `refresh_session` Redis session semantics. Record explicit no-grace decision, logout failure behavior, fixed TTL, and deployment-time re-login. Preserve reference links in the design/spec document rather than duplicating unsupported security claims.

- [ ] **Step 2: Run complete automated verification**

Run:

```bash
cd BE && ./gradlew test
cd ../FE && npm test -- --run && npm run typecheck && npx eslint . && npm run check:colors && npm run build
cd .. && git diff --check
```

Expected: every command exits 0; lint has no errors.

- [ ] **Step 3: Define and perform post-deploy smoke checks after user-authorized push**

1. Sign in with Kakao and inspect browser cookies: `access_token` and `refresh_session` exist; `refresh_token` does not.
2. On EC2, inspect `docker exec attacca-redis-1 redis-cli --scan --pattern 'auth:refresh:*'`; raw cookie value must not appear in keys.
3. Verify Redis TTL: `docker exec attacca-redis-1 redis-cli TTL 'auth:refresh:{hash}'` returns a positive value no greater than 1,209,600 seconds.
4. Force an expired access cookie in a test environment or wait for expiry; protected BFF request must obtain a new access cookie once while retaining the same refresh session cookie.
5. Log out; both cookies disappear and the individual Redis session key is gone.
6. Temporarily make Redis unavailable only in a non-production verification environment; login/reissue returns 503 while a previously valid access JWT request remains authorized.

- [ ] **Step 4: Move task state after evidence exists**

Mark the item done only after automated checks and the authorized production smoke results are recorded. Do not commit or push unless the user asks.

## Plan Self-Review

* **Spec coverage:** Tasks 1-3 cover opaque Redis session storage, fixed TTL, issuance, BFF cookies, reissue, and legacy re-login. Task 4 covers logout cookie deletion and error disclosure. Tasks 5-6 cover the common identity state and all direct consumers. Task 7 covers docs, full checks, and production smoke.
* **Placeholder scan:** 구현자가 추가 판단 없이 실행할 수 있도록 모든 단계에 파일·명령·기대 결과를 적었다. 후속 범위는 승인된 spec에서 명시적으로 제외했다.
* **Type consistency:** BE issuance is `{ accessToken, refreshSession }`; BE reissue is `{ accessToken }`; BFF cookie is `refresh_session`; provider exposes `status`, `me`, `refreshIdentity`, and `setAnonymous` throughout.
* **Review focus coverage:** fixed TTL and hash-only storage are Task 1; Redis failure is Task 2; logout failure is Task 3-4; request de-duplication is Task 5.
