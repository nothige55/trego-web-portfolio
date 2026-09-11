// 기존 Planner와 같이 root 다음 계층부터 30px 단위로 들여씀
// 행, 경로 정보, 드래그 미리보기가 같은 기준을 써야 세로 정렬이 맞음
export const PLANNER_INDENTATION_WIDTH = 30;

export function getPlannerRowIndentation(depth: number): number {
  return Math.max(0, depth - 1) * PLANNER_INDENTATION_WIDTH;
}
