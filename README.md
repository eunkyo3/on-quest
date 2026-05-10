# On-Quest — 게임형 온보딩 플랫폼

신입 사원의 조직 적응을 돕기 위해 '퀘스트' 형태의 과제를 부여하고,
사수(관리자)가 검토하며, **n8n**을 통해 **Slack 알림**을 실시간으로 주고받는 시스템입니다.

> 요구사항명세서 / 설계명세서 / 최종보고서를 기반으로 설계된 MVP 보일러플레이트.

## 📐 아키텍처

```
┌──────────────┐   REST    ┌──────────────┐   HMAC-Signed    ┌─────────────┐
│  React (SPA) │ ────────► │   NestJS     │ ───Webhook─────► │    n8n      │
│  Vite+TS     │ ◄──────── │   Prisma     │                  │ (Self-host) │
└──────────────┘           └──────┬───────┘                  └──────┬──────┘
                                  │ SQL                             │ Slack API
                                  ▼                                 ▼
                          ┌──────────────┐                  ┌─────────────┐
                          │ PostgreSQL   │                  │   Slack     │
                          │ BLOB 제출물  │                  │ chat.post*  │
                          └──────────────┘                  └─────────────┘
```

- **Frontend**: React (Vite) + TypeScript + Zustand
- **Backend**: NestJS + Prisma + class-validator
- **Database**: PostgreSQL 16 (증빙자료는 BLOB/`bytea`)
- **Automation**: n8n (Webhook → Slack)
- **Infra**: Docker Compose (단일 네트워크 `onquest-net`)

## 🚀 실행 방법

### 1) 환경 변수 구성
```bash
cp .env.example .env
# .env 파일을 열어 N8N_WEBHOOK_SECRET 등 시크릿을 반드시 교체하세요.
```

### 2) 전체 스택 기동
```bash
docker compose up -d --build
```

| 서비스 | URL | 비고 |
| --- | --- | --- |
| Frontend | http://localhost:8080 | Nginx + React 빌드 |
| Backend  | http://localhost:3000 | NestJS (REST) |
| n8n      | http://localhost:5678 | Basic Auth 로그인 |
| Postgres | localhost:5432 | `onquest/onquest_pw` |

### 3) n8n 워크플로우 설정
1. http://localhost:5678 에 접속
2. **Webhook 노드** 생성 → Path: `onquest`, Method: `POST`
3. **Function/Code 노드**에서 HMAC 검증 (아래 예시 참고)
4. **Slack 노드** (`chat.postMessage`) 연결

HMAC 검증 예시 (n8n Code 노드):
```js
const crypto = require('crypto');
const secret = $env.ONQUEST_WEBHOOK_SECRET;
const signature = $request.headers['x-onquest-signature'];
const expected = crypto
  .createHmac('sha256', secret)
  .update(JSON.stringify($json))
  .digest('hex');
if (signature !== expected) throw new Error('Invalid signature');
return $input.all();
```

## 🗂 디렉터리 구조

```
on-quest/
├── backend/          # NestJS API 서버
│   ├── prisma/          # Prisma 스키마 및 마이그레이션
│   └── src/
│       ├── quest/         # 퀘스트 도메인
│       ├── prisma/        # PrismaService
│       ├── automation/    # n8n 연동 서비스 (HMAC)
│       └── common/        # 공통 유틸
├── frontend/         # React SPA
│   └── src/
│       ├── pages/         # 신입/관리자 대시보드
│       ├── components/    # 재사용 UI
│       └── store/         # Zustand 상태
├── docker-compose.yml
└── .env.example
```

## 🔐 보안 설계

- **HMAC-SHA256 서명**: NestJS → n8n 웹훅 호출 시 모든 페이로드를 서명
- **요청 재전송 방어**: 타임스탬프 기반 window 검증 (5분)
- **최소 권한 원칙**: n8n 컨테이너는 Slack 토큰만 보유
- **CORS 화이트리스트**: `CORS_ORIGIN` 환경 변수 기반

## 💡 개발 팁

- **n8n `Verify HMAC` — `Module 'crypto' is disallowed`:** n8n 서비스에 `NODE_FUNCTION_ALLOW_BUILTIN=crypto` ([문서](https://docs.n8n.io/hosting/configuration/configuration-examples/modules-in-code-node/)).
- **n8n `access to env vars denied` / `$env` 사용 불가:** n8n 2.x 기본값으로 Code 노드에서 환경 변수가 막혀 있습니다. `N8N_BLOCK_ENV_ACCESS_IN_NODE=false` 설정 ([보안 환경 변수](https://docs.n8n.io/hosting/configuration/environment-variables/security/)). 자체 호스팅에서만 사용하고, 가능하면 시크릿은 전용 Credential으로 옮기는 편이 더 안전합니다.
- 위 둘 다 적용 후: `docker compose up -d --force-recreate n8n`
- BLOB 저장 방식의 성능 이슈가 우려된다면 10MB 이상 파일은 S3/MinIO 등 외부 스토리지로 offload하는 하이브리드 방식을 고려하세요.
- 로컬 개발 시 `backend`와 `frontend`만 호스트에서 돌리고 `postgres`/`n8n`만 컴포즈로 띄우면 HMR이 빨라집니다.
- **Prisma**: `backend` 디렉터리에서 `DATABASE_URL`을 설정한 뒤 `npx prisma migrate dev`로 스키마를 적용합니다. Docker 기동 시 컨테이너가 `prisma migrate deploy`로 마이그레이션을 자동 실행합니다.
