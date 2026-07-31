# Trego Frontend Agents Guide

이 문서는 `trego-web-portfolio`에서 작업하는 에이전트와 개발자가 따라야 할 현재 기준을 정리합니다.

## 1. 프로젝트 참고 문서

기획, 기능 이관 범위, 설계 결정, 테스트 학습 자료가 필요하면 다음 로컬 문서 디렉터리에서 관련 Markdown 파일을 먼저 확인합니다.

`/Users/jinha/trego_docs`

- 현재 주요 문서는 `frontend-migration-plan.md`, `testing.md`입니다.
- 로컬 문서는 참고 자료이며 Git 저장소에 복사하거나 커밋하지 않습니다.
- 문서에 미확정 사항이나 서로 충돌하는 내용이 있으면 구현 결정으로 확정하기 전에 사용자에게 확인합니다.
- 코드와 직접 함께 유지해야 하는 폴더 책임과 import 규칙은 각 `src/*/README.md`에 기록합니다.

## 2. 프로젝트 기본 정보

- Stack: React 19 + TypeScript + Vite
- Router: React Router
- Styling: Tailwind CSS v4 + shadcn/ui
- shadcn base: Base UI
- Testing: Vitest + React Testing Library + jsdom
- Package manager: npm

핵심 스크립트:

- `npm run dev`: 개발 서버 실행
- `npm run lint`: ESLint 검사
- `npm run lint:fix`: ESLint 자동 수정
- `npm run format`: Prettier 포맷팅
- `npm run format:check`: Prettier 검사
- `npm test`: 전체 테스트를 한 번 실행
- `npm run test:watch`: 테스트 watch 모드 실행
- `npm run build`: 타입 검사와 프로덕션 빌드

## 3. 아키텍처 기준

`src`는 Bulletproof React 스타일을 기준으로 구성합니다.

- `app`: 앱 엔트리, 라우팅, 전역 provider, feature 조합
- `assets`: 이미지, 폰트 등 정적 리소스
- `components`: 도메인에 종속되지 않는 공용 UI
- `config`: 환경변수와 전역 설정
- `features`: 기능 단위 모듈
- `hooks`: 공용 React hook
- `lib`: 사전 구성한 외부 라이브러리와 기반 client
- `stores`: 여러 기능이 공유하는 전역 client state
- `testing`: 공통 테스트 설정, render helper, mock
- `types`: 공용 TypeScript 타입
- `utils`: 프레임워크와 도메인에 종속되지 않는 순수 함수

현재 앱 진입 흐름:

1. `src/main.tsx`
2. `src/app/app.tsx`
3. `src/app/router.tsx`
4. route 또는 feature 화면

필요하지 않은 폴더나 추상화를 미리 추가하지 않습니다. 상태관리, API client 등은 실제 기능 요구사항을 확인한 뒤 도입합니다.

## 4. 의존성 방향

허용 방향:

- `app` -> `features`, 공용 레이어
- `features` -> 공용 레이어

금지 방향:

- 공용 레이어 -> `features` 또는 `app`
- feature A -> feature B

공용 레이어는 `assets`, `components`, `config`, `hooks`, `lib`, `stores`, `testing`, `types`, `utils`를 의미합니다. 여러 feature를 조합하는 작업은 `app`에서 처리합니다.

## 5. 네이밍과 코드 규칙

- `src/**/*.{ts,tsx}` 파일명은 kebab-case를 사용합니다.
- `src` 하위 폴더명은 kebab-case를 사용합니다.
- 함수, 파라미터, 변수는 camelCase를 사용합니다.
- 타입과 React 컴포넌트는 PascalCase를 사용합니다.
- import는 `@/*` alias를 우선 사용합니다.
- `src/components/ui`의 shadcn 생성 코드는 프로젝트 ESLint 예외 범위를 유지합니다.
- shadcn 컴포넌트는 `src/components/ui`에 설치하고 직접 수정한 코드는 저장소가 소유합니다.
- Dialog, Popover, date picker, dropdown처럼 열림 상태, 포커스, 키보드 조작을 관리하는 UI는 shadcn 컴포넌트를 적극적으로 우선 사용합니다.
- 단순 버튼과 텍스트 입력처럼 semantic HTML만으로 충분한 요소는 shadcn 사용을 강제하지 않으며, 필요한 상호작용 컴포넌트만 CLI로 `src/components/ui`에 추가합니다.

## 6. 테스트 기준

- 테스트 파일은 기본적으로 대상 코드 가까이에 `*.test.ts` 또는 `*.test.tsx`로 둡니다.
- 공통 설정과 render helper만 `src/testing`에서 관리합니다.
- 컴포넌트의 내부 구현보다 사용자가 확인하는 동작을 검증합니다.
- 가능한 경우 `getByRole`, `findByRole`, label, 화면 텍스트처럼 접근성 기반 query를 사용합니다.
- 사용자 입력은 `userEvent`를 사용합니다.
- API 연동이 시작되기 전에는 불필요한 mock server를 미리 구성하지 않습니다.

## 7. 작업 및 검증 절차

1. 현재 브랜치와 작업 트리를 확인합니다.
2. 요청받은 범위를 벗어난 변경사항을 구분합니다.
3. 기능을 작은 논리 단위로 구현합니다.
4. 필요하면 `npm run lint:fix`, `npm run format`을 실행합니다.
5. 커밋 전 다음 검사를 실행합니다.
   - `npm run lint`
   - `npm run format:check`
   - `npm test`
   - `npm run build`
   - `git diff --check`
6. 사용자 변경이나 범위 밖 파일을 스테이징하지 않습니다.
7. 사용자가 커밋을 요청하거나 범위를 승인한 뒤 논리 단위로 커밋합니다.

현재 별도 pre-commit hook을 전제로 하지 않으므로 검증 명령을 직접 실행합니다.

## 8. 커밋과 브랜치 규칙

커밋 메시지는 다음 형식을 사용합니다.

`type: concise subject`

주요 타입:

- `feat`: 새로운 사용자 기능
- `fix`: 버그 수정
- `docs`: 추적 대상 문서 변경
- `style`: 동작 변화 없는 스타일 또는 포맷 변경
- `refactor`: 동작을 유지하는 구조 개선
- `test`: 테스트 추가 또는 수정
- `chore`: 빌드, 설정, 패키지 관리 작업

브랜치명은 `type/kebab-case-summary` 형식을 사용합니다.

예시:

- `chore/app-foundation`
- `feat/travel-planner`
- `fix/calendar-drag-state`

작업 브랜치에는 검토 가능한 논리 커밋을 남기고, 기본 브랜치에는 squash merge하여 기능 단위 이력을 유지합니다.

## 9. 문서와 작성 규칙

- 저장소 문서는 현재 코드에서 확인 가능한 사실을 기준으로 간결하게 작성합니다.
- 구현되지 않은 계획을 완료된 기능처럼 표현하지 않습니다.
- 개인 학습 기록, 장기 이관 계획, 미확정 설계 메모는 `/Users/jinha/trego_docs`에서 관리합니다.
- PR 설명에는 변경 내용, 변경 이유, 사용자 또는 개발자 영향, 검증 명령을 포함합니다.
- 버그 수정 문서에는 재현 조건과 원인을 함께 기록합니다.
