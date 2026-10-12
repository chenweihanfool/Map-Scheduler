import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

export interface ChangelogRelease {
  version: string;
  date: string;
  items: string[];
}

interface ChangelogTimelineProps {
  releases: ChangelogRelease[];
  currentVersion: string;
}

export function ChangelogTimeline({ releases, currentVersion }: ChangelogTimelineProps) {
  // 預設只展開最新版本
  const [openVersions, setOpenVersions] = useState<Set<string>>(
    () => new Set([currentVersion]),
  );

  const toggle = (version: string, open: boolean) => {
    setOpenVersions((prev) => {
      const next = new Set(prev);
      if (open) next.add(version);
      else next.delete(version);
      return next;
    });
  };

  return (
    <ol className="pt-2" data-testid="changelog-timeline">
      {releases.map((release, index) => {
        const isCurrent = release.version === currentVersion;
        const isOpen = openVersions.has(release.version);
        const isLast = index === releases.length - 1;

        return (
          <li key={release.version} className="grid grid-cols-[5.5rem_1.5rem_1fr]">
            {/* 左：版本號與日期 */}
            <div className="flex flex-col items-end gap-1 pr-1 pt-0.5">
              <Badge
                variant={isCurrent ? "default" : "secondary"}
                className="font-mono"
              >
                {release.version}
              </Badge>
              <span className="text-xs text-muted-foreground tabular-nums">
                {release.date}
              </span>
            </div>

            {/* 中：時間軸線與節點 */}
            <div className="relative flex justify-center">
              {!isLast && (
                <span className="absolute top-3 bottom-0 w-px bg-border" aria-hidden />
              )}
              <span
                className={cn(
                  "relative mt-1.5 h-3 w-3 rounded-full border-2",
                  isCurrent
                    ? "border-primary bg-primary"
                    : "border-muted-foreground/50 bg-background",
                )}
                aria-hidden
              />
            </div>

            {/* 右：可折疊的內容 */}
            <Collapsible
              open={isOpen}
              onOpenChange={(open) => toggle(release.version, open)}
              className={cn("pl-1 min-w-0", !isLast && "pb-5")}
            >
              <CollapsibleTrigger
                className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm hover-elevate"
                data-testid={`changelog-toggle-${release.version}`}
              >
                <span className="font-medium">{release.items.length} 項更新</span>
                {isCurrent && (
                  <Badge variant="outline" className="text-xs text-green-600 border-green-400">
                    最新
                  </Badge>
                )}
                <ChevronDown
                  className={cn(
                    "ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                    isOpen && "rotate-180",
                  )}
                />
              </CollapsibleTrigger>
              {!isOpen && (
                <p className="truncate px-2 text-xs text-muted-foreground">
                  {release.items[0]}
                </p>
              )}
              <CollapsibleContent>
                <ul className="space-y-1.5 px-2 pt-1">
                  {release.items.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <span className="text-primary mt-0.5 shrink-0">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </CollapsibleContent>
            </Collapsible>
          </li>
        );
      })}
    </ol>
  );
}
