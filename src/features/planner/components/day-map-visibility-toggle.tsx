import { Eye, EyeOff } from "lucide-react";

import { usePlannerMapStore } from "@/features/planner/stores/planner-map-store";
import type { PlannerNodePathId } from "@/features/planner/types/planner-node";

export function DayMapVisibilityToggle({
  dayPathId,
  dayName,
}: {
  readonly dayPathId: PlannerNodePathId;
  readonly dayName: string;
}) {
  const isHidden = usePlannerMapStore((state) => state.hiddenDayIds.has(dayPathId));
  const toggleDayVisibility = usePlannerMapStore((state) => state.toggleDayVisibility);
  const actionLabel = isHidden ? "지도에 표시하기" : "지도에서 숨기기";

  return (
    <button
      type="button"
      aria-label={`${dayName} ${actionLabel}`}
      title={actionLabel}
      className="mr-2 flex size-7 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 hover:bg-muted hover:text-foreground focus:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      onPointerDown={(event) => {
        event.stopPropagation();
      }}
      onClick={(event) => {
        event.stopPropagation();
        toggleDayVisibility(dayPathId);
      }}
    >
      {isHidden ? (
        <EyeOff aria-hidden="true" className="size-4" />
      ) : (
        <Eye aria-hidden="true" className="size-4" />
      )}
    </button>
  );
}
