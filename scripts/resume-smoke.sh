#!/usr/bin/env bash
set -euo pipefail

API_BASE="${API_BASE:-http://localhost:3000/api}"
LOGIN="${SMOKE_LOGIN:-admin}"
PASSWORD="${SMOKE_PASSWORD:-admin}"

echo "[resume-smoke] API_BASE=$API_BASE"

ACCESS_TOKEN="$(
  curl -sS -X POST "$API_BASE/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"login\":\"$LOGIN\",\"password\":\"$PASSWORD\"}" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d);process.stdout.write(j.accessToken||'')}catch{}})"
)"

if [[ -z "$ACCESS_TOKEN" ]]; then
  echo "[resume-smoke] ERROR: login failed or accessToken missing"
  exit 1
fi

echo "[resume-smoke] login OK"

RESP_CREATE="$(curl -sS -X POST "$API_BASE/resume/candidates" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"rawText":"Иванов Иван Иванович\nEmail: ivanov@example.com\nТелефон: +79991234567\nСтаж 7 лет\nСпециализация: уролог"}')"

CANDIDATE_ID="$(echo "$RESP_CREATE" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d);process.stdout.write(j.id||'')}catch{}})")"
if [[ -z "$CANDIDATE_ID" ]]; then
  echo "[resume-smoke] ERROR: candidate creation failed"
  echo "$RESP_CREATE"
  exit 1
fi

echo "[resume-smoke] candidate created: $CANDIDATE_ID"

sleep 1

curl -sS -f "$API_BASE/resume/candidates?page=1&limit=5" \
  -H "Authorization: Bearer $ACCESS_TOKEN" >/dev/null
echo "[resume-smoke] list endpoint OK"

curl -sS -f "$API_BASE/resume/candidates/$CANDIDATE_ID" \
  -H "Authorization: Bearer $ACCESS_TOKEN" >/dev/null
echo "[resume-smoke] detail endpoint OK"

curl -sS -f -X POST "$API_BASE/resume/candidates/$CANDIDATE_ID/notes" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content":"smoke-note","authorName":"smoke"}' >/dev/null
echo "[resume-smoke] notes endpoint OK"

curl -sS -f "$API_BASE/resume/candidates/export?page=1&limit=5" \
  -H "Authorization: Bearer $ACCESS_TOKEN" >/dev/null
echo "[resume-smoke] export endpoint OK"

curl -sS -f "$API_BASE/resume/analytics/summary" \
  -H "Authorization: Bearer $ACCESS_TOKEN" >/dev/null
echo "[resume-smoke] analytics endpoint OK"

echo "[resume-smoke] SUCCESS"
