#!/usr/bin/env bash
# Vercel 환경 변수 일괄 설정
# 사용법:
#   export VERCEL_TOKEN="..."   # https://vercel.com/account/tokens
#   export AUTH_GOOGLE_ID="..."
#   export AUTH_GOOGLE_SECRET="..."
#   ./scripts/set-vercel-env.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -z "${VERCEL_TOKEN:-}" ]]; then
  echo "VERCEL_TOKEN이 필요합니다. https://vercel.com/account/tokens 에서 생성하세요."
  exit 1
fi

AUTH_SECRET="${AUTH_SECRET:-$(openssl rand -base64 32)}"
AUTH_GOOGLE_ID="${AUTH_GOOGLE_ID:-}"
AUTH_GOOGLE_SECRET="${AUTH_GOOGLE_SECRET:-}"
UPSTASH_REDIS_REST_URL="${UPSTASH_REDIS_REST_URL:-}"
UPSTASH_REDIS_REST_TOKEN="${UPSTASH_REDIS_REST_TOKEN:-}"

if [[ -z "$AUTH_GOOGLE_ID" || -z "$AUTH_GOOGLE_SECRET" ]]; then
  echo "AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET 이 필요합니다."
  echo "Google Cloud Console → OAuth 2.0 클라이언트에서 발급하세요."
  exit 1
fi

PROJECT=$(curl -sS -H "Authorization: Bearer $VERCEL_TOKEN" \
  "https://api.vercel.com/v9/projects/strike?teamId=team_skdanieloh" 2>/dev/null || true)

PROJECT_ID=$(echo "$PROJECT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id',''))" 2>/dev/null || echo "")

if [[ -z "$PROJECT_ID" ]]; then
  # team slug 없이 재시도
  PROJECT=$(curl -sS -H "Authorization: Bearer $VERCEL_TOKEN" \
    "https://api.vercel.com/v9/projects/strike")
  PROJECT_ID=$(echo "$PROJECT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id',''))")
fi

if [[ -z "$PROJECT_ID" ]]; then
  echo "Vercel 프로젝트 'strike' 를 찾지 못했습니다."
  echo "$PROJECT"
  exit 1
fi

echo "Project ID: $PROJECT_ID"

add_env() {
  local key="$1"
  local value="$2"
  curl -sS -X POST "https://api.vercel.com/v10/projects/${PROJECT_ID}/env" \
    -H "Authorization: Bearer $VERCEL_TOKEN" \
    -H "Content-Type: application/json" \
    -d "$(python3 -c "
import json, os
print(json.dumps({
  'key': os.environ['KEY'],
  'value': os.environ['VAL'],
  'type': 'encrypted',
  'target': ['production', 'preview', 'development'],
}))
" KEY="$key" VAL="$value")" >/dev/null
  echo "  ✓ $key"
}

echo "환경 변수 설정 중..."
add_env "AUTH_SECRET" "$AUTH_SECRET"
add_env "AUTH_GOOGLE_ID" "$AUTH_GOOGLE_ID"
add_env "AUTH_GOOGLE_SECRET" "$AUTH_GOOGLE_SECRET"

if [[ -n "$UPSTASH_REDIS_REST_URL" ]]; then
  add_env "UPSTASH_REDIS_REST_URL" "$UPSTASH_REDIS_REST_URL"
fi
if [[ -n "$UPSTASH_REDIS_REST_TOKEN" ]]; then
  add_env "UPSTASH_REDIS_REST_TOKEN" "$UPSTASH_REDIS_REST_TOKEN"
fi

echo ""
echo "완료. Vercel에서 Redeploy 하세요."
echo "로컬 .env.local 도 동기화하려면:"
echo "  AUTH_SECRET=$AUTH_SECRET"
