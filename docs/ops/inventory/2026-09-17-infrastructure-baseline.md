# 2026-09-17 인프라 기준선

> 수집 시각: 2026-09-18 KST
>
> 상태: **수집 진행 중. AWS 호출자와 실행 중 EC2 인스턴스는 확인했고, 나머지 import 식별자는 읽기 전용으로 수집한다.**

## 수집 범위와 안전 규칙

이 기준선은 Vercel FE 분리와 EC2 BE 블루/그린 전환 전에 현재 상태를 읽기 전용으로 기록한다.
AWS, DNS, Vercel, EC2에 변경을 만드는 명령은 실행하지 않았다. 비밀값·토큰·private key·DB
password는 기록하지 않는다.

## AWS 호출자와 리전

| 항목 | 관찰값 | 근거 |
|---|---|---|
| AWS CLI | `aws-cli/2.35.15` | `aws --version` |
| 기본 리전 | `ap-northeast-2` | `aws configure get region` |
| 호출자 account ID/ARN | `530310463238` / `arn:aws:iam::530310463238:user/predevho` | 자격증명 갱신 뒤 `aws sts get-caller-identity` 성공 |
| 활성 프로필 | `default` | `aws configure list-profiles` |
| 자격증명 방식 | shared credentials file의 정적 access key | `aws configure list` |

AWS CLI 자격증명을 갱신한 뒤 STS 인증을 통과했다. 키 값은 확인·기록하지 않았다. AWS API 조회는
읽기 전용으로만 재개하며, Terraform import·state bucket 생성·AWS/DNS 변경은 import 대상과 계획을
검토하기 전까지 실행하지 않는다.

## EC2·EIP·보안 그룹

실행 중 인스턴스는 다음과 같다. 다른 인스턴스(`pokade-server`)는 Attacca 작업 범위 밖이므로 변경·import
대상에 포함하지 않는다.

| 이름 | instance ID | 사양 | 공인 IP | 사설 IP |
|---|---|---|---|---|
| `attacca` | `i-0c04da18f6eb5292d` | `t3.micro` | `3.39.184.71` | `172.31.38.175` |

연결 관계는 다음과 같다.

| 항목 | 관찰값 |
|---|---|
| Elastic IP | `eipalloc-01966a32c2b275242` / `eipassoc-008e4a114fb9414da` / `3.39.184.71` |
| EC2 보안 그룹 | `sg-0b69d1a077984fddc` (`attacca-ec2-sg`) |
| root volume | `vol-006f02a8c49a11539`, `gp3`, 30 GiB, 3,000 IOPS, 125 MiB/s, 암호화 꺼짐 |
| subnet | `subnet-0e18fa8c2b2bfaffb` (`ap-northeast-2c`) |
| VPC | `vpc-0da3998132b39cea4`, 기본 VPC, `172.31.0.0/16` |
| instance profile | 없음 |

EC2 보안 그룹은 외부에 TCP 80/443을 열고 SSH 22는 단일 IPv4 `/32`에만 연다. root volume은 EC2
instance의 root block device로 함께 관리해야 하므로 별도 EBS resource로 import하지 않는다.

## RDS·자동 백업 복구점

| 항목 | 관찰값 |
|---|---|
| DB instance | `attacca-db`, `db.t3.micro`, MySQL `8.4.11`, 상태 `available` |
| endpoint | `attacca-db.crc8q20oqyb9.ap-northeast-2.rds.amazonaws.com:3306` |
| storage | `gp2`, 20 GiB, 암호화 켜짐, Multi-AZ 꺼짐, public access 꺼짐 |
| 보안 그룹 | `sg-0452642da9fdafe45` (`attacca-rds-sg`) |
| 자동 백업 | 보존 1일 |
| 수동 스냅샷 | `versionupbeforesnapshot` (2026-09-13 11:39 UTC, 20 GiB, 암호화 켜짐, `available`, customer managed KMS key) |
| 기본 그룹 | DB subnet group `default-vpc-0da3998132b39cea4`, parameter group `default.mysql8.4`, option group `default:mysql-8-4` |
| 보호 설정 | deletion protection 꺼짐, snapshot 태그 복사 켜짐 |

DB subnet group은 기본 VPC의 네 서브넷을 쓰며 다른 프로젝트도 같은 VPC를 사용한다. AWS 기본 parameter/
option/subnet group은 Terraform 관리·import 대상이 아니라 data source로만 참조한다.

## 현행 배포 이미지와 Git 기준점

| 항목 | 관찰값 | 근거 |
|---|---|---|
| Git HEAD | `13ebdadfb7aceeff2e4b68f5048af8486d8ce57d` | `git rev-parse HEAD` |
| BE image | `ghcr.io/predevho/attacca-be:latest` | `docker compose -f docker-compose.prod.yml config --images` |
| FE image | `ghcr.io/predevho/attacca-fe:latest` | 동일 |
| Redis image | `redis:7-alpine` | 동일 |
| Nginx image | `nginx:1.27-alpine` | 동일 |

이미지 조회는 로컬 `.env.prod`를 읽지 않고 Compose 정의만 펼쳤다. 따라서 DB·JWT 등 미설정 경고는
실행 환경 이상이 아니라 이 읽기 전용 검사에서 의도적으로 환경변수를 주지 않은 결과다.

## DNS 기준선

| 이름 | 결과 | 근거 |
|---|---|---|
| `attacca.site` | `A 3.39.184.71`, TTL 3600 | `dig +noall +answer attacca.site A` |
| `www.attacca.site` | `A 3.39.184.71`, TTL 3600 | `dig +noall +answer www.attacca.site A` |
| `api.attacca.site` | NXDOMAIN | `dig +noall +comments api.attacca.site A` |
| `staging.attacca.site` | NXDOMAIN | `dig +noall +comments staging.attacca.site A` |

`api`와 `staging`은 아직 존재하지 않으므로, Vercel 또는 Nginx 설정을 먼저 바꾸면 안 된다.

AWS Route 53 hosted zone은 0개다. DNS는 현재 외부 사업자가 관리하므로 Terraform provider로 이전하지
않고, API/staging 레코드는 해당 사업자 콘솔에서 별도 검토 후 만든다.

## Terraform import 대상

다음 Attacca 전용 자원만 HCL resource와 import block으로 state에 편입한다.

* EC2 instance `i-0c04da18f6eb5292d`(root volume 설정 포함), Elastic IP `eipalloc-01966a32c2b275242`와 association `eipassoc-008e4a114fb9414da`
* EC2 보안 그룹 `sg-0b69d1a077984fddc`, RDS 보안 그룹 `sg-0452642da9fdafe45`
* RDS instance `attacca-db`(현재 backup 설정 포함)

기본 VPC `vpc-0da3998132b39cea4`, subnet, 기본 RDS subnet/parameter/option group은 Pokade와 공유하거나
AWS 기본값이므로 import하지 않는다. Terraform data source로만 참조한다. `pokade-server`, `pokade-db`,
`pokade-storage`는 작업 범위에서 제외한다.

S3에는 `pokade-storage`만 있고 Attacca state용 버킷은 없다. `infra/bootstrap`에서 전용 버킷을 새로
만들기 전에는 기존 버킷을 재사용하지 않는다.

## 미확인 항목과 다음 단계 차단 조건

1. Vercel 프로젝트·도메인 소유권은 아직 이 기준선에서 확인하지 못했다. Vercel 사전 검증 단계에서 확인한다.
2. Terraform state backend는 Attacca 전용 S3 버킷을 bootstrap으로 만들기 전, 버킷명과 IAM 권한을 계획에서 검토한다.
3. IAM Identity Center 인스턴스는 운영 account에서 `ACTIVE`다. Terraform 전용 permission set과 named profile을 만들기 전에는 현재 장기 관리자 키로 Terraform을 실행하지 않는다.
4. 이 기준선은 AWS 식별자 수집을 완료했다. Terraform 코드, import block, AWS 변경, DNS 변경은 단계 1 계획을 검토한 뒤에만 만든다.
