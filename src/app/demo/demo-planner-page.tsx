// 운영과 같은 ProjectPlannerPage에 브라우저 안의 서버를 주입. feature 코드에는 데모 분기가 없음

import { useEffect, useState, useSyncExternalStore } from "react";

import { createDemoCollaborator } from "@/app/demo/demo-collaborator";
import { DemoControlPanel } from "@/app/demo/demo-control-panel";
import { createDemoNetwork } from "@/app/demo/demo-network";
import { createDemoProjectServer } from "@/app/demo/demo-project-server";
import { createDemoRestClient } from "@/app/demo/demo-rest-client";
import {
  createDemoProjectSeed,
  DEMO_COLLABORATOR,
  DEMO_IDENTITY,
  DEMO_INITIAL_EXPANDED_PATH_IDS,
  DEMO_MEMBERS,
  DEMO_PROJECT_ID,
} from "@/app/demo/demo-seed";
import { createDemoSignalRClient } from "@/app/demo/demo-signalr-client";
import { ProjectPlannerPage } from "@/app/realtime/project-planner-page";
import { usePlannerViewStore } from "@/features/planner/stores/planner-view-store";
import type { PlannerNode } from "@/features/planner/types/planner-node";

// 사용자가 고르고 있는 노드는 동료가 건드리지 않음. 편집을 가로채면 데모가 방해가 됨
function isUntouchedByUser(node: PlannerNode): boolean {
  const { multiSelectedIds, selectedItemId } = usePlannerViewStore.getState();
  return node.pathId !== selectedItemId && !multiSelectedIds.includes(node.pathId);
}

// 첫 화면에서 동료가 편집하는 날짜가 클릭 없이 보이도록, 일정이 처음 적재되면 한 번만 펼침
function expandInitialNodesOnLoad(): () => void {
  let isExpanded = false;
  const unsubscribe = usePlannerViewStore.subscribe(({ expandNode, tree }) => {
    if (isExpanded || !DEMO_INITIAL_EXPANDED_PATH_IDS.every((id) => tree.entityMap.has(id))) {
      return;
    }

    isExpanded = true;
    unsubscribe();
    DEMO_INITIAL_EXPANDED_PATH_IDS.forEach((pathId) => expandNode(pathId));
  });

  return unsubscribe;
}

// 드래그 중에 원격 변경이 끼어들면 드롭 위치가 흔들리므로, 누르고 있는 동안은 동료가 기다림
function createPointerPressTracker() {
  let isPressed = false;
  const handlePointerDown = () => {
    isPressed = true;
  };
  const handlePointerUp = () => {
    isPressed = false;
  };

  return {
    isPressed: () => isPressed,
    listen() {
      window.addEventListener("pointerdown", handlePointerDown, true);
      window.addEventListener("pointerup", handlePointerUp, true);
      window.addEventListener("pointercancel", handlePointerUp, true);

      return () => {
        window.removeEventListener("pointerdown", handlePointerDown, true);
        window.removeEventListener("pointerup", handlePointerUp, true);
        window.removeEventListener("pointercancel", handlePointerUp, true);
      };
    },
  };
}

function createDemoEnvironment() {
  const network = createDemoNetwork();
  const pointer = createPointerPressTracker();
  const server = createDemoProjectServer({ members: DEMO_MEMBERS, seed: createDemoProjectSeed() });

  return {
    network,
    pointer,
    clientFactory: () => createDemoSignalRClient({ network, server }),
    collaborator: createDemoCollaborator({
      canTouch: isUntouchedByUser,
      member: DEMO_COLLABORATOR,
      server,
      shouldHold: () => pointer.isPressed() || document.visibilityState === "hidden",
    }),
    restClient: createDemoRestClient({ network, server }),
  };
}

export function DemoPlannerPage() {
  const [sessionKey, setSessionKey] = useState(0);

  return <DemoPlannerSession key={sessionKey} onReset={() => setSessionKey((key) => key + 1)} />;
}

function DemoPlannerSession({ onReset }: { readonly onReset: () => void }) {
  const [environment] = useState(createDemoEnvironment);
  const { collaborator, network, pointer } = environment;
  const isOnline = useSyncExternalStore(network.subscribe, network.isOnline);
  const [isCollaboratorActive, setIsCollaboratorActive] = useState(true);

  useEffect(() => pointer.listen(), [pointer]);
  useEffect(() => expandInitialNodesOnLoad(), []);

  useEffect(() => {
    if (!isCollaboratorActive) {
      return;
    }

    collaborator.start();

    return () => {
      collaborator.stop();
    };
  }, [collaborator, isCollaboratorActive]);

  return (
    <>
      <ProjectPlannerPage
        clientFactory={environment.clientFactory}
        identity={DEMO_IDENTITY}
        projectId={DEMO_PROJECT_ID}
        restClient={environment.restClient}
      />
      <DemoControlPanel
        collaboratorName={DEMO_COLLABORATOR.name}
        isCollaboratorActive={isCollaboratorActive}
        isOnline={isOnline}
        onCollaboratorActiveChange={setIsCollaboratorActive}
        onOnlineChange={network.setOnline}
        onReset={onReset}
      />
    </>
  );
}
