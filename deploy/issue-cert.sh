#!/usr/bin/env bash
#
# Let's Encrypt 인증서를 발급한다. EC2에서 실행한다.
#
#   ./deploy/issue-cert.sh --staging   # 먼저 이걸로 연습 (횟수 제한 없음)
#   ./deploy/issue-cert.sh             # 진짜 발급
#
# 전제:
#   - .env.prod 에 SERVER_NAME(도메인)과 CERTBOT_EMAIL 이 있다
#   - 도메인 A 레코드가 이 서버를 가리킨다
#   - 80번 포트가 열려 있고 nginx가 /.well-known/acme-challenge/ 를 서빙한다
#
# ⚠️ 진짜 발급은 **주당 5회** 제한이 있다(같은 도메인 기준). 그래서 --staging 을
#    먼저 돌려 경로·DNS가 맞는지 확인하고 나서 진짜를 부른다.

set -euo pipefail
cd "$(dirname "$0")/.."

STAGING=""
[ "${1:-}" = "--staging" ] && STAGING="--staging"

[ -f .env.prod ] || { echo "오류: .env.prod 가 없다." >&2; exit 1; }
# shellcheck disable=SC1091
set -a; . ./.env.prod; set +a

: "${SERVER_NAME:?.env.prod 에 SERVER_NAME=<도메인> 이 필요하다}"
: "${CERTBOT_EMAIL:?.env.prod 에 CERTBOT_EMAIL=<만료 알림 받을 메일> 이 필요하다}"

# 도커가 마운트 대상 디렉터리를 먼저 만들면 root 소유가 되어 여기서 막힌다.
# 그럴 때만 sudo로 만들고 소유권을 돌려받는다.
if ! mkdir -p deploy/certbot/www deploy/certbot/conf 2>/dev/null; then
  sudo mkdir -p deploy/certbot/www deploy/certbot/conf
  sudo chown -R "$(id -u):$(id -g)" deploy/certbot
fi

echo "도메인: $SERVER_NAME"

# --- 1. DNS가 이 서버를 가리키는지 --------------------------------------------
# 여기서 안 막으면 certbot이 실패하면서 발급 횟수만 깎아먹는다.
here=$(curl -fsS --max-time 5 http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null \
       || curl -fsS --max-time 5 https://api.ipify.org)
resolved=$(getent hosts "$SERVER_NAME" | awk '{print $1}' | head -1)
echo "  이 서버의 공인 IP : $here"
echo "  도메인이 가리키는 IP: ${resolved:-(응답 없음)}"
if [ "$here" != "$resolved" ]; then
  echo "오류: DNS가 이 서버를 가리키지 않는다. A 레코드와 전파를 먼저 확인할 것." >&2
  exit 1
fi

# www 도 같은 서버를 가리키면 함께 받는다. 나중에 추가하려면 재발급인데
# 진짜 발급은 도메인당 주 5회 제한이라 처음에 한 번에 받는 편이 낫다.
DOMAINS=("$SERVER_NAME")
www_resolved=$(getent hosts "www.$SERVER_NAME" | awk '{print $1}' | head -1)
if [ "$www_resolved" = "$here" ]; then
  DOMAINS+=("www.$SERVER_NAME")
  echo "  www.$SERVER_NAME 도 이 서버를 가리킨다 — 함께 발급한다"
else
  echo "  www.$SERVER_NAME 는 건너뛴다(가리키는 곳: ${www_resolved:-없음})"
fi

# --- 2. 챌린지 경로가 실제로 서빙되는지 ---------------------------------------
# certbot을 부르기 전에 우리가 직접 파일을 놓고 밖에서 받아 본다.
token="attacca-precheck-$$"
mkdir -p deploy/certbot/www/.well-known/acme-challenge
echo ok > "deploy/certbot/www/.well-known/acme-challenge/$token"
for d in "${DOMAINS[@]}"; do
  if ! curl -fsS --max-time 10 "http://$d/.well-known/acme-challenge/$token" | grep -q ok; then
    echo "오류: http://$d/.well-known/acme-challenge/ 가 서빙되지 않는다." >&2
    echo "  nginx에 해당 location이 있고 webroot가 마운트됐는지 확인할 것." >&2
    rm -f "deploy/certbot/www/.well-known/acme-challenge/$token"
    exit 1
  fi
  echo "  $d 챌린지 경로 확인"
done
rm -f "deploy/certbot/www/.well-known/acme-challenge/$token"

# --- 3. 발급 -----------------------------------------------------------------
[ -n "$STAGING" ] && echo "  (스테이징 — 브라우저가 신뢰하지 않는 연습용 인증서다)"
d_args=()
for d in "${DOMAINS[@]}"; do d_args+=(-d "$d"); done
./deploy/dc.sh --profile tools run --rm certbot certonly \
  --webroot -w /var/www/certbot \
  "${d_args[@]}" \
  --email "$CERTBOT_EMAIL" \
  --agree-tos --no-eff-email --non-interactive \
  $STAGING

echo
echo "발급 완료. 인증서 위치: deploy/certbot/conf/live/$SERVER_NAME/"
ls -1 "deploy/certbot/conf/live/$SERVER_NAME/" 2>/dev/null | sed 's/^/  /' || true
echo
if [ -n "$STAGING" ]; then
  echo "다음: 연습이 됐으니 스테이징 인증서를 지우고 진짜로 발급한다."
  echo "  sudo rm -rf deploy/certbot/conf/{live,archive,renewal}/$SERVER_NAME*"
  echo "  ./deploy/issue-cert.sh"
else
  echo "다음: docs/DEPLOY.md 2단계에 따라 nginx를 HTTPS 설정으로 전환한다."
fi
