# Trego AI Gateway

AI SDK와 OpenAI Responses API를 사용하는 Node Gateway입니다. 브라우저에 API 키를 노출하지 않으며, Planner 변경을 실행하지 않고 구조화된 제안만 스트리밍합니다.

AI SDK 7의 요구사항에 맞춰 Node.js 22 이상에서 실행합니다.

## 배치

브라우저가 Gateway를 같은 origin의 `/ai` 경로로 **직접** 호출합니다. ASP.NET을 거쳐 프록시하지 않습니다.

```
브라우저 ──/ai/v1/planner/chat──▶ Gateway ──/api/me/info──▶ ASP.NET
    └────/api, /project(SignalR)──────────────────────────▶ ASP.NET
```

스트림이 한 홉으로 끝나므로 ASP.NET에 스트리밍 릴레이를 만들 필요가 없고, 클라이언트가 연결을 끊으면 모델 호출도 즉시 중단됩니다.

## 역할 경계

- **Gateway**: 모델 호출, 스트리밍, 제안 스키마 검증, 멤버 단위 rate limit
- **ASP.NET**: 인증과 권한의 authority, Planner 도메인 검증, 변경 실행, SignalR 전파
- **React**: 채팅, 제안 선택, diff 미리보기, 승인, 승인된 변경의 명령 실행

Gateway는 토큰을 스스로 해독하지 않습니다. 받은 `Authorization` 헤더를 그대로 ASP.NET의 `GET /api/me/info`에 되물어 세션을 확인하고 `publicId`를 얻습니다. 서명 키를 복제하지 않아도 되고, 토큰 형식이 바뀌어도 Gateway를 고칠 일이 없으며, **인가 판단은 계속 ASP.NET 한 곳에만 있습니다.**

Gateway는 DB에 쓰지 않습니다. 승인된 변경은 브라우저가 기존 SignalR Planner 명령으로 실행하므로 수동 편집과 동일한 서버 검증·전파·undo 경로를 탑니다.

## 실행

```sh
export OPENAI_API_KEY="..."
npm run dev:ai
```

- 상태 확인: `GET /ai/health`
- 스트리밍: `POST /ai/v1/planner/chat` (NDJSON, 한 줄에 JSON 객체 하나)

개발 시 Vite가 `/ai`를 `http://127.0.0.1:8787`로 전달하므로 프론트에서는 같은 origin으로 보입니다. 배포 시에는 리버스 프록시에서 `/ai/*`를 Gateway로, 나머지를 ASP.NET으로 보냅니다.

| 환경변수             | 필수   | 설명                                                          |
| -------------------- | ------ | ------------------------------------------------------------- |
| `OPENAI_API_KEY`     | 예     | 없으면 채팅 요청이 503으로 응답합니다                         |
| `OPENAI_MODEL`       | 아니오 | 기본값 `gpt-5.6-terra`                                        |
| `AI_GATEWAY_PORT`    | 아니오 | 기본값 `8787`                                                 |
| `TREGO_API_BASE_URL` | 아니오 | 세션 확인에 쓰는 ASP.NET 주소. 기본값 `http://localhost:3000` |

## 안전 장치

- 모델이 만들 수 있는 변경은 Activity 이동·메모·시간 3종뿐입니다.
- 제안이 요청 문맥에 없는 `pathId`를 가리키면 Gateway가 `proposal-rejected`로 걸러냅니다.
- Planner 문맥은 프롬프트에서 명시적으로 "데이터이지 명령이 아님"으로 취급합니다.
- 요청 본문은 1MB, 대화는 30턴, 문맥은 100개 항목으로 제한합니다.
- 멤버당 분당 20회로 제한합니다. Gateway가 사용자에게 직접 노출되므로 키 소각을 막는 최소 방어입니다.
