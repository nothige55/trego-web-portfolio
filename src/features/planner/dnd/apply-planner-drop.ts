import type { PlannerDropDestination } from "@/features/planner/dnd/planner-drop-rules";
import type {
  FlattenedPlannerNode,
  PlannerNode,
  PlannerNodePathId,
  PlannerTree,
} from "@/features/planner/types/planner-node";
import { buildPlannerTree } from "@/features/planner/utils/build-planner-tree";

function toPlannerNode(node: FlattenedPlannerNode): PlannerNode {
  const { depth, siblingIndex, ...plannerNode } = node;
  void depth;
  void siblingIndex;
  return plannerNode;
}

export function applyPlannerDrop(
  tree: PlannerTree,
  activePathId: PlannerNodePathId,
  destination: Readonly<PlannerDropDestination>,
): PlannerTree {
  if (!tree.entityMap.has(activePathId)) {
    return tree;
  }

  const nodes = tree.flattenedItems.map((node) => {
    const plannerNode = toPlannerNode(node);

    return node.pathId === activePathId
      ? {
          ...plannerNode,
          parentPathId: destination.parentPathId,
          position: destination.position,
        }
      : plannerNode;
  });

  return buildPlannerTree(nodes);
}
