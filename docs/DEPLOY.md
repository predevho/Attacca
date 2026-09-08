# 배포

> 2026-09-08. **AWS EC2 1대 + RDS**. 1단계는 도메인 없이 IP + HTTP로 띄우고, 2단계에서 도메인·HTTPS를 붙인다.

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
| 엔진 | **MySQL 8.0** | 8.4는 Flyway가 "지원 테스트 안 됨" 경고를 낸다. 동작은 하지만 8.0이 안전하다 |
| 템플릿 | 프리 티어 | |
| 인스턴스 | `db.t3.micro` | |
| 스토리지 | gp3 20GB, **자동 조정 끄기** | 켜두면 모르는 사이 과금이 는다 |
| 퍼블릭 액세스 | **아니요** | 인터넷에 DB를 열지 않는다 |
| 초기 데이터베이스 이름 | `attaca` | 안 넣으면 DB가 안 만들어져 접속이 실패한다 |
| 자격 증명 | 사용자명·비밀번호 기록해 둘 것 | `.env.prod`에 쓴다 |

생성 후 **파라미터 그룹**에서 `character_set_server=utf8mb4`,
`collation_server=utf8mb4_unicode_ci`로 바꾼다(기본값이면 한글이 깨질 수 있다).

**테이블은 만들지 않는다.** 첫 기동 때 Flyway가 만든다.

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

```bash
# Docker
sudo apt-get update && sudo apt-get install -y ca-certificates curl git
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER && newgrp docker
```

**스왑 2GB를 반드시 추가한다.** t3.micro는 메모리가 1GB뿐이라 Gradle 빌드가 그냥 죽는다
(에러가 `Killed` 한 줄만 나와 원인을 찾기 어렵다).

```bash
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h   # Swap 2.0Gi 확인
```

### 1-5. 배포

```bash
git clone <레포 주소> attaca && cd attaca
cp .env.prod.example .env.prod
vi .env.prod
```

채울 값(자세한 설명은 아래 표):

```bash
PUBLIC_ORIGIN=http://<Elastic IP>
NEXT_PUBLIC_BE_WS_URL=ws://<Elastic IP>/ws
DB_URL=jdbc:mysql://<RDS 엔드포인트>:3306/attaca
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

**`Successfully applied 1 migration`** 과 **`Started AttacaApplication`** 이 보이면 성공이다.
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
| `DB_URL` | `jdbc:mysql://<endpoint>:3306/attaca` | RDS 엔드포인트 |
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

```bash
# 재배포 (코드 갱신)
git pull && docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build

# 로그
docker compose -f docker-compose.prod.yml logs -f be
docker compose -f docker-compose.prod.yml logs -f fe

# 디스크 정리 (빌드 캐시가 30GB를 금방 먹는다)
docker system prune -af --volumes=false
```

**스키마를 바꿀 때**는 엔티티만 고치면 안 된다.
`BE/src/main/resources/db/migration/V2__<설명>.sql`을 함께 추가한다.
안 그러면 다음 배포에서 `validate`가 실패해 기동하지 않는다.

---

## 아직 안 한 것

- **CI 배포 job** — `.github/workflows/ci.yml`은 테스트까지만 돈다. EC2 접속 방식(SSH 키/SSM/ECR)이
  정해지면 붙인다. 지금은 서버에서 `git pull` + `up -d --build`가 배포다
- **HTTPS** — 도메인 확보 후 2단계
- **S3 실연동** — 코드는 있으나 실자격증명으로 확인한 적이 없다
- **로그·모니터링** — 지금은 컨테이너 로그가 전부. CloudWatch 등으로 모을지 결정 필요
- **DB 백업 정책** — RDS 자동 백업 보존 기간 확인
- **refresh 토큰 로테이션·철회** — Redis 도입과 함께
