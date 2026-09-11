export interface DemoNetwork {
  isOnline: () => boolean;
  setOnline: (isOnline: boolean) => void;
  subscribe: (listener: () => void) => () => void;
}

// 이 탭과 데모 서버 사이의 회선이다. 끊으면 SignalR과 REST가 함께 실패하고,
// 서버 쪽 접속자(시뮬레이션 동료)는 영향을 받지 않는다. 백엔드가 내려간 상황과 같은 조건이다.
export function createDemoNetwork(): DemoNetwork {
  const listeners = new Set<() => void>();
  let isOnline = true;

  return {
    isOnline() {
      return isOnline;
    },
    setOnline(nextIsOnline) {
      if (isOnline === nextIsOnline) {
        return;
      }

      isOnline = nextIsOnline;
      listeners.forEach((listener) => listener());
    },
    subscribe(listener) {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
  };
}
