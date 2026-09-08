#!/usr/bin/env bash
# docker compose 래퍼. -f 와 --env-file 을 매번 치지 않게 한다.
#
#   ./deploy/dc.sh ps
#   ./deploy/dc.sh logs -f be
#   ./deploy/dc.sh up -d --build
#   ./deploy/dc.sh restart be
#
# 매번 붙이는 게 번거로워서가 아니라, 빠뜨리면 위험해서 만든다.
# --env-file 없이 `up` 을 돌리면 환경변수가 전부 빈 값인 채로 컨테이너가 재생성되어
# 앱이 DB에 못 붙고 죽는다(경고만 뜨고 그대로 진행된다).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [ ! -f .env.prod ]; then
  echo "오류: .env.prod 가 없다." >&2
  echo "  cp .env.prod.example .env.prod  후 값을 채울 것 (docs/DEPLOY.md 참고)" >&2
  exit 1
fi

exec docker compose -f docker-compose.prod.yml --env-file .env.prod "$@"
