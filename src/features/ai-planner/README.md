# AI Planner

AI가 제안한 일정 변경을 사용자가 검토하고 승인하는 인터랙션을 관리합니다.

- 이 feature는 **변경을 실행하지 않습니다.** 승인된 명령은 `AiPlannerOperationExecutor`로 주입받아 app 레이어가 Planner 명령 경로에서 실행합니다.
- 서버가 보내는 제안(`AiPlannerProposal`)은 정식 명령만 담습니다. 라벨과 before/after 문구는 `create-proposal-preview`가 현재 문맥에서 만듭니다. before가 스냅샷이 아니라 현재 값이라 문맥이 바뀌면 diff도 함께 정확해집니다.
- 메시지는 AI SDK `UIMessage`의 parts 구조를 씁니다. 승인 상태는 임의 필드가 아니라 툴 파트 상태(`approval-requested` → `approval-responded` → `output-available` / `output-error` / `output-denied`)로 표현합니다.
- 사용자 메시지에는 그 시점의 문맥 스냅샷을 `data-planner-context` part로 고정합니다. 이후 선택이 바뀌어도 과거 대화의 근거는 변하지 않습니다.
- 전송 계층은 `AiPlannerChatClient` 하나로 추상화하고 mock과 Gateway 호출이 같은 이벤트 스트림을 냅니다.
- Planner 상태를 직접 읽지 않습니다. 문맥은 props로 받습니다(feature 간 직접 import 금지).
