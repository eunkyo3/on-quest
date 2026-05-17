# On-Quest 설계 의사결정 Q&A

> **“이건 왜 이렇게 만들었어요?”** 에 대한 프로젝트 전반의 설계·구현 근거를 정리한 문서입니다.  
> 면접, 코드 리뷰, 발표, 유지보수 인수인계 시 참고용으로 사용할 수 있습니다.

### 피드백 반영 요약 (2차)

외부 리뷰를 반영해 아래를 보완했습니다.

| 주제 | 반영 내용 |
| --- | --- |
| 상태 용어 | 코드 enum `IN_PROGRESS`는 유지, **UI·문서 라벨은 `검토 대기`**로 통일 (Q5-2a) |
| BLOB + memoryStorage | 동시 업로드 시 힙·GC·OOM 리스크 명시, S3 진화 우선순위 (Q1-3, Q6-4) |
| fire-and-forget | 응답 직후 프로세스 종료 시 요청 소멸 가능성·Outbox 강조 (Q7-4) |
| 회원가입 role | 데모·평가 시나리오 의도로 문구 정교화 (Q3-3) |
| n8n crypto 허용 | Compose 내부망 전제·프로덕션 대안 (Q7-10) |

---

## 목차

1. [전체 아키텍처](#1-전체-아키텍처)
2. [기술 스택 선택](#2-기술-스택-선택)
3. [인증·인가](#3-인증인가)
4. [멀티 테넌시(회사코드)](#4-멀티-테넌시회사코드)
5. [퀘스트 도메인](#5-퀘스트-도메인)
6. [증빙 파일 저장](#6-증빙-파일-저장)
7. [Slack · n8n 연동](#7-slack--n8n-연동)
8. [증빙 공유 링크](#8-증빙-공유-링크)
9. [날짜·시간 표시](#9-날짜시간-표시)
10. [프론트엔드](#10-프론트엔드)
11. [API·백엔드 구조](#11-api백엔드-구조)
12. [Docker · 인프라](#12-docker--인프라)
13. [보안](#13-보안)
14. [성능·확장성 한계와 향후 방향](#14-성능확장성-한계와-향후-방향)

---

## 1. 전체 아키텍처

### Q1-1. 왜 모놀리식 API(NestJS) + SPA(React)로 나눴나요?

**답변:** 온보딩 퀘스트 관리는 **REST API**로 충분하고, 화면은 관리자/사원 역할에 따라 자주 바뀌는 **UI 레이어**입니다. 백엔드는 비즈니스 규칙·DB·Slack 웹훅을 담당하고, 프론트는 대시보드·폼·상태 표시만 담당하도록 관심사를 분리했습니다. MVP 단계에서 BFF나 마이크로서비스를 두면 배포·디버깅 비용만 늘어납니다.

---

### Q1-2. 왜 Slack 알림을 백엔드에서 직접 보내지 않고 n8n을 거치나요?

**답변:**

| 직접 연동 | n8n 경유 |
| --- | --- |
| NestJS에 Slack SDK·토큰·채널 ID 관리 필요 | 백엔드는 “이벤트 발생”만 알림 |
| 메시지 문구 변경 시 백엔드 배포 | n8n UI에서 템플릿 수정 가능 |
| Slack 장애가 API 응답에 영향 가능 | fire-and-forget으로 API와 분리 |

요구사항에 **“자동화 도구(n8n)를 통한 Slack 연동”**이 포함되어 있고, 운영 담당자가 코드 없이 알림 흐름을 바꿀 수 있게 하기 위함입니다.

---

### Q1-3. 왜 PostgreSQL 하나로 사용자·퀘스트·BLOB을 모두 저장하나요?

**답변:** MVP 규모(단일 회사·수십~수백 건 퀘스트)에서는 **운영 단순성**이 최우선입니다. Postgres는 `bytea`로 증빙 BLOB을 지원하고, Prisma로 `Bytes` 필드에 바이너리를 **선언·마이그레이션·타입 안전**하게 다룰 수 있으며, Docker Compose 한 컨테이너로 기동할 수 있습니다.

**면접·리뷰 시 주의:** “Prisma와 궁합이 좋다”는 **개발 생산성·스키마 일관성**을 말하는 것이지, 대용량 바이너리 **스트리밍·처리량**까지 보장한다는 뜻은 아닙니다. Prisma는 BLOB을 주로 **전체 버퍼**로 읽고 씁니다. 동시 다건 업로드 시 Multer `memoryStorage`와 겹치면 Node.js 힙에 파일 크기만큼 메모리가 쌓이고, DB 반영 과정에서 **추가 복사·GC 부담**이 생길 수 있습니다. 이 조합은 MVP 이후 **가장 먼저 S3(또는 MinIO) + presigned URL**로 바꿔야 할 병목으로 인지하고 있습니다.

---

### Q1-4. 왜 Docker Compose로 전체 스택을 묶었나요?

**답변:** 팀원·평가자가 `docker compose up` 한 번으로 **동일한 환경**(DB, API, UI, n8n)을 재현할 수 있어야 했기 때문입니다. 학습/데모 프로젝트에서 “내 PC에서는 되는데…”를 줄이는 것이 목표입니다.

---

## 2. 기술 스택 선택

### Q2-1. 왜 NestJS인가요? Express만 쓰면 안 되나요?

**답변:** NestJS는 **모듈·DI·가드·파이프** 구조가 정해져 있어, 인증/역할 검사/DTO 검증을 일관되게 붙이기 쉽습니다. `class-validator`와 `ValidationPipe`로 요구사항의 “제목/마감 유효성 검사”를 선언적으로 처리할 수 있습니다. Express 단독도 가능하지만, 팀 규모가 커질수록 구조가 흩어지기 쉽습니다.

---

### Q2-2. 왜 Prisma인가요? TypeORM은요?

**답변:** 스키마가 `schema.prisma` 한곳에 모이고, 마이그레이션이 `prisma migrate`로 관리됩니다. 타입 안전한 클라이언트 생성, `select`로 **BLOB 제외 조회** 같은 최적화를 코드에서 명확히 표현할 수 있습니다. 기존 설계 문서에 TypeORM `QuestEntity` 언급이 있어 Prisma 모델 주석에 “대응” 관계를 남겼습니다.

바이너리 **저장 위치**는 Postgres BLOB이고, Prisma의 역할은 그 위에 **안전한 접근 계층**을 두는 것입니다. 대용량·고동시 업로드 성능은 Q6-4·Q14-1의 스토리지 분리로 해결하는 설계입니다.

---

### Q2-3. 왜 React + Vite인가요? Next.js는요?

**답변:** 화면은 **로그인 후 SPA 대시보드** 수준이며 SEO·SSR이 필요 없습니다. Vite는 빌드·HMR이 빠르고 설정이 단순합니다. Next.js는 라우팅·서버 컴포넌트 이점이 있지만, 이 프로젝트 범위에서는 오버엔지니어링입니다.

---

### Q2-4. 왜 상태 관리에 Zustand인가요? Redux는요?

**답변:** 퀘스트 목록·통계·로그인 정도의 **전역 상태**만 필요합니다. Zustand는 보일러플레이트가 적고, `create` 한 번으로 store를 정의할 수 있어 MVP에 맞습니다. Redux Toolkit도 가능하지만 action/reducer/slice 구조는 이 규모에 과합니다.

---

### Q2-5. 왜 axios인가요? fetch는요?

**답변:** **인터셉터**로 JWT 자동 첨부, 401 시 로그아웃·리다이렉트를 한곳에서 처리합니다. `multipart/form-data` 증빙 업로드, `blob` 다운로드 응답 타입도 설정이 익숙합니다. 네이티브 `fetch`로도 동일 구현이 가능합니다.

---

## 3. 인증·인가

### Q3-1. 왜 JWT(Access Token) 방식인가요? 세션 쿠키는요?

**답변:** SPA가 백엔드와 **분리된 origin**(또는 Nginx 프록시)에서 동작할 때, Bearer 토큰은 구현이 단순합니다. 서버에 세션 저장소(Redis 등)를 두지 않아도 되어 MVP 인프라가 가벼워집니다. 단점은 토큰 탈취 시 무효화가 어렵다는 점이며, 운영에서는 짧은 만료(`JWT_EXPIRES_IN`)·HTTPS·idle logout으로 보완합니다.

---

### Q3-2. JWT payload에 무엇을 넣었고, 왜 그렇게 했나요?

**답변:** `sub`(user id), `email`, `role`, `companyCode`, `slackMemberId`를 포함합니다.

- **`companyCode`**: 모든 퀘스트 쿼리에 테넌트 필터로 사용
- **`slackMemberId`**: 사원이 “본인 담당 퀘스트”인지 `assigneeId`와 비교
- **`role`**: admin 전용 API 가드

매 요청마다 DB에서 사용자를 다시 조회하지 않고 권한 판단을 할 수 있습니다. 민감 정보(비밀번호 해시)는 절대 넣지 않습니다.

---

### Q3-3. 왜 회원가입 API에서 role을 클라이언트가내나요? 보안 문제 아닌가요?

**답변:** 데모·평가 환경에서 **시드 스크립트나 DB 직접 조작 없이**, 평가자가 회원가입 화면 하나로 관리자·사원 역할을 각각 만들어 **두 플로우를 연속 검증**할 수 있도록 `SignUpDto`에 `admin` | `employee`를 허용했습니다. 기획·UX 관점의 **의도적 타협**이며, 프로덕션에서는 반드시 잠급니다.

실서비스 전환 시: (1) 최초 admin만 시드/초대 코드, (2) 공개 signup은 `employee` 고정, (3) admin 승급은 별도 API·감사 로그.

---

### Q3-4. 왜 JwtAuthGuard를 컨트롤러 클래스에 걸고, 일부만 AdminRoleGuard를 추가했나요?

**답변:** NestJS 관례대로 **기본은 인증 필요**, 예외만 공개 엔드포인트로 분리합니다. `QuestController`는 전부 JWT, `QuestProofShareController`는 JWT 없이 토큰 쿼리만 검증합니다. admin API는 `@UseGuards(AdminRoleGuard)`를 메서드 단위로 붙여 **최소 권한**을 표현합니다.

---

### Q3-5. 왜 프론트에 RoleRoute로 /admin, /employee를 나눴나요?

**답변:** URL 단계에서 잘못된 역할 접근을 막습니다(사원이 `/admin` URL 입력 등). 백엔드가 최종 방어선이지만, UX상 허용되지 않은 화면을 보여주지 않는 것이 좋습니다. 역할에 맞는 홈으로 `Navigate` 리다이렉트합니다.

---

### Q3-6. 왜 무활동 시 자동 로그아웃(useIdleLogout)을 넣었나요?

**답변:** 공용 PC·사무실 환경에서 토큰이 `localStorage`에 남는 위험을 줄입니다. `mousemove`, `keydown` 등으로 활동을 감지하고, `VITE_IDLE_TIMEOUT_MS`(기본 30분) 후 `logout`합니다. 보안 요구가 있는 온보딩 도구 특성상 방어적 UX입니다.

---

### Q3-7. 왜 비밀번호에 bcrypt를 썼나요?

**답변:** 업계 표준적인 단방향 해시입니다. cost factor 10은 MVP에서 속도·안전성 균형점입니다. 평문·MD5·단순 SHA 저장은 절대 사용하지 않습니다.

---

## 4. 멀티 테넌시(회사코드)

### Q4-1. 왜 `companyCode`로 회사를 구분하나요? org_id, tenant_id는요?

**답변:** 요구사항·도메인 언어가 **“회사코드”**였고, 문자열 하나로 테넌트를 표현하기에 충분합니다. 이름은 달라도 역할은 동일합니다(논리적 격리 키).

---

### Q4-2. 왜 (email, companyCode), (slackMemberId, companyCode) 복합 유니크인가요?

**답변:**

- 같은 회사 안에서 이메일·Slack ID 중복 가입 방지
- **다른 회사**는 동일 이메일을 쓸 수 있게 함(데모·교육 환경에서 여러 팀이 같은 DB 사용)

글로벌 이메일 유니크만 두면 멀티 회사 시나리오가 막힙니다.

---

### Q4-3. 퀘스트 조회 시 왜 항상 companyCode를 필터하나요?

**답변:** **테넌트 데이터 유출 방지**입니다. admin도 자신의 `companyCode` 퀘스트만 보고, employee는 `companyCode` + `assigneeId === slackMemberId`로 이중 제한합니다. `assertQuestAccess` 헬퍼로 상세·증빙 다운로드에도 동일 규칙을 적용합니다.

---

## 5. 퀘스트 도메인

### Q5-1. 왜 퀘스트 ID를 UUID가 아니라 8자 nanoid인가요?

**답변:** 설계명세서에 **8자리 문자열 ID**가 명시되어 있습니다. `nanoid` custom alphabet으로 URL-safe 62^8 조합을 쓰며, Slack·UI에 짧게 노출하기 좋습니다. 충돌 확률은 규모상 무시 가능하고, DB PK 충돌 시 재시도 로직을 추가할 수 있습니다.

---

### Q5-2. 왜 상태를 enum 문자열이 아니라 숫자(0~3)로 DB에 저장하나요?

**답변:** 설계명세서·기존 ER 다이어그램이 **SmallInt 상태 코드**를 사용합니다. 저장 공간·인덱스 측면에서 소형 정수가 유리하고, API·프론트에서는 `QuestStatus` enum으로 라벨·색상을 매핑합니다.

---

### Q5-2a. 상태 코드 `1`의 이름이 `IN_PROGRESS`(진행중)인데, 실제로는 “검토 대기” 아닌가요? (용어 일관성)

**답변:** 지적이 타당합니다. **도메인 관점**에서 상태 `1`은 “사원이 업무를 수행 중”이 아니라 **“증빙을 제출했고 관리자 승인을 기다리는 상태”**에 가깝습니다. 이상적인 명명은 `SUBMITTED` / `REVIEW_PENDING` 등입니다.

| 코드 | DB/API enum | 설계 명세·코드 | UI·문서 표기 (현재) | 실제 의미 |
| --- | --- | --- | --- | --- |
| 0 | `PENDING` | 대기 | 대기 | 배정만 됨, 증빙 없음 |
| 1 | `IN_PROGRESS` | 진행중(명세 잔존) | **검토 대기** | 증빙 제출됨, 관리자 검토 전 |
| 2 | `COMPLETED` | 완료 | 완료 | 승인됨 |
| 3 | `REJECTED` | 반려 | 반려 | 보완 요청 |

**왜 enum 이름은 안 바꿨나:** 설계 명세·기존 마이그레이션·통계 필드명(`inProgress`)과의 **하위 호환**을 위해 DB 정수 `1`과 TypeScript `IN_PROGRESS`는 유지했습니다. 대신 **사용자에게 보이는 라벨**(`QUEST_STATUS_LABEL`, 통계 카드, README)은 `검토 대기`로 통일했습니다.

**향후:** 명세 개정이 가능하면 enum·API를 `SUBMITTED`로 리네이밍하고, “착수만 한 상태”가 필요할 때 별도 `IN_PROGRESS`를 새로 두는 편이 도메인 모델이 깔끔합니다.

---

### Q5-3. 왜 “대기 → (검토 대기)” 전환이 증빙 업로드 시점인가요? 사원이 “수락” 버튼을 두지 않은 이유는?

**답변:** MVP 플로우를 **“증빙 제출 = 관리자에게 검토 요청”**으로 단순화했습니다. 별도 수락 단계가 없으면 UI·API·Slack 이벤트가 줄어듭니다.

- 상태 `0`(대기): 퀘스트만 배정된 상태  
- 상태 `1`(검토 대기): 증빙 업로드 직후 — 관리자 대시보드의 “검토 대기” 섹션과 동일한 의미  

“배정만 받고 아직 작업 중”과 “제출 완료·검토 대기”를 나누려면 `ACCEPTED` / `IN_PROGRESS` / `SUBMITTED`처럼 **상태를 한 단계 더 쪼개는** v2 모델이 필요합니다.

---

### Q5-4. 왜 완료(2)와 반려(3)만 검토 API에서 허용하나요?

**답변:** 검토는 **종결 판단**만 의미합니다. 다시 대기·검토 대기로 임의 롤백하면 통계·알림·감사 추적이 복잡해집니다. 반려 후 재제출은 `uploadProof`로 다시 상태 `1`(검토 대기)이 됩니다.

---

### Q5-5. 왜 반려 시 프론트에서 피드백 필수인가요?

**답변:** 반려는 “무엇을 고쳐야 하는지” 전달이 목적입니다. 빈 반려는 사원 입장에서 재작업 기준이 없어 UX가 나쁩니다. 백엔드 DTO는 optional이지만 프론트에서 1차 검증합니다(엄격히 하려면 DTO에도 조건부 검증 추가 가능).

---

### Q5-6. 왜 assigneeId에 User FK가 아니라 Slack 멤버 ID 문자열인가요?

**답변:**

1. Slack 알림에서 `<@U123…>` 멘션에 **바로 사용**
2. User 테이블과 느슨한 결합 — Slack ID만 알면 퀘스트 배정 가능
3. 가입 전 사원에게 퀘스트를 “예약”하는 시나리오도 이론상 가능(현재는 assignable-employees로 가입된 사원만 선택)

`listAssignableEmployees`로 발행 시 유효한 사원만 고르게 해 데이터 정합성을 맞춥니다.

---

### Q5-7. 왜 publisherSlackMemberId를 퀘스트에 저장하나요?

**답변:** 증빙 제출 Slack 메시지에서 **발행 관리자를 멘션**하기 위함입니다. 제출 시점의 발행자를 고정해 두면, 나중에 관리자 계정이 바뀌어도 “누구에게 알림이 갔는지” 추적이 됩니다.

---

### Q5-8. 왜 submissionNote(추가 설명)를 별도 필드로 두었나요?

**답변:** 증빙 **파일**과 **텍스트 설명**은 성격이 다릅니다. 파일은 BLOB, 설명은 Text로 저장·검색·Slack 메시지에 붙이기 쉽습니다. 선택 입력(optional)으로 사진만 올리는 경우도 허용합니다. 최대 5,000자는 description과 동일 상한으로 맞췄습니다.

---

### Q5-9. 왜 관리자 대시보드에서 “검토 대기”와 “그 외” 퀘스트를 나눠 보여주나요?

**답변:** admin의 핵심 작업은 **증빙이 올라왔으나 아직 완료되지 않은 퀘스트 검토**입니다. `proofFileName` 존재 + `status !== COMPLETED`로 필터해 우선순위를 시각화합니다.

이 UI 섹션 제목(`검토 대기`)과 상태 라벨(`검토 대기`)을 맞춰, 예전 enum 명칭 `진행중`과 화면 용어가 어긋나지 않게 했습니다. 필터는 “상태=1만”이 아니라 **반려 후 재제출** 등 증빙은 있으나 완료 전인 모든 건을 포함합니다.

---

### Q5-10. 왜 담당자별 통계에 “퀘스트가 한 번도 없는 사원”은 빼나요?

**답변:** `groupBy assigneeId`는 **배정 이력이 있는 사람**만 집계합니다. “아직 퀘스트 없는 사원”까지 넣으려면 전체 employee 목록과 outer join이 필요해 MVP 범위를 넘습니다.

---

## 6. 증빙 파일 저장

### Q6-1. 왜 증빙을 S3가 아니라 PostgreSQL BLOB(bytea)에 저장하나요?

**답변:**

| BLOB (현재) | S3 |
| --- | --- |
| Compose만으로 완결 | 버킷·IAM·presigned URL 추가 |
| 트랜잭션으로 메타+파일 일관성 | 업로드 실패 시 고아 객체 관리 |
| 소규모·건당 10MB 제한에 적합 | 대용량·다건에 유리 |

요구사항이 “MVP + Docker 단일 스택”이므로 BLOB을 선택했습니다.

---

### Q6-2. 왜 목록 API에서 proofData를 select에서 제외하나요?

**답변:** BLOB을 목록마다 읽으면 **네트워크·메모리·DB I/O**가 폭증합니다. 목록에는 `proofFileName`, `hasProof` 수준만 필요하고, 바이너리는 `GET /quests/:id/proof`에서만 로드합니다.

---

### Q6-3. 왜 업로드 크기 제한이 10MB인가요?

**답변:** 온보딩 증빙(스크린샷, 짧은 PDF) 기준의 합리적 상한입니다. Nginx `client_max_body_size 12m`과 맞춰 여유를 두었습니다. 대용량은 스토리지 아키텍처 변경 신호로 봅니다.

---

### Q6-4. 왜 Multer memoryStorage(버퍼)로 올리나요?

**답변:** 파일을 디스크에 쓰지 않고 곧바로 DB `Bytes`에 넣기 위함입니다. 컨테이너 ephemeral disk 관리가 필요 없습니다.

**잠재 리스크 (면접 방어용):** `memoryStorage`는 업로드 파일 전체가 **Node.js 힙**에 올라갑니다. 건당 최대 10MB × 동시 N건이면 수백 MB가 순간적으로 점유될 수 있고, Prisma가 DB로 넘기는 과정에서 **버퍼 복사**가 한 번 더 일어날 수 있습니다. 그 결과 GC 스트레스·OOM 위험이 있습니다.

**인지한 한계:** 이 경로는 MVP 데모용이며, 트래픽이 늘면 (1) `diskStorage` + 스트림 업로드, (2) S3 presigned PUT, (3) API와 파일 저장 워커 분리 순으로 **반드시** 바꿔야 합니다. Q1-3·Q14-1과 동일한 진화 축입니다.

---

### Q6-5. 왜 검토 대기(상태 1) 중에도 파일을 다시 제출할 수 있게 했나요?

**답변:** 관리자 검토 전 **오업로드 수정**을 허용합니다. 반려(`REJECTED`) 후에도 재제출 플로우가 있습니다. 완료(`COMPLETED`) 후에는 `BadRequestException`으로 막습니다.

---

## 7. Slack · n8n 연동

### Q7-1. 왜 웹훅 본문에 HMAC 서명을 넣나요?

**답변:** n8n Webhook URL이 노출되면 **임의인이 가짜 이벤트**를 보낼 수 있습니다. `N8N_WEBHOOK_SECRET`으로 서명하지 않은 요청은 Code 노드에서 거부합니다. Nest ↔ n8n **양쪽만 아는 비밀키** 모델입니다.

---

### Q7-2. 왜 JSON.stringify가 아니라 stableStringify(키 정렬)인가요?

**답변:** JavaScript 객체 키 순서에 따라 서명이 달라지면 **검증 실패**가 납니다. 키를 정렬한 뒤 직렬화해 Nest와 n8n이 **동일 바이트열**로 HMAC을 계산합니다.

---

### Q7-3. 왜 X-OnQuest-Timestamp와 ±5분 윈도우를 쓰나요?

**답변:** 서명이 유출되어도 **오래된 요청 재전송(replay)** 으로 Slack 스팸을 보내는 것을 줄입니다. n8n Verify HMAC 노드에서 `driftMs > 5 * 60 * 1000`이면 거부합니다.

---

### Q7-4. 왜 웹훅 호출을 fire-and-forget으로 했나요? 실패하면요?

**답변:** 요구사항에 **“Slack 3초 이내”**가 있지만, 사용자 API 응답은 **DB 저장 성공**이 우선입니다. `axios.post().catch(log)`로 n8n 장애가 퀘스트 생성/제출 실패로 이어지지 않게 했습니다. 알림 유실은 로그 모니터링·재시도로 보완하는 **at-least-once vs 사용자 경험** 트레이드오프입니다.

**추가 리스크:** Node.js 이벤트 루프 특성상, `res.send()`로 HTTP 응답을 마친 **직후** 프로세스가 재시작되거나(OOM, `docker compose restart`, 배포 롤링) 극단적 부하로 이벤트 루프가 정리되면, 아직 큐에만 올라간 Axios 요청이 **전송되지 않고 소멸**할 수 있습니다. “실패 시 catch로 로그”와는 별개의 실패 모드입니다.

**고도화 우선순위:** (1) **Outbox 패턴** — DB 트랜잭션 안에 `notification_events` 행을 같이 쓰고, 별도 워커가 n8n을 재시도, (2) Nest `EventEmitter` + 내부 큐로 최소한 요청 생명주기와 분리, (3) 메시지 브로커(Redis/SQS). MVP 이후 Slack 신뢰성을 올릴 때 Outbox를 1순위로 둡니다(Q14-2).

---

### Q7-5. 왜 웹훅 타임아웃이 2.5초인가요?

**답변:** SLA 3초보다 짧게 잡아 **hang 연결**이 쌓이지 않게 합니다. 실패 시 빨리 끊고 로그만 남깁니다.

---

### Q7-6. 왜 이벤트 타입을 quest.created / quest.proof_uploaded / quest.reviewed 세 가지로 나눴나요?

**답변:** n8n Switch 노드에서 **메시지 템플릿 분기**가 명확해집니다. 하나의 event에 `type` 필드만 바꾸는 것도 가능하지만, 워크플로 시각화·유지보수에서 분리 이벤트가 읽기 쉽습니다.

---

### Q7-7. 왜 deadline은 ISO와 deadlineDisplay를 둘 다내나요?

**답변:**

- **`deadline` (ISO)**: 기계 처리·로그·향후 다른 소비자용
- **`deadlineDisplay`**: Slack 메시지에 **분 단위 한국어 표기**를 바로 넣기 위함

n8n 표현식만으로 타임존 포맷을 맞추면 Nest·프론트와 **표시 불일치**가 생기기 쉽습니다.

---

### Q7-8. 왜 Slack 메시지에 submissionNote를 “있을 때만” 붙이나요?

**답변:** 선택 필드이므로 빈 줄 `• 추가 설명: (없음)`은 노이즈입니다. n8n 템플릿에서 삼항 연산자로 조건부 렌더링합니다.

---

### Q7-9. 왜 n8n 워크플로를 JSON 템플릿 파일로 repo에 포함했나요?

**답변:** **재현 가능한 인프라**입니다. UI에서만 만들면 팀원마다 다른 워크플로가 됩니다. Import 후 Slack Credential·채널만 바꾸면 됩니다.

---

### Q7-10. 왜 docker-compose에 NODE_FUNCTION_ALLOW_BUILTIN=crypto 등을 넣었나요?

**답변:** n8n 2.x 기본 샌드박스는 Code 노드에서 `require('crypto')`와 `$env` 접근을 막습니다. HMAC 검증 없이는 웹훅이 **누구나 호출 가능**해지므로, self-hosted 데모에서만 이 완화 설정을 켰고 README에 보안 주의를 적었습니다.

**보안 범위:** `NODE_FUNCTION_ALLOW_BUILTIN=crypto`는 **n8n 컨테이너 전역**에 영향을 줍니다. n8n UI(Basic Auth)가 뚫리면 악의적 Code 노드로 시크릿·내부망을 노출할 **공격 면적**이 넓어집니다.

**전제·프로덕션 대안:** 현재는 Compose **내부 브리지 네트워크**(`onquest-net`)에만 n8n을 두고, 호스트에 5678을 노출하더라도 강한 Basic Auth·시크릿 교체를 전제로 합니다. 프로덕션에서는 (1) n8n을 외부에 공개하지 않거나 IP 제한, (2) HMAC 검증을 **커스텀 n8n 노드** 또는 사이드카 마이크로서비스로 분리, (3) `$env` 대신 n8n Credential Store로 시크릿 주입을 검토합니다.

---

## 8. 증빙 공유 링크

### Q8-1. 왜 Slack에서 증빙을 보려면 JWT 없는 URL이 필요한가요?

**답변:** Slack 클라이언트·브라우저는 On-Quest **로그인 세션을 갖지 않습니다**. 파일명 텍스트만으로는 확인이 불가능하므로, 제출 시점에 **서명된 공유 URL**을 생성해 메시지에 넣습니다.

---

### Q8-2. 왜 공유 API를 QuestController가 아니라 별도 컨트롤러로 분리했나요?

**답변:** `QuestController`는 클래스 레벨 `@UseGuards(JwtAuthGuard)`입니다. 공개 엔드포인트만 **물리적으로 분리**하면 실수로 가드가 붙는 일을 방지합니다. 의도가 코드 구조에서 드러납니다.

---

### Q8-3. 왜 JWT 대신 HMAC 서명 토큰(쿼리 param)을 썼나요?

**답변:**

| JWT URL | HMAC 토큰 (현재) |
| --- | --- |
| 길이가 김 | 짧은 URL |
| revoke/블랙리스트 설계 필요 | TTL(`exp`)로 자동 만료 |
| Slack 링크에 적합하나 설정 무거움 | 구현 단순, 목적(읽기 전용 1건)에 부합 |

**읽기 전용·단기·특정 questId** 바인딩이 목적이라 커스텀 토큰이면 충분합니다.

---

### Q8-4. 토큰에 questId를 넣고 URL path의 id와도 비교하는 이유는?

**답변:** URL이 `.../quests/ABC/proof/share?token=(다른 퀘스트용 토큰)`으로 **조작**되는 경우를 막습니다. 페이로드 `q`와 path `:id`가 일치해야 합니다.

---

### Q8-5. 왜 timingSafeEqual로 서명을 비교하나요?

**답변:** 일반 `===` 비교는 타이밍 공격에 취약할 수 있습니다. HMAC hex 비교는 `crypto.timingSafeEqual`로 처리합니다.

---

### Q8-6. 왜 이미지는 inline, 그 외는 attachment Content-Disposition인가요?

**답변:** Slack·브라우저에서 **이미지 미리보기**가 가능해집니다. PDF·ZIP 등은 다운로드가 자연스럽습니다. MIME `image/*` prefix로 분기합니다.

---

### Q8-7. 왜 API_PUBLIC_URL 환경 변수가 별도인가요?

**답변:** Docker 내부 `N8N_WEBHOOK_URL`은 `http://n8n:5678`이지만, **Slack 사용자 브라우저**가 열 링크는 호스트/공인 도메인이어야 합니다. 백엔드가 스스로 “외부에서 보이는 URL”을 알 수 없어 명시 설정합니다.

---

### Q8-8. 왜 PROOF_SHARE_SECRET을 N8N_WEBHOOK_SECRET과 분리할 수 있게 했나요?

**답변:** 웹훅 시크릿이 n8n·로그에 더 자주 노출될 수 있어, **증빙 URL 위변조**용 키를 분리하면 blast radius가 줄어듭니다. 비우면 fallback으로 웹훅 시크릿을 씁니다(MVP 편의).

---

### Q8-9. 왜 공유 링크 TTL 기본이 7일인가요?

**답변:** 온보딩 검토 주기 안에 Slack에서 다시 열어볼 수 있게 하면서, 무기한 공개 URL을 피합니다. `PROOF_SHARE_TTL_SECONDS`로 조정 가능합니다.

---

### Q8-10. 제출 이전 퀘스트는 Slack에 proofUrl이 없는 이유는?

**답변:** 토큰은 **uploadProof 성공 시** 생성됩니다. 과거 데이터에 소급 적용하려면 배치로 URL 재발급 job이 필요합니다(미구현).

---

## 9. 날짜·시간 표시

### Q9-1. DB에는 timestamptz 전체 정밀도인데 UI/Slack은 왜 분까지만?

**답변:**

- **저장**: 마감 비교·정렬·타임존 변환에 초·밀리초가 필요
- **표시**: 사용자 UX상 “15:30” 수준이면 충분하고, `…00.000Z`는 노이즈

`formatDateTimeToMinute` / `deadlineDisplay`로 **표시 계층만** 자릅니다.

---

### Q9-2. 왜 timeZone을 Asia/Seoul(또는 TZ env)로 고정했나요?

**답변:** 한국어 로케일(`ko-KR`) 사용자·운영팀 기준입니다. 글로벌 서비스라면 사용자별 타임존 설정이 필요합니다.

---

### Q9-3. API 응답 deadline은 여전히 ISO인 이유는?

**답변:** 프론트가 `new Date(iso)`로 파싱·비교(기한 경과 등)하기 쉽습니다. 표시만 `formatDateTimeToMinute`로 변환합니다. API에 `deadlineDisplay`를 중복 필드로 넣지 않은 것은 **단일 진실 공급원(ISO)** 유지와 페이로드 최소화입니다.

---

## 10. 프론트엔드

### Q10-1. 왜 관리자/사원 페이지를 완전 분리(AdminDashboard / EmployeeDashboard)했나요?

**답변:** 역할별 **기능 집합이 다릅니다**(발행·검토 vs 제출). 하나의 대시보드에 `if (role)`을 많이 넣으면 유지보수가 어렵습니다.

---

### Q10-2. 왜 퀘스트 상태를 서버 숫자 그대로 쓰고 라벨·색상만 매핑하나요?

**답변:** API와 타입이 일치합니다. `QUEST_STATUS_LABEL`, `QUEST_STATUS_COLOR`를 한곳(`types/quest.ts`)에 두어 UI 일관성을 유지합니다.

---

### Q10-3. 왜 증빙 파일 input을 hidden + 버튼으로 트리거하나요?

**답변:** 커스텀 UI(선택된 파일명 표시, 제출 버튼 분리)를 위함입니다. 네이티브 file input 스타일링 한계를 피합니다.

---

### Q10-4. 왜 제출 전 confirm 창을 띄우나요?

**답변:** 파일·설명 제출은 **되돌리기 어렵고** 관리자에게 Slack이 갑니다. 실수 업로드 방지용 확인입니다.

---

### Q10-5. 왜 localStorage에 토큰과 user를 저장하나요?

**답변:** 새로고침 후에도 로그인 유지(hydrate). httpOnly 쿠키가 더 안전하지만, SPA + 별도 API 도메인 MVP에서는 Bearer + localStorage가 구현이 빠릅니다.

---

### Q10-6. 401 인터셉터에서 window.location.href로 로그인 보내는 이유는?

**답변:** axios 레이어는 React Router 밖입니다. `Navigate` 대신 전역 리다이렉트로 **만료 토큰 상태를 확실히 정리**합니다.

---

## 11. API·백엔드 구조

### Q11-1. 왜 글로벌 prefix가 /api인가요?

**답변:** Nginx에서 `/api/` → backend 프록시, `/` → SPA 정적 파일로 **한 origin** 서비스하기 위함입니다. 운영에서 경로 기반 라우팅이 단순해집니다.

---

### Q11-2. 왜 ValidationPipe에 whitelist, forbidNonWhitelisted를 켰나요?

**답변:** DTO에 없는 필드 주입을 막아 **질량 할당(mass assignment)** 위험을 줄입니다. API 계약이 명확해집니다.

---

### Q11-3. 왜 QuestService에서 Prisma select를 questListSelect로 모았나요?

**답변:** 목록·상세·업데이트 응답 필드를 **한곳에서 관리**하고, 실수로 `proofData`를 포함하지 않게 합니다.

---

### Q11-4. 왜 toSummary()로 hasProof를 계산해 내려주나요?

**답변:** 클라이언트가 `proofFileName` null 체크를 반복하지 않게 합니다. BLOB 존재 여부의 파사드입니다.

---

### Q11-5. 왜 review 시 reviewerId를 optional로 받나요?

**답변:** JWT `sub`로 서버가 reviewer를 정할 수도 있지만, DTO에 optional로 열어 **Slack reviewer ID** 등 외부 식별자와 맞출 여지를 남겼습니다. 미전달 시 null 유지.

---

## 12. Docker · 인프라

### Q12-1. 왜 backend 이미지가 Alpine이 아니라 bookworm-slim인가요?

**답변:** Dockerfile 주석대로 Prisma 엔진이 Alpine(musl)에서 OpenSSL 이슈가 잦아 **Debian glibc** 기반을 선택했습니다. 안정적 migrate/runtime이 우선입니다.

---

### Q12-2. 왜 CMD에서 prisma migrate deploy 후 서버를 띄우나요?

**답변:** 컨테이너 기동 시 **스키마 자동 적용**으로 “DB 마이그레이션 안 함” 오류를 줄입니다. 프로덕션 대규모에서는 별도 migration job이 더 안전할 수 있습니다.

---

### Q12-3. 왜 frontend 빌드 시 VITE_API_BASE_URL을 비울 수 있게 했나요?

**답변:** Compose 환경에서는 **상대 경로 `/api`** 로 같은 호스트(8080)에 요청 → Nginx 프록시. 로컬 Vite dev만 `http://localhost:3000`을 씁니다.

---

### Q12-4. 왜 n8n과 backend를 같은 Docker network에 두었나요?

**답변:** `N8N_WEBHOOK_URL=http://n8n:5678/webhook/onquest`로 **내부 DNS** 호출이 가능합니다. 호스트 localhost를 쓰면 컨테이너마다 의미가 달라집니다.

---

## 13. 보안

### Q13-1. 이 프로젝트에서 가장 취약한 MVP 타협은 무엇인가요?

**답변 (솔직한 목록):**

1. 회원가입 시 클라이언트가 `admin` role 지정 가능 (데모·평가 편의용, Q3-3)  
2. 증빙 공유 URL — 토큰을 아는 사람은 JWT 없이 파일 조회 가능  
3. localStorage JWT — XSS 시 탈취 위험  
4. n8n env 접근 완화 (`N8N_BLOCK_ENV_ACCESS_IN_NODE=false`)  
5. 기본 시크릿 값이 repo example에 존재 — **배포 전 반드시 교체**

---

### Q13-2. 그럼에도 데모/MVP로 괜찮은 방어는?

**답변:** bcrypt, JWT 만료, 회사코드 격리, HMAC 웹훅, replay window, admin guard, 증빙 토큰 TTL·서명, CORS, 업로드 크기 제한, idle logout 등 **다층 방어의 뼈대**는 갖춰져 있습니다.

---

## 14. 성능·확장성 한계와 향후 방향

### Q14-1. BLOB이 느려지면 어떻게 하나요?

**답변:** 메타는 Postgres, 파일은 S3/MinIO, 업로드는 presigned URL, Slack 링크는 presigned GET으로 전환합니다. 목록 API 설계(`proofData` 제외)는 그대로 유용합니다.

---

### Q14-2. Slack 알림 유실을 줄이려면?

**답변:** **Outbox 패턴**을 1순위로 권장합니다. 퀘스트 저장과 같은 DB 트랜잭션에 `outbox_events` 행을 insert하고, 별도 워커가 n8n을 **재시도·멱등 처리**합니다. fire-and-forget의 “응답 후 소멸”·“n8n 일시 장애”를 모두 완화합니다. 그다음 단계로 Redis/SQS 등 메시지 브로커를 둘 수 있습니다. 현재 MVP는 로그만 남깁니다(Q7-4).

---

### Q14-3. 퀘스트 ID 8자 충돌이 걱정되면?

**답변:** `create` 시 unique violation catch 후 재생성, 또는 길이 확장.

---

### Q14-4. 실시간 UI 갱신이 필요하면?

**답변:** 폴링 대신 WebSocket/SSE, 또는 Slack만 보고 UI는 수동 새로고침(현재). MVP는 fetch on mount + 액션 후 `fetchStats` 정도입니다.

---

## 부록: 한 줄 요약 표

| 영역 | 한 줄 요약 |
| --- | --- |
| 아키텍처 | SPA + REST API + n8n + Slack, MVP 단순 스택 |
| 테넌트 | `companyCode`로 데이터 격리 |
| 퀘스트 ID | 설계서 준수 8자 nanoid |
| 상태 | 0~3 정수; `1`=검토 대기(UI), enum명 `IN_PROGRESS` |
| 증빙 | Postgres BLOB + memoryStorage; 목록에서 BLOB 제외, S3가 1차 진화 |
| Slack | HMAC 웹훅, fire-and-forget(Outbox 권장), 3종 이벤트 |
| 증빙 링크 | JWT 없는 HMAC URL, Slack 클릭용 |
| 시간 | DB ISO, 표시는 분 단위 |
| 인증 | JWT + role guard + idle logout |
| 인프라 | Docker Compose, Nginx /api 프록시 |

---

*문서 버전: 피드백 2차 반영 — 상태 라벨 `검토 대기`, BLOB 메모리 리스크, fire-and-forget·n8n 보안 보완.*
