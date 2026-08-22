# Planner Hooks

일정 패널 UI가 소유하는 로컬 상호작용 상태를 hook으로 분리합니다.

- 컴포넌트에서 분리한 상태 기계만 둡니다. 렌더링(JSX)은 `components`가 담당합니다.
- 서버 통신은 `PlannerNodeEditingCommands`로 주입받고, hook이 직접 SignalR·REST를 호출하지 않습니다.
- 다른 feature나 `app`을 참조하지 않습니다. 도메인 지식이 없는 hook은 `src/hooks`에 둡니다.
