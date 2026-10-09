import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ALL_LAND_SECTIONS, LAND_SECTIONS, sectionLabel, type LandSection } from "@shared/land-sections";

type SectionComboboxProps = Omit<React.ComponentProps<"input">, "value" | "onChange" | "onBlur" | "ref"> & {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
};

// 輸入段代碼（例如 1117）或段名關鍵字（例如 城北）都能找到；清單依段代碼由小到大
function matchSections(query: string): LandSection[] {
  const q = query.trim();
  if (!q) return LAND_SECTIONS;
  // 已經是完整的「鄉鎮+段名」時（例如編輯舊案件），列出全部方便改選
  if (LAND_SECTIONS.some((s) => sectionLabel(s) === q)) return LAND_SECTIONS;
  // 代碼可省略開頭的 0，例如 317 也能找到 0317
  if (/^\d+$/.test(q)) return LAND_SECTIONS.filter((s) => s.code.startsWith(q) || s.code.replace(/^0+/, "").startsWith(q));
  return LAND_SECTIONS.filter((s) => sectionLabel(s).includes(q) || s.name.includes(q));
}

function findByCode(query: string): LandSection | undefined {
  const q = query.trim();
  if (!/^\d{1,4}$/.test(q)) return undefined;
  return LAND_SECTIONS.find((s) => s.code === q.padStart(4, "0"));
}

export const SectionCombobox = forwardRef<HTMLInputElement, SectionComboboxProps>(
  ({ value, onChange, onBlur, className, ...inputProps }, ref) => {
    const [open, setOpen] = useState(false);
    const [highlight, setHighlight] = useState(0);
    const listRef = useRef<HTMLDivElement>(null);

    const options = useMemo(() => matchSections(value || ""), [value]);
    // 現行地段優先；舊案件可能是已停用的地段，一樣顯示代碼並標註
    const current =
      LAND_SECTIONS.find((s) => sectionLabel(s) === (value || "").trim()) ??
      ALL_LAND_SECTIONS.find((s) => sectionLabel(s) === (value || "").trim());

    useEffect(() => {
      setHighlight(0);
    }, [value]);

    useEffect(() => {
      if (!open) return;
      const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${highlight}"]`);
      el?.scrollIntoView({ block: "nearest" });
    }, [highlight, open]);

    const select = (section: LandSection) => {
      onChange(sectionLabel(section));
      setOpen(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setOpen(true);
        setHighlight((h) => Math.min(h + 1, options.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlight((h) => Math.max(h - 1, 0));
      } else if (e.key === "Enter" && open && options[highlight]) {
        // 選地段，不要送出整張表單
        e.preventDefault();
        select(options[highlight]);
      }
    };

    // Esc 只關選單不關對話框：Radix Dialog 在 document 的 capture 階段就攔 Esc，
    // 所以要在更早的 window capture 階段先處理
    useEffect(() => {
      if (!open) return;
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key !== "Escape") return;
        e.stopPropagation();
        setOpen(false);
      };
      window.addEventListener("keydown", onKeyDown, true);
      return () => window.removeEventListener("keydown", onKeyDown, true);
    }, [open]);

    const handleBlur = () => {
      setOpen(false);
      // 只輸入段代碼就離開欄位時，自動換成對應的段名
      const byCode = findByCode(value || "");
      if (byCode) onChange(sectionLabel(byCode));
      onBlur?.();
    };

    return (
      <div className="relative">
        <div className="relative">
          <Input
            {...inputProps}
            ref={ref}
            value={value}
            autoComplete="off"
            role="combobox"
            aria-expanded={open}
            aria-controls="section-combobox-list"
            onChange={(e) => {
              onChange(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onClick={() => setOpen(true)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className={cn("pr-8", className)}
            data-testid="input-section"
          />
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        </div>
        {current && !open && (
          <p className="mt-1 text-xs text-muted-foreground" data-testid="text-section-code">
            段代碼 {current.code}{current.retired && "（此段已停用，請改選現行地段）"}
          </p>
        )}
        {open && (
          <div
            ref={listRef}
            id="section-combobox-list"
            role="listbox"
            className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-md"
            data-testid="list-section-options"
          >
            {options.length === 0 ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                找不到符合的地段，可直接輸入
              </div>
            ) : (
              options.map((s, i) => (
                <div
                  key={s.code}
                  role="option"
                  aria-selected={i === highlight}
                  data-index={i}
                  // mousedown 先選，避免 input 失焦把選單關掉
                  onMouseDown={(e) => {
                    e.preventDefault();
                    select(s);
                  }}
                  onMouseEnter={() => setHighlight(i)}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm",
                    i === highlight && "bg-accent text-accent-foreground",
                  )}
                  data-testid={`option-section-${s.code}`}
                >
                  <span className="font-mono text-xs text-muted-foreground tabular-nums">{s.code}</span>
                  <span className="flex-1 truncate">{s.name}</span>
                  <span className="text-xs text-muted-foreground">{s.township}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    );
  },
);
SectionCombobox.displayName = "SectionCombobox";
