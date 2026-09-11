import { useCallback, useMemo } from "react";

import {
  MockPlaceExplorer,
  type PlaceAddHandler,
} from "@/features/places/components/mock-place-explorer";
import type { PlaceAddTarget } from "@/features/places/types/mock-place";
import { usePlannerViewStore } from "@/features/planner/stores/planner-view-store";
import type { PlannerNodeEditingCommands } from "@/features/planner/types/planner-editing-commands";
import type {
  FlattenedPlannerNode,
  PlannerNodePathId,
  PlannerTree,
} from "@/features/planner/types/planner-node";

type PlannerPlaceExplorerProps = {
  readonly createPlaceActivity?: PlannerNodeEditingCommands["createPlaceActivity"];
};

function toPlaceAddTarget(node: FlattenedPlannerNode): PlaceAddTarget | null {
  if (node.kind === "day") {
    return { id: node.pathId, label: node.name, color: node.color, group: "day" };
  }

  if (node.kind === "folder" && node.folderType === "wish") {
    return { id: node.pathId, label: node.name, color: node.color, group: "wish" };
  }

  return null;
}

function buildPlaceAddTargets(tree: PlannerTree): PlaceAddTarget[] {
  return tree.flattenedItems.flatMap((node) => toPlaceAddTarget(node) ?? []);
}

// 선택한 행에서 위로 올라가며 처음 만나는 날짜(또는 위시리스트)를 "지금 보고 있는 곳"으로 본다.
function findCurrentTargetId(
  tree: PlannerTree,
  selectedItemId: PlannerNodePathId | null,
): PlannerNodePathId | null {
  let current = selectedItemId ? tree.entityMap.get(selectedItemId) : undefined;

  while (current) {
    if (toPlaceAddTarget(current)) {
      return current.pathId;
    }
    current = current.parentPathId ? tree.entityMap.get(current.parentPathId) : undefined;
  }

  return null;
}

// 장소 탐색(places)과 일정 트리(planner)를 잇는 지점이다.
// places는 트리 구조를 모르고, planner는 목업 장소 형태를 모르므로 번역은 여기서만 한다.
export function PlannerPlaceExplorer({ createPlaceActivity }: PlannerPlaceExplorerProps) {
  const tree = usePlannerViewStore((state) => state.tree);
  const selectedItemId = usePlannerViewStore((state) => state.selectedItemId);
  const addTargets = useMemo(() => buildPlaceAddTargets(tree), [tree]);
  const currentTargetId = findCurrentTargetId(tree, selectedItemId);

  const addPlace = useCallback<PlaceAddHandler>(
    async (place, target) => {
      if (!createPlaceActivity) {
        return;
      }

      const pathId = await createPlaceActivity({
        parentPathId: target.id,
        name: place.name,
        latitude: place.latitude,
        longitude: place.longitude,
        rating: place.rating,
        ratingCount: place.reviewCount,
        googlePlaceId: "",
      });
      // 추가한 장소가 보이도록 부모 날짜를 펼치고 지도를 그 위치로 옮긴다.
      usePlannerViewStore.getState().activateItem(pathId);
    },
    [createPlaceActivity],
  );

  return (
    <MockPlaceExplorer
      addTargets={addTargets}
      currentTargetId={currentTargetId}
      onAddPlace={createPlaceActivity ? addPlace : undefined}
    />
  );
}
