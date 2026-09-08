# 배포

> 작성일 2026-09-08. 단일 인스턴스(EC2 1대) + RDS 기준.

## 전제와 그 이유

**BE 컨테이너는 1벌이다.** 채팅의 STOMP 브로커가 인메모리 Simple Broker이고 `PresenceRegistry`도
인메모리라, BE를 2벌 이상 띄우면 **A서버에 붙은 사용자와 B서버에 붙은 사용자 사이에 메시지가 오가지
않는다.** 접속 표시도 서버마다 다르게 보인다.

그래서 이 문서의 구성은 스케일아웃과 블루-그린 무중단 배포를 **의도적으로 포기**한다.
포트폴리오 규모에서는 1대로 충분하고, 확장이 필요해지면 그때 Redis를 먼저 넣는다
(`enableStompBrokerRelay`로 브로커를 바꾸고 `PresenceRegistry`를 Redis 구현으로 교체 —
**도메인 코드는 바뀌지 않는다**).

스키마는 Hibernate가 아니라 **Flyway**가 만든다(`ddl-auto: validate`). 운영 DB에서 Hibernate가
제 판단으로 스키마를 바꾸는 것을 막기 위함이며, 특히 `update`는 컬럼 삭제·타입 변경을 반영조차
하지 않아 코드와 스키마가 조용히 어긋난다.

---

## 환경변수

`.env.prod`에 넣고 `docker compose --env-file .env.prod`로 주입한다. **이 파일은 커밋하지 않는다.**

### 인프라 공통 (compose가 읽는 값)

| 변수 | 예시 | 설명 |
|---|---|---|
| `SERVER_NAME` | `attaca.example.com` | Nginx `server_name`, 인증서 도메인 |
| `PUBLIC_ORIGIN` | `https://attaca.example.com` | 외부에서 보이는 주소. WS origin·파일 URL·카카오 콜백이 이걸로 조립된다 |

### 백엔드

| 변수 | 기본값 | 설명 |
|---|---|---|
| `DB_URL` | `jdbc:mysql://localhost:3306/attaca` | **RDS 엔드포인트로 교체** |
| `DB_USERNAME` / `DB_PASSWORD` | `attaca` / `attaca-local` | RDS 자격증명 |
| `JWT_SECRET` | 로컬 개발용 문자열 | **반드시 교체.** 32자 이상 무작위 |
| `KAKAO_CLIENT_ID` / `KAKAO_CLIENT_SECRET` | 빈 값 | 카카오 개발자 콘솔 |
| `WS_ALLOWED_ORIGINS` | `http://localhost:3000,http://localhost:3001` | **운영 origin으로 좁힐 것.** 채팅은 브라우저가 BE에 직접 붙어 BFF를 거치지 않으므로 이 값이 실제 접근 통제다 |
| `STORAGE_TYPE` | `local` | `local` \| `s3` |
| `STORAGE_LOCAL_BASE_URL` | `http://localhost:8080/files` | local일 때 파일 공개 주소 |
| `S3_BUCKET` / `S3_REGION` / `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `S3_BASE_URL` | 빈 값 | s3일 때. `S3_BASE_URL`이 CloudFront 교체 지점 |
| `DDL_AUTO` | `validate` | **바꾸지 말 것.** 스키마는 Flyway가 만든다 |
| `FLYWAY_ENABLED` | `true` | 끄면 새 DB에 테이블이 안 생긴다 |

### 프론트엔드

| 변수 | 주입 시점 | 설명 |
|---|---|---|
| `BE_BASE_URL` | 런타임 | BFF가 BE를 부르는 주소. 컨테이너 네트워크 이름(`http://be:8080`). 브라우저는 이 값을 보지 못한다 |
| `NEXT_PUBLIC_BE_WS_URL` | **빌드 시점** | `wss://<도메인>/ws`. `NEXT_PUBLIC_*`은 번들에 박히므로 런타임 env로 못 바꾼다 — 값이 바뀌면 **다시 빌드**해야 한다 |
| `KAKAO_CLIENT_ID` | 런타임 | 카카오 인가 URL 조립용 |
| `KAKAO_REDIRECT_URI` | 런타임 | `<PUBLIC_ORIGIN>/api/bff/oauth/kakao/callback`. **카카오 콘솔에도 같은 값을 등록해야 한다** |

---

## 절차

### 1. RDS

MySQL 8.x 인스턴스를 만들고 다음을 확인한다.

- **퍼블릭 접근 차단.** 보안그룹에서 EC2 인스턴스만 3306 허용
- 파라미터 그룹: `character_set_server=utf8mb4`, `collation_server=utf8mb4_unicode_ci`, 타임존
- HikariCP 기본 풀(10)과 인스턴스 `max_connections` 확인
- 빈 스키마만 만들어 두면 된다. **테이블은 첫 기동 때 Flyway가 만든다**

### 2. EC2

Docker와 compose 플러그인을 설치하고 레포를 받는다. 보안그룹은 80/443만 연다.

### 3. 환경 파일

```bash
cp .env.prod.example .env.prod   # 없으면 위 표를 보고 직접 작성
vi .env.prod
```

### 4. 기동

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

첫 기동 로그에서 Flyway가 `Successfully applied 1 migration`을 찍고
`Started AttacaApplication`이 뜨는지 본다. `SchemaManagementException`이 나오면
엔티티와 스키마가 어긋난 것이다(마이그레이션을 추가해야 한다).

### 5. HTTPS

certbot으로 인증서를 발급하고 `deploy/certbot/conf`에 마운트되도록 둔다.
발급 전에는 80으로 접근해 `/.well-known/acme-challenge/`가 열려 있어야 한다.

### 6. 카카오 콘솔

Redirect URI에 `<PUBLIC_ORIGIN>/api/bff/oauth/kakao/callback`을 등록한다.
콘솔 위치는 **앱 → 플랫폼 키 → REST API 키(`/config/callback`)** 이다(카카오 로그인 메뉴가 아니다).

---

## 배포 후 확인

- [ ] `https://<도메인>/` — 비로그인 홈이 뜬다(공개 랜딩)
- [ ] 회원가입 → 로그인 → 프로필. 쿠키가 `HttpOnly; Secure`인지 개발자도구에서 확인
- [ ] 공연 상세로 바로 들어가면 로그인으로 갔다가 **원래 그 공연으로 돌아오는지**
- [ ] 채팅 실시간 송수신 — WS가 `wss://`로 붙는지, `NEXT_PUBLIC_BE_WS_URL`이 빌드에 박혔는지
- [ ] 파일 업로드 후 새로고침해도 이미지가 남아 있는지(local이면 볼륨, s3면 자격증명)
- [ ] `/actuator/env`, `/actuator/beans`가 **열려 있지 않은지**(health만 열려 있어야 한다)
- [ ] 다른 origin에서 WS 핸드셰이크가 거부되는지

---

## 아직 안 한 것

- **CI/CD 자동 배포** — `.github/workflows/ci.yml`은 테스트까지만 돈다. 배포 단계는 EC2 접속
  방식(SSH 키 / SSM / ECR)이 정해진 뒤에 붙인다
- **S3 실연동 검증** — 코드는 있으나 실자격증명으로 확인한 적이 없다
- **로그·모니터링** — 지금은 `GlobalExceptionHandler`가 `log.warn`/`log.error`로 남기는 게 전부.
  CloudWatch 등으로 모을지 결정 필요
- **고아 파일 정리** — 업로드 실패로 남은 물리 파일을 치우는 배치
- **refresh 토큰 로테이션·철회** — Redis 도입과 함께
