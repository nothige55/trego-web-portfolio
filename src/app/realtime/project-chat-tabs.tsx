import { Bot, Users } from "lucide-react";
import { type ReactNode, useState } from "react";

type ProjectChatTab = "ai" | "team";

type ProjectChatTabsProps = {
  readonly aiContent: ReactNode;
  readonly teamContent: ReactNode;
};

const tabs: ReadonlyArray<{
  readonly icon: typeof Users;
  readonly label: string;
  readonly value: ProjectChatTab;
}> = [
  { value: "team", label: "팀 채팅", icon: Users },
  { value: "ai", label: "AI 플래너", icon: Bot },
];

export function ProjectChatTabs({ aiContent, teamContent }: ProjectChatTabsProps) {
  const [activeTab, setActiveTab] = useState<ProjectChatTab>("team");

  return (
    <section aria-label="프로젝트 채팅" className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div
        role="tablist"
        aria-label="채팅 종류"
        className="mb-3 grid grid-cols-2 rounded-lg bg-muted p-1"
      >
        {tabs.map(({ icon, label, value }) => {
          const isActive = activeTab === value;
          const TabIcon = icon;

          return (
            <button
              key={value}
              type="button"
              role="tab"
              id={`project-chat-${value}-tab`}
              aria-controls={`project-chat-${value}-panel`}
              aria-selected={isActive}
              className={`flex h-8 items-center justify-center gap-1.5 rounded-md text-xs font-medium transition-colors ${
                isActive
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setActiveTab(value)}
            >
              <TabIcon aria-hidden="true" className="size-3.5" />
              {label}
            </button>
          );
        })}
      </div>
      <div
        role="tabpanel"
        id="project-chat-team-panel"
        aria-labelledby="project-chat-team-tab"
        hidden={activeTab !== "team"}
        className="min-h-0 flex-1 data-[active=true]:flex"
        data-active={activeTab === "team"}
      >
        {teamContent}
      </div>
      <div
        role="tabpanel"
        id="project-chat-ai-panel"
        aria-labelledby="project-chat-ai-tab"
        hidden={activeTab !== "ai"}
        className="min-h-0 flex-1 data-[active=true]:flex"
        data-active={activeTab === "ai"}
      >
        {aiContent}
      </div>
    </section>
  );
}
