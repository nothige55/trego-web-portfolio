# Lib

앱에서 사용할 수 있도록 사전 구성한 외부 라이브러리와 기반 클라이언트를 관리합니다.

- REST API, SignalR, Google Maps 같은 연결 기반을 둘 수 있습니다.
- 특정 제품 기능의 상태 변경이나 도메인 규칙은 포함하지 않습니다.
- 인증 토큰처럼 feature가 소유하는 값은 공용 client가 feature store를 직접 참조하지 않고 외부에서 공급받습니다.
- REST client는 응답 본문을 반환하고, endpoint별 요청·응답 타입과 스키마는 사용하는 feature가 소유합니다.
- SignalR client는 연결 lifecycle과 상태 구독만 제공하며 Hub 명령과 이벤트 계약은 사용하는 feature가 소유합니다.
