# Vercel FE 분리·EC2 BE 블루/그린·Terraform 전환 설계

- 작성일: 2026-09-17
- 상태: **사용자 승인** (2026-09-17)
- 범위: 운영 배포 구조와 전환 순서. 애플리케이션 기능 구현, AWS 자원 생성·삭제, DNS 변경은 이 문서 승인 뒤 별도 계획으로 진행한다.

## 1. 결정과 목적

`https://attacca.site`는 Vercel의 Next.js 프론트엔드와 BFF가 제공하고,
`https://api.attacca.site`는 현재 EC2의 Nginx, Spring BE, Redis, 로컬 파일 서비스를 제공한다.
`https://staging.attacca.site`는 Vercel의 고정 사전 검증 주소로 사용한다.

목적은 세 가지다.

1. FE의 CDN·프리뷰·즉시 롤백을 Vercel에 맡겨 EC2의 CPU·메모리 부담을 줄인다.
2. BE 이미지만 EC2에서 블루/그린 전환해 HTTP 요청의 502 공백을 없앤다.
3. 이미 만든 AWS 자원을 Terraform 상태에 안전하게 편입해 콘솔 수동 변경을 줄인다.

## 2. 현재 사실과 제약

| 사실 | 근거 | 전환에 주는 영향 |
|---|---|---|
| EC2 Compose는 `be`·`fe`·`nginx`·`redis`를 함께 실행한다. | `docker-compose.prod.yml` | FE를 Vercel로 옮겨도 EC2의 `fe`는 Vercel 검증이 끝날 때까지 제거하지 않는다. |
| 로그인·피드 등 브라우저 REST는 `/api/bff/**`의 Next BFF를 거친다. | `FE/app/api/bff/**`, `ARCHITECTURE-STATUTE §1` | Vercel에서도 BFF 경로를 그대로 유지해 토큰 httpOnly 쿠키 경계를 보존한다. |
| 채팅 WebSocket은 BFF가 아닌 BE `/ws`에 직접 연결한다. | `FE/lib/chat/stompClient.ts`, `BE/src/main/java/com/back/global/websocket/WebSocketConfig.java` | `NEXT_PUBLIC_BE_WS_URL`은 `wss://api.attacca.site/ws`가 되어야 하고 `WS_ALLOWED_ORIGINS`는 운영·고정 staging origin만 정확히 허용한다. |
| 채팅 브로커와 presence는 인메모리다. | `WebSocketConfig.enableSimpleBroker`, `InMemoryPresenceRegistry` | 색상 두 BE가 겹치면 서로 다른 색상에 붙은 사용자의 채팅과 접속 상태가 분리된다. 외부 STOMP broker relay와 공유 presence가 선행 조건이다. Redis는 presence 보조 저장소 후보로만 검토한다. |
| 업로드는 EC2 Docker volume의 로컬 파일 저장소다. | `docker-compose.prod.yml`의 `be-uploads`, `STORAGE_LOCAL_BASE_URL` | 두 색상은 같은 업로드 volume을 공유하고, 공개 URL은 `api.attacca.site/files/**`로 유지해야 한다. |
| Flyway가 기동 시 스키마를 검증·반영한다. | `docs/DEPLOY.md`, BE migration 설정 | 구·신 BE가 겹치는 동안 깨지지 않는 expand/contract 마이그레이션만 허용한다. |

## 3. 목표 요청 흐름

```text
브라우저
  ├─ https://attacca.site/*
  │    └─ Vercel: Next.js UI + /api/bff/**
  │         └─ 서버 간 HTTPS → https://api.attacca.site/api/**
  ├─ wss://api.attacca.site/ws
  │    └─ EC2 Nginx → 활성 BE 색상
  └─ https://api.attacca.site/files/**
       └─ EC2 Nginx → 활성 BE 색상 → 공유 uploads volume
```

브라우저의 REST API 주소와 인증 쿠키는 계속 `attacca.site`에 남는다. 따라서 API 도메인으로
인증 쿠키를 넓히거나 브라우저 REST CORS를 새로 열지 않는다. WebSocket만 별도 origin이므로
서버의 origin allowlist를 정확히 `https://attacca.site`로 둔다.

### 환경변수 책임 분리

| 위치 | 변수 | 값 |
|---|---|---|
| Vercel Production | `BE_BASE_URL` | `https://api.attacca.site` |
| Vercel Production | `NEXT_PUBLIC_BE_WS_URL` | `wss://api.attacca.site/ws` |
| Vercel Production | `KAKAO_CLIENT_ID` | 기존 값 |
| Vercel Production | `KAKAO_REDIRECT_URI` | `https://attacca.site/api/bff/oauth/kakao/callback` |
| Vercel Staging | `BE_BASE_URL` | `https://api.attacca.site` |
| Vercel Staging | `NEXT_PUBLIC_BE_WS_URL` | `wss://api.attacca.site/ws` |
| Vercel Staging | `KAKAO_REDIRECT_URI` | `https://staging.attacca.site/api/bff/oauth/kakao/callback` |
| EC2 `.env.prod` | `WS_ALLOWED_ORIGINS` | `https://attacca.site,https://staging.attacca.site` |
| EC2 `.env.prod` | `STORAGE_LOCAL_BASE_URL` | `https://api.attacca.site/files` |
| EC2 `.env.prod` | `SERVER_NAME` | `api.attacca.site` |

현재 `PUBLIC_ORIGIN` 하나가 WebSocket, 파일 URL, 카카오 콜백까지 겸한다. 목표 구조에서는
웹 origin과 API origin이 다르므로 이 변수의 역할을 위처럼 분리한다. 비밀값(`DB_PASSWORD`,
`JWT_SECRET`, OAuth client secret, KOPIS 키)은 Vercel이나 Terraform 상태에 복제하지 않고,
EC2의 git-ignored `.env.prod`에만 둔다.

Vercel이 자동으로 만드는 preview URL은 배포마다 바뀌므로 WebSocket origin allowlist에 넣지 않는다.
`staging.attacca.site`를 Vercel의 검증용 배포에 고정 연결해, BFF·쿠키·WebSocket·카카오 콜백을
운영과 같은 origin 규칙으로 확인한다. 카카오 개발자 콘솔에는 운영과 staging callback URL을 모두 등록한다.

### 빌드·배포 책임

| 대상 | 전환 전 | 전환 후 |
|---|---|---|
| FE 테스트 | GitHub Actions | GitHub Actions와 Vercel build |
| FE 빌드·배포 | GitHub Actions → `attacca-fe` GHCR image → EC2 `fe` | Vercel Git 연동 → Vercel deployment |
| BE 테스트·이미지 | GitHub Actions → `attacca-be` GHCR image | 동일 |
| BE 릴리스 | EC2 2분 polling updater가 단일 `be`를 교체 | health gate가 있는 EC2 blue/green release runner |

따라서 새 FE Docker image나 별도 EC2 인스턴스는 만들지 않는다. Vercel 검증과 apex 전환이 끝난 뒤에만
CI의 FE GHCR publish matrix와 EC2 `fe` 서비스를 제거한다. 그 전에는 기존 `attacca-fe` image와
컨테이너를 롤백용으로 유지한다.

## 4. BE 블루/그린 설계

### 4.1 배포 단위

* CI는 BE 이미지를 커밋 SHA 태그로 GHCR에 만든다. `latest`는 배포 판단 기준으로 쓰지 않는다.
* EC2에는 활성 색상과 대기 색상을 별도 Docker Compose project name으로 실행한다. Docker Compose의 project name은 컨테이너·network·volume 이름을 구분하는 공식 기능이다.
* Redis와 uploads volume은 색상 외부의 단일 공유 자원으로 유지한다. 두 BE가 동일 RDS, Redis, uploads에 붙는다.
* Nginx는 유일한 공개 진입점이며, include 파일의 upstream만 활성 색상으로 바꾼 뒤 설정 검사와 reload로 전환한다.

### 4.2 한 번의 릴리스

1. 활성 색상과 배포할 immutable BE 이미지 SHA를 기록한다.
2. 비활성 색상에 새 이미지를 시작한다. 이 시점에는 Nginx가 아직 활성 색상만 가리킨다.
3. 비활성 색상의 `/actuator/health`가 통과하고, 내부 API smoke check와 DB/Flyway 상태가 통과하는지 확인한다.
4. Nginx upstream을 비활성 색상으로 원자 전환하고 `nginx -t` 후 reload한다.
5. 외부 HTTPS API, 파일, WebSocket handshake를 확인한다. 기존 WebSocket 연결은 짧게 재연결될 수 있다.
6. 고정 drain 시간 뒤 이전 색상을 중지한다. 실패하면 Nginx upstream만 이전 색상으로 즉시 되돌린다.

### 4.3 DB와 롤백 경계

* 새 컬럼·테이블 추가와 구 버전 호환 읽기/쓰기만 먼저 배포한다.
* 컬럼 삭제·타입 변경·의미 변경은 구 BE가 완전히 사라진 다음 별도 릴리스에서 수행한다.
* Nginx 전환 전 health 실패는 자동 중단한다. 전환 뒤의 자동 이미지 롤백은 하지 않는다. Flyway가 이미 적용됐을 수 있으므로, 운영자가 호환성 확인 뒤 upstream을 되돌린다.

## 5. Terraform 설계

### 5.1 관리 원칙

Terraform은 애플리케이션 배포 도구가 아니라 AWS 자원 선언·변경 도구로 한정한다. Docker 배포는
Terraform provisioner로 실행하지 않는다.

기존 Attacca 전용 EC2, Elastic IP, 보안 그룹, RDS는 새로 생성하지 않는다. 각각 HCL `resource`
블록과 `import` 블록을 짝지어 상태에 편입하고, 첫 `terraform plan`은 import 외 `add/change/destroy`
가 모두 0인지 검토한다. 계획이 다르면 apply하지 않고 선언을 실제 자원에 맞춘다. 기본 VPC·subnet과
AWS 기본 RDS subnet/parameter/option group은 공유 또는 AWS 소유이므로 import하지 않고 data source로만 참조한다.

### 5.2 상태와 비밀값

* `infra/bootstrap`은 Terraform state용 전용 S3 bucket을 한 번 만들며 versioning과 차단된 public access를 적용한다.
* `infra/production`은 S3 backend의 `use_lockfile = true`를 쓴다. DynamoDB lock은 현재 Terraform 문서에서 deprecated이므로 새로 만들지 않는다.
* backend 버킷 이름·리전만 backend partial configuration으로 주고, AWS 자격증명은 로컬 프로필 또는 CI OIDC 환경으로 공급한다.
* DB 비밀번호, JWT, OAuth secret, KOPIS 키는 `.tf`, `.tfvars`, state, GitHub 변수에 넣지 않는다. 기존 EC2 `.env.prod`가 계속 런타임 정본이다.
* 현재 `default` AWS CLI profile은 `AdministratorAccess`가 붙은 장기 access key이므로 Terraform apply에 사용하지 않는다. IAM Identity Center의 임시 자격 증명을 쓰는 `attacca-terraform` named profile을 먼저 만들고, 최소 권한 permission set을 적용한다.

### 5.3 Terraform 범위

첫 번째 관리 범위는 공유 VPC와 subnet의 data source 참조, Attacca EC2(root volume 포함), EIP association,
EC2/RDS 보안 그룹, RDS instance와 backup 설정, state bucket이다. 현재 instance profile은 없으므로 새로
만들지 않는다. AWS 기본 RDS parameter/option/subnet group은 data source 참조만 한다. 도메인 DNS는 현재
DNS 사업자에서 관리하므로 Terraform provider로 무단 이전하지 않는다.

## 6. 작업 순서

### 단계 0 — 현황 고정과 복구점 확보

1. AWS STS로 계정·리전을 확인하고 현재 EC2/EIP/RDS/보안 그룹/서브넷/인스턴스 프로파일 식별자를 읽기 전용으로 수집한다.
2. RDS 자동 백업 보존 기간과 최근 스냅샷, EC2 volume, 현재 Docker 이미지 SHA·Compose 상태를 기록한다.
3. `attacca.site` DNS TTL을 확인하고, Vercel·도메인 DNS·AWS 접근 권한을 점검한다.
4. 이 단계는 변경을 만들지 않는다. 복구점이나 자원 식별에 빈칸이 있으면 다음 단계로 가지 않는다.

### 단계 1 — Terraform 안전망

1. state용 S3 backend bootstrap을 별도 코드로 만들고 versioning과 잠금을 검증한다.
2. `infra/production`에 AWS 선언과 import blocks를 작성한다.
3. 기존 자원을 import하고 `plan`에서 import 외 변경 0건을 확인한다.
4. `prevent_destroy`와 계정 allowlist를 걸고, 비밀값이 state/plan에 없는지 확인한다.

### 단계 2 — API subdomain과 Nginx 분리

1. DNS에 `api.attacca.site`를 EC2 EIP로 추가하고, API 전용 TLS 인증서를 발급한다.
2. 현재 EC2의 `be`를 그대로 upstream으로 두고, Nginx에 API·files·WebSocket 전용 server block을 추가한다. 이 단계는 apex와 기존 EC2 `fe`를 바꾸지 않는다.
3. EC2 런타임 origin 변수를 `WS_ALLOWED_ORIGINS`와 `STORAGE_LOCAL_BASE_URL`로 분리하고 내부/외부 smoke test를 통과시킨다.
4. `https://api.attacca.site/api/**`, `wss://api.attacca.site/ws`, `https://api.attacca.site/files/**`가 현재 BE와 호환되는 것을 확인한다.

### 단계 3 — Vercel 사전 배포

1. Vercel 프로젝트의 Root Directory를 `FE`로 연결하고 일반 Preview 배포를 만든다.
2. `staging.attacca.site`를 검증용 Vercel 배포에 고정 연결하고, Staging/Production 환경별로 `BE_BASE_URL=https://api.attacca.site`, `NEXT_PUBLIC_BE_WS_URL=wss://api.attacca.site/ws`, 카카오 redirect URI를 설정한다.
3. `staging.attacca.site`에서 공개 화면, 자체 로그인, 카카오 시작·콜백, 인증 쿠키, BFF API, chat WebSocket을 검증한다.
4. 이 단계에서는 EC2 `fe`와 `attacca.site` DNS를 건드리지 않는다.

### 단계 4 — FE apex 전환

1. Vercel Production을 `attacca.site`에 연결한다.
2. DNS가 안정된 뒤 공개·인증·파일·chat 흐름과 Vercel rollback을 검증한다.
3. 기존 EC2 `fe` 컨테이너는 최소 관찰 기간 동안 유지하고, 롤백 절차를 한 번 연습한다.
4. 롤백 관찰이 끝난 뒤에만 CI의 FE GHCR publish와 EC2 `fe` 서비스를 제거한다.

### 단계 5 — BE 이중 실행 선행 조건

1. STOMP Simple Broker를 RabbitMQ 또는 ActiveMQ 같은 외부 broker relay로 교체하고, `InMemoryPresenceRegistry`의 공유 구현을 설계한다. Redis는 presence 보조 저장소 후보로 별도 검토한다.
2. 단일 BE와 두 BE 환경에서 방 메시지·읽음·typing·presence와 재연결을 통합 테스트한다.
3. Redis 장애 시 인증·채팅 각각의 실패 정책을 문서·테스트로 고정한다.

### 단계 6 — BE 블루/그린

1. 색상별 Compose, 공유 Redis/uploads, Nginx upstream include, health/smoke/drain/revert 스크립트를 TDD와 dry-run으로 만든다.
2. 운영과 동일한 이미지 SHA로 비활성 색상 기동→health→Nginx 전환→rollback drill을 비공개 경로에서 연습한다.
3. 첫 운영 전환은 관찰하며 실행한다. 이후에만 현재 2분 polling updater를 색상 전환 release runner로 교체할지 결정한다.

## 7. 완료 기준

* `attacca.site`의 FE/BFF와 `api.attacca.site`의 BE/WS/files가 각자 TLS로 동작한다.
* Vercel rollback이 FE에만 영향을 주며 EC2 BE는 유지된다.
* 새 BE는 Nginx 전환 전 health와 smoke check를 통과하고, 실패하면 공개 트래픽을 받지 않는다.
* 두 BE가 겹쳐도 서로 다른 색상에 연결한 사용자가 같은 채팅 메시지·presence를 본다.
* Terraform state는 원격·versioned·locked 상태이며, 첫 import 후 plan은 의도하지 않은 변경 0건이다.
* 런타임 비밀값이 Git, Vercel 공개 변수, Terraform state에 없다.

## 8. 학습 기록

각 전환 단위가 검증까지 끝나면 `docs/TIL/YYYY-MM-DD-주제.md`에 실제 관찰값과 판단 근거를 남긴다.
TIL에는 비밀값을 넣지 않고, 다음 내용을 포함한다.

* 이 단계에서 확인한 인프라 개념과 실제 구성의 대응
* 선택한 방식과 배제한 방식의 이유
* 실행한 검증과 그 결과
* 다음 단계가 전제하는 운영 제약

`docs/`가 정본이며, TIL은 그 뒤 Notion TIL DB에 요약·미러링한다.

## 9. 근거

* 현재 레포지토리의 `docker-compose.prod.yml`, `deploy/nginx.https.conf`, `BE/src/main/java/com/back/global/websocket/WebSocketConfig.java`, `BE/src/main/java/com/back/global/websocket/InMemoryPresenceRegistry.java`, `FE/lib/chat/stompClient.ts`를 기준으로 현행 흐름과 단일 인스턴스 제약을 확인했다.
* Terraform은 기존 자원을 관리하려면 import block과 동일 주소의 resource block을 함께 두도록 안내한다. [HashiCorp Terraform import](https://developer.hashicorp.com/terraform/language/import)
* Terraform state는 원격 backend와 잠금·접근 제어가 필요하고, state를 버전 관리 시스템에 두지 말라고 안내한다. [HashiCorp Terraform state](https://developer.hashicorp.com/terraform/language/state)
* S3 backend는 versioning과 `use_lockfile`을 권장하며 DynamoDB locking은 deprecated다. [HashiCorp S3 backend](https://developer.hashicorp.com/terraform/language/backend/s3)
* Vercel은 프로젝트 설정에서 apex domain과 subdomain을 별도로 연결한다. [Vercel custom domains](https://vercel.com/docs/domains/working-with-domains/add-a-domain)
* Vercel 환경변수는 배포 환경별로 관리한다. [Vercel environment variables](https://vercel.com/docs/environment-variables)
