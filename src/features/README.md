# Features

사용자가 인식할 수 있는 제품 기능을 독립된 모듈로 관리합니다.

- feature는 공용 모듈만 참조하며 다른 feature를 직접 참조하지 않습니다.
- 여러 feature의 조합은 `app/routes`에서 담당합니다.
- 각 feature에는 필요한 경우에만 `api`, `assets`, `components`, `hooks`, `stores`, `types`, `utils`를 둡니다.
