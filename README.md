# On-Quest — 게임형 온보딩 플랫폼

신입 사원의 조직 적응을 돕기 위해 **퀘스트** 형태의 과제를 부여하고, 사수(관리자)가 증빙을 검토하며, **n8n**을 통해 **Slack**으로 실시간 알림을 보내는 MVP입니다.

- **멀티 테넌트**: `companyCode` 단위로 사용자·퀘스트가 격리됩니다.
- **역할 기반 UI**: `admin`(관리자) / `employee`(사원) 대시보드 분리
- **증빙 저장**: PostgreSQL `bytea` BLOB (최대 10MB/건)
- **Slack 연동**: 퀘스트 생성 · 증빙 제출 · 검토 결과 3종 이벤트

설계 선택 근거·면접 대응용 Q&A는 [DESIGN_RATIONALE.md](./DESIGN_RATIONALE.md)를 참고하세요.

---

## 목차

- [시스템 구성](#시스템-구성)
- [퀘스트 생명주기](#퀘스트-생명주기)
- [Slack 알림](#slack-알림)
- [빠른 시작](#빠른-시작)
- [환경 변수](#환경-변수)
- [API 개요](#api-개요)
- [디렉터리 구조](#디렉터리-구조)
- [로컬 개발](#로컬-개발)
- [보안 설계](#보안-설계)
- [문제 해결 / 개발 팁](#문제-해결--개발-팁)

---

## 시스템 구성

```
┌──────────────────┐  REST + JWT   ┌──────────────────┐  HMAC Webhook   ┌─────────────┐
│  React SPA       │ ────────────► │  NestJS API      │ ──────────────► │    n8n      │
│  Vite · Zustand  │ ◄──────────── │  Prisma · JWT    │                 │  (self-host)│
│  Nginx (/api 프록시)│              └────────┬─────────┘                 └──────┬──────┘
└──────────────────┘                       │ SQL                              │ Slack API
                                           ▼                                  ▼
                                   ┌──────────────┐                   ┌─────────────┐
                                   │ PostgreSQL 16│                   │   Slack     │
                                   │ quests BLOB  │                   │ #onboarding │
                                   └──────────────┘                   └─────────────┘
```

| 계층 | 기술 | 버전(대표) |
| --- | --- | --- |
| Frontend | React, Vite, TypeScript, Zustand, React Router | React 18, Vite 5 |
| Backend | NestJS, Prisma, class-validator, Passport JWT | Nest 10, Prisma 5 |
| DB | PostgreSQL 16 | Alpine 이미지 |
| Automation | n8n (Webhook → Code → Switch → Slack) | latest |
| Infra | Docker Compose, Nginx | 단일 브리지 `onquest-net` |

### 서비스 URL (Docker Compose 기본)

| 서비스 | URL | 비고 |
| --- | --- | --- |
| Frontend | http://localhost:8080 | Nginx + SPA, `/api` → backend 프록시 |
| Backend API | http://localhost:3000/api | 글로벌 prefix `api` |
| n8n | http://localhost:5678 | Basic Auth (`N8N_BASIC_AUTH_*`) |
| Postgres | localhost:5432 | 기본 `onquest` / `onquest_pw` |

프론트엔드가 Docker로 뜰 때 `VITE_API_BASE_URL`을 비우면 **동일 origin**(`http://localhost:8080/api`)으로 API를 호출하고, Nginx가 백엔드로 프록시합니다.

---

## 퀘스트 생명주기

### 상태 코드

| 코드 | 라벨 | 설명 |
| --- | --- | --- |
| `0` | 대기 | 관리자가 발행만 한 상태 |
| `1` | 검토 대기 | 사원이 증빙을 제출해 관리자 검토를 기다리는 상태 (`IN_PROGRESS`) |
| `2` | 완료 | 관리자 승인 |
| `3` | 반려 | 관리자 반려 (피드백 필수) |

### 역할별 기능

| 역할 | 주요 기능 |
| --- | --- |
| **admin** | 퀘스트 발행, 담당 사원 선택, 증빙 검토(승인/반려), 전체·담당자별 통계 |
| **employee** | 배정된 퀘스트 조회, 증빙 파일 + 선택적 추가 설명 제출, 재제출(반려 후), 증빙 다운로드 |

### 일반적인 흐름

1. 관리자가 퀘스트 생성 → 담당자 Slack ID 지정 → `quest.created` Slack 알림
2. 사원이 증빙 업로드(+ `submissionNote` 선택) → 상태 `검토 대기(1)` → `quest.proof_uploaded` 알림
3. 관리자가 승인/반려 → `quest.reviewed` 알림
4. 반려 시 사원이 다시 증빙 제출 가능

### 데이터 모델 요약

**User** (`users`)

- `(email, companyCode)`, `(slackMemberId, companyCode)` 유니크
- `role`: `admin` | `employee`

**Quest** (`quests`)

- `id`: 8자 영숫자 (`nanoid` 커스텀)
- `proofData` / `proofMimeType` / `proofFileName`: 증빙 BLOB (목록 API에서는 BLOB 제외)
- `submissionNote`: 사원이 제출 시 함께 보내는 선택 설명 (최대 5,000자)
- `assigneeId`, `publisherSlackMemberId`: Slack 멤버 ID (`U…` 형식)
- `companyCode`: 테넌트 격리 키

---

## Slack 알림

NestJS는 비즈니스 트랜잭션 **성공 후** n8n 웹훅을 **fire-and-forget**으로 호출합니다(실패해도 API 응답은 성공). SLA 목표는 **3초 이내** Slack 전달입니다.

### 웹훅 페이로드 형식

```json
{
  "event": "quest.proof_uploaded",
  "timestamp": "2026-05-17T06:30:00.000Z",
  "data": { ... }
}
```

헤더: `X-OnQuest-Signature`, `X-OnQuest-Timestamp`, `X-OnQuest-Event`

서명은 `stableStringify`(키 정렬 JSON) + HMAC-SHA256(`N8N_WEBHOOK_SECRET`)입니다. n8n Code 노드 검증 로직은 `n8n/onquest-workflow.template.json`과 동일해야 합니다.

### 이벤트별 `data` 필드

| event | Slack 메시지 요약 | 주요 `data` 필드 |
| --- | --- | --- |
| `quest.created` | 새 퀘스트 발행 | `title`, `deadline`(ISO), `deadlineDisplay`(분 단위), `assigneeId`, `publisherSlackMemberId` |
| `quest.proof_uploaded` | 증빙 제출 | `title`, `fileName`, `proofUrl`, `proofMimeType`, `submissionNote`, `assigneeId`, `publisherSlackMemberId` |
| `quest.reviewed` | 승인/반려 | `title`, `status`(2 또는 3), `feedback`, `assigneeId` |

### 표시 규칙

- **마감 시각**: DB/API는 `timestamptz` ISO 전체(`…T06:30:00.000Z`)를 저장하고, Slack·프론트는 **분 단위**(`deadlineDisplay`, `formatDateTimeToMinute`)만 표시합니다.
- **추가 설명**: `submissionNote`가 있을 때만 Slack 메시지에 `• 추가 설명:` 줄을 붙입니다.
- **증빙 링크**: 제출 시 HMAC 서명 **공유 URL**(`proofUrl`)을 생성합니다. Slack에서 `<URL\|파일명>` 형식으로 클릭 가능하며, 이미지는 인라인 미리보기, PDF 등은 다운로드됩니다.

공유 URL 예시:

```
GET /api/quests/{id}/proof/share?token={signedToken}
```

- JWT 불필요, 토큰 만료·서명 검증 (`PROOF_SHARE_SECRET`, 기본 TTL 7일)
- 운영 시 `API_PUBLIC_URL`은 Slack/n8n이 **실제로 접근 가능한** 백엔드 주소여야 합니다.

### n8n 워크플로우 설정

1. http://localhost:5678 접속
2. **Import from File** → `n8n/onquest-workflow.template.json`
3. 각 **Slack** 노드에 워크스페이스 Credential 연결, 채널(`#onboarding` 등) 수정
4. Webhook path: `onquest`, Method: `POST` → 활성화 후 URL이 `http://n8n:5678/webhook/onquest`(Docker 내부)와 일치하는지 확인
5. `docker-compose.yml`의 n8n 환경 변수(`NODE_FUNCTION_ALLOW_BUILTIN=crypto`, `N8N_BLOCK_ENV_ACCESS_IN_NODE=false`)가 적용되어 있는지 확인

템플릿을 수정한 뒤에는 n8n UI에서 **재 import**하거나 노드 문구를 수동으로 맞춰야 합니다.

---

## 빠른 시작

### 1) 환경 변수

```bash
cp .env.example .env
# JWT_SECRET, N8N_WEBHOOK_SECRET, N8N_BASIC_AUTH_PASSWORD 등을 반드시 교체하세요.
```

### 2) 전체 스택 기동

```bash
docker compose up -d --build
```

### 3) 동작 확인

1. http://localhost:8080 → 회원가입(관리자/사원, Slack 멤버 ID + 회사코드)
2. 관리자로 로그인 → 퀘스트 발행
3. 사원으로 로그인 → 증빙 제출
4. n8n 실행 이력 + Slack 채널 메시지 확인

---

## 환경 변수

`.env.example` 기준 전체 목록입니다.

| 변수 | 설명 | 기본/예시 |
| --- | --- | --- |
| `POSTGRES_*` | DB 접속 | `onquest` / `onquest_pw` |
| `DATABASE_URL` | Prisma (로컬 backend 실행 시) | `postgresql://…@localhost:5432/onquest` |
| `JWT_SECRET` | Access token 서명 | **운영에서 변경 필수** |
| `JWT_EXPIRES_IN` | 토큰 만료 | `1h` |
| `N8N_WEBHOOK_URL` | Nest → n8n URL | Compose: `http://n8n:5678/webhook/onquest` |
| `N8N_WEBHOOK_SECRET` | HMAC 공유 시크릿 | Nest ↔ n8n 동일 값 |
| `N8N_BASIC_AUTH_*` | n8n UI 로그인 | |
| `API_PUBLIC_URL` | Slack 증빙 링크 베이스 (**`/api` 포함**) | `http://localhost:3000/api` |
| `PROOF_SHARE_SECRET` | 증빙 공유 토큰 HMAC | 비우면 `N8N_WEBHOOK_SECRET` 사용 |
| `PROOF_SHARE_TTL_SECONDS` | 공유 링크 TTL(초) | `604800` (7일) |
| `CORS_ORIGIN` | 허용 Origin (쉼표 구분 가능) | `http://localhost:8080` |
| `VITE_API_BASE_URL` | 프론트 API 베이스 | Docker: 비움 → `/api` 프록시 |
| `VITE_IDLE_TIMEOUT_MS` | 무활동 자동 로그아웃 | `1800000` (30분) |
| `TZ` | 시간대 | `Asia/Seoul` |

**Docker + Slack 링크 팁:** 컨테이너 안 Slack/n8n이 호스트의 API에 접근해야 하면 Windows/Mac에서 `API_PUBLIC_URL=http://host.docker.internal:3000/api` 등을 검토하세요.

---

## API 개요

Base path: `/api` (인증 필요 엔드포인트는 `Authorization: Bearer <token>`)

### 인증 ` /auth`

| Method | Path | 설명 |
| --- | --- | --- |
| POST | `/auth/signup` | 회원가입 |
| POST | `/auth/login` | 로그인 → `accessToken`, `user` |
| GET | `/auth/me` | 현재 사용자 (JWT) |

### 퀘스트 ` /quests` (JWT)

| Method | Path | 권한 | 설명 |
| --- | --- | --- | --- |
| POST | `/quests` | admin | 퀘스트 발행 |
| GET | `/quests` | all | 목록 (admin: 회사 전체, employee: 본인 담당) |
| GET | `/quests/stats` | all | 진행 통계 |
| GET | `/quests/stats/by-assignee` | admin | 담당자별 통계 |
| GET | `/quests/assignable-employees` | admin | 발행 시 선택 가능한 사원 목록 |
| GET | `/quests/:id` | all | 상세 |
| POST | `/quests/:id/proof` | assignee | 증빙 업로드 (`multipart`: `file`, `submissionNote`) |
| GET | `/quests/:id/proof` | all* | 증빙 다운로드 (JWT, 회사/담당 권한) |
| PATCH | `/quests/:id/review` | admin | 검토 `{ status: 2\|3, feedback? }` |

\* 같은 `companyCode` 내 admin 또는 해당 퀘스트 `assigneeId`

### 증빙 공유 (JWT 없음)

| Method | Path | 설명 |
| --- | --- | --- |
| GET | `/quests/:id/proof/share?token=…` | 서명 토큰으로 증빙 조회 (Slack 링크용) |

---

## 디렉터리 구조

```
on-quest/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma          # User, Quest 모델
│   │   └── migrations/
│   └── src/
│       ├── auth/                  # JWT 회원가입·로그인
│       ├── quest/
│       │   ├── quest.controller.ts
│       │   ├── quest-proof-share.controller.ts  # 공개 증빙 링크
│       │   ├── quest.service.ts
│       │   └── dto/
│       ├── automation/
│       │   └── n8n.service.ts     # HMAC 웹훅
│       └── common/utils/
│           ├── id-generator.ts
│           ├── format-datetime.ts
│           └── proof-share-token.ts
├── frontend/
│   └── src/
│       ├── pages/                 # AdminDashboard, EmployeeDashboard
│       ├── components/            # QuestItem, CreateQuestForm, …
│       ├── auth/                  # 로그인·회원가입·역할 라우트
│       ├── api/                   # axios + questApi
│       ├── store/                 # Zustand (quest, auth)
│       └── utils/formatDateTime.ts
├── n8n/
│   └── onquest-workflow.template.json
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## 로컬 개발

### Docker만 (권장)

```bash
docker compose up -d --build
```

백엔드 컨테이너 기동 시 `prisma migrate deploy`가 자동 실행됩니다.

### 호스트에서 backend + frontend (HMR)

```bash
# 터미널 1 — DB·n8n만 Compose
docker compose up -d postgres n8n

# 터미널 2 — backend
cd backend
cp ../.env.example .env   # DATABASE_URL 등 조정
npm install
npx prisma migrate dev
npm run start:dev         # http://localhost:3000/api

# 터미널 3 — frontend
cd frontend
npm install
# .env: VITE_API_BASE_URL=http://localhost:3000
npm run dev               # Vite 기본 http://localhost:5173
```

### 유용한 스크립트

| 위치 | 명령 | 설명 |
| --- | --- | --- |
| backend | `npm run start:dev` | Nest watch 모드 |
| backend | `npm run prisma:migrate` | 마이그레이션 개발 |
| frontend | `npm run dev` | Vite dev server |
| frontend | `npm run build` | 프로덕션 빌드 |

---

## 보안 설계

| 항목 | 구현 |
| --- | --- |
| API 인증 | JWT (Passport), 역할·회사코드 기반 접근 제어 |
| n8n 웹훅 | HMAC-SHA256 + 타임스탬프 ±5분 윈도우 |
| 증빙 공유 | 단기 HMAC 토큰 URL, `timingSafeEqual` 서명 비교 |
| 비밀번호 | bcrypt (cost 10) |
| CORS | `CORS_ORIGIN` 화이트리스트 |
| n8n 권한 분리 | API DB 자격 증명 없이 Slack 토큰만 n8n에 보관 (권장) |
| BLOB 목록 조회 | `proofData`는 목록 `select`에서 제외 |

운영 체크리스트:

- `JWT_SECRET`, `N8N_WEBHOOK_SECRET`, `PROOF_SHARE_SECRET` 기본값 사용 금지
- `API_PUBLIC_URL`을 HTTPS 공개 주소로 설정
- n8n Basic Auth 비밀번호 변경
- 증빙 공유 TTL을 정책에 맞게 조정

---

## 문제 해결 / 개발 팁

### n8n

| 증상 | 조치 |
| --- | --- |
| `Module 'crypto' is disallowed` | `NODE_FUNCTION_ALLOW_BUILTIN=crypto` ([문서](https://docs.n8n.io/hosting/configuration/configuration-examples/modules-in-code-node/)) |
| `$env` / 환경 변수 접근 거부 | `N8N_BLOCK_ENV_ACCESS_IN_NODE=false` ([보안 환경 변수](https://docs.n8n.io/hosting/configuration/environment-variables/security/)) |
| 설정 변경 후 | `docker compose up -d --force-recreate n8n` |

### Slack

- 알림이 안 오면: `N8N_WEBHOOK_URL` 연결, 워크플로 **Active**, Slack Credential·채널명 확인
- 증빙 링크 401/404: `API_PUBLIC_URL` 접근 가능 여부, 토큰 만료, **제출 이전 퀘스트**는 `proofUrl` 미생성(재제출 필요)

### 성능

- 증빙은 DB BLOB(건당 최대 10MB). 대용량·다건이 늘면 S3/MinIO presigned URL 하이브리드 전환을 검토하세요.
- 웹훅 실패는 백엔드 로그(`n8n webhook failed`)에 남고, API 트랜잭션은 롤백되지 않습니다.

### Prisma

```bash
cd backend
npx prisma migrate dev    # 스키마 변경 시
npx prisma studio         # 데이터 확인
```

---

## 라이선스 / 출처

요구사항명세서·설계명세서·최종보고서를 기반으로 한 학습/데모용 MVP 보일러플레이트입니다.
