# Trego Web Portfolio

기존 Trego 프론트엔드의 핵심 여행 계획 흐름을 기능 단위로 이식하는 포트폴리오용 웹 애플리케이션입니다.

## 기술 구성

- React 19, TypeScript, Vite
- React Router
- Tailwind CSS v4, shadcn/ui
- Vitest, React Testing Library

## 시작하기

Node.js와 npm을 준비한 뒤 의존성을 설치하고 개발 서버를 실행합니다.

```bash
npm install
cp .env.example .env.local
npm run dev
```

## 환경변수

| 이름                    | 필수 여부 | 설명                                                                    |
| ----------------------- | --------- | ----------------------------------------------------------------------- |
| `VITE_API_BASE_URL`     | 선택      | REST API 기준 URL. 비워두면 현재 origin의 상대 경로를 사용              |
| `VITE_SIGNALR_HUB_URL`  | 선택      | SignalR Hub URL. 비워두면 API origin의 `/project` 또는 로컬 proxy를 사용 |

환경변수는 `src/config`에서 검증하고 정규화합니다. API 주소를 지정한다면 `http` 또는 `https` 절대 URL을 사용해야 합니다. SignalR Hub는 절대 URL 또는 `/project` 같은 root-relative 경로를 사용할 수 있습니다. 개발 환경에서 값을 비워두면 Vite가 `/api`와 `/project` 요청을 기존 백엔드 주소인 `http://localhost:3000`으로 전달합니다.

## 주요 명령어

```bash
npm run dev          # 개발 서버
npm run lint         # ESLint 검사
npm run format:check # Prettier 검사
npm test             # 전체 테스트 1회 실행
npm run build        # 타입 검사 및 프로덕션 빌드
```

## 구조

`src`는 Bulletproof React 스타일의 단방향 의존성을 따릅니다.

- `app`: 앱 엔트리, 라우팅, 전역 provider와 feature 조합
- `features`: 사용자 기능 단위 모듈
- `components`: 도메인에 종속되지 않는 공용 UI
- `config`: 환경변수와 전역 설정
- `lib`: 사전 구성한 외부 라이브러리와 기반 client
- `testing`: 공통 테스트 설정과 render helper

공용 레이어는 `features`나 `app`을 참조하지 않으며, feature 간 직접 참조도 허용하지 않습니다.
