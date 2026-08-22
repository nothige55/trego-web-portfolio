# Chat Hooks

채팅 UI가 소유하는 로컬 상태와 DOM 부수효과를 hook으로 분리합니다.

- 메시지 병합·전송 계약은 `utils`와 `realtime`이 담당합니다.
- 다른 feature나 `app`을 참조하지 않습니다.
