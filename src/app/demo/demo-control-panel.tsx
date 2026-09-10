import { ChevronDown, Pause, Play, RotateCcw, Wifi, WifiOff } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

type DemoControlPanelProps = {
  readonly collaboratorName: string;
  readonly isCollaboratorActive: boolean;
  readonly isOnline: boolean;
  readonly onCollaboratorActiveChange: (isActive: boolean) => void;
  readonly onOnlineChange: (isOnline: boolean) => void;
  readonly onReset: () => void;
};

// 리뷰어가 링크를 열자마자 무엇이 시뮬레이션인지, 무엇을 눌러 볼 수 있는지 알 수 있게 하는 안내다.
export function DemoControlPanel({
  collaboratorName,
  isCollaboratorActive,
  isOnline,
  onCollaboratorActiveChange,
  onOnlineChange,
  onReset,
}: DemoControlPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (!isExpanded) {
    return (
      <div className="fixed right-4 bottom-8 z-80">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-full shadow-lg"
          aria-expanded={false}
          onClick={() => setIsExpanded(true)}
        >
          <span className="size-1.5 rounded-full bg-brand" aria-hidden="true" />
          데모 안내
        </Button>
      </div>
    );
  }

  return (
    <aside
      aria-label="데모 안내"
      className="fixed right-4 bottom-8 z-80 w-80 rounded-2xl border bg-card/95 p-4 text-sm shadow-xl backdrop-blur"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="flex items-center gap-1.5 font-semibold">
            <span className="rounded-full bg-brand px-1.5 py-0.5 text-[10px] leading-none font-bold text-brand-foreground">
              DEMO
            </span>
            백엔드 없이 동작하는 데모
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            서버는 브라우저 안에서 흉내 내고, {collaboratorName}의 편집·채팅·커서는
            시뮬레이션입니다. 화면 코드는 백엔드에 연결할 때와 같습니다.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label="데모 안내 접기"
          aria-expanded
          onClick={() => setIsExpanded(false)}
        >
          <ChevronDown aria-hidden="true" />
        </Button>
      </div>

      <ul className="mt-3 space-y-1 border-t pt-3 text-xs text-muted-foreground">
        <li>
          <kbd className="font-sans font-semibold text-foreground">⌘/Ctrl+Z</kbd> 되돌리기 ·{" "}
          <kbd className="font-sans font-semibold text-foreground">⇧⌘/Ctrl+Shift+Z</kbd> 다시 실행
        </li>
        <li>드래그로 일정 이동 · Shift+클릭으로 여러 개 선택</li>
      </ul>

      <div className="mt-3 flex flex-wrap gap-1.5 border-t pt-3">
        <Button
          type="button"
          variant={isOnline ? "outline" : "default"}
          size="sm"
          onClick={() => onOnlineChange(!isOnline)}
        >
          {isOnline ? <WifiOff aria-hidden="true" /> : <Wifi aria-hidden="true" />}
          {isOnline ? "연결 끊기" : "다시 연결"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-pressed={isCollaboratorActive}
          onClick={() => onCollaboratorActiveChange(!isCollaboratorActive)}
        >
          {isCollaboratorActive ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
          {collaboratorName} {isCollaboratorActive ? "멈추기" : "움직이기"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onReset}>
          <RotateCcw aria-hidden="true" />
          처음부터
        </Button>
      </div>

      {isOnline ? null : (
        <p role="status" className="mt-2 rounded-lg bg-muted px-2.5 py-2 text-xs">
          연결이 끊긴 동안에도 {collaboratorName}는 서버에서 계속 편집합니다. 다시 연결하면 놓친
          변경을 서버에서 다시 받아옵니다.
        </p>
      )}
    </aside>
  );
}
