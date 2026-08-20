# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## AGENTS.md 우선

`AGENTS.md`가 이 저장소의 기준 문서입니다. 폴더 책임, 의존성 방향, 네이밍, 커밋/브랜치 규칙, 검증 절차, 포트폴리오 문서 갱신 규칙은 그 문서를 따릅니다. 이 문서는 여러 파일을 읽어야만 파악되는 아키텍처 흐름만 보충합니다.

## 저장소 밖 문서 (Obsidian vault)

기획·설계·이식 현황 문서는 `/Users/jinha/trego_docs` (Obsidian vault, 평문 Markdown)에 있습니다. 참고 자료이며 저장소로 복사하거나 커밋하지 않습니다.

현재 구현 범위를 판단할 때는 코드와 `SignalR 이식 현황.md`를 우선 근거로 삼습니다. `frontend-migration-plan.md`와 `planner 이식 현황.md`의 체크박스·비교표는 `main`보다 뒤처져 있습니다.

**기능 이식·조사를 마쳤거나 PR을 `main`에 머지했으면, 사용자에게 결과를 전달하기 전에 `update-portfolio-docs` skill로 vault 문서를 갱신합니다** (`AGENTS.md` §10).

## 서술 대상 구분

README·강조점·평가를 쓸 때 **프론트엔드 전체**를 말하는지 **이식 작업**을 말하는지 먼저 구분합니다 (`AGENTS.md` §9).

- 전체를 말하는 자리: `README.md`, 포트폴리오 소개, 면접 답변 → vault `frontend-strengths.md`가 순위 기준
- 이식을 말하는 자리: PR 설명, 작업 계획, vault의 이식 현황 문서

이식은 작업 방식이지 성과가 아닙니다. `README.md`가 이식을 주제로 자기소개하지 않도록 유지합니다. 요청에서 대상이 분명하지 않으면 확인하고 시작합니다.

## 명령어

```bash
npm run dev                     # 개발 서버
npm run lint                    # ESLint
npm run format:check            # Prettier 검사
npm test                        # Vitest 1회 실행
npm run build                   # tsc -b + vite build

npx vitest run src/features/planner/dnd/planner-drop-rules.test.ts   # 단일 파일
npx vitest run -t "groups sibling activities"                         # 이름으로 단일 테스트
npm run test:watch                                                   # watch 모드
```

커밋 전 `lint` → `format:check` → `test` → `build` → `git diff --check`를 직접 실행합니다 (pre-commit hook 없음).

## 레이어 구조와 강제 규칙

`src`는 Bulletproof React 스타일이며 ESLint가 실제로 막습니다:

- `import/no-restricted-paths`로 feature 간 직접 import, 공용 레이어(`components`, `config`, `hooks`, `lib`, `stores`, `testing`, `types`, `utils`, `assets`) → `features`/`app` import, `features` → `app` import이 **에러**입니다. 새 feature 폴더를 추가하면 `eslint.config.js`가 `src/features`를 읽어 zone을 자동 생성합니다.
- `check-file`이 `src/**` 파일명·폴더명을 kebab-case로 강제합니다.
- import는 `@/*` alias 사용, `simple-import-sort`로 정렬합니다.
- 각 `src/*/README.md`에 해당 폴더의 책임과 금지사항이 적혀 있습니다. 폴더를 새로 만들면 README도 함께 씁니다.

여러 feature를 조합하는 코드는 반드시 `src/app`에 둡니다. 실제로 planner + chat + collaboration을 묶는 유일한 지점이 `src/app/realtime/project-planner-page.tsx`입니다.

## 실시간 데이터 흐름 (핵심)

하나의 SignalR 연결을 planner·chat·cursor presence가 공유합니다. 계층이 명확히 나뉘어 있으므로 새 실시간 기능을 넣을 때 계층을 섞지 마세요.

1. `lib/signalr-client.ts` — 연결 lifecycle과 `SignalRConnectionStatus`만 담당. Hub 메서드 이름을 모릅니다.
2. `app/realtime/project-realtime-session.ts` — `start() → JoinProject → resync()` 순서를 하나의 in-flight promise로 직렬화하고, `reconnecting → connected` 전이를 감지하면 join+resync를 자동 재실행합니다. React와 무관한 순수 세션 객체(테스트하기 쉬움).
3. `app/realtime/project-realtime-provider.tsx` — 위 세션을 React context로 노출. `projectId`를 `key`로 써서 프로젝트가 바뀌면 인스턴스를 통째로 재생성합니다.
4. feature의 realtime 모듈(`features/planner/realtime`, `features/chat/realtime`, `features/collaboration/realtime`) — Hub 명령/이벤트 계약을 **feature가 소유**합니다. `PlannerHubTransport`처럼 필요한 최소 인터페이스만 받으므로 `SignalRClient`에 직접 의존하지 않습니다.

### Optimistic update 규약

`features/planner/realtime/planner-realtime.ts`의 모든 command는 동일한 패턴입니다:

```
applyOptimistic()  // 요청 payload를 그대로 reducer에 넣어 로컬 반영
→ client.invoke(...)
→ 실패 시 reportError + actions.resync()  // 서버 상태를 canonical로 되돌림
```

이 때문에 `planner-realtime-reducer.ts`는 **idempotent**여야 합니다. 서버가 sender에게도 echo 이벤트를 보내므로 같은 payload가 두 번 적용됩니다. 변화가 없으면 reducer는 기존 배열 참조를 그대로 반환하고, 호출부는 참조 비교로 `setNodes`를 건너뜁니다. 새 이벤트를 추가할 때 이 성질을 깨지 마세요.

서버 계약의 관례:

- `parentPathId`의 루트 표현은 `null`이 아니라 `EMPTY_GUID`입니다. 경계에서 `normalizeParentPathId` / `toHubParentPathId`로 변환합니다.
- 필드명이 서버와 다르거나 오타가 있는 경우(`travelTimeMinuates`, `marker`, `lat`/`lng`)를 `project-hub-planner-contracts.ts`와 request builder에서만 흡수합니다. 도메인 타입(`PlannerNode`)에는 서버 철자를 퍼뜨리지 않습니다.

## Planner 상태 모델

노드는 `folder | day | activity` 판별 union이고, 트리 구조는 `parentPathId` + 소수 `position`(step 0.1)으로 표현합니다. `pathId`가 트리 식별자이고 `id`는 엔터티 ID로 별개입니다.

store 3개가 역할별로 분리되어 있습니다 (`features/planner/stores`):

- `planner-view-store` — 원본 `nodes` + 파생 구조(`tree.entityMap`/`childrenMap`/`flattenedItems`)를 함께 갱신. 선택, 확장, 지도 focus 요청, 모듈 패널 상태 소유. `replaceNodes`는 재조회 시 선택/확장 상태 중 살아남은 것만 유지합니다.
- `planner-map-store` — 지도에서 숨긴 day 집합.
- `planner-history-store` — undo/redo 스택. 항목은 `{ redo, undo }` 커맨드 배열 쌍입니다.

undo/redo는 스냅샷이 아니라 **역커맨드 재생**입니다. `operations/planner-operation-command.ts`가 커맨드 union과 실행기를 정의하고, 삭제처럼 서브트리가 사라지는 작업은 `buildDeleteHistoryOperations`가 깊이순으로 정렬된 재생성 커맨드를 만듭니다. 새 planner 조작을 추가하면 여기에 redo/undo 쌍을 함께 정의하고 `project-planner-page.tsx`의 `runRecordedOperation`으로 실행합니다. 실패하면 히스토리를 통째로 비웁니다(부분 재생 상태를 남기지 않기 위해).

DnD는 `features/planner/dnd`에 규칙(`planner-drop-rules.ts`: 어떤 부모가 어떤 자식을 받는지, cycle/root 방지)과 dnd-kit 어댑터(`use-planner-drag-and-drop.ts`)로 분리되어 있습니다. 드롭 판정 로직은 순수 함수 쪽에 두고 테스트합니다.

## 인증

`app/auth/auth-provider.tsx`가 access token을 `sessionStorage`에 보관하고, 토큰이 주입된 `ApiClient`를 context로 내려줍니다. 401이면 세션을 지웁니다. `lib/api-client.ts`는 feature store를 참조하지 않고 `getAccessToken` 콜백으로 토큰을 공급받습니다 — 이 방향을 유지하세요.

route는 URL 해석과 인증 분기만 하고(`app/routes/*`), 화면 조합은 feature 컴포넌트가 담당합니다.

## 테스트

- 테스트는 대상 파일 옆에 둡니다. 공통 설정은 `src/testing`뿐입니다.
- 컴포넌트 테스트는 `@/testing/test-utils`의 `render`/`userEvent`를 사용하고, 접근성 query(`getByRole`, label, 화면 텍스트)로 검증합니다. UI 문구는 한국어입니다.
- MSW 같은 mock server는 쓰지 않습니다. 대신 **DI**로 대체합니다: `ProjectPlannerPage`는 `clientFactory`와 `restClient` props를 받고, 테스트는 `project-planner-page.test.tsx`처럼 fake `SignalRClient`(상태 전이와 이벤트 emit 가능)와 `vi.fn()` 기반 `ApiClient`를 주입합니다. 실시간 동작을 검증할 때 이 패턴을 재사용하세요.
- Mapbox를 쓰는 `planner-map`은 컴포넌트 테스트에서 `vi.mock`으로 대체합니다(`PlannerWorkspace`에서 lazy import되어 있음).
- store는 모듈 전역이므로 테스트 간 `reset()`/`clear()`가 필요합니다.

## 환경변수

`src/config/env.ts`에서만 `import.meta.env`를 읽고 검증·정규화합니다. `VITE_API_BASE_URL`은 절대 URL, `VITE_SIGNALR_HUB_URL`은 절대 URL 또는 root-relative 경로여야 하며, 비우면 개발 시 Vite proxy(`/api`, `/project` → `http://localhost:3000`)를 씁니다. `VITE_MAPBOX_ACCESS_TOKEN`이 없으면 지도 영역만 안내 문구로 대체되고 나머지 Planner UI는 동작합니다.

## UI

Tailwind v4 + shadcn/ui(Base UI 기반, `components.json`의 style `base-nova`). 열림 상태·포커스·키보드를 다루는 UI(Dialog, Popover, Context Menu, Calendar)는 `src/components/ui`의 shadcn 컴포넌트를 우선 사용합니다. `src/components/ui`는 ESLint 예외 구역이므로 생성된 코드를 그대로 두어도 됩니다.
