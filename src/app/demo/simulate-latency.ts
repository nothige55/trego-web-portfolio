// 네트워크 왕복을 흉내 낸다. 0이면 타이머 없이 다음 microtask로 넘겨, 테스트가 가짜 타이머 없이도 돌게 한다.
export function simulateLatency(delay: number): Promise<void> {
  if (delay <= 0) {
    return Promise.resolve();
  }

  return new Promise((resolve) => setTimeout(resolve, delay));
}
