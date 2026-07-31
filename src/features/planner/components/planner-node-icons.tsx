import { Heart } from "lucide-react";

import type { FlattenedPlannerNode } from "@/features/planner/types/planner-node";

type IconSizeProps = {
  readonly size?: number;
};

type PlannerCalendarIconProps = IconSizeProps & {
  readonly color?: string | null;
  readonly dayNumber: number | string;
};

export function PlannerCalendarIcon({ size = 16, color, dayNumber }: PlannerCalendarIconProps) {
  const calendarColor = color || "#F44336";

  return (
    <svg
      aria-hidden="true"
      data-planner-icon="calendar"
      data-color={calendarColor}
      data-number={dayNumber}
      width={size}
      height={size}
      viewBox="5 3 38 39"
      className="shrink-0"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path fill="#EDF5FF" d="M5 38V14h38v24a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4Z" />
      <path fill={calendarColor} d="M43 10v6H5v-6a4 4 0 0 1 4-4h30a4 4 0 0 1 4 4Z" />
      <g fill="#37474F">
        <circle cx="33" cy="10" r="3" />
        <circle cx="15" cy="10" r="3" />
      </g>
      <g fill="#B0BEC5">
        <path d="M33 3a2 2 0 0 0-2 2v5a2 2 0 1 0 4 0V5a2 2 0 0 0-2-2Z" />
        <path d="M15 3a2 2 0 0 0-2 2v5a2 2 0 1 0 4 0V5a2 2 0 0 0-2-2Z" />
      </g>
      <text
        x="24"
        y="30"
        fill="#37474F"
        fontSize="20"
        fontWeight="700"
        textAnchor="middle"
        dominantBaseline="middle"
      >
        {dayNumber}
      </text>
    </svg>
  );
}

type PlannerFolderIconProps = IconSizeProps & {
  readonly color?: string | null;
};

export function PlannerFolderIcon({ size = 16, color }: PlannerFolderIconProps) {
  const folderColor = color || "#FFA000";

  return (
    <svg
      aria-hidden="true"
      data-planner-icon="folder"
      width={size}
      height={size}
      viewBox="4 8 40 32"
      className="shrink-0"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path fill={folderColor} d="M40 12H22l-4-4H8a4 4 0 0 0-4 4v8h40v-4a4 4 0 0 0-4-4Z" />
      <path
        fill={folderColor}
        d="M40 12H8a4 4 0 0 0-4 4v20a4 4 0 0 0 4 4h32a4 4 0 0 0 4-4V16a4 4 0 0 0-4-4Z"
      />
    </svg>
  );
}

type PlannerMarkerIconProps = IconSizeProps & {
  readonly color?: string | null;
  readonly number?: number | string;
};

function PlannerNumberedPin({
  size,
  color,
  number,
}: Required<Pick<PlannerMarkerIconProps, "size">> &
  Pick<PlannerMarkerIconProps, "color" | "number">) {
  return (
    <svg
      aria-hidden="true"
      data-planner-icon="marker"
      data-number={number}
      width={size}
      height={size}
      viewBox="0 0 384 512"
      className="shrink-0"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fill={color || "#9D9D9D"}
        d="M172.268 501.67C26.97 291.031 0 269.413 0 192 0 85.961 85.961 0 192 0s192 85.961 192 192c0 77.413-26.97 99.031-172.268 309.67-9.535 13.774-29.93 13.773-39.464 0Z"
      />
      <text
        x="192"
        y="224"
        fill="#FFFFFF"
        fontSize="320"
        fontWeight="700"
        textAnchor="middle"
        dominantBaseline="middle"
      >
        {number}
      </text>
    </svg>
  );
}

export function PlannerMarkerIcon({ size = 16, color, number }: PlannerMarkerIconProps) {
  return <PlannerNumberedPin size={size} color={color} number={number} />;
}

type PlannerNodeIconProps = IconSizeProps & {
  readonly node: FlattenedPlannerNode;
  readonly dayNumber?: number;
  readonly parent?: FlattenedPlannerNode;
};

// 일정 행과 breadcrumb가 같은 도메인 아이콘 규칙을 공유하도록 노드별 조합을 한곳에 둔다.
export function PlannerNodeIcon({ node, dayNumber, parent, size = 16 }: PlannerNodeIconProps) {
  if (node.kind === "folder") {
    if (node.folderType === "wish") {
      return (
        <Heart
          aria-hidden="true"
          className="shrink-0 fill-[#F44336] text-[#F44336]"
          style={{ width: size, height: size }}
        />
      );
    }

    return <PlannerFolderIcon color={node.color} size={size} />;
  }

  if (node.kind === "day") {
    return <PlannerCalendarIcon color={node.color} dayNumber={dayNumber ?? ""} size={size} />;
  }

  return (
    <PlannerMarkerIcon
      color={node.color}
      number={parent?.kind === "day" ? node.siblingIndex + 1 : undefined}
      size={size}
    />
  );
}
