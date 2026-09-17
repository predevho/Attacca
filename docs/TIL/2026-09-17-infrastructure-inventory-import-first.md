# TIL — 기존 인프라를 Terraform으로 옮기기 전 읽기 전용 기준선

> 작성일: 2026-09-17
>
> 관찰 정본: `docs/ops/inventory/2026-09-17-infrastructure-baseline.md`

## 1. 왜 먼저 기준선을 고정하는가

Terraform은 코드만 보고 AWS 자원을 알아내지 않는다. state는 선언한 resource와 실제 원격 객체를
연결하는 기록이므로, 먼저 어떤 account·region·resource ID를 다루는지 확인해야 한다. 이미 운영 중인
자원을 새로 만들도록 선언하면, 가장 원치 않는 시점에 EIP·보안 그룹·RDS가 달라질 수 있다.

그래서 이번 단계는 apply가 아니라 읽기 전용 inventory부터 시작했다. 이 방식은 전환의 속도보다
복구 가능성과 근거를 먼저 확보한다.

## 2. Terraform import와 state의 역할

기존 자원은 Terraform `resource` 선언과 `import`를 같은 주소로 짝지어 state에 편입한다. 첫 plan에서
import 외 add/change/destroy가 0이어야 실제 운영 자원과 선언이 맞는지 확인할 수 있다.

state는 비밀값과 인프라 메타데이터를 담을 수 있으므로 Git에 두지 않는다. 이후 단계에서 versioning과
lockfile을 갖춘 S3 backend를 만들되, backend 자체를 만들기 전에도 계정·리전·권한을 먼저 확인한다.

## 3. Attacca에서 확인한 실제 연결 관계

2026-09-17 기준 Compose 정의는 BE, FE, Redis, Nginx image를 함께 사용한다. Git 기준점은
`13ebdadfb7aceeff2e4b68f5048af8486d8ce57d`이며, 현재 DNS는 `attacca.site`와 `www.attacca.site`를
`3.39.184.71`로 보낸다.

목표 구조에 필요한 `api.attacca.site`, `staging.attacca.site`는 DNS에 아직 없다. AWS 인증을 회복한 뒤
Attacca EC2, EIP, 보안 그룹, root volume, RDS와 최근 자동 snapshot을 읽기 전용으로 확인했다. 따라서
다음 단계는 현행 apex를 건드리지 않고 Terraform state bootstrap과 import 계획을 검토하는 일이다.

## 4. 복구점과 변경 금지선

처음 STS가 `InvalidClientTokenId`로 실패했을 때에는 계정 자체를 증명할 수 없었다. 자격증명을 갱신해
account `530310463238`의 IAM user `predevho`를 확인한 뒤에만 조회를 재개했다. 이 순서 덕분에 문서의
예전 EC2 IP나 RDS endpoint를 현재 사실로 오인하지 않았다.

또 하나의 핵심은 "보이는 자원 모두를 import하지 않는다"는 점이다. Attacca와 Pokade는 기본 VPC와 기본
RDS subnet group을 공유한다. 기본 VPC·subnet·AWS 기본 parameter/option group은 Terraform data source로
참조하고, Attacca 전용 EC2/EIP/보안 그룹/RDS만 import한다. 공유 자원을 잘못 state에 넣으면 다른 서비스의
변경까지 이 프로젝트의 plan에 섞일 수 있다.

## 5. 다음 단계 체크리스트

1. Attacca 전용 state S3 bucket의 이름·IAM 권한·versioning/lockfile 규칙을 검토한다.
2. Attacca 전용 resource/import block과 공유 네트워크 data source를 분리해 Terraform 계획을 작성한다.
3. 첫 `terraform plan`에서 import 이외 변경이 0건인지 확인한다.
4. 그 뒤에만 API subdomain과 Vercel staging 전환을 시작한다.
