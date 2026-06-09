# On-Quest — 게임형 온보딩 플랫폼

신입 사원의 조직 적응을 돕기 위해 **퀘스트** 형태의 과제를 부여하고, 사수(관리자)가 증빙을 검토하며, **n8n**을 통해 **Slack**으로 실시간 알림을 보내는 MVP입니다.

- **멀티 테넌트**: `companyCode` 단위로 사용자·퀘스트 격리
- **역할 기반 UI**: `admin` / `employee` 대시보드·상세 페이지 분리
- **퀘스트 v2 상태**: 대기 → 착수 → 검토 대기 → 완료/반려
- **증빙 저장**: PostgreSQL `bytea` BLOB (건당 최대 10MB)
- **Slack 연동**: 생성 · 제출 · 검토 · 마감 임박 · 마감 연체 (5종 이벤트)
- **프론트 UX**: 토스트 알림, 페이징·필터, 드래그앤드롭 제출, 증빙 미리보기, JWT refresh

---

## 목차

- [시스템 구성](#시스템-구성)
- [퀘스트 생명주기](#퀘스트-생명주기)
- [프론트엔드 기능](#프론트엔드-기능)
- [Slack 알림](#slack-알림)
- [빠른 시작](#빠른-시작)
- [환경 변수](#환경-변수)
- [API 개요](#api-개요)
- [디렉터리 구조](#디렉터리-구조)
- [로컬 개발](#로컬-개발)
- [보안 설계](#보안-설계)
- [문제 해결 / 개발 팁](#문제-해결--개발-팁)
- [앞으로 진행할 부분](#앞으로-진행할-부분)

---

## 시스템 구성

```
┌──────────────────┐  REST + JWT   ┌──────────────────┐  HMAC Webhook   ┌─────────────┐
│  React SPA       │ ────────────► │  NestJS API      │ ──────────────► │    n8n      │
│  Vite · Zustand  │ ◄──────────── │  Prisma · Cron   │                 │  (self-host)│
│  Nginx (/api)    │   refresh     └────────┬─────────┘                 └──────┬──────┘
└──────────────────┘                        │ SQL                              │ Slack API
                                            ▼                                  ▼
                                    ┌──────────────┐                   ┌─────────────┐
                                    │ PostgreSQL 16│                   │   Slack     │
                                    │ quests BLOB  │                   │ #onboarding │
                                    └──────────────┘                   └─────────────┘
```

| 계층 | 기술 | 버전(대표) |
| --- | --- | --- |
| Frontend | React, Vite, TypeScript, Zustand, React Router | React 18, Vite 5 |
| Backend | NestJS, Prisma, `@nestjs/schedule`, Passport JWT | Nest 10, Prisma 5 |
| DB | PostgreSQL 16 | Alpine 이미지 |
| Automation | n8n (Webhook → HMAC → Switch → Slack) | latest |
| Infra | Docker Compose, Nginx | 단일 브리지 `onquest-net` |

### 서비스 URL (Docker Compose 기본)

| 서비스 | URL | 비고 |
| --- | --- | --- |
| Frontend | http://localhost:8080 | Nginx + SPA, `/api` → backend 프록시 |
| Backend API | http://localhost:3000/api | 글로벌 prefix `api` |
| n8n | http://localhost:5678 | Basic Auth (`N8N_BASIC_AUTH_*`) |
| Postgres | localhost:5432 | 기본 `onquest` / `onquest_pw` |

Docker 환경에서 `VITE_API_BASE_URL`을 비우면 **동일 origin**(`http://localhost:8080/api`)으로 요청하고, Nginx가 백엔드로 프록시합니다.

---

## 퀘스트 생명주기

### 상태 코드 (v2)

| 코드 | enum | 라벨 | 설명 |
| --- | --- | --- | --- |
| `0` | `PENDING` | 대기 | 관리자 발행만 된 상태 |
| `1` | `IN_PROGRESS` | 착수 | 사원이 업무를 시작한 상태 |
| `2` | `SUBMITTED` | 검토 대기 | 증빙 제출 후 관리자 검토 대기 |
| `3` | `COMPLETED` | 완료 | 관리자 승인 |
| `4` | `REJECTED` | 반려 | 관리자 반려 (피드백 필수) |
| `5` | `DECLINED` | 거부됨 | 사원이 수행 자체를 거부 (사유 필수) |

> 기존 DB(0~3 코드)를 쓰던 경우 `prisma migrate deploy`로 `20260517120000_quest_status_v2` 마이그레이션이 자동 적용됩니다.

### 역할별 기능

| 역할 | 주요 기능 |
| --- | --- |
| **superadmin** | 회사코드 **최초 가입자** 자동 부여. 구성원 **역할 관리(신입사원↔관리자)**, 전사 퀘스트 현황. 관리자 기능의 상위 집합(퀘스트 발행·검토도 가능) |
| **admin** | 퀘스트 발행·**수정·삭제(대기·거부됨)**, 담당자 선택, **검토 대기** 목록 검토, 증빙 미리보기/다운로드, 전체·담당자별 통계, 목록 필터·페이징 |
| **employee** | 배정 퀘스트 조회, **착수**, 증빙 + 선택 설명 제출, **검토 전 수정 재제출**, 반려 후 재제출, **퀘스트 거부(사유 필수)**, 상세·다운로드 |

> **역할 부여**: 회사코드의 첫 가입자는 `superadmin`이 되고, 이후 가입자는 모두 `employee`로 고정됩니다. `admin`은 슈퍼관리자가 사용자 관리 화면에서 승격합니다(회원가입 시 역할 선택 없음).
>
> **퀘스트 뷰**: 목록은 카드가 아닌 **테이블**로 표시하며, 행을 펼치면 그 자리에서 착수·제출·거부·검토를 수행합니다.
>
> **거부 처리**: 거부된 퀘스트는 관리자가 **재개봉**(대기로 복귀, 같은/다른 담당자)하거나 삭제합니다. 재제출 시 이전 반려 피드백은 초기화됩니다.
>
> **완료율**: `completionRate = 완료 / (전체 − 거부됨)` — 사원이 거부한 건은 분모에서 제외합니다.

### 일반적인 흐름

1. 관리자 퀘스트 생성 → `quest.created` Slack 알림
2. 사원 **착수** (`POST /quests/:id/start`) → 상태 `1`
3. 사원 증빙 업로드(+ `submissionNote` 선택) → 상태 `2` → `quest.proof_uploaded` (증빙 공유 URL 포함)
4. 관리자 승인/반려 → `quest.reviewed` (검토자 Slack ID 자동 기록)
5. 반려 시 사원이 다시 착수·재제출 가능
6. (백그라운드) 마감 24시간 이내·연체 시 Cron → `quest.deadline_soon` / `quest.deadline_overdue`

### 데이터 모델 요약

**User** (`users`)

- `(email, companyCode)`, `(slackMemberId, companyCode)` 유니크
- `role`: `admin` | `employee`

**Quest** (`quests`)

- `id`: 8자 영숫자 (`nanoid`)
- `proofData` / `proofMimeType` / `proofFileName`: 증빙 BLOB (목록 API에서 BLOB 제외)
- `submissionNote`: 선택 설명 (최대 5,000자)
- `assigneeId`, `publisherSlackMemberId`: Slack 멤버 ID
- `deadlineSoonNotifiedAt`, `overdueNotifiedAt`: 마감 알림 중복 방지
- `companyCode`: 테넌트 격리

---

## 프론트엔드 기능

| 기능 | 경로·구현 |
| --- | --- |
| 관리자 대시보드 | `/admin` — 검토 대기 / 전체 퀘스트, 상태 필터, 페이지네이션 |
| 사원 대시보드 | `/employee` — 내 퀘스트, 필터·페이징 |
| 퀘스트 상세 | `/admin/quests/:id`, `/employee/quests/:id` — 상세·수정(대기)·삭제·검토/제출 UI |
| 토스트 알림 | `toastStore` + `ToastContainer` (`alert` 대신) |
| 증빙 제출 UX | 드래그앤드롭, 이미지 썸네일, 허용 형식 안내 |
| 증빙 미리보기 | 관리자·담당자 `GET …/proof/preview` (Blob) |
| 담당자 표시 | 카드에 `assigneeName` + Slack ID |
| 인증 | JWT access + refresh, 401 시 자동 갱신, 무활동 로그아웃 |
| 역할 라우팅 | `RoleRoute` (`/superadmin`, `/admin`, `/employee` 분리, 역할별 배너로 화면 구분) |

---

## Slack 알림

NestJS는 트랜잭션 **성공 후** n8n 웹훅을 **fire-and-forget**으로 호출합니다. SLA 목표는 **3초 이내** Slack 전달입니다.

### 웹훅 페이로드

```json
{
  "event": "quest.proof_uploaded",
  "timestamp": "2026-05-17T06:30:00.000Z",
  "data": { ... }
}
```

헤더: `X-OnQuest-Signature`, `X-OnQuest-Timestamp`, `X-OnQuest-Event`  
서명: `stableStringify` + HMAC-SHA256 (`N8N_WEBHOOK_SECRET`)

### 이벤트별 `data` 필드

| event | 요약 | 주요 `data` |
| --- | --- | --- |
| `quest.created` | 새 퀘스트 | `title`, `deadline`, `deadlineDisplay`, `assigneeId`, `publisherSlackMemberId` |
| `quest.proof_uploaded` | 증빙 제출 | `title`, `fileName`, `proofUrl`, `proofMimeType`, `submissionNote`, `assigneeId`, `publisherSlackMemberId` |
| `quest.reviewed` | 승인/반려 | `title`, `status`(3 또는 4), `feedback`, `reviewerId`, `assigneeId` |
| `quest.deadline_soon` | 마감 24h 이내 | `title`, `deadlineDisplay`, `assigneeId`, `publisherSlackMemberId` |
| `quest.deadline_overdue` | 마감 연체 | 동일 |

### 표시·링크 규칙

- **마감**: DB는 ISO 전체 저장, Slack·UI는 **분 단위** (`deadlineDisplay`, `formatDateTimeToMinute`)
- **추가 설명**: `submissionNote` 있을 때만 Slack에 표시
- **증빙 링크**: `proofUrl` → `GET /api/quests/{id}/proof/share?token=…` (JWT 불필요, TTL 기본 7일)

### n8n 설정

1. http://localhost:5678 접속
2. **Import** → `n8n/onquest-workflow.template.json`
3. Slack Credential·채널 연결
4. Webhook path `onquest`, **Active** → Docker 내부 URL `http://n8n:5678/webhook/onquest`
5. Compose에 `NODE_FUNCTION_ALLOW_BUILTIN=crypto`, `N8N_BLOCK_ENV_ACCESS_IN_NODE=false` 확인

---

## 빠른 시작

### 1) 환경 변수

```bash
cp .env.example .env
# JWT_SECRET, N8N_WEBHOOK_SECRET, N8N_BASIC_AUTH_PASSWORD 등 교체
```

### 2) 전체 스택 기동

```bash
docker compose up -d --build
```

백엔드 기동 시 `prisma migrate deploy`가 자동 실행됩니다 (상태 v2·마감 알림 컬럼 포함).

### 3) 동작 확인

1. http://localhost:8080 → 회원가입 (관리자/사원, Slack ID + 회사코드)
2. 관리자 → 퀘스트 발행
3. 사원 → **착수** → 증빙 제출
4. 관리자 → 검토 대기 목록에서 승인/반려
5. n8n 실행 이력 + Slack 채널 확인

---

## 환경 변수

| 변수 | 설명 | 기본/예시 |
| --- | --- | --- |
| `POSTGRES_*` | DB 접속 | `onquest` / `onquest_pw` |
| `DATABASE_URL` | Prisma (로컬 backend) | `postgresql://…@localhost:5432/onquest` |
| `JWT_SECRET` | Access token 서명 | **운영에서 변경 필수** |
| `JWT_EXPIRES_IN` | Access 만료 | `1h` |
| `JWT_REFRESH_EXPIRES_IN` | Refresh 만료 | `7d` |
| `N8N_WEBHOOK_URL` | Nest → n8n | `http://n8n:5678/webhook/onquest` |
| `N8N_WEBHOOK_SECRET` | HMAC 시크릿 | Nest ↔ n8n 동일 |
| `N8N_BASIC_AUTH_*` | n8n UI | |
| `API_PUBLIC_URL` | Slack 증빙 링크 (**`/api` 포함**) | `http://localhost:3000/api` |
| `PROOF_SHARE_SECRET` | 증빙 공유 HMAC | 비우면 `N8N_WEBHOOK_SECRET` |
| `PROOF_SHARE_TTL_SECONDS` | 공유 링크 TTL | `604800` |
| `CORS_ORIGIN` | 허용 Origin | `http://localhost:8080` |
| `VITE_API_BASE_URL` | 프론트 API | Docker: 비움 |
| `VITE_IDLE_TIMEOUT_MS` | 무활동 로그아웃 | `1800000` |
| `TZ` | 시간대 | `Asia/Seoul` |

**Slack 링크:** 컨테이너에서 호스트 API 접근 시 `API_PUBLIC_URL=http://host.docker.internal:3000/api` (Windows/Mac Docker) 검토.

---

## API 개요

Base: `/api` · 인증: `Authorization: Bearer <accessToken>`

### 인증 `/auth`

| Method | Path | 설명 |
| --- | --- | --- |
| POST | `/auth/signup` | 회원가입 → `accessToken`, `refreshToken`, `user` |
| POST | `/auth/login` | 로그인 → 동일 |
| POST | `/auth/refresh` | `{ refreshToken }` → 새 토큰 쌍 |
| GET | `/auth/me` | 현재 사용자 (JWT) |

### 퀘스트 `/quests` (JWT)

| Method | Path | 권한 | 설명 |
| --- | --- | --- | --- |
| POST | `/quests` | admin | 발행 |
| GET | `/quests?page=&limit=&status=` | all | **페이지 목록** `{ items, total, page, limit, totalPages }` |
| GET | `/quests/stats` | all | 통계 (`pending`, `started`, `submitted`, `completed`, `rejected`) |
| GET | `/quests/stats/by-assignee` | admin | 담당자별 통계 |
| GET | `/quests/assignable-employees` | admin | 발행 시 사원 목록 |
| GET | `/quests/:id` | all | 상세 (`assigneeName` 포함) |
| PATCH | `/quests/:id` | admin | **수정** (대기만: title, description, deadline) |
| DELETE | `/quests/:id` | admin | **삭제** (대기만) |
| POST | `/quests/:id/start` | assignee | **착수** |
| POST | `/quests/:id/decline` | assignee | **거부** (대기·착수만, `{ reason }` 필수) |
| POST | `/quests/:id/reopen` | admin | **재개봉** (거부됨→대기, `{ assigneeId? }` 로 재배정) |
| POST | `/quests/:id/proof` | assignee | 증빙 업로드 (`file`, `submissionNote`) |
| GET | `/quests/:id/proof` | all* | 다운로드 |
| GET | `/quests/:id/proof/preview` | all* | 미리보기 (inline/새 탭) |
| PATCH | `/quests/:id/review` | admin | 검토 `{ status: 3\|4, feedback? }` (반려 시 feedback 필수) |

\* 같은 `companyCode` 내 admin 또는 해당 `assigneeId`

### 사용자 관리 `/users` (JWT · superadmin 전용)

| Method | Path | 설명 |
| --- | --- | --- |
| GET | `/users` | 같은 회사 구성원 목록(역할 포함) |
| GET | `/users/audit-logs?limit=` | 감사 로그(역할 변경·검토·삭제·거부·재개봉·이양) |
| PATCH | `/users/:id/role` | 역할 변경 `{ role: 'admin' \| 'employee' }` (본인·슈퍼관리자 변경 불가) |
| POST | `/users/:id/transfer-ownership` | 슈퍼관리자 권한 이양(본인→admin 강등, 대상→superadmin) |

### 증빙 공유 (JWT 없음)

| Method | Path | 설명 |
| --- | --- | --- |
| GET | `/quests/:id/proof/share?token=…` | Slack용 서명 URL |

---

## 디렉터리 구조

```
on-quest/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/          # status v2, submission_note, …
│   └── src/
│       ├── auth/
│       ├── quest/
│       │   ├── quest.controller.ts
│       │   ├── quest-proof-share.controller.ts
│       │   ├── quest-deadline.scheduler.ts   # 마감 Cron
│       │   ├── quest.service.ts
│       │   └── dto/
│       ├── automation/n8n.service.ts
│       └── common/utils/
├── frontend/
│   └── src/
│       ├── pages/               # Admin/Employee Dashboard, QuestDetailPage
│       ├── components/          # QuestItem, ToastContainer, …
│       ├── store/               # questStore, toastStore, authStore
│       ├── api/questApi.ts      # refresh 인터셉터
│       └── utils/formatDateTime.ts
├── n8n/onquest-workflow.template.json
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## 로컬 개발

### Docker (권장)

```bash
docker compose up -d --build
```

### 호스트 HMR

```bash
docker compose up -d postgres n8n

cd backend && npm install && npx prisma migrate dev && npm run start:dev
cd frontend && npm install && npm run dev
# VITE_API_BASE_URL=http://localhost:3000
```

### 유용한 명령

| 위치 | 명령 |
| --- | --- |
| backend | `npm run start:dev` |
| backend | `npx prisma migrate dev` |
| frontend | `npm run dev` / `npm run build` |

---

## 보안 설계

| 항목 | 구현 |
| --- | --- |
| API 인증 | JWT access + refresh, 역할·`companyCode` 격리 |
| 역할 즉시 반영 | JwtStrategy가 매 요청마다 DB의 현재 role을 읽어 검증 → 승격/강등이 토큰 만료를 기다리지 않고 즉시 적용, 삭제된 계정 토큰 무효화 |
| 슈퍼관리자 유일성 | `users(companyCode) WHERE role='superadmin'` 부분 유니크 인덱스로 동시 최초 가입 경합 방지 |
| 레이트리밋 | 전역 ThrottlerGuard(120/분) + `/auth/login`·`/auth/signup` 10/분 |
| 감사 로그 | 역할 변경·검토·삭제·거부·재개봉·이양을 `audit_logs`에 기록 |
| n8n 웹훅 | HMAC-SHA256, 타임스탬프 ±5분 |
| 증빙 공유 | HMAC URL, TTL, `timingSafeEqual` |
| 비밀번호 | bcrypt |
| CORS | `CORS_ORIGIN` 화이트리스트 |
| BLOB 목록 | `proofData` select 제외 |

**운영 체크리스트:** 시크릿 교체, `API_PUBLIC_URL` HTTPS, n8n Basic Auth, 증빙 TTL 조정.

**알려진 MVP 타협:** 회사코드 첫 가입자=슈퍼관리자(서버 결정), refresh/localStorage, fire-and-forget 웹훅, BLOB + memoryStorage 동시 업로드 시 메모리 부담.

---

## 문제 해결 / 개발 팁

### n8n

| 증상 | 조치 |
| --- | --- |
| `crypto` disallowed | `NODE_FUNCTION_ALLOW_BUILTIN=crypto` |
| `$env` 거부 | `N8N_BLOCK_ENV_ACCESS_IN_NODE=false` |
| 변경 후 | `docker compose up -d --force-recreate n8n` |

### Slack

- 알림 없음: 워크플로 Active, `N8N_WEBHOOK_URL`, Credential 확인
- 증빙 링크 실패: `API_PUBLIC_URL` 외부 접근 가능 여부, 토큰 만료
- 마감 알림 없음: 백엔드 Cron 동작, 미완료 퀘스트·`deadlineSoonNotifiedAt` null 확인

### API / DB

- `GET /quests`가 배열이 아닌 객체 → **페이징 응답**으로 변경됨 (정상)
- 상태 코드 0~4 → v2 마이그레이션 필요: `npx prisma migrate deploy`

### Prisma

```bash
cd backend
npx prisma migrate deploy
npx prisma studio
```

---

## 앞으로 진행할 부분

현재 MVP 이후 우선순위를 정리한 로드맵입니다.

### 최근 반영 완료 (2026-06)

- **역할 체계**: 회사코드 최초 가입자=슈퍼관리자, 이후 신입사원 고정. 슈퍼관리자 사용자 관리·권한 이양.
- **역할 즉시 반영**: JwtStrategy가 매 요청 DB role 검증(승격/강등 즉시).
- **슈퍼관리자 경합 방지**: 부분 유니크 인덱스.
- **퀘스트 거부/재개봉**: 거부됨 상태 + 사유, 관리자 재개봉·재배정.
- **검토 전 재제출**: 피드백 초기화.
- **테이블 뷰**: 카드 → 테이블(행 펼치기).
- **감사 로그**: `audit_logs` + 슈퍼관리자 조회 화면.
- **레이트리밋**: 전역 + 인증 엔드포인트.
- **테스트/CI**: jest 단위 테스트 + GitHub Actions(typecheck·test·build·prisma validate).


### 보안·인증 (우선)

| 항목 | 내용 |
| --- | --- |
| 회원가입 role 잠금 | 공개 signup은 `employee` 고정, admin은 시드/초대 코드만 |
| 로그인 `companyCode` | 동일 이메일 다중 테넌트 시 로그인 폼에 회사코드 추가 |
| httpOnly 쿠키 | refresh/access를 쿠키로 이전 (XSS 완화) |
| 증빙 공유 레이트 리미트 | 무차별 URL 접근 방지 |

### 신뢰성·운영

| 항목 | 내용 |
| --- | --- |
| **Outbox 패턴** | Slack 웹훅 실패·프로세스 재시작 시 알림 유실 방지 (DB 이벤트 큐 + 워커 재시도) |
| 헬스체크 | `GET /api/health` (DB·선택 n8n ping) |
| CI/CD | GitHub Actions — lint, build, `prisma validate` |
| 자동 테스트 | QuestService, HMAC·공유 토큰 단위 테스트, API e2e |

### 스토리지·성능

| 항목 | 내용 |
| --- | --- |
| **S3/MinIO** | BLOB → 객체 스토리지, presigned 업로드/다운로드 (동시 업로드 OOM 해소) |
| 스트리밍 업로드 | Multer `memoryStorage` 대체 |
| 목록 최적화 | 필요 시 커서 페이징, 검색(제목·담당자) |

### 제품·도메인

| 항목 | 내용 |
| --- | --- |
| 퀘스트 일괄 발행 | CSV/템플릿 기반 다건 생성 |
| 알림 설정 | 마감 N일 전 사용자·채널별 설정 |
| 감사 로그 | 검토·수정·삭제 이력 테이블 |
| Slack 멘션 개선 | 담당자 실명·프로필 연동 (User ↔ Slack API) |
| 관리자 대시보드 | 미완료 퀘스트만 보기, 엑셀보내기 |

### 프론트엔드 UX

| 항목 | 내용 |
| --- | --- |
| 실시간 갱신 | WebSocket/SSE 또는 짧은 폴링으로 목록 자동 갱신 |
| 접근성 | 키보드 전용 제출·검토, ARIA 보강 |
| 다국어(i18n) | 한/영 리소스 분리 |
| 다크 모드 | CSS 변수 테마 확장 |

### 인프라·배포

| 항목 | 내용 |
| --- | --- |
| 프로덕션 Compose/K8s | secrets 관리, HTTPS 종단, 리버스 프록시 |
| n8n 하드닝 | 커스텀 HMAC 노드, Credential Store, UI 외부 비공개 |
| Observability | 구조화 로그, Slack 실패 메트릭, APM 연동 |

### 문서·협업

| 항목 | 내용 |
| --- | --- |
| OpenAPI | `@nestjs/swagger`로 API 문서 자동화 |
| CONTRIBUTING | 브랜치·커밋·PR 규칙 |
| CHANGELOG | 버전별 breaking change 기록 (상태 v2 등) |

---

## 라이선스 / 출처

요구사항명세서·설계명세서·최종보고서를 기반으로 한 학습/데모용 MVP 보일러플레이트입니다.
