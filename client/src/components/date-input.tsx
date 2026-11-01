import { useEffect, useState } from "react";
import { CalendarIcon } from "lucide-react";
import { zhTW } from "date-fns/locale";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { fmtDate, fmtMonth, parseDateInput, useDateStyle } from "@/lib/date-style";

interface DateInputProps {
  value: string;                   // 西元 YYYY-MM-DD，空字串表示未填
  onChange: (iso: string) => void;
  id?: string;
  className?: string;
  disabled?: boolean;
  "data-testid"?: string;
}

const isoOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// 日期欄位：依設定用民國或西元輸入。可直接打 1151105、115/11/5 等，也可點右邊的小日曆選
export function DateInput({ value, onChange, id, className, disabled, ...rest }: DateInputProps) {
  const [style] = useDateStyle();
  const [text, setText] = useState(fmtDate(value));
  const [open, setOpen] = useState(false);
  const parsed = parseDateInput(text);
  const invalid = text.trim() !== "" && !parsed;

  // 外部改了值（例 自動推薦日期、點小日曆）就更新文字；正在打字、值沒變時不動
  useEffect(() => {
    if ((parseDateInput(text) ?? "") !== (value ?? "")) setText(fmtDate(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, style]);

  const commit = () => { if (parsed) setText(fmtDate(parsed)); };
  const selected = value ? new Date(`${value}T00:00:00`) : undefined;

  return (
    <div className={cn("relative flex items-center", className)}>
      <Input
        id={id}
        value={text}
        disabled={disabled}
        inputMode="numeric"
        autoComplete="off"
        placeholder={style === "roc" ? "例 1151105 或 115/11/05" : "例 20261105 或 2026/11/05"}
        className={cn("pr-9 tabular-nums", invalid && "border-destructive focus-visible:ring-destructive")}
        aria-invalid={invalid}
        title={invalid ? "日期格式不正確或日期不存在" : parsed ? fmtDate(parsed, { long: true, weekday: true }) : ""}
        onChange={(e) => {
          setText(e.target.value);
          const iso = parseDateInput(e.target.value);
          if (iso) onChange(iso);
          else if (!e.target.value.trim()) onChange("");
        }}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); }}
        data-testid={rest["data-testid"]}
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="ghost" size="icon" disabled={disabled} className="!absolute right-0.5 h-8 w-8" aria-label="選擇日期" data-testid={rest["data-testid"] ? `${rest["data-testid"]}-picker` : undefined}>
            <CalendarIcon className="h-4 w-4 opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 z-[1100]" align="end">
          <Calendar
            mode="single"
            locale={zhTW}
            selected={selected}
            defaultMonth={selected}
            formatters={{ formatCaption: (d) => fmtMonth(d, style) }}
            onSelect={(d) => { if (d) { onChange(isoOf(d)); setText(fmtDate(isoOf(d))); } setOpen(false); }}
            initialFocus
          />
        </PopoverContent>
      </Popover>
      {invalid && <span className="sr-only">日期格式不正確</span>}
    </div>
  );
}
