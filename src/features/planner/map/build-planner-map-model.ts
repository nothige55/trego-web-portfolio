import type {
  PlannerMapCoordinate,
  PlannerMapFocus,
  PlannerMapMarker,
  PlannerMapModel,
  PlannerMapRoute,
} from "@/features/planner/map/planner-map-model";
import type {
  FlattenedPlannerNode,
  PlannerNodePathId,
  PlannerTree,
} from "@/features/planner/types/planner-node";

const FALLBACK_MARKER_COLOR = "#6B7280";
const VISIBLE_OPACITY = 1;
const SELECTED_HIDDEN_OPACITY = 0.5;

function buildPlannerMapFocus({
  tree,
  markers,
  selectedItemId,
}: {
  readonly tree: PlannerTree;
  readonly markers: readonly PlannerMapMarker[];
  readonly selectedItemId: PlannerNodePathId | null;
}): PlannerMapFocus | null {
  if (!selectedItemId) {
    return null;
  }

  const selectedNode = tree.entityMap.get(selectedItemId);
  if (!selectedNode) {
    return null;
  }

  if (selectedNode.kind === "activity" && selectedNode.activityType !== "group") {
    const marker = markers.find(({ pathId }) => pathId === selectedItemId);
    return marker
      ? { pathId: selectedItemId, kind: "point", coordinates: [marker.coordinate] }
      : null;
  }

  const coordinates = markers
    .filter((marker) => {
      if (selectedNode.kind === "day") {
        return marker.dayPathId === selectedItemId;
      }

      if (
        (selectedNode.kind === "activity" && selectedNode.activityType === "group") ||
        (selectedNode.kind === "folder" && selectedNode.folderType === "wish")
      ) {
        return marker.containerPathId === selectedItemId;
      }

      return false;
    })
    .map(({ coordinate }) => coordinate);

  return coordinates.length > 0 ? { pathId: selectedItemId, kind: "bounds", coordinates } : null;
}

function isActivityContainer(node: FlattenedPlannerNode): boolean {
  return (
    node.kind === "day" ||
    (node.kind === "activity" && node.activityType === "group") ||
    (node.kind === "folder" && node.folderType === "wish")
  );
}

function toCoordinate(node: FlattenedPlannerNode): PlannerMapCoordinate | null {
  if (node.kind !== "activity") {
    return null;
  }

  const { latitude, longitude } = node;
  if (
    latitude === null ||
    longitude === null ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }

  return [longitude, latitude];
}

function findAncestorDayPathId(
  tree: PlannerTree,
  node: FlattenedPlannerNode,
): PlannerNodePathId | null {
  let current: FlattenedPlannerNode | undefined = node;

  while (current) {
    if (current.kind === "day") {
      return current.pathId;
    }

    current = current.parentPathId ? tree.entityMap.get(current.parentPathId) : undefined;
  }

  return null;
}

function getContainerColor(container: FlattenedPlannerNode): string {
  if (container.kind === "day") {
    return container.color ?? FALLBACK_MARKER_COLOR;
  }

  if (container.kind === "activity" && container.activityType === "group") {
    return container.color ?? FALLBACK_MARKER_COLOR;
  }

  return FALLBACK_MARKER_COLOR;
}

function getContainerOpacity({
  dayPathId,
  hiddenDayIds,
  selectedItemId,
}: {
  readonly dayPathId: PlannerNodePathId | null;
  readonly hiddenDayIds: ReadonlySet<PlannerNodePathId>;
  readonly selectedItemId: PlannerNodePathId | null;
}): number | null {
  if (!dayPathId || !hiddenDayIds.has(dayPathId)) {
    return VISIBLE_OPACITY;
  }

  return selectedItemId === dayPathId ? SELECTED_HIDDEN_OPACITY : null;
}

export function buildPlannerMapModel({
  tree,
  hiddenDayIds,
  selectedItemId,
}: {
  readonly tree: PlannerTree;
  readonly hiddenDayIds: ReadonlySet<PlannerNodePathId>;
  readonly selectedItemId: PlannerNodePathId | null;
}): PlannerMapModel {
  const markers: PlannerMapMarker[] = [];
  const routes: PlannerMapRoute[] = [];

  tree.flattenedItems.filter(isActivityContainer).forEach((container) => {
    const dayPathId = findAncestorDayPathId(tree, container);
    const opacity = getContainerOpacity({ dayPathId, hiddenDayIds, selectedItemId });
    if (opacity === null) {
      return;
    }

    const activities = (tree.childrenMap.get(container.pathId) ?? [])
      .filter((node) => node.kind === "activity")
      .toSorted((first, second) => first.position - second.position);
    const color = getContainerColor(container);
    const routeCoordinates: PlannerMapCoordinate[] = [];

    activities.forEach((activity, index) => {
      const coordinate = toCoordinate(activity);
      if (!coordinate) {
        return;
      }

      markers.push({
        pathId: activity.pathId,
        containerPathId: container.pathId,
        dayPathId,
        name: activity.name,
        number: index + 1,
        color,
        coordinate,
        opacity,
        isSelected: activity.pathId === selectedItemId,
      });

      if (container.kind === "day") {
        routeCoordinates.push(coordinate);
      }
    });

    if (container.kind === "day" && routeCoordinates.length >= 2) {
      routes.push({
        dayPathId: container.pathId,
        color,
        coordinates: routeCoordinates,
        opacity,
      });
    }
  });

  return {
    markers,
    routes,
    focus: buildPlannerMapFocus({ tree, markers, selectedItemId }),
  };
}
