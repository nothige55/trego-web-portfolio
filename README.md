# Trego Planner

**여러 사람이 하나의 계층형 여행 일정을 함께 편집하는 웹 에디터입니다.**

일정은 목록이 아니라 `폴더 → 날짜 → 일정` 트리입니다. 이 저장소가 다루는 문제는 두 가지입니다.

- 깊은 계층 데이터를 사용자가 **학습하지 않고도** 다룰 수 있게 만드는 것
- 그 트리를 여러 사람이 **동시에** 바꿀 때 화면·서버·되돌리기 이력이 어긋나지 않게 하는 것

<!-- TODO: 배포 데모 링크 -->
<!-- TODO: 두 브라우저에서 동시 편집하는 15~30초 GIF (docs/media/) -->

## 배경

2025년 5월부터 약 9개월간 7인 팀으로 만든 여행 계획 서비스 **Trego**의 프론트엔드입니다. 프론트엔드 설계와 구현을 주도했고, 기여 범위는 커밋 기록으로 확인할 수 있습니다.

| 저장소                | 전체 커밋 | 본인 커밋     |
| --------------------- | --------- | ------------- |
| 프론트엔드            | 733       | **639 (87%)** |
| 백엔드 (ASP.NET Core) | 258       | 61            |

이 저장소는 그 프론트엔드를 TypeScript와 테스트 위에서 다시 설계한 결과입니다.

## 어려웠던 문제

### 계층 트리를 다루는 자료구조

아래 모든 기능이 이 위에서 돌아갑니다. 원본 노드 배열 하나에서 목적별 인덱스를 파생시켜 함께 갱신합니다.

- `entityMap` — `pathId`로 노드와 부모를 즉시 조회
- `childrenMap` — 부모별 자식 목록과 형제 순서
- `flattenedItems` — 렌더링과 드래그 앤 드롭이 쓰는 depth-first 배열

트리 위치(`pathId`)와 엔터티(`id`)를 분리해서 같은 장소를 여러 날짜에 넣을 수 있고, 형제 순서는 분수 `position`(step 0.1)이라 재배치가 이웃 행을 건드리지 않습니다.

계층형 Shift 다중 선택에서는 부모가 이미 선택되면 그 자손을 작업 대상에서 제외합니다. 그러지 않으면 삭제 한 번에 중복 명령이 나갑니다.

- `src/features/planner/utils/build-planner-tree.ts`

### 스크롤하면 지금 어디를 보는지 잃어버립니다

일정 트리가 깊어지면 화면에 보이는 장소가 어느 지역, 어느 날짜에 속하는지 알 수 없게 됩니다.

항상 떠 있는 고정 헤더는 쓰지 않았습니다. 늘 공간을 차지하기 때문입니다. 대신 **원래 라벨이 화면 상단에서 사라지는 그 순간에만** 조상 경로가 자리를 이어받게 했습니다.

- 현재 노드는 경로에서 제외합니다. 같은 라벨이 두 번 보이지 않습니다
- 라벨이 사라지는 시점과 경로가 나타나는 시점을 맞춥니다
- 다음 폴더로 넘어갈 때 경로가 갑자기 사라지지 않고, **이전 구간의 최상위 라벨로 마감한 뒤** 전환합니다
- 트리 행, 경로, 마감 라벨이 같은 라벨 컴포넌트를 재사용합니다

구현은 스크롤 위치와 계층 관계를 함께 계산합니다. 컨테이너 기준선을 넘는 마지막 항목을 추적하고, 다음 항목이 최상위 폴더의 직속 자식인지 판별해 전환 상태를 정합니다.

- `src/features/planner/utils/get-planner-breadcrumb-ancestors.ts`

### 같은 트리를 여러 사람이 동시에 바꿉니다

서버는 요청 payload를 검증 없이 접속자 전원에게 되쏩니다. **보낸 사람에게도 같은 이벤트가 돌아옵니다.**

그래서 낙관적 반영을 별도 로직으로 두지 않고, **서버가 보낼 이벤트를 스스로에게 미리 보내는** 형태로 만들었습니다.

```ts
createFolder(input) {
  const request = createFolderRequest(input);
  return invoke("CreateFolder", request, () => applyNodeEvent("OnFolderCreated", request));
  //                                            ^ 서버 이벤트를 처리하는 바로 그 함수
}
```

상태를 바꾸는 경로가 하나뿐이라 로컬과 서버가 어긋날 코드가 없습니다. 대신 같은 변경이 두 번 적용되므로 **reducer가 idempotent해야 합니다.** 변화가 없으면 기존 배열 참조를 그대로 반환하고, 호출부는 참조 비교로 리렌더를 건너뜁니다.

실패하면 이전 상태로 되돌리지 않고 서버에서 다시 받아옵니다. 그 사이 다른 사람이 바꾼 내용까지 지워지면 안 되기 때문입니다.

- `src/features/planner/realtime/planner-realtime-reducer.ts`

### 되돌리기를 스냅샷으로 할 수 없습니다

트리 전체 스냅샷을 되돌리면 다른 사람의 변경까지 되돌아갑니다. 그래서 되돌리기를 **역커맨드 재생**으로 구현했습니다. 각 작업이 `{ redo, undo }` 커맨드 쌍을 남기고, 삭제처럼 서브트리가 사라지는 작업은 깊이순으로 정렬된 재생성 커맨드를 만듭니다.

순차 명령 중간에 실패하면 부분 재생 상태를 남기지 않기 위해 이력을 비우고 서버 상태로 재동기화합니다.

- `src/features/planner/operations/planner-operation-command.ts`

### 드롭 규칙이 도메인 제약입니다

폴더·날짜·일정은 아무 곳에나 놓을 수 없습니다.

- 부모 종류마다 받을 수 있는 자식이 다릅니다
- 자기 자손 안으로는 들어갈 수 없습니다
- 루트는 이동·삭제 대상이 아닙니다
- 화면에 보이는 순서와 실제 부모 관계가 다릅니다

이 판정을 전부 순수 함수로 분리했습니다. dnd-kit 어댑터는 규칙을 호출만 합니다.

- `src/features/planner/dnd/planner-drop-rules.ts`

### 명령형 지도 SDK와 선언형 상태를 잇습니다

일정 트리를 마커·경로 모델로 바꾸는 부분은 순수 함수이고, Mapbox SDK 호출만 어댑터로 격리했습니다. 선택 상태와 카메라 이동 요청을 분리해서, 드래그나 Shift 다중 선택은 지도를 움직이지 않습니다.

SDK와 전용 CSS는 지도 컴포넌트 단위로 지연 로딩합니다. 초기 실패와 타임아웃에는 지도 인스턴스만 재생성하는 재시도 UI를 두어 SDK 실패가 Planner 상태로 번지지 않게 했습니다.

- `src/features/planner/map/build-planner-map-model.ts`

## 동작하는 범위

- 폴더·날짜·일정 계층 편집, 인라인 이름 변경, 메모 편집, 날짜 색상 지정
- 계층 제약을 반영한 드래그 앤 드롭, Shift 다중 선택, 선택 항목 삭제·그룹화
- 여행 기간 변경에 따른 날짜 생성·삭제와 프로젝트 종료일 동기화
- 되돌리기·다시 실행 (`Cmd/Ctrl+Z`, `Cmd/Ctrl+Shift+Z`)
- 날짜별 지도 마커·경로, 표시 토글, 일정 선택에 따른 카메라 이동
- 실시간 공동 편집, 팀 채팅, 커서 공유 (SignalR 연결 하나를 공유)
- 이메일 회원가입·로그인, 내 프로젝트 조회·생성, 이메일 기반 멤버 초대

## 구조

```
src/
├─ app/         라우팅, 전역 provider, 여러 feature의 조합
├─ features/    planner, chat, collaboration, auth, home, project-management
└─ 공용 레이어   components, config, hooks, lib, stores, testing, types, utils
```

의존성은 `app → features → 공용 레이어` 한 방향입니다. feature 간 직접 import와 공용 레이어의 역방향 import는 ESLint 에러입니다. 여러 feature를 엮는 코드는 반드시 `app`에 둡니다. 각 폴더의 책임은 `src/*/README.md`에 있습니다.

### 실시간 계층

하나의 SignalR 연결을 일정·채팅·커서가 공유합니다.

```
lib/signalr-client            연결 lifecycle만 담당. Hub 메서드 이름을 모릅니다
  └ app/realtime/session      start → JoinProject → 재조회를 하나의 in-flight promise로 직렬화
      └ features/*/realtime   Hub 명령·이벤트 계약을 각 feature가 소유
```

세션 객체는 React와 무관한 순수 객체입니다. 재연결과 경합 시나리오를 단위 테스트로 검증하기 위해서입니다. `reconnecting → connected` 전이를 감지하면 재가입과 재조회를 자동 실행하고, React StrictMode의 `start → cleanup stop → start` 경합은 실제 연결 상태를 기준으로 직렬화합니다.

### 상태

| store                   | 소유                                                   |
| ----------------------- | ------------------------------------------------------ |
| `planner-view-store`    | 원본 노드와 파생 트리, 선택·확장 상태, 지도 focus 요청 |
| `planner-map-store`     | 지도에서 숨긴 날짜 집합                                |
| `planner-history-store` | 되돌리기·다시 실행 커맨드 스택                         |

## 하지 않은 것과 이유

| 항목                                       | 이유                                                                                                                                                                |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 지도 마커 클러스터링                       | Mapbox 내장 클러스터링은 GeoJSON layer에서만 동작합니다. 현재 마커는 키보드 포커스와 aria label을 가진 DOM 버튼이라, 클러스터링을 넣으면 접근성 트리에서 사라집니다 |
| Excel·KML 내보내기                         | 라이브러리 연결에 가까워 이 저장소가 다루는 문제와 무관합니다                                                                                                       |
| 다국어, 썸네일 업로드, 소셜 로그인, 템플릿 | 계층 데이터와 동시 편집이라는 축과 무관해 제외했습니다                                                                                                              |
| 모바일 편집                                | 계층형 드래그 앤 드롭은 데스크톱 포인터를 전제로 설계했습니다                                                                                                       |

## 진행 중

작업 브랜치에서 개발 중이며 아직 `main`에 없습니다.

- **장소 탐색** (`feat/planner-exploration-context`) — 장소 검색·상세, 일정 간 거리·이동 정보, 지도 마커에서 목록으로 향하는 역방향 선택. 현재 고정 데이터로 동작하며 실제 장소 API 연결이 남아 있습니다.
- **AI 플래너** (`feat/ai-planner-chat-control`) — 선택한 일정을 문맥으로 AI가 변경을 제안하고 사용자가 작업별로 승인·거절합니다. 승인된 작업은 일반 조작과 같은 커맨드 경로를 타므로 되돌리기가 그대로 적용됩니다. 현재 기본 동작은 mock이며, 승인 시점의 최신 상태 검증이 남아 있습니다.

## 실행

```bash
npm install
cp .env.example .env.local
npm run dev
```

`/demo`는 백엔드와 로그인 없이 동작합니다. 브라우저 안의 가짜 서버가 실제 Hub처럼 요청을 접속자 전원에게 되쏘고, 가상의 동료가 주기적으로 일정을 편집합니다. 연결을 끊었다가 다시 이으면 놓친 변경이 재조회로 복원되는 과정을 직접 확인할 수 있습니다.

그 밖의 화면은 REST API와 SignalR Hub를 제공하는 백엔드가 필요합니다. 개발 시 환경변수를 비우면 Vite가 `/api`와 `/project`를 `http://localhost:3000`으로 전달합니다.

| 환경변수                   | 필수        | 설명                                                                   |
| -------------------------- | ----------- | ---------------------------------------------------------------------- |
| `VITE_API_BASE_URL`        | 선택        | REST API 기준 URL. 절대 URL이어야 합니다                               |
| `VITE_SIGNALR_HUB_URL`     | 선택        | SignalR Hub URL. 절대 URL 또는 root-relative 경로                      |
| `VITE_MAPBOX_ACCESS_TOKEN` | 지도에 필요 | 없으면 지도 영역만 안내 문구로 대체되고 나머지 Planner UI는 동작합니다 |

환경변수는 `src/config/env.ts`에서만 읽고 검증합니다. 토큰은 `.env.local`에만 두고 커밋하지 않습니다.

## 검증

```bash
npm run lint          # ESLint (레이어 규칙 포함)
npm run format:check  # Prettier
npm test              # Vitest
npm run build         # tsc -b + vite build
```

mock server는 쓰지 않습니다. WebSocket 상태 전이와 서버 발신 이벤트를 표현할 수 없기 때문입니다. 대신 화면 컴포넌트가 `clientFactory`와 `restClient`를 주입받고, 테스트는 상태 전이와 이벤트 emit이 가능한 fake SignalR 클라이언트를 넣습니다. `/demo`도 같은 주입 지점을 쓰므로 feature 코드에는 데모 분기가 없습니다.

## 기술 구성

React 19 · TypeScript · Vite · React Router · Tailwind CSS v4 · shadcn/ui(Base UI) · Zustand · dnd-kit · Mapbox GL JS · SignalR · Vitest · React Testing Library
