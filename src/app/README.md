# App

애플리케이션 진입점, 전역 Provider, 라우터와 route-level 조합을 관리합니다.

- `app`은 `features`와 공용 모듈을 조합할 수 있습니다.
- 제품 도메인 로직과 재사용 UI 구현은 이 폴더에 두지 않습니다.
- `demo`는 백엔드 없는 `/demo`를 위한 브라우저 내 서버, SignalR·REST 대체 구현, 가상 동료를 둡니다. 여러 feature의 Hub 계약을 함께 알아야 하므로 `app`에 둡니다. feature 코드에 데모 전용 분기를 넣지 않고, `ProjectPlannerPage`의 `clientFactory`·`restClient` 주입 지점만 사용합니다.
