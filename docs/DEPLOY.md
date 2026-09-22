# 배포

> **현재 운영 상태 (2026-09-22)**: `attacca.site`와 `www.attacca.site`의 FE는 Vercel Production이 제공하고, `api.attacca.site`의 BE·WebSocket·파일은 EC2가 제공한다. EC2의 `attacca-fe`는 Vercel 장애 시에만 쓰는 rollback 후보로 유지한다. `staging.attacca.site`는 폐기했으며 운영 경로가 아니다. `attacca-update.timer`는 `enabled`·`active`이고 최근 service는 성공 상태로 완료됐다.
>
> 아래 1·2단계는 초기 구축 당시의 절차를 보존한 기록이다. 현재 운영 변경은 이 문서의 "운영 중 자주 하는 것"과 "자동 배포"를 기준으로 한다.

## 현재 운영 주소

| 역할 | 주소 | 2026-09-21 공개 DNS 확인 |
|---|---|---|
| 웹 | `https://attacca.site` | Vercel A `216.198.79.1` |
| 웹 별칭 | `https://www.attacca.site` | Vercel CNAME `335cd7f1e6a8d4bc.vercel-dns-017.com.` |
| API·WebSocket | `https://api.attacca.site` / `wss://api.attacca.site/ws` | EC2 A `3.39.184.71` |
| staging | 사용하지 않음 | A·CNAME 미조회 |

`WS_ALLOWED_ORIGINS`는 `https://attacca.site,https://www.attacca.site`만 허용한다. 런타임 비밀값은 EC2 `.env.prod`에서만 관리하며 Git·이미지·Actions 로그에 넣지 않는다.

## AWS 계정 준비

**루트 계정으로는 아래 네 가지만 하고 그 뒤로는 쓰지 않는다.**

1. 루트에 **MFA** 설정
2. **IAM 사용자** 1개 생성(콘솔 접근 + MFA). 이후 모든 작업은 이 계정으로 한다
3. **결제 정보 IAM 액세스 활성화** — 계정 설정 → "IAM 사용자/역할의 결제 정보 액세스".
   **루트에서만 켤 수 있다.** 안 켜면 IAM 사용자로는 비용 화면이 보이지 않아 프리티어 초과를
   모르고 지나간다
4. **Budgets 알림**(예: 월 $5 초과 시 메일)

IAM 사용자 권한은 1인 프로젝트 기준 `AdministratorAccess` + MFA가 현실적이다. 좁히려면
`AmazonEC2FullAccess` + `AmazonRDSFullAccess` + `IAMReadOnlyAccess`로도 이 문서의 작업은 된다.

**액세스 키(프로그래매틱 액세스)는 만들지 않는다.** 콘솔로만 작업하므로 필요 없고,
키 유출이 가장 흔한 사고다. 앱도 1단계에서는 AWS 자격증명이 필요 없다
(`STORAGE_TYPE=local`). `.env.prod`의 `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`는 비워 둔다.

> S3로 전환할 때도 서버에 키를 두지 말고 **EC2 인스턴스 역할(IAM Role)**을 붙인다.
> 단, **현재 코드는 `STORAGE_TYPE=s3`로 기동되지 않는다**(`S3Client` 빈이 없음 —
> TODO-BACKLOG 참고). 전환은 그 결함을 고친 뒤에 한다.

---

## 전제와 그 이유

**BE 컨테이너는 1벌이다.** 채팅의 STOMP 브로커가 인메모리 Simple Broker이고 `PresenceRegistry`도
인메모리라, BE를 2벌 이상 띄우면 **A서버에 붙은 사용자와 B서버에 붙은 사용자 사이에 메시지가 오가지
않는다.** 그래서 이 문서는 스케일아웃과 블루-그린 무중단 배포를 **의도적으로 포기**한다.
확장이 필요해지면 RabbitMQ 또는 ActiveMQ 같은 외부 STOMP broker relay와 공유
`PresenceRegistry`를 먼저 설계·구현한다. Redis는 refresh token allowlist와 presence 보조 저장소 후보이며,
`enableStompBrokerRelay`의 직접 대상이 아니다. **도메인 코드는 `SimpMessagingTemplate` 경계를 유지한다.**

**스키마는 Flyway가 만든다**(`ddl-auto: validate`). 엔티티를 바꾸고 마이그레이션을 안 쓰면
**기동이 실패한다** — 운영 DB에서 Hibernate가 조용히 스키마를 바꾸는 것보다 낫다는 판단이다.

---

## 초기 구축 기록: 1단계 — IP + HTTP로 띄우기

### 1-1. RDS

콘솔 → RDS → 데이터베이스 생성.

| 항목 | 값 | 비고 |
|---|---|---|
| 엔진 | **MySQL 8.4** | 8.0은 2026-07-31에 RDS 표준 지원이 끝나 **유료 Extended Support**가 붙는다(생성 자체가 거부된다) |
| 템플릿 | 프리 티어 | |
| 인스턴스 | `db.t3.micro` | |
| 스토리지 | gp3 20GB, **자동 조정 끄기** | 켜두면 모르는 사이 과금이 는다 |
| 퍼블릭 액세스 | **아니요** | 인터넷에 DB를 열지 않는다 |
| 초기 데이터베이스 이름 | `attacca` | 안 넣으면 DB가 안 만들어져 접속이 실패한다 |
| 자격 증명 | 사용자명·비밀번호 기록해 둘 것 | `.env.prod`에 쓴다 |

**첫 기동 로그에 Flyway 경고가 뜨는 건 정상이다.**

```
Flyway upgrade recommended: MySQL 8.4 is newer than this version of Flyway
and support has not been tested. The latest supported version of MySQL is 8.1.
```

번들된 Flyway가 10.20.1이라 나오는 경고일 뿐이고, **로컬 MySQL 8.4에서 베이스라인·신규 마이그레이션·
`validate`가 모두 정상 동작하는 것을 확인했다.** 경고를 없애려면 Flyway를 올려야 하는데,
운영 스키마를 관리하는 도구를 메이저 버전으로 점프시키는 일이라 배포와 분리해서 한다(BACKLOG).

**파라미터 그룹은 손대지 않아도 된다.** MySQL 8.x는 기본 문자셋이 이미 `utf8mb4`이고,
베이스라인 SQL이 테이블마다 `CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`를 명시하므로
서버 기본값과 무관하게 한글이 안전하다. (서버 기본 collation이 `utf8mb4_0900_ai_ci`라
로컬과 다르지만, 테이블 레벨 지정이 이기므로 실제 정렬도 동일하다.)

**리전을 확인한다.** 서울(`ap-northeast-2`)로 만들고 **EC2도 같은 리전·같은 VPC**에 만든다.
리전이 다르면 보안 그룹으로 연결할 수 없다 — 흔한 실수다.

**테이블은 만들지 않는다.** 첫 기동 때 Flyway가 만든다.

생성 후 **엔드포인트**를 복사해 둔다(`.env.prod`의 `DB_URL`에 들어간다).
생성에는 5~15분 걸린다.

### 1-2. EC2

| 항목 | 값 |
|---|---|
| AMI | Ubuntu Server 24.04 LTS |
| 인스턴스 | `t3.micro`(프리 티어) |
| 스토리지 | gp3 **30GB** (프리 티어 한도) |
| 키 페어 | 새로 만들고 `.pem` 안전하게 보관 |

**보안 그룹(인바운드)**

| 포트 | 소스 | 용도 |
|---|---|---|
| 22 | **내 IP** | SSH. 0.0.0.0/0으로 열지 말 것 |
| 80 | 0.0.0.0/0 | 서비스 |

**Elastic IP를 반드시 할당한다.** 인스턴스를 중지했다 켜면 퍼블릭 IP가 바뀌는데,
`NEXT_PUBLIC_BE_WS_URL`은 **빌드 시점에 번들에 박혀 있어** 채팅이 조용히 죽는다.

### 1-3. RDS에 EC2만 붙이기

RDS 보안 그룹 → 인바운드 규칙 → **MySQL/Aurora(3306)**, 소스에 **EC2의 보안 그룹**을 지정한다.
(IP가 아니라 보안 그룹을 지정해야 IP가 바뀌어도 안 끊긴다.)

### 1-4. 서버 준비

```bash
ssh -i <키>.pem ubuntu@<Elastic IP>
```

Docker 설치와 스왑 잡기는 `deploy/bootstrap.sh`가 한다(여러 번 실행해도 안전).

```bash
sudo apt-get update && sudo apt-get install -y git
git clone <레포 주소> attacca && cd attacca
bash deploy/bootstrap.sh
```

끝나면 **SSH를 끊고 다시 접속한다**(docker 그룹 적용).

스크립트가 하는 일:

- Docker CE + compose 플러그인 설치
- **스왑 2GB** — 인스턴스 메모리가 1GB뿐이라 Gradle 빌드가 OOM으로 죽는다.
  에러가 `Killed` 한 줄만 남아 원인을 찾기 어려우므로 미리 잡는다
- 현재 사용자를 `docker` 그룹에 추가

### 1-5. 배포

```bash
git clone <레포 주소> attacca && cd attacca
cp .env.prod.example .env.prod
vi .env.prod
```

채울 값(자세한 설명은 아래 표):

```bash
PUBLIC_ORIGIN=http://<Elastic IP>
NEXT_PUBLIC_BE_WS_URL=ws://<Elastic IP>/ws
DB_URL=jdbc:mysql://<RDS 엔드포인트>:3306/attacca
DB_USERNAME=<RDS 사용자>
DB_PASSWORD=<RDS 비밀번호>
JWT_SECRET=$(openssl rand -base64 48)   # 실제 값을 넣을 것
STORAGE_TYPE=local
```

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

첫 빌드는 10~20분 걸린다(Gradle 의존성 내려받기). 그 뒤 로그를 본다.

```bash
docker compose -f docker-compose.prod.yml logs -f be
```

**`Successfully applied 1 migration`** 과 **`Started AttaccaApplication`** 이 보이면 성공이다.
`SchemaManagementException`이 나오면 엔티티와 스키마가 어긋난 것이다(마이그레이션을 추가해야 한다).

브라우저에서 `http://<Elastic IP>` 로 접속한다.

---

## 초기 구축 기록: 2단계 — 도메인 + HTTPS

도메인: **attacca.site** (가비아, 2026-09-08 등록). 서버: Elastic IP `3.39.184.71`(`attacca-eip`).

**왜 급한가** — 지금 HTTP에서는 **로그인이 아예 안 된다.** `NODE_ENV=production`이라
쿠키에 `Secure`가 붙는데 HTTP에서는 브라우저가 그 쿠키를 저장하지 않는다.
즉 HTTPS는 "있으면 좋은 것"이 아니라 서비스 동작 조건이다.

순서가 중요하다. **인증서를 받기 전에 nginx를 HTTPS 설정으로 바꾸면 안 된다** —
`ssl_certificate` 파일이 없어 nginx가 기동에 실패하고 사이트 전체가 죽는다.

### 1. DNS (가비아)

My가비아 → 서비스 관리 → 도메인 → DNS 관리툴 → DNS 설정 → 레코드 추가

| 타입 | 호스트 | 값/위치 | TTL |
|---|---|---|---|
| A | `@` | `3.39.184.71` | 3600 |
| A | `www` | `3.39.184.71` | 3600 |

`www`도 함께 넣는다. 나중에 추가하려면 인증서를 다시 받아야 하는데
**진짜 발급은 도메인당 주 5회 제한**이 있다.

확인: `dig +short A attacca.site @ns.gabia.co.kr`

### 2. 보안 그룹에 443 추가

EC2 → 보안 그룹 → 인바운드 규칙 편집 → 유형 `HTTPS`, 소스 `0.0.0.0/0`.

### 3. 인증서 발급

`.env.prod`에 `SERVER_NAME=attacca.site`, `CERTBOT_EMAIL=<메일>`이 있어야 한다.

```bash
./deploy/issue-cert.sh --staging   # 연습 (횟수 제한 없음)
./deploy/issue-cert.sh             # 진짜
```

스크립트가 발급 전에 **DNS가 이 서버를 가리키는지**와 **챌린지 경로가 실제로
서빙되는지**를 직접 확인한다. 이 확인 없이 certbot을 부르면 실패하면서
발급 횟수만 깎아먹는다.

### 4. nginx를 HTTPS로 전환

`docker-compose.prod.yml`의 nginx 블록에서 1단계 주석을 2단계로 바꾼다
(`nginx.https.conf`를 templates로, certbot 볼륨 2개, `SERVER_NAME`, 443 포트).
푸시하면 자동 배포가 반영한다.

### 5. 주소를 https/wss로 바꾼다

* `.env.prod`: `PUBLIC_ORIGIN=https://attacca.site`
* **저장소 Variables의 `NEXT_PUBLIC_BE_WS_URL`을 `wss://attacca.site/ws`로**
  → 이 값은 번들에 박히므로 **FE 이미지를 다시 구워야** 적용된다.
  변수만 바꾸면 아무 일도 일어나지 않는다. FE에 닿는 커밋을 푸시하거나
  Actions에서 재실행해 이미지를 새로 만들 것.
* ⚠️ 순서: https 전환 **후에** wss로 바꾼다. 반대로 하면 HTTP 페이지에서
  `wss://`를 열려다 채팅이 죽는다.

### 6. 카카오 (지금은 해당 없음)

`KAKAO_CLIENT_ID`가 비어 있어 자체 로그인만 쓴다. 나중에 붙일 때
Redirect URI를 `https://attacca.site/api/bff/oauth/kakao/callback`로 등록한다.

---

## 환경변수

`.env.prod`에 넣는다. **커밋하지 않는다.**

| 변수 | 1단계 예시 | 설명 |
|---|---|---|
| `PUBLIC_ORIGIN` | `http://13.0.0.0` | 서비스의 대표 웹 주소. 파일 URL·카카오 콜백이 이 값으로 조립된다 |
| `WS_ALLOWED_ORIGINS` | `http://13.0.0.0` | 브라우저가 직접 연결할 수 있는 WebSocket origin 목록(쉼표 구분). 대표 주소와 별도로 관리하며, 운영에서 허용한 웹 도메인만 넣는다 |
| `NEXT_PUBLIC_BE_WS_URL` | `ws://13.0.0.0/ws` | **빌드 시점에 박힌다.** 바꾸면 `--build` 필수 |
| `DB_URL` | `jdbc:mysql://<endpoint>:3306/attacca` | RDS 엔드포인트 |
| `DB_USERNAME` / `DB_PASSWORD` | | RDS 자격증명 |
| `JWT_SECRET` | | **반드시 교체.** 32자 이상 무작위 |
| `STORAGE_TYPE` | `local` | 단일 인스턴스라 `local` + 볼륨으로 충분. S3는 나중에 |
| `KAKAO_CLIENT_ID` / `KAKAO_CLIENT_SECRET` | 빈 값 | 비우면 자체 로그인만 쓴다 |
| `KOPIS_SERVICE_KEY` | 빈 값 | KOPIS Open API 인증키. 비우면 KOPIS 수집을 건너뛴다 |
| `IMPORT_CONTACT` | 운영 연락처 | 대학 게시판 User-Agent `AttaccaBot/1.0 (+...)`에 공개할 메일 주소 또는 URL. 운영 시 필수 |
| `SERVER_NAME` | (2단계) | 도메인. 인증서 경로에도 쓰인다 |

BE는 그 외에 `DDL_AUTO`(=`validate`, 바꾸지 말 것), `FLYWAY_ENABLED`(=`true`),
`WS_ALLOWED_ORIGINS`(Compose가 명시 목록을 주입한다)를 읽는다.
FE의 `BE_BASE_URL`은 컨테이너 네트워크 이름(`http://be:8080`)이라 손댈 일이 없다.

---

## 배포 후 확인

- [ ] `http://<IP>/` — 비로그인 홈이 뜬다(캐러셀·게시글·달력)
- [ ] 회원가입 → 로그인 → 프로필 수정
- [ ] 공연 상세로 바로 들어가면 로그인으로 갔다가 **원래 그 공연으로 돌아오는지**
- [ ] 인증 연주자 신청 → (DB에서 role을 ADMIN으로 바꾼 계정으로) 승인 → 공연 등록 게이팅 해제
- [ ] 채팅 실시간 송수신. 개발자도구 Network에서 `ws://<IP>/ws`가 101로 붙는지
- [ ] 파일 업로드 후 새로고침해도 이미지가 남아 있는지
- [ ] `http://<IP>/actuator/health` 가 **403**(Nginx가 막음), `/actuator/env`도 막혀 있는지
- [ ] 서버 안에서는 health가 보이는지
      `docker compose -f docker-compose.prod.yml exec be wget -qO- localhost:8080/actuator/health`

---

## 운영 중 자주 하는 것

`deploy/dc.sh`가 `-f docker-compose.prod.yml --env-file .env.prod`를 붙여 준다.

```bash
# 재배포 — 할 게 없다. main에 푸시하면 2분 안에 반영된다(아래 "자동 배포").
#   배포 로그: journalctl -u attacca-update -n 50
#   즉시 확인: sudo systemctl start attacca-update

# 상태 / 로그
./deploy/dc.sh ps
./deploy/dc.sh logs -f be
./deploy/dc.sh logs -f fe

# 특정 서비스만 재시작 (.env.prod 만 고쳤을 때)
./deploy/dc.sh up -d be

# 롤백 — 되돌릴 커밋 sha로 태그를 고정한다
IMAGE_TAG=<sha> ./deploy/dc.sh up -d --no-build

# 디스크 정리 (평소엔 update.sh가 알아서 지운다)
docker system prune -af --volumes=false
```

**`--env-file`을 빠뜨리면 위험하다.** `ps`·`logs`는 값을 표시만 못 하고 지나가지만,
**`up`을 `--env-file` 없이 돌리면 환경변수가 전부 빈 값인 채로 컨테이너가 재생성되어**
앱이 DB에 못 붙고 죽는다. 경고만 뜨고 그대로 진행되기 때문에 알아채기 어렵다.
`dc.sh`는 `.env.prod`가 없으면 아예 실행을 멈춘다.

직접 치고 싶으면 환경변수로 대신할 수도 있다(compose v2.24+).

```bash
export COMPOSE_FILE=docker-compose.prod.yml
export COMPOSE_ENV_FILES=.env.prod
docker compose ps          # 이제 옵션 없이 동작
```

**스키마를 바꿀 때**는 엔티티만 고치면 안 된다.
`BE/src/main/resources/db/migration/V2__<설명>.sql`을 함께 추가한다.
안 그러면 다음 배포에서 `validate`가 실패해 기동하지 않는다.

---

## 자동 배포 (CD)

**main에 푸시하면 끝이다.** 사람이 서버에 들어갈 일이 없다.

```
git push main
   → GitHub Actions: 테스트 → 이미지 빌드 → GHCR에 :latest / :<sha> 푸시
   → EC2의 systemd 타이머(2분 주기)가 새 이미지를 발견 → pull → 컨테이너 교체
```

### 왜 이 모양인가

* **서버에서 굽지 않는다.** t3.micro(1GB)에서 Gradle과 Next를 빌드하면 스왑을 긁으며
  오래 걸리고, 빌드 캐시가 **5GB**까지 불어나 디스크를 먹었다. 이제 서버가 하는 일은
  pull과 컨테이너 교체뿐이다.
* **미는 게 아니라 당겨온다.** GitHub이 서버로 밀어넣으려면 22번을 전체 개방하거나
  AWS SSM/OIDC를 붙여야 한다. 서버가 스스로 확인하면 **인바운드 포트를 하나도 열지
  않고**, GitHub에 서버 자격증명을 두지 않아도 된다. SSH는 지금처럼 관리자 IP에만
  열어 둔다. 대가는 **최대 2분의 배포 지연**과 GitHub에 배포 로그가 안 남는 것이다
  (로그는 서버의 `journalctl -u attacca-update`).
* **한쪽만 바뀌어도 둘 다 굽는다.** `latest` 두 개가 늘 같은 커밋을 가리켜야
  API 계약이 바뀐 배포에서 "BE 신버전 + FE 구버전" 조합이 생기지 않는다.
* **이미지는 배포 때마다 정리한다.** `update.sh`가 교체 후 `docker image prune -f`로
  참조를 잃은 옛 이미지를 지운다. 안 지우면 배포마다 한 벌(약 1GB)씩 쌓인다.

### 최초 1회 설정

1. **저장소 Variable 등록** — Settings → Secrets and variables → Actions → Variables
   `NEXT_PUBLIC_BE_WS_URL` = `ws://<Elastic IP>/ws` (2단계 이후 `wss://<도메인>/ws`).
   `NEXT_PUBLIC_*`은 번들에 박히므로 **이 값을 바꾸면 이미지를 다시 구워야** 한다.
2. **main에 푸시** → Actions의 `images` job이 GHCR에 올린다.
3. **서버에 타이머 설치** — EC2에서 한 번만:

   ```bash
   cd ~/attacca && git pull && sudo ./deploy/install-updater.sh
   ```

   저장소가 공개면 GHCR 패키지도 공개로 만들어지므로 서버는 로그인 없이 받는다
   (2026-09-08 익명 pull로 확인). 저장소를 비공개로 돌리면 서버에서
   `read:packages` PAT로 `docker login ghcr.io`가 필요하다.

### 확인

```bash
systemctl list-timers attacca-update.timer   # 다음 실행 시각
journalctl -u attacca-update -n 50           # 배포 이력
sudo systemctl start attacca-update          # 기다리지 않고 즉시 실행
sudo systemctl disable --now attacca-update.timer   # 자동 배포 중단
```

### 알아 둘 것

* **DB 마이그레이션은 자동 배포와 함께 돈다.** 파괴적인 마이그레이션(컬럼 삭제 등)은
  푸시하는 순간 적용된다. 그런 변경은 타이머를 잠시 끄고 손으로 하는 편이 안전하다.
* **배포 중 짧은 끊김이 있다.** 컨테이너 1벌 구성이라 무중단이 아니다 —
  BE 재기동 동안(약 30초) 502가 난다. 블루-그린은 채팅의 인메모리 브로커 때문에
  Redis 릴레이가 선행돼야 한다.
* **prod compose에 `build:` 섹션을 넣지 마라.** 넣으면 compose가 그 서비스를
  "빌드로 관리되는 것"으로 보고 `--no-build`와 만났을 때 **이미지 변경 검사를
  건너뛴다.** 새 이미지를 받아 놓고도 컨테이너를 교체하지 않아 타이머가 2분마다
  "새 이미지가 있다"만 반복하며 영영 배포되지 않았다(2026-09-08에 겪음).
  지금은 `update.sh`가 바뀐 서비스를 `--force-recreate`로 명시 교체해 이중으로 막는다.
* **nginx 설정은 reload로 반영되지 않는다.** 설정을 파일 하나로 bind mount 했는데
  그런 마운트는 inode에 고정된다. `git pull`이 파일을 갈아끼우면 inode가 바뀌어
  컨테이너는 영영 옛 파일을 본다. `update.sh`가 컨테이너를 재생성하는 이유다.
  손으로 고칠 때도 `./deploy/dc.sh up -d --force-recreate nginx`를 쓸 것.
* **이미지는 세 군데에 쌓인다.**
  * **EC2 도커 이미지** — 배포마다 `update.sh`가 정리한다. 태그 없는 이미지와
    사용하지 않는 7일 초과 이미지만 `docker image prune -a`로 지운다. 현재 실행 중인
    이미지와 최근 롤백 이미지는 보존되며, Docker 저장 영역이 4GB 미만이면 경고한다.
    과거에는 `latest`가 아닌 SHA 이미지를 전부 삭제하는 로직이 있어 롤백 보존 주석과
    실제 동작이 달랐고, 이번에 7일 기준으로 수정했다.
  * **GHCR** — 커밋마다 `:<sha>` 태그가 생긴다. CI가 최근 10개만 남기고 지운다.
  * **업로드 파일**(`be-uploads` 볼륨) — **정리 장치가 없다.** 29GB 디스크에
    무한히 쌓이며, 지우는 기능도 용량 제한도 없다. 지금은 0건이라 문제가 아니지만
    실사용이 붙으면 S3 전환이나 정리 정책이 필요하다(S3는 현재 기동 불가 — 백로그).
* **업로드 디렉터리 권한** — BE는 uid 10001로 돈다. `be-uploads` 볼륨이 root 소유면
  앱이 한 글자도 못 쓰고 업로드가 통째로 실패한다(500 `FILE_UPLOAD_FAILED`).
  2026-09-09까지 운영이 이 상태였다 — 아무도 올린 적이 없어 가려져 있었다.
  이미지에서는 고쳤지만(`BE/Dockerfile`), **이미 만들어진 볼륨은 한 번 손으로 고쳐야 한다.**

  ```bash
  docker run --rm -v attacca_be-uploads:/u alpine chown -R 10001:10001 /u
  ```

  확인: `docker exec <be> sh -c 'touch /app/uploads/.probe && echo ok'`
* **첫 어드민은 `ADMIN_LOGIN_IDS` 로 만든다.** 가입한 뒤 `.env.prod` 에 loginId를 적고
  BE를 다시 띄우면 ADMIN이 된다. **승격 후 본인이 다시 로그인해야** 반영된다
  (access 토큰 30분에 role이 박혀 있다). 올리기만 하고 내리지 않으니,
  회수는 DB에서 직접 한다. 규칙은 `docs/DOMAIN-MEMBER-STATUTE.md` §4.1.

  ```bash
  # .env.prod 에 ADMIN_LOGIN_IDS=<loginId> 추가 후
  ./deploy/dc.sh up -d be
  ./deploy/dc.sh logs be | grep "어드민 부트스트랩"
  ```
* **롤백할 때는 타이머를 멈춰라.** `IMAGE_TAG=<sha>`로 되돌린 컨테이너 자체는
  타이머가 건드리지 않지만(그 태그는 움직이지 않는다), **다음 푸시가 오면
  그대로 굴러간다.** 원인을 잡을 때까지는 `sudo systemctl stop attacca-update.timer`.
* **자동 롤백은 없다.** `update.sh`는 헬스체크가 healthy가 되지 않으면 경고만 남기고
  종료한다. 마이그레이션이 이미 돌았을 수 있어서 이미지만 되돌리는 것이 오히려
  위험하기 때문이다. 다만 **반쯤 적용된 상태는 방치하지 않는다** — 다음 실행이
  "돌고 있는 컨테이너가 제 이미지를 쓰는가"를 보고 다시 시도한다.

* **이미지 용량 가드레일** — EC2 디스크는 약 29GB이므로 이미지·Docker 캐시·업로드
  볼륨이 함께 증가하면 디스크 부족으로 배포가 실패할 수 있다. 확인 명령은 다음과 같다.

  ```bash
  df -h /var/lib/docker
  docker system df
  docker images --format '{{.Repository}}:{{.Tag}}\t{{.Size}}'
  ```

  업로드 파일(`be-uploads`)은 이미지 정리 대상이 아니므로 별도의 보존·S3 전환 정책이
  필요하다.

* **이미지 식별자** — CI는 BE/FE 이미지에 커밋 SHA 태그와 함께
  `org.opencontainers.image.revision` 라벨을 기록한다. 운영에서 `latest`를 사용하더라도
  실제 컨테이너 이미지의 커밋을 `docker inspect`로 확인할 수 있다. `update.sh`는 pull 뒤
  BE와 FE 라벨이 모두 있고 서로 같은지 확인한 뒤에만 컨테이너를 교체한다. 기존 라벨 없는
  이미지는 새 CI 이미지가 생성될 때까지 배포를 중단하지만, 이미 실행 중인 컨테이너는 유지한다.

  ```bash
  docker inspect -f '{{ index .Config.Labels "org.opencontainers.image.revision" }}' \
    "$(docker compose -f docker-compose.prod.yml ps -q be)"
  ```

* **런타임 환경변수 운영 결정(2026-09-18)** — DB 자격증명·JWT·OAuth secret 등은
  계속 EC2에 SSH 접속해 서버의 `.env.prod`에 직접 주입·변경한다. Git 저장소·Docker
  이미지·GitHub Actions 로그에는 넣지 않는다. `NEXT_PUBLIC_*`처럼 브라우저 번들에
  들어가는 값은 비밀값으로 취급하지 않는다.

---

## 아직 안 한 것

- **S3 실연동** — 코드는 있으나 실자격증명으로 확인한 적이 없다
- **로그·모니터링** — 지금은 컨테이너 로그가 전부. CloudWatch 등으로 모을지 결정 필요
- **무중단 배포** — 컨테이너 1벌이라 배포 중 약 30초 끊긴다. 블루-그린은 채팅의 Redis 릴레이 선행
- **자동 롤백** — 지금은 헬스체크 실패 시 경고만. 마이그레이션이 이미 돌았을 수 있어 판단이 필요하다
# 배포 완료 기준

인프라 전환 완료로 판단하려면 기능 동작뿐 아니라 배포 중 서비스 연속성도 확인한다.

- Terraform `plan`이 의도하지 않은 변경 없이 종료된다.
- Vercel FE와 EC2 BE의 REST API, 카카오 OAuth, WebSocket 연결이 정상이다.
- BE 배포 중 기존 요청이 실패하지 않거나 허용된 재시도 범위 안에서 복구된다.
- WebSocket 클라이언트가 배포 중 끊겨도 자동 재연결한다.
- 배포 전후 헬스체크와 핵심 API smoke test가 통과한다.

무중단 배포 검증은 FE 제거 이후 최종 운영 전환 단계에서 수행하며, 검증 전에는 기존 FE 컨테이너를 삭제하지 않는다.

## Vercel 운영 상태 (2026-09-21)

Vercel Production에는 `attacca.site`, `www.attacca.site`, 기본 Vercel 도메인만 연결한다. `staging.attacca.site`는 Vercel·카카오·DNS·WebSocket Origin에서 모두 제거했다.

운영 smoke로 홈, 카카오 로그인, 새로고침 후 세션 유지, 보호 데이터 동선, WebSocket 채팅 연결과 입력창을 확인했다. 공개 API `https://api.attacca.site/api/public/performances`도 성공 응답을 반환한다.

Vercel 장애 시 이전 `Ready` deployment를 `Promote`할 수 있다. DNS 장애에서만 가비아의 `@`와 `www`를 EC2로 되돌리는 절차를 검토하며, `api` 레코드는 FE rollback과 무관하므로 유지한다. EC2 `attacca-fe`는 별도 승인 전 삭제하지 않는다.
