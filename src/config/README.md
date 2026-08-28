# Config

환경변수, 실행 환경과 앱 전역 설정을 관리합니다.

- 환경변수 접근은 이 폴더에서 한 번만 정규화해 외부에 제공합니다.
- 제품 도메인 상태와 UI 로직은 포함하지 않습니다.
- `env.ts`는 환경변수를 검증하고 앱에서 사용할 이름으로 정규화합니다.
- SignalR Hub URL은 명시된 값, REST API origin, 로컬 `/project` 순으로 결정합니다.
- AI Planner는 기본적으로 `mock`이며, `VITE_AI_PLANNER_MODE=api`로 바꾸면 같은 origin의 `/ai` Gateway를 호출합니다.
