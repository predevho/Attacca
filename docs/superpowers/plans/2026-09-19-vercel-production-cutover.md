# Vercel Production Cutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vercel의 고정 staging 검증을 근거로 `attacca.site` FE를 안전하게 전환하고, 검증 전 EC2 FE를 보존하는 운영 절차를 고정한다.

**Architecture:** 브라우저 REST와 httpOnly 인증 쿠키는 Vercel의 Next.js/BFF에 남고, `api.attacca.site`는 EC2 Nginx를 통해 Spring API, 파일, WebSocket만 제공한다. DNS 전환은 FE 진입점만 바꾸며, EC2의 `be`, `redis`, `nginx`, uploads volume은 유지한다.

**Tech Stack:** Vercel, Gabia DNS, Next.js BFF, EC2 Docker Compose, Nginx, Spring Boot, STOMP WebSocket, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-17-vercel-api-blue-green-terraform-design.md`

## Global Constraints

* DNS·Vercel 도메인 연결·EC2 컨테이너 삭제는 외부 상태를 바꾸므로 실행 직전에 사용자 승인을 다시 받는다.
* `DB_PASSWORD`, JWT/OAuth secret, refresh token, SSH key를 Vercel·Terraform state·GitHub 로그·문서에 넣지 않는다.
* `NEXT_PUBLIC_BE_WS_URL`은 브라우저에 공개되는 주소이므로 비밀값이 아니며, 변경하면 새 Vercel 배포가 필요하다.
* `attacca-fe`와 EC2의 apex Nginx route는 Vercel rollback 및 관찰 기간이 끝나기 전 삭제하지 않는다.
* 단일 인스턴스 STOMP Simple Broker와 in-memory presence 상태에서는 BE 블루/그린을 실행하지 않는다.

---

### Task 1: Staging 전환 증거 고정

**Files:**
- Modify: `docs/TODO-DOING.md`
- Modify: `docs/DEPLOY.md`
- Modify: `docs/CONTEXT.md`
- Modify: `docs/AI-ACTION-LOGS.md`
- Test: `git diff --check`

**Interfaces:**
- Consumes: `staging.attacca.site`, `api.attacca.site`, 현재 Vercel 환경 변수와 EC2 Compose 상태
- Produces: 운영 DNS 전환 전 통과해야 하는 재현 가능한 스모크 체크 목록

- [x] **Step 1: Vercel staging의 인증 및 BFF 경로를 확인한다**

카카오 로그인 뒤 `staging.attacca.site`의 보호 화면으로 이동하고, 새로고침 뒤에도 세션이 유지되는지 확인한다.

Expected: 콜백이 `login?error=oauth`로 돌아가지 않고, 인증이 필요한 화면의 BFF 요청이 성공한다.

- [x] **Step 2: API와 WebSocket 분리를 확인한다**

브라우저에서 `https://api.attacca.site/api/public/performances`를 열고, 채팅 화면에서
`wss://api.attacca.site/ws` handshake가 `101 Switching Protocols`인지 확인한다.

Expected: 공개 API는 JSON을 반환하고, WebSocket은 Pending 상태로 유지되며 채팅 송수신이 된다.

- [x] **Step 3: 채팅 입력 UX 회귀를 확인한다**

한글 조합 입력과 Shift+Enter 줄바꿈을 확인하고, 메시지가 늘어나도 입력창이 보이는지 확인한다.

Expected: 조합 확정 Enter가 메시지를 보내지 않고, 최종 문자열이 한 번만 전송되며 입력창은 화면 하단에 유지된다.

- [x] **Step 4: 검증 결과를 정본 문서에 기록한다**

Run: `git diff --check`

Expected: 문서에 공백 오류가 없고, staging 통과가 apex 전환 완료로 잘못 기록되지 않는다.

### Task 2: Vercel Production 전환 준비

**Files:**
- Modify: Vercel Project Settings > Domains
- Modify: Vercel Project Settings > Environment Variables
- Test: Vercel Production deployment detail

**Interfaces:**
- Consumes: Vercel Production domain validation instructions, `BE_BASE_URL`, `NEXT_PUBLIC_BE_WS_URL`, Kakao 운영 callback URI
- Produces: DNS 변경 직전의 Vercel Production deployment와 롤백 후보 deployment URL

- [x] **Step 1: Production 도메인 후보를 Vercel 프로젝트에 추가한다**

Vercel Domains에서 `attacca.site`와 `www.attacca.site`를 Production에 추가하되, DNS 레코드는 아직 바꾸지 않는다.

Expected: Vercel이 apex와 `www` 각각에 요구하는 DNS type/name/value를 표시한다. 이 화면의 실제 값만 다음 단계에 사용한다.

Result: Production에 `attacca.site`, `www.attacca.site`를 연결했다. Vercel은 `A @ -> 216.198.79.1`, `CNAME www -> 335cd7f1e6a8d4bc.vercel-dns-017.com.`을 요구한다. 가비아 DNS는 아직 EC2를 가리키므로 두 도메인 모두 `Invalid Configuration`이며, 이는 전환 전의 정상 대기 상태다.

- [ ] **Step 2: Production 환경 변수를 대조한다**

Vercel Production에 다음 공개 주소가 설정됐는지 확인한다.

```text
BE_BASE_URL=https://api.attacca.site
NEXT_PUBLIC_BE_WS_URL=wss://api.attacca.site/ws
KAKAO_REDIRECT_URI=https://attacca.site/api/bff/oauth/kakao/callback
```

Expected: `NEXT_PUBLIC_BE_WS_URL`은 Config로 저장되고, 비밀값은 Secret으로 유지한다. 값 변경 뒤에는 Production deployment를 새로 만든다.

- [ ] **Step 3: 즉시 롤백 후보를 고정한다**

현재 EC2 apex 주소와 Vercel의 직전 정상 Production deployment URL을 기록한다.

Expected: DNS 장애 시 Gabia에서 apex/www를 기존 EC2 값으로 되돌리고, Vercel 장애 시 직전 deployment로 Promote할 수 있다.

### Task 3: Apex DNS 전환과 관찰

**Files:**
- Modify: Gabia DNS records for `@` and `www`
- Test: Browser smoke, `dig`, Vercel domain status

**Interfaces:**
- Consumes: Task 2에서 Vercel이 표시한 실제 DNS record values
- Produces: Vercel FE를 제공하는 `attacca.site`와 즉시 실행 가능한 rollback condition

- [x] **Step 1: 사용자 승인 직전에 Vercel 요구 레코드를 재확인한다**

Gabia 레코드를 저장하기 직전에 Vercel Domains 화면의 type/name/value를 읽고 현재 `@`, `www`의 EC2 레코드와 비교한다.

Expected: 레코드 대상이 Vercel 화면 값과 한 글자까지 일치한다. 값이 다르거나 인증서 상태가 pending이면 저장하지 않는다.

- [x] **Step 2: apex와 www를 Vercel 요구 값으로 전환한다**

Gabia에서 `@`와 `www`만 Vercel이 요구한 레코드로 변경한다. `api.attacca.site`와 `staging.attacca.site`는 변경하지 않는다.

Result: 사용자가 가비아에 레코드를 저장했다. 공개 DNS 조회 결과는 `attacca.site -> 216.198.79.1`, `www.attacca.site -> 335cd7f1e6a8d4bc.vercel-dns-017.com.`, `api.attacca.site -> 3.39.184.71`, `staging.attacca.site -> 335cd7f1e6a8d4bc.vercel-dns-017.com.`이다. Vercel의 `Valid Configuration`과 운영 HTTPS smoke는 다음 단계에서 확인한다.

Verification: Vercel Domains 화면에서 `attacca.site`, `www.attacca.site`, `staging.attacca.site`, `attacca-taupe.vercel.app`가 모두 `Valid Configuration`임을 확인했다.

- [x] **Step 3: 운영 도메인 스모크를 실행한다**

브라우저에서 아래 흐름을 순서대로 실행한다.

```text
https://attacca.site/ 공개 화면
카카오 로그인 -> 보호 화면 -> 새로고침
피드 또는 구인 목록의 BFF 요청
프로필 이미지 또는 공연 포스터의 기존 업로드 조회
채팅 방 입장 -> wss://api.attacca.site/ws 101 -> 송수신
```

Expected: 브라우저 REST는 `attacca.site`의 BFF를 사용하고 WebSocket과 파일 URL만 `api.attacca.site`를 사용한다. 실패 시 다음 단계를 진행하지 않는다.

Verification: 사용자가 `https://attacca.site`의 홈 표시, 카카오 로그인, 강제 새로고침 뒤 세션 유지, 보호 데이터 동선이 정상이라고 확인했다. WebSocket은 staging 사전 검증에서 101 handshake와 채팅 송수신을 이미 확인했으며, 운영 전환 뒤 장기 관찰 대상으로 둔다.

### Task 4: 롤백 관찰과 EC2 FE 제거 판정

**Files:**
- Modify: `docker-compose.prod.yml` and Nginx configuration only after approval
- Modify: `.github/workflows/ci.yml` only after approval
- Test: rollback drill, post-removal smoke

**Interfaces:**
- Consumes: Task 3 정상 스모크, Vercel deployment history, EC2 Compose state
- Produces: EC2 FE 제거 여부의 명시적인 Go/No-Go 판단

- [x] **Step 1: 관찰 기간 동안 EC2 FE를 유지한다**

운영 전환 뒤 일반 사용자 동선과 오류 로그를 관찰하며 `attacca-fe`를 실행 상태로 둔다.

Expected: Vercel 또는 DNS 문제면 EC2 FE를 다시 켤 필요 없이 DNS rollback만으로 복구할 수 있다.

Verification: 2026-09-20 EC2에서 `docker compose --env-file .env.prod -f docker-compose.prod.yml ps fe`를 실행해 `attacca-fe-1`이 `Up 19 hours`, `3000/tcp` 상태임을 확인했다.

- [x] **Step 2: 롤백 경로를 한 번 검증한다**

Vercel의 직전 deployment Promote 절차를 확인하고, DNS rollback 값이 EC2 EIP인지 다시 대조한다. 실제 DNS rollback은 장애가 없으면 실행하지 않는다.

Expected: rollback은 FE만 바꾸며 API, Redis, RDS, uploads, WebSocket 서버에 영향을 주지 않는다.

Verification: 2026-09-20 Vercel Deployments에서 현재 Production이 아닌 이전 `Ready` 배포의 메뉴를 열어 `Promote`가 활성화된 것을 확인했다. 실제 Promote와 DNS rollback은 실행하지 않았다. DNS rollback 값은 `A @ -> 3.39.184.71`, `A www -> 3.39.184.71`로 복구하는 절차이며, `api` 레코드는 변경하지 않는다.

- [ ] **Step 3: EC2 FE 제거를 별도 승인으로 실행한다**

관찰 기간과 롤백 점검이 끝난 뒤에만 `attacca-fe` 서비스, FE image publish, apex FE Nginx route를 제거한다.

Expected: EC2에는 `be`, `redis`, `nginx`만 남고 API/files/WebSocket 스모크가 계속 통과한다.

### Task 5: BE 무중단 배포 선행 조건

**Files:**
- Modify: WebSocket broker/presence implementation and deployment configuration in a separate feature plan
- Test: two-BE integration test and rollback drill

**Interfaces:**
- Consumes: STOMP broker relay, shared presence store, shared Redis/uploads/RDS
- Produces: blue/green을 실행해도 사용자 간 메시지와 presence가 분리되지 않는 BE topology

- [ ] **Step 1: 공유 STOMP broker와 presence 저장소를 설계한다**

Simple Broker를 두 BE에 그대로 복제하지 않는다. 브로커 relay와 Redis 기반 presence를 선택한 뒤, 인증·메시지·typing·presence의 장애 정책을 명세와 테스트에 먼저 적는다.

Expected: 두 BE에 연결된 사용자가 같은 방의 메시지와 presence 상태를 본다는 통합 테스트가 존재한다.

- [ ] **Step 2: health-gated blue/green runner를 만든다**

비활성 색상 시작, `/actuator/health`, 핵심 API smoke, Nginx upstream atomic switch, drain, revert를 순서대로 수행한다.

Expected: 새 색상이 health/smoke를 통과하기 전에는 외부 트래픽을 받지 않으며, 실패 시 기존 색상을 유지한다.

- [ ] **Step 3: 운영 무중단 검증을 기록한다**

REST 반복 요청과 WebSocket 연결을 유지한 상태로 배포를 실행해 성공률, 재연결 시간, 오류 로그를 기록한다.

Expected: 허용된 재연결 범위를 넘어서는 5xx 또는 메시지 유실이 없고, 증거를 `docs/DEPLOY.md`와 작업 로그에 남긴다.

## Self-Review

* Vercel staging 검증, apex DNS 전환, EC2 FE 삭제, BE blue/green을 독립 관문으로 분리했다.
* API/파일/WS 도메인은 apex 전환 중 변경하지 않도록 명시했다.
* 단일 인스턴스 STOMP 제약을 해소하기 전 blue/green을 실행하지 않도록 막았다.
* DNS와 컨테이너 삭제 같은 외부 변경은 실행 직전 별도 사용자 승인 조건으로 남겼다.
