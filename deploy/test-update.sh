#!/usr/bin/env bash

set -euo pipefail

ATTACCA_UPDATE_TEST_MODE=1 source "$(dirname "$0")/update.sh"

assert_image_gate() {
  local description=$1 expected=$2 be_revision=$3 fe_revision=$4 target_revision=$5
  local actual=false
  if image_matches_target_revision "$be_revision" "$fe_revision" "$target_revision"; then
    actual=true
  fi
  if [ "$actual" != "$expected" ]; then
    echo "실패: $description (expected=$expected actual=$actual)" >&2
    exit 1
  fi
}

assert_image_gate 'BE와 FE가 목표 커밋이면 교체 가능' true 'new-sha' 'new-sha' 'new-sha'
assert_image_gate '이전 latest 이미지는 목표 커밋과 달라 교체 불가' false 'old-sha' 'old-sha' 'new-sha'
assert_image_gate 'BE와 FE가 서로 다르면 교체 불가' false 'new-sha' 'old-sha' 'new-sha'

echo 'update image gate: ok'
