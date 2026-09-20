# Staging 도메인 폐기 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (\`- [ ]\`) syntax for tracking.

**Goal:** 운영 서비스에 영향을 주지 않고 \`staging.attacca.site\`와 전용 외부 설정을 폐기한다.

**Architecture:** 프론트 운영 진입점은 Vercel의 \`attacca.site\`와 \`www.attacca.site\`로 유지하고,
API·WebSocket·파일 진입점은 EC2의 \`api.attacca.site\`로 유지한다. staging은 독립된 환경이
아니므로 도메인, DNS, OAuth 콜백, WebSocket Origin allowlist의 staging 참조만 제거한다.
외부 콘솔 변경은 하나씩 검증하며, Production 변수와 \`api\`/\`www\` DNS는 변경하지 않는다.

**Tech Stack:** Vercel, 가비아 DNS, 카카오 개발자 콘솔, AWS EC2 Docker Compose, Spring WebSocket,
Next.js BFF

**Spec:** \`docs/superpowers/specs/2026-09-20-staging-domain-retirement-design.md\`

## Global Constraints

- 유지 주소는 \`https://attacca.site\`, \`https://www.attacca.site\`, \`https://api.attacca.site\`뿐이다.
- 삭제 대상은 \`staging.attacca.site\`와 그 전용 참조뿐이다.
- Vercel Production 변수, \`api\` A 레코드, apex A 레코드, \`www\` CNAME은 삭제하거나 변경하지 않는다.
- 비밀값, OAuth 앱 키, 쿠키, JWT, \`.env.prod\` 전체 내용은 출력·문서화·Git 추가를 금지한다.
- EC2 런타임 변수는 Git이 아닌 \`/home/ubuntu/attacca/.env.prod\`에만 직접 주입한다.
- 단일 BE 컨테이너 재생성 시 짧은 WebSocket/HTTP 단절이 발생할 수 있다. 이를 무중단 배포로 표현하지 않는다.
- 커밋과 푸시는 사용자가 명시적으로 요청한 경우에만 수행한다.

## Review Focus

- Vercel 변수 범위를 잘못 삭제해 Production 카카오 로그인 또는 BFF가 깨지지 않는지 Task 2에서 Production 값만 재확인한다.
- 가비아에서 \`staging\` 외 레코드를 지우지 않는지 Task 3에서 apex, \`www\`, \`api\`를 같은 화면에서 대조한다.
- 카카오에서 운영·로컬 콜백까지 삭제하지 않는지 Task 2에서 보존 URI 두 개를 확인한다.
- Origin allowlist 축소 후 \`attacca.site\`와 \`www.attacca.site\` 모두 WebSocket을 여는지 Task 4에서 각각 확인한다.
- DNS 캐시가 남은 상태를 폐기 실패로 오판하지 않는지 Task 3에서 TTL 경과 후 공개 DNS를 다시 확인한다.

---

### Task 1: 운영 기준선과 롤백 정보 기록

**Files:**
- Modify: \`docs/TODO-DOING.md\`
- Modify: \`docs/AI-ACTION-LOGS.md\`
- Modify: \`docs/CONTEXT.md\`

**Interfaces:**
- Consumes: 현재 Vercel Domains, 가비아 DNS, 카카오 Redirect URI, EC2 Compose 상태
- Produces: staging 제거 전 상태와 운영 유지 주소의 확인 기록

- [ ] **Step 1: 운영 프론트와 API의 기준선 확인**

브라우저에서 아래 주소를 열어 운영 상태를 확인한다.

\`\`\`text
https://attacca.site
https://www.attacca.site
https://api.attacca.site/api/public/performances
\`\`\`

Expected: 두 프론트 도메인은 정상 화면을 표시하고, 공개 API는 성공 JSON을 반환한다.

- [ ] **Step 2: 운영 인증과 채팅 기준선 확인**

\`https://attacca.site\`에서 기존 카카오 로그인, 강제 새로고침 후 세션 유지, 보호 화면, 채팅방
접속과 한 건의 채팅 송수신을 확인한다.

Expected: 로그인 오류, BFF 오류, WebSocket 재연결 경고가 없다.

- [ ] **Step 3: 외부 콘솔의 삭제 대상만 기록**

값을 복사하지 말고 존재 여부만 확인한다.

\`\`\`text
Vercel Domains: staging.attacca.site 존재
가비아 DNS: host=staging CNAME 존재
카카오 Redirect URI: https://staging.attacca.site/api/bff/oauth/kakao/callback 존재
\`\`\`

Expected: 아래 Task에서 제거할 대상이 정확히 하나씩 식별된다.

- [ ] **Step 4: 문서에 기준선 결과를 기록**

\`docs/TODO-DOING.md\`, \`docs/AI-ACTION-LOGS.md\`, \`docs/CONTEXT.md\`에 날짜, 성공/실패 여부,
유지 주소만 기록한다. 레코드 값, 환경변수 값, 토큰은 기록하지 않는다.

Expected: 이후 작업자가 현재 운영 경로와 삭제 대상만 보고 판단할 수 있다.

### Task 2: 카카오와 Vercel의 staging 참조 제거

**Files:**
- Modify: \`docs/TODO-DOING.md\`
- Modify: \`docs/AI-ACTION-LOGS.md\`
- Modify: \`docs/CONTEXT.md\`

**Interfaces:**
- Consumes: Task 1의 운영 기준선
- Produces: staging OAuth 콜백과 Vercel 도메인 연결이 제거된 상태

- [ ] **Step 1: 카카오 Redirect URI 목록을 안전하게 대조**

카카오 개발자 콘솔에서 아래 두 URI가 남아 있는지 먼저 확인한다.

\`\`\`text
http://localhost:3000/api/bff/oauth/kakao/callback
https://attacca.site/api/bff/oauth/kakao/callback
\`\`\`

Expected: staging URI 외 운영과 로컬 URI가 모두 보인다.

- [ ] **Step 2: staging 카카오 콜백만 제거**

다음 URI 한 줄만 삭제하고 저장한다.

\`\`\`text
https://staging.attacca.site/api/bff/oauth/kakao/callback
\`\`\`

Expected: 운영과 로컬 URI는 남고, staging URI만 사라진다.

- [ ] **Step 3: 운영 카카오 로그인 회귀 확인**

\`https://attacca.site/login\`에서 카카오 로그인을 완료하고, 새로고침 후에도 세션이 유지되는지 확인한다.

Expected: callback은 \`https://attacca.site/api/bff/oauth/kakao/callback\`으로만 완료된다.

- [ ] **Step 4: Vercel Production 환경변수 보존 확인**

Vercel Environment Variables에서 Production 범위의 아래 이름을 열어 운영 주소를 가리키는지
확인한다. 값을 복사하거나 화면 기록에 남기지 않는다.

\`\`\`text
BE_BASE_URL
NEXT_PUBLIC_BE_WS_URL
KAKAO_REDIRECT_URI
KAKAO_CLIENT_ID
\`\`\`

Expected: Production에 필요한 항목이 남아 있고, staging 전용 값만 제거 대상으로 식별된다.

- [ ] **Step 5: Vercel에서 staging 도메인만 제거**

Vercel Domains에서 \`staging.attacca.site\` 행만 삭제한다. \`attacca.site\`, \`www.attacca.site\`,
기본 Vercel 도메인은 유지한다.

Expected: 남은 운영 도메인은 \`Valid Configuration\`을 유지한다.

- [ ] **Step 6: Vercel Preview의 staging 전용 값만 제거**

Preview에만 사용하는 staging callback 또는 staging host 값이 별도 행으로 존재할 때만 제거한다.
Production과 Preview에 공통으로 쓰이는 운영 API/WS 값은 그대로 둔다.

Expected: Production 변수 범위와 값은 변경되지 않는다.

### Task 3: 가비아 staging DNS 제거와 전파 확인

**Files:**
- Modify: \`docs/TODO-DOING.md\`
- Modify: \`docs/AI-ACTION-LOGS.md\`
- Modify: \`docs/CONTEXT.md\`

**Interfaces:**
- Consumes: Task 2에서 Vercel staging 도메인이 제거된 상태
- Produces: 공개 DNS에서 staging이 해석되지 않는 상태

- [ ] **Step 1: 삭제 직전 유지 레코드를 대조**

가비아 DNS 화면에서 아래 레코드가 존재하는지 확인하고, 수정하지 않는다.

\`\`\`text
@       A       216.198.79.1
www     CNAME   335cd7f1e6a8d4bc.vercel-dns-017.com.
api     A       3.39.184.71
\`\`\`

Expected: 삭제할 행은 \`staging\` CNAME 하나뿐이다.

- [ ] **Step 2: staging CNAME 한 행만 삭제**

가비아에서 host가 \`staging\`인 CNAME 행만 삭제하고 저장한다.

Expected: apex, \`www\`, \`api\` 레코드는 저장 후에도 남아 있다.

- [ ] **Step 3: TTL 이후 공개 DNS를 다시 확인**

로컬 터미널에서 아래 명령을 실행한다.

\`\`\`bash
dig +short staging.attacca.site
dig +short attacca.site
dig +short www.attacca.site
dig +short api.attacca.site
\`\`\`

Expected: staging은 빈 결과 또는 NXDOMAIN이고, 나머지 세 주소는 기존 대상이 계속 해석된다.

- [ ] **Step 4: 브라우저에서 운영 도메인을 다시 확인**

\`https://attacca.site\`, \`https://www.attacca.site\`, \`https://api.attacca.site/api/public/performances\`를
새 탭에서 연다.

Expected: 운영 도메인은 기존처럼 정상이고 staging만 더 이상 접근할 수 없다.

### Task 4: BE WebSocket Origin allowlist에서 staging 제거

**Files:**
- Modify: \`/home/ubuntu/attacca/.env.prod\` (EC2, Git 미추적)
- Runtime only: \`attacca-be-1\`
- Modify: \`docs/TODO-DOING.md\`
- Modify: \`docs/AI-ACTION-LOGS.md\`
- Modify: \`docs/CONTEXT.md\`

**Interfaces:**
- Consumes: Task 3에서 staging DNS가 제거된 상태
- Produces: 운영 origin 둘만 허용하는 WebSocket 백엔드

- [ ] **Step 1: EC2에서 Compose 파생 설정을 비밀값 없이 검증**

EC2에서 \`/home/ubuntu/attacca\`로 이동해 아래 명령을 실행한다.

\`\`\`bash
docker compose --env-file .env.prod -f docker-compose.prod.yml config >/dev/null && echo \"compose config 정상\"
\`\`\`

Expected: \`compose config 정상\`이 출력된다.

- [ ] **Step 2: \`.env.prod\`의 allowlist를 운영 origin 둘로 수정**

\`.env.prod\`에서 \`WS_ALLOWED_ORIGINS\` 단 하나를 다음 값으로 만든다. 파일 전체와 다른 환경변수는
출력하지 않는다.

\`\`\`text
WS_ALLOWED_ORIGINS=https://attacca.site,https://www.attacca.site
\`\`\`

Expected: staging origin이 없다.

- [ ] **Step 3: BE만 재생성하고 health를 확인**

EC2에서 아래 명령을 실행한다.

\`\`\`bash
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --force-recreate be
sleep 30
docker compose --env-file .env.prod -f docker-compose.prod.yml ps be
\`\`\`

Expected: \`attacca-be-1\`이 \`healthy\` 상태다. 짧은 연결 단절은 이 단계에서만 허용한다.

- [ ] **Step 4: 운영 WebSocket 두 origin을 각각 확인**

브라우저에서 \`https://attacca.site/chat/...\`와 \`https://www.attacca.site/chat/...\`를 각각 열고
개발자 도구 Network에서 \`wss://api.attacca.site/ws\`의 status \`101\`과 채팅 송수신을 확인한다.

Expected: 두 운영 origin 모두 연결되며 재연결 경고가 없다.

### Task 5: 최종 운영 검증과 문서 상태 전환

**Files:**
- Modify: \`docs/DEPLOY.md\`
- Modify: \`docs/CONTEXT.md\`
- Modify: \`docs/TODO-DOING.md\`
- Modify: \`docs/TODO-DONE.md\`
- Modify: \`docs/AI-ACTION-LOGS.md\`
- Modify: \`docs/superpowers/specs/2026-09-17-vercel-api-blue-green-terraform-design.md\`

**Interfaces:**
- Consumes: Task 1~4의 검증 결과
- Produces: staging이 없는 현재 운영 구조와 검증 근거

- [ ] **Step 1: 최종 회귀 시나리오를 운영 도메인에서 실행**

아래 순서로 \`https://attacca.site\`에서 확인한다.

\`\`\`text
홈 열기 -> 카카오 로그인 -> 강제 새로고침 -> 보호 화면 열기 -> 채팅 접속 -> 메시지 송수신
\`\`\`

Expected: 로그인, 세션, BFF, API, WebSocket이 모두 정상이다.

- [ ] **Step 2: 폐기 상태를 외부 콘솔에서 대조**

아래 조건을 모두 대조한다.

\`\`\`text
Vercel Domains에 staging.attacca.site 없음
가비아 DNS에 staging CNAME 없음
카카오 Redirect URI에 staging callback 없음
EC2 WS_ALLOWED_ORIGINS에 staging origin 없음
\`\`\`

Expected: 네 조건이 모두 충족된다.

- [ ] **Step 3: 운영 문서를 현재 상태로 갱신**

\`docs/DEPLOY.md\`에는 staging을 현재 고정 검증 주소로 설명한 문장에 폐기 사실과 날짜를 덧붙인다.
\`docs/superpowers/specs/2026-09-17-vercel-api-blue-green-terraform-design.md\`에는 당시 설계의
역사적 staging 역할은 유지하되 현재 활성 구성은 아니라는 주석을 추가한다.
\`docs/CONTEXT.md\`에는 현재 운영 주소 세 개와 staging 폐기 완료만 남긴다.

Expected: 과거 검증 기록과 현재 구성 설명이 구분된다.

- [ ] **Step 4: TODO와 작업 로그를 완료 상태로 전환**

\`docs/TODO-DOING.md\`의 staging 폐기 항목을 제거하거나 완료 참조로 바꾸고,
\`docs/TODO-DONE.md\`에 날짜, 제거 범위, 검증 결과를 추가한다. \`docs/AI-ACTION-LOGS.md\`에는
실제 수행한 외부 변경과 검증 결과만 한 항목으로 추가한다.

Expected: TODO와 로그가 실제 외부 상태를 과장하지 않는다.

- [ ] **Step 5: 문서 변경 형식을 검증**

로컬 저장소에서 아래 명령을 실행한다.

\`\`\`bash
git diff --check
git status --short
\`\`\`

Expected: 공백 오류가 없고, staging 폐기 관련 문서만 검토 대상임을 확인한다. 커밋과 푸시는
사용자가 별도로 요청할 때만 수행한다.
