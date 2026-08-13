# Trego AI Gateway

AI SDK와 OpenAI Responses API를 사용하는 내부 전용 Node Gateway입니다. 브라우저에 API 키를 노출하지 않으며, Planner 변경안을 실행하지 않고 구조화된 제안만 스트리밍합니다.

AI SDK 7의 요구사항에 맞춰 Node.js 22 이상에서 실행합니다.

## 역할 경계

- Gateway: 모델 호출, 스트리밍, 제안 스키마 검증
- ASP.NET API: 사용자 인증, 프로젝트 권한, 대화 저장, 최신 Planner 상태 재검증, 승인된 변경의 트랜잭션 실행
- React: 채팅, 제안 선택, diff 미리보기, 승인 UI

`AI_GATEWAY_SHARED_SECRET`은 ASP.NET API와 Gateway 사이의 내부 호출 인증에 사용합니다. 브라우저가 이 값을 가져서는 안 됩니다.

## 로컬 실행

프로젝트 루트의 환경에서 다음 값을 설정한 뒤 실행합니다.

```sh
export OPENAI_API_KEY="..."
export AI_GATEWAY_SHARED_SECRET="..."
npm run dev:ai
```

상태 확인은 `GET /health`, 스트리밍 엔드포인트는 `POST /v1/planner/chat`입니다. 스트림은 한 줄에 하나의 JSON 객체를 보내는 NDJSON 형식입니다.
