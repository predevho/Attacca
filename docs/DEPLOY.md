# 배포

> 2026-09-08. **AWS EC2 1대 + RDS**. 1단계는 도메인 없이 IP + HTTP로 띄우고, 2단계에서 도메인·HTTPS를 붙인다.

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
확장이 필요해지면 그때 Redis를 먼저 넣는다(`enableStompBrokerRelay` 교체 + Redis `PresenceRegistry`,
**도메인 코드는 바뀌지 않는다**).

**스키마는 Flyway가 만든다**(`ddl-auto: validate`). 엔티티를 바꾸고 마이그레이션을 안 쓰면
**기동이 실패한다** — 운영 DB에서 Hibernate가 조용히 스키마를 바꾸는 것보다 낫다는 판단이다.

---

## 1단계 — IP + HTTP로 띄우기

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

## 2단계 — 도메인 + HTTPS

도메인이 생긴 뒤에 한다. 순서가 중요하다.

1. A 레코드를 Elastic IP로 연결하고 전파를 확인(`dig <도메인>`)
2. EC2 보안 그룹에 **443** 추가
3. `docker-compose.prod.yml`의 nginx 블록에서 주석 처리된 2단계 항목으로 교체
   (`nginx.https.conf` 마운트, certbot 볼륨, `SERVER_NAME`, 443 포트)
4. certbot으로 인증서 발급
5. `.env.prod` 수정 — `PUBLIC_ORIGIN`을 `https://`로, `NEXT_PUBLIC_BE_WS_URL`을 `wss://`로,
   `SERVER_NAME` 추가
6. **FE 이미지를 다시 빌드한다**(`--build`). `NEXT_PUBLIC_*`은 런타임 env로 안 바뀐다
7. 카카오 콘솔 Redirect URI를 https 주소로 등록·수정

---

## 환경변수

`.env.prod`에 넣는다. **커밋하지 않는다.**

| 변수 | 1단계 예시 | 설명 |
|---|---|---|
| `PUBLIC_ORIGIN` | `http://13.0.0.0` | 외부에서 보이는 주소. WS 허용 origin·파일 URL·카카오 콜백이 이걸로 조립된다 |
| `NEXT_PUBLIC_BE_WS_URL` | `ws://13.0.0.0/ws` | **빌드 시점에 박힌다.** 바꾸면 `--build` 필수 |
| `DB_URL` | `jdbc:mysql://<endpoint>:3306/attacca` | RDS 엔드포인트 |
| `DB_USERNAME` / `DB_PASSWORD` | | RDS 자격증명 |
| `JWT_SECRET` | | **반드시 교체.** 32자 이상 무작위 |
| `STORAGE_TYPE` | `local` | 단일 인스턴스라 `local` + 볼륨으로 충분. S3는 나중에 |
| `KAKAO_CLIENT_ID` / `KAKAO_CLIENT_SECRET` | 빈 값 | 비우면 자체 로그인만 쓴다 |
| `SERVER_NAME` | (2단계) | 도메인. 인증서 경로에도 쓰인다 |

BE는 그 외에 `DDL_AUTO`(=`validate`, 바꾸지 말 것), `FLYWAY_ENABLED`(=`true`),
`WS_ALLOWED_ORIGINS`(compose가 `PUBLIC_ORIGIN`으로 채운다)를 읽는다.
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

# 디스크 정리 (평소엔 update.sh가 알아서 지운다. 서버에서 직접 구웠을 때만 필요)
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
3. **패키지를 공개로** — GitHub 프로필 → Packages → `attacca-be` / `attacca-fe` →
   Package settings → Change visibility → Public. GHCR 패키지는 저장소가 공개여도
   기본이 비공개라, 안 바꾸면 서버가 `denied`로 못 받는다.
   (비공개로 두려면 서버에서 `read:packages` PAT로 `docker login ghcr.io` 해야 한다.)
4. **서버에 타이머 설치** — EC2에서 한 번만:

   ```bash
   cd ~/attacca && git pull && sudo ./deploy/install-updater.sh
   ```

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
* **롤백은 수동이다.** `update.sh`는 헬스체크가 healthy가 되지 않으면 경고만 남기고
  종료한다. 자동 롤백은 넣지 않았다 — 마이그레이션이 이미 돌았을 수 있어서
  이미지만 되돌리는 것이 오히려 위험하다.

---

## 아직 안 한 것

- **HTTPS** — 도메인 확보 후 2단계
- **S3 실연동** — 코드는 있으나 실자격증명으로 확인한 적이 없다
- **로그·모니터링** — 지금은 컨테이너 로그가 전부. CloudWatch 등으로 모을지 결정 필요
- **DB 백업 정책** — RDS 자동 백업 보존 기간 확인
- **무중단 배포** — 컨테이너 1벌이라 배포 중 약 30초 끊긴다. 블루-그린은 채팅의 Redis 릴레이 선행
- **자동 롤백** — 지금은 헬스체크 실패 시 경고만. 마이그레이션이 이미 돌았을 수 있어 판단이 필요하다
