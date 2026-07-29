import { describe, expect, it } from "vitest";

import {
  normalizeActivityUpdated,
  normalizeParentPathId,
  reducePlannerHubEvent,
} from "@/features/planner/realtime/planner-realtime-reducer";
import type {
  CreateActivityRequest,
  CreateDayRequest,
  CreateFolderRequest,
  PlannerHubEvent,
} from "@/features/planner/realtime/project-hub-planner-contracts";
import { EMPTY_GUID } from "@/features/planner/realtime/project-hub-planner-contracts";
import type { PlannerNode } from "@/features/planner/types/planner-node";

const folderRequest: CreateFolderRequest = {
  id: "folder-id",
  name: "Trip",
  type: "default",
  pathId: "folder-path",
  parentPathId: EMPTY_GUID,
  position: 0,
};

const dayRequest: CreateDayRequest = {
  id: "day-id",
  name: "Day 1",
  color: "blue",
  pathId: "day-path",
  parentPathId: "folder-path",
  position: 1,
};

const activityRequest: CreateActivityRequest = {
  id: "activity-id",
  name: "Museum",
  type: "place",
  marker: "museum",
  travelMode: "walk",
  travelTimeMinutes: 15,
  travelDistanceMeters: 1200,
  travelCost: "0",
  lat: 37.5,
  lng: 127,
  rating: 4.7,
  ratingCount: 250,
  googleId: "google-place",
  pathId: "activity-path",
  parentPathId: "day-path",
  position: 2,
};

function apply(nodes: readonly PlannerNode[], event: PlannerHubEvent): readonly PlannerNode[] {
  return reducePlannerHubEvent(nodes, event);
}

describe("planner realtime normalization", () => {
  it("normalizes empty parent GUID values to the domain root", () => {
    expect(normalizeParentPathId(EMPTY_GUID)).toBeNull();
    expect(normalizeParentPathId("")).toBeNull();
    expect(normalizeParentPathId("parent")).toBe("parent");

    const nodes = apply([], { name: "OnFolderCreated", payload: folderRequest });

    expect(nodes[0]?.parentPathId).toBeNull();
  });

  it("maps transport activity fields and its misspelled duration field to domain names", () => {
    let nodes = apply([], { name: "OnActivityCreated", payload: activityRequest });
    nodes = apply(nodes, {
      name: "OnActivityUpdated",
      payload: {
        id: "activity-id",
        marker: "food",
        travelTimeMinuates: 25,
        travelDistanceMeters: 1800,
      },
    });

    expect(nodes[0]).toMatchObject({
      markerType: "food",
      travelTime: 25,
      travelDistance: 1800,
      latitude: 37.5,
      longitude: 127,
      googlePlaceId: "google-place",
    });
    expect(normalizeActivityUpdated({ id: "activity-id", name: null })).toEqual({
      id: "activity-id",
    });
  });
});

describe("reducePlannerHubEvent", () => {
  it("upserts create events by pathId so sender echoes do not duplicate nodes", () => {
    const optimistic = apply([], { name: "OnActivityCreated", payload: activityRequest });
    const echoed = apply(optimistic, { name: "OnActivityCreated", payload: activityRequest });

    expect(echoed).toBe(optimistic);
    expect(echoed).toHaveLength(1);

    const serverVersion = apply(echoed, {
      name: "OnActivityCreated",
      payload: { ...activityRequest, name: "Museum (server)" },
    });
    expect(serverVersion).toHaveLength(1);
    expect(serverVersion[0]?.name).toBe("Museum (server)");
  });

  it("applies path, folder, day, and activity updates idempotently", () => {
    let nodes = apply([], { name: "OnFolderCreated", payload: folderRequest });
    nodes = apply(nodes, { name: "OnDayCreated", payload: dayRequest });
    nodes = apply(nodes, { name: "OnActivityCreated", payload: activityRequest });
    nodes = apply(nodes, {
      name: "OnPathUpdated",
      payload: { pathId: "activity-path", parentPathId: EMPTY_GUID, position: 4 },
    });
    nodes = apply(nodes, {
      name: "OnFolderUpdated",
      payload: { id: "folder-id", name: "Wish list", type: "wish" },
    });
    nodes = apply(nodes, {
      name: "OnDayUpdated",
      payload: { id: "day-id", name: "Arrival", color: "green" },
    });
    nodes = apply(nodes, {
      name: "OnActivityUpdated",
      payload: {
        id: "activity-id",
        name: "Gallery",
        memo: "Tickets booked",
        marker: null,
        travelMode: "transit",
      },
    });

    expect(nodes).toEqual([
      expect.objectContaining({ name: "Wish list", folderType: "wish" }),
      expect.objectContaining({ name: "Arrival", color: "green" }),
      expect.objectContaining({
        name: "Gallery",
        memo: "Tickets booked",
        markerType: null,
        travelMode: "transit",
        parentPathId: null,
        position: 4,
      }),
    ]);

    const repeated = apply(nodes, {
      name: "OnActivityUpdated",
      payload: {
        id: "activity-id",
        name: "Gallery",
        memo: "Tickets booked",
        marker: null,
        travelMode: "transit",
      },
    });
    expect(repeated).toBe(nodes);
  });

  it("removes a node and all descendants while ignoring repeated delete echoes", () => {
    let nodes = apply([], { name: "OnFolderCreated", payload: folderRequest });
    nodes = apply(nodes, { name: "OnDayCreated", payload: dayRequest });
    nodes = apply(nodes, { name: "OnActivityCreated", payload: activityRequest });

    const deleted = apply(nodes, {
      name: "OnNodeDeleted",
      payload: { pathId: "day-path" },
    });
    const echoed = apply(deleted, {
      name: "OnNodeDeleted",
      payload: { pathId: "day-path" },
    });

    expect(deleted.map((node) => node.pathId)).toEqual(["folder-path"]);
    expect(echoed).toBe(deleted);
  });

  it("leaves node state unchanged for project metadata events and unknown entity updates", () => {
    const nodes = apply([], { name: "OnFolderCreated", payload: folderRequest });
    const projectEvent = apply(nodes, {
      name: "OnProjectDateUpdated",
      payload: {
        publicId: "project-id",
        title: "Seoul",
        startDate: "2026-08-01",
        endDate: "2026-08-03",
        isPublic: false,
      },
    });
    const missingUpdate = apply(nodes, {
      name: "OnDayUpdated",
      payload: { id: "missing", name: "Missing", color: "red" },
    });

    expect(projectEvent).toBe(nodes);
    expect(missingUpdate).toBe(nodes);
  });
});
