# Testing

공통 render 함수, 테스트 fixture, mock과 테스트 환경 설정을 관리합니다.

- `setup-tests.ts`에서 공통 matcher와 테스트 간 cleanup을 설정합니다.
- 컴포넌트 테스트에서는 `test-utils.tsx`의 render 함수를 사용합니다.
- 운영 코드가 `testing`을 참조하지 않도록 합니다.
- feature 전용 fixture는 해당 feature 가까이에 둘 수 있습니다.
