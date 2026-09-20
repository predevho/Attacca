# AWS Free 플랜·유료 전환·계정 이전 조사

> 조사일: 2026-09-18
>
> 범위: Attacca·Pokade를 새 AWS account로 이전하기 전 Free 플랜 유지 조건과 비용 안전선
>
> 출처: AWS 공식 문서만 사용

## 결론

새 AWS account를 만들었다고 Free 플랜이나 Free Tier 크레딧이 보장되지는 않는다. AWS는 기존 AWS
account가 있거나 과거에 있었던 고객을 Free 플랜·크레딧 비대상으로 둘 수 있다. 대상 새 account는 사용자
Billing Console 화면으로 **Free account plan**, 미수금 `$0.00`, 남은 credit `$100.00`, plan 종료일
`2027-03-18`(182일)을 확인했다.

그러나 이 계정은 `Sign up for AWS (new)`로 만든 **프로젝트 account**다. AWS가 Organizations와 SCP를
관리하며, 대상 IAM user의 서울(`ap-northeast-2`) EC2·RDS·S3 read API는 SCP explicit deny로 실제 차단됐다.
새 가입 방식 프로젝트는 지정 리전만 쓸 수 있고, 아시아 태평양 주소의 지정 리전은 Sydney
(`ap-southeast-2`)다. 기존 Attacca·Pokade 자원은 서울에 있으므로 이 Free Plan 프로젝트는 계정 간
마이그레이션 대상 계정으로 사용할 수 없다.

새 계정이 Free 플랜이더라도 팀 프로젝트의 장기 운영 계정으로 확정하지 않는다. Free 플랜은 계정 생성 후
6개월 또는 크레딧 소진 중 이른 시점에 끝나며, Paid Plan으로 바꾸지 않으면 계정과 자원이 닫힐 수 있다.
따라서 계정 이전은 Free Tier 회피가 아니라 운영 계정 분리와 비용 통제를 위한 마이그레이션으로 판단한다.

## 확인된 자동 유료 전환 조건

Free account plan은 아래 중 하나가 발생하면 Paid Plan으로 자동 전환된다.

* AWS Organizations 생성 또는 가입
* AWS Control Tower landing zone 설정
* AWS Partner Network 가입, Professional Services 계약, Enterprise Agreement 등록
* AWS Skill Builder Team 구독, HIPAA/SEC compliance 지정

특히 AWS Organization을 생성·가입하면 Free Tier 크레딧이 즉시 만료되고 이후 추가 크레딧 대상에서도
제외된다. Paid Plan을 Free Plan으로 다시 내릴 수는 없다.

## 새 가입 방식 프로젝트의 결정적 제약

AWS의 새 가입 방식은 Free Plan을 제공하는 대신 프로젝트마다 AWS가 Organization·SCP·접근 구성을
관리한다. Fine-grained IAM user/role 제어, 특정 리전 선택, 전체 AWS 서비스 접근이 필요한 경우 AWS는
`Sign up for AWS (advanced)` 또는 advanced features 활성화를 사용하라고 안내한다. advanced features는
Free Plan의 제한을 해제하는 유료 전환 경로다.

이전 작업에는 서울 리전, 계정 간 EIP transfer, KMS 정책, RDS snapshot 공유, EC2 AMI 공유가 필요하다.
따라서 다음 둘 중 하나를 명시적으로 선택해야 한다.

1. **기존 Paid Plan account 유지**: 서울 리전 자원을 그대로 두고 비용 경보·최적화만 수행한다.
2. **새 Advanced account로 별도 이전**: Free Plan/credit을 전제하지 않고, 마이그레이션 비용과 운영비를
   승인한 뒤 서울 리전에서 재구축·이전한다.

현재 Free Plan 프로젝트(`migration-target` profile, account `107651266451`)에는 더 이상 IAM·EC2·RDS
설정이나 마이그레이션 작업을 하지 않는다.

## IAM Identity Center 판단

IAM Identity Center 자체는 추가 요금이 없다. 다만 조직 인스턴스는 AWS Organizations 관리 account에서
만들어야 한다. 단일 account 용도에는 standalone account에 묶이는 **account instance**가 별도 유형으로
존재한다.

일반 standalone account에서 Free Plan을 실제로 유지한다면 다음을 지킨다.

1. 기존 Organization에 새 account를 가입시키지 않는다.
2. IAM Identity Center가 필요할 때는 organization instance, multi-Region instance가 아니라 단일 리전의
   account instance 선택 가능 여부를 먼저 확인한다.
3. account instance가 Organization을 만들지 않는다는 구조적 구분은 확인됐지만, Console의 plan 상태가
   Free로 남는지를 활성화 전후에 직접 확인한다. 이를 추측으로 보장하지 않는다.

## Attacca·Pokade 이전에 대한 제약

Free Plan 프로젝트의 서비스 목록에는 EC2, EBS, RDS, S3, VPC가 포함될 수 있다. 단, 계정별 서비스
제한, 지정 리전, SCP explicit deny가 함께 적용되므로 Console의 실제 plan 상태와 AWS Settings의 selected
Region이 정본이다.

두 프로젝트는 이미 기존 account의 EC2·RDS를 사용한다. 새 account로 이전하려면 다음을 별도 수행해야
하며, 기존 자원을 IAM 변경만으로 옮길 수는 없다.

* EIP: 같은 리전의 다른 account로 이전할 수 있고, EIP 이전 자체에는 비용이 없다.
* EC2: AMI를 새 account에 명시적으로 공유하거나 새 instance를 재구축한다. AMI/EBS가 AWS 관리 KMS 키로
  암호화된 경우 직접 공유할 수 없으므로 KMS 확인이 필요하다.
* RDS: manual snapshot만 공유할 수 있다. encrypted snapshot이 source account의 기본 AWS KMS 키를 쓰면
  직접 공유할 수 없으므로 customer managed KMS 키로 복사한 뒤 공유하거나, 논리 백업·복원 방식을 택한다.
* DNS/EIP 전환, 파일 업로드, Redis, 환경변수, HTTPS, 배포 자동화는 새 instance 검증 후에만 전환한다.

두 프로젝트 모두 새 account에서 데이터·기동·HTTPS·스모크 검증이 끝나기 전 기존 EC2/RDS/EIP를 종료하지
않는다.

## 비용 안전선

새 account에서 다음 순서로 확인한다.

1. Console Home 또는 Billing에서 account plan이 `Free account plan`인지, credit balance와 종료일이 있는지
   확인한다.
2. `AWS Organizations`가 없고, Control Tower를 만들지 않았는지 확인한다.
3. Free Tier usage alert와 `zero spend budget`을 설정해 85% Free Tier 사용량과 예측 초과를 이메일로 받는다.
4. account plan이 Paid이거나 credits가 없으면, 이전 전 EC2·RDS·EBS·데이터 전송의 현행 가격을 별도 산정하고
   사용자 승인 없이 새 자원을 만들지 않는다.

대상 새 account는 Free Plan 상태 자체는 통과했지만, project SCP와 Sydney 지정 리전 때문에 서울 리전
마이그레이션 대상에서는 제외됐다.

## 공식 근거

* [AWS Free Tier FAQ](https://aws.amazon.com/free/free-tier-faqs/): 신규 고객 대상, Organization 생성·가입 시 자동 유료 전환·크레딧 만료, Free Plan 재전환 불가.
* [AWS 계정 플랜 선택](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/free-tier-plans.html): Free Plan의 6개월/크레딧 소진 종료와 자동 전환 조건.
* [AWS Sign up new 지원 서비스](https://docs.aws.amazon.com/accounts/latest/reference/supported-services-sign-up-new.html): Free Plan에서 가능한 서비스와 제한.
* [AWS 새 가입 방식 비교](https://docs.aws.amazon.com/accounts/latest/reference/sign-up-for-aws.html): 프로젝트 Organization/SCP 관리, fine-grained IAM 및 특정 리전이 필요하면 advanced 가입 방식을 선택해야 한다는 제약.
* [AWS 프로젝트 리전](https://docs.aws.amazon.com/accounts/latest/reference/project-regions.html): 프로젝트의 지정 리전과 변경 제한.
* [IAM Identity Center 인스턴스 유형](https://docs.aws.amazon.com/singlesignon/latest/userguide/identity-center-instances.html): organization instance와 account instance의 범위 차이.
* [Free Tier 사용량 추적](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/tracking-free-tier-usage.html): 85% 경보와 zero spend budget.
* [EIP 계정 간 이전](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/transfer-EIPs-intro-ec2.html): 동일 리전 이전 절차와 이전 자체 무과금.
* [RDS snapshot 공유](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_ShareSnapshot.html): manual snapshot과 기본 KMS 키 암호화 제한.
* [EC2 AMI 공유](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/sharingamis-explicit.html): account 간 AMI 공유와 암호화 키 제약.
