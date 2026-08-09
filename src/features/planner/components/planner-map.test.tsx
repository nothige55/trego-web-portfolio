import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PlannerMap } from "@/features/planner/components/planner-map";
import { demoPlannerProject } from "@/features/planner/data/demo-planner";
import { usePlannerMapStore } from "@/features/planner/stores/planner-map-store";
import { usePlannerViewStore } from "@/features/planner/stores/planner-view-store";
import { act, render, screen, userEvent } from "@/testing/test-utils";

type EventHandler = () => void;

interface MockSource {
  readonly setData: ReturnType<typeof vi.fn>;
}

interface MockMapInstance {
  readonly addLayer: ReturnType<typeof vi.fn>;
  readonly addControl: ReturnType<typeof vi.fn>;
  readonly addSource: ReturnType<typeof vi.fn>;
  readonly easeTo: ReturnType<typeof vi.fn>;
  readonly fitBounds: ReturnType<typeof vi.fn>;
  readonly getZoom: ReturnType<typeof vi.fn>;
  readonly getSource: (id: string) => MockSource | undefined;
  readonly remove: ReturnType<typeof vi.fn>;
  readonly resize: ReturnType<typeof vi.fn>;
  readonly setCenter: ReturnType<typeof vi.fn>;
  readonly setZoom: ReturnType<typeof vi.fn>;
  trigger: (event: string) => void;
}

interface MockMarkerInstance {
  readonly addTo: ReturnType<typeof vi.fn>;
  readonly element: HTMLDivElement;
  readonly remove: ReturnType<typeof vi.fn>;
  readonly setLngLat: ReturnType<typeof vi.fn>;
}

const mapboxMocks = vi.hoisted(() => ({
  mapConstructor: vi.fn(),
  mapInstances: [] as MockMapInstance[],
  markerConstructor: vi.fn(),
  markerInstances: [] as MockMarkerInstance[],
  navigationControlConstructor: vi.fn(),
}));

vi.mock("mapbox-gl", () => {
  class MockMap implements MockMapInstance {
    private readonly handlers = new globalThis.Map<string, Set<EventHandler>>();
    private readonly sources = new globalThis.Map<string, MockSource>();
    readonly addControl = vi.fn();
    readonly addLayer = vi.fn();
    readonly easeTo = vi.fn();
    readonly fitBounds = vi.fn();
    readonly getZoom = vi.fn(() => 9);
    readonly remove = vi.fn();
    readonly resize = vi.fn();
    readonly setCenter = vi.fn();
    readonly setZoom = vi.fn();
    readonly addSource = vi.fn((id: string) => {
      this.sources.set(id, { setData: vi.fn() });
    });
    readonly getSource = vi.fn((id: string) => this.sources.get(id));

    constructor(options: unknown) {
      mapboxMocks.mapConstructor(options);
      mapboxMocks.mapInstances.push(this);
    }

    on(event: string, handler: EventHandler): void {
      const handlers = this.handlers.get(event) ?? new Set<EventHandler>();
      handlers.add(handler);
      this.handlers.set(event, handlers);
    }

    trigger(event: string): void {
      this.handlers.get(event)?.forEach((handler) => {
        handler();
      });
    }
  }

  class MockMarker implements MockMarkerInstance {
    readonly element: HTMLDivElement;
    readonly remove = vi.fn();
    readonly setLngLat = vi.fn(() => this);
    readonly addTo = vi.fn(() => this);

    constructor(options: { element: HTMLDivElement }) {
      this.element = options.element;
      mapboxMocks.markerConstructor(options);
      mapboxMocks.markerInstances.push(this);
    }
  }

  class MockNavigationControl {
    constructor(options: unknown) {
      mapboxMocks.navigationControlConstructor(options);
    }
  }

  return {
    default: { Map: MockMap, Marker: MockMarker, NavigationControl: MockNavigationControl },
  };
});

describe("PlannerMap", () => {
  let resizeCallback: ResizeObserverCallback | undefined;

  beforeEach(() => {
    mapboxMocks.mapConstructor.mockClear();
    mapboxMocks.mapInstances.length = 0;
    mapboxMocks.markerConstructor.mockClear();
    mapboxMocks.markerInstances.length = 0;
    mapboxMocks.navigationControlConstructor.mockClear();
    usePlannerMapStore.getState().reset();
    usePlannerViewStore.getState().load(demoPlannerProject.nodes);

    class MockResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        resizeCallback = callback;
      }

      observe(): void {}
      disconnect(): void {}
    }

    vi.stubGlobal("ResizeObserver", MockResizeObserver);
  });

  afterEach(() => {
    usePlannerMapStore.getState().reset();
    usePlannerViewStore.getState().reset();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    resizeCallback = undefined;
  });

  it("shows configuration guidance without constructing Mapbox when the token is missing", () => {
    render(<PlannerMap accessToken={null} />);

    expect(screen.getByText("Mapbox 토큰이 필요합니다")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(mapboxMocks.mapConstructor).not.toHaveBeenCalled();
  });

  it("creates map layers and markers once, updates visibility, resizes, and cleans up", () => {
    const { unmount } = render(<PlannerMap accessToken="pk.test" />);
    const map = mapboxMocks.mapInstances[0];
    const mapContainer = screen.getByTestId("planner-map-canvas");

    expect(mapContainer).toHaveClass("h-full", "w-full");
    expect(mapContainer.parentElement).toHaveClass("absolute", "inset-0");
    expect(map.addControl).toHaveBeenCalledWith(expect.anything(), "top-right");
    expect(mapboxMocks.navigationControlConstructor).toHaveBeenCalledWith({
      visualizePitch: true,
    });
    expect(screen.getByRole("status")).toHaveTextContent("지도를 불러오는 중입니다");

    act(() => {
      map.trigger("load");
    });

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(map.addSource).toHaveBeenCalledWith(
      "planner-routes",
      expect.objectContaining({ type: "geojson" }),
    );
    expect(map.addLayer).toHaveBeenCalledTimes(2);
    expect(mapboxMocks.markerInstances.length).toBeGreaterThan(0);
    expect(mapboxMocks.markerConstructor).toHaveBeenCalledWith(
      expect.objectContaining({ anchor: "bottom", offset: [0, 16] }),
    );
    expect(map.fitBounds).toHaveBeenCalledTimes(1);
    const routeSource = map.getSource("planner-routes") as MockSource;
    expect(routeSource.setData).toHaveBeenCalledWith(
      expect.objectContaining({ type: "FeatureCollection" }),
    );

    act(() => {
      usePlannerMapStore.getState().toggleDayVisibility("day-one");
    });

    expect(mapboxMocks.markerInstances.some((marker) => marker.remove.mock.calls.length > 0)).toBe(
      true,
    );
    expect(routeSource.setData.mock.calls.length).toBeGreaterThan(1);

    act(() => {
      resizeCallback?.([], {} as ResizeObserver);
    });
    expect(map.resize).toHaveBeenCalled();

    unmount();
    expect(map.remove).toHaveBeenCalledTimes(1);
    expect(mapboxMocks.markerInstances.every((marker) => marker.remove.mock.calls.length > 0)).toBe(
      true,
    );
  });

  it("keeps Planner state while retrying a failed initial map load", async () => {
    const user = userEvent.setup();
    usePlannerViewStore.getState().selectItem("day-one-airport");
    render(<PlannerMap accessToken="pk.test" />);
    const firstMap = mapboxMocks.mapInstances[0];

    act(() => {
      firstMap.trigger("error");
    });

    expect(screen.getByRole("alert")).toHaveTextContent("지도를 불러오지 못했습니다");
    expect(screen.queryByRole("button", { name: "전체 일정 보기" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "지도 다시 시도" }));

    expect(firstMap.remove).toHaveBeenCalledTimes(1);
    expect(mapboxMocks.mapConstructor).toHaveBeenCalledTimes(2);
    expect(usePlannerViewStore.getState().selectedItemId).toBe("day-one-airport");
    expect(screen.getByRole("status")).toHaveTextContent("지도를 불러오는 중입니다");

    const retriedMap = mapboxMocks.mapInstances[1];
    act(() => {
      retriedMap.trigger("load");
    });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "전체 일정 보기" })).toBeInTheDocument();
    expect(retriedMap.easeTo).toHaveBeenCalledWith(
      expect.objectContaining({ center: [126.4914, 33.5104] }),
    );
  });

  it("offers retry when the initial map load times out", () => {
    vi.useFakeTimers();
    const { unmount } = render(<PlannerMap accessToken="pk.test" />);

    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    expect(screen.getByRole("alert")).toHaveTextContent("지도를 불러오지 못했습니다");
    expect(screen.getByRole("button", { name: "지도 다시 시도" })).toBeInTheDocument();

    unmount();
  });

  it("focuses places, Day bounds, and a selected hidden Day without moving for root or Shift selection", () => {
    render(<PlannerMap accessToken="pk.test" />);
    const map = mapboxMocks.mapInstances[0];

    act(() => {
      map.trigger("load");
    });
    map.fitBounds.mockClear();

    act(() => {
      usePlannerViewStore.getState().selectItem("day-one-airport");
    });
    expect(map.easeTo).toHaveBeenCalledWith(
      expect.objectContaining({ center: [126.4914, 33.5104], zoom: 14, duration: 500 }),
    );
    const selectedMarker = mapboxMocks.markerInstances.find(({ element }) =>
      element.textContent?.includes("제주국제공항"),
    );
    expect(selectedMarker?.element.style.zIndex).toBe("10");
    expect(selectedMarker?.element.querySelectorAll("span")[1]).toHaveStyle({
      transform: "scale(1.2)",
    });

    map.easeTo.mockClear();
    act(() => {
      usePlannerViewStore.getState().selectItem("day-one-airport");
    });
    expect(map.easeTo).toHaveBeenCalledTimes(1);
    expect(mapboxMocks.mapConstructor).toHaveBeenCalledTimes(1);

    map.easeTo.mockClear();
    act(() => {
      usePlannerViewStore.getState().selectItem("day-one-iho", true);
    });
    expect(map.easeTo).not.toHaveBeenCalled();
    expect(map.fitBounds).not.toHaveBeenCalled();

    act(() => {
      usePlannerViewStore.getState().clearSelection();
      usePlannerViewStore.getState().selectItem("day-one");
    });
    expect(map.fitBounds).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ padding: 80, maxZoom: 14, duration: 500 }),
    );

    act(() => {
      usePlannerViewStore.getState().clearSelection();
    });
    map.fitBounds.mockClear();
    act(() => {
      usePlannerMapStore.getState().toggleDayVisibility("day-one");
      usePlannerViewStore.getState().selectItem("day-one");
    });
    expect(map.fitBounds).toHaveBeenCalledTimes(1);

    map.fitBounds.mockClear();
    act(() => {
      usePlannerViewStore.getState().clearSelection();
      usePlannerViewStore.getState().selectItem("root");
    });
    expect(map.easeTo).not.toHaveBeenCalled();
    expect(map.fitBounds).not.toHaveBeenCalled();
  });

  it("returns to the complete visible schedule from the map control", async () => {
    const user = userEvent.setup();
    render(<PlannerMap accessToken="pk.test" />);
    const map = mapboxMocks.mapInstances[0];

    act(() => {
      map.trigger("load");
      usePlannerViewStore.getState().selectItem("day-one-airport");
    });
    map.fitBounds.mockClear();

    await user.click(screen.getByRole("button", { name: "전체 일정 보기" }));

    expect(map.fitBounds).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ duration: 0, maxZoom: 14 }),
    );
  });
});
