import { Eye, SlidersHorizontal } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { surveyorColorStyle } from "@/lib/surveyor-colors";
import { useSurveyorVisibility, type SurveyorVis } from "@/lib/surveyor-visibility";
import type { Surveyor } from "@shared/schema";

const OPTIONS: { v: SurveyorVis; label: string }[] = [
  { v: "show", label: "顯示" },
  { v: "dim", label: "淡化" },
  { v: "hide", label: "隱藏" },
];

// 月曆／排班表上方的「測量員顯示」設定：每位測量員可選顯示、淡化或隱藏
export function SurveyorVisibilityMenu() {
  const { data: surveyors = [] } = useQuery<Surveyor[]>({ queryKey: ["/api/surveyors"] });
  const { visOf, setVis, reset, changed } = useSurveyorVisibility();
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant={changed ? "default" : "outline"} size="sm" className="gap-1.5" data-testid="button-surveyor-visibility">
          <SlidersHorizontal className="h-4 w-4" />
          測量員顯示{changed ? `（${changed}）` : ""}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-3">
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="font-medium text-sm">測量員顯示</div>
            <div className="text-xs text-muted-foreground">只套用在這台電腦，不影響其他人</div>
          </div>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={reset} disabled={!changed} data-testid="button-visibility-reset">全部顯示</Button>
        </div>
        <div className="space-y-1 max-h-[60vh] overflow-y-auto">
          {surveyors.map((s, i) => {
            const v = visOf(s.name);
            return (
              <div key={s.id} className="flex items-center gap-2" data-testid={`vis-row-${s.name}`}>
                <span className={cn("w-3 h-3 rounded-sm border shrink-0", surveyorColorStyle(s, i).chip)} />
                <span className={cn("text-sm flex-1 truncate", v === "dim" && "opacity-50", v === "hide" && "line-through text-muted-foreground")}>{s.name}</span>
                <div className="inline-flex rounded-md border p-0.5 shrink-0">
                  {OPTIONS.map((o) => (
                    <button
                      key={o.v}
                      type="button"
                      onClick={() => setVis(s.name, o.v)}
                      className={cn("px-2 py-0.5 text-xs rounded", v === o.v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}
                      data-testid={`vis-${s.name}-${o.v}`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground flex items-center gap-1">
          <Eye className="h-3 w-3" />點右側測量員卡片篩選時，即使設為隱藏也會顯示那位。
        </p>
      </PopoverContent>
    </Popover>
  );
}
