import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { fmtDate, useDateStyle, type DateStyle } from "@/lib/date-style";

// 日期格式（民國／西元）：只影響這台電腦這個瀏覽器的顯示與輸入，資料與同步一律西元
export function DateStyleCard() {
  const [style, setStyle] = useDateStyle();
  const today = new Date();
  const options: { value: DateStyle; title: string; hint: string }[] = [
    { value: "roc", title: "民國", hint: "輸入可打 1151105、115/11/05、115.11.5" },
    { value: "ad", title: "西元", hint: "輸入可打 20261105、2026/11/05" },
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle>日期格式</CardTitle>
        <CardDescription>日期的顯示與輸入方式，只套用在這個瀏覽器；資料、同步與匯出一律以西元存放，不受影響</CardDescription>
      </CardHeader>
      <CardContent>
        <RadioGroup value={style} onValueChange={(v) => setStyle(v as DateStyle)} className="grid sm:grid-cols-2 gap-3">
          {options.map((o) => (
            <Label key={o.value} htmlFor={`date-style-${o.value}`} className={cn("flex items-start gap-3 p-4 rounded-lg border cursor-pointer hover-elevate", style === o.value && "border-primary bg-primary/5")}>
              <RadioGroupItem value={o.value} id={`date-style-${o.value}`} data-testid={`radio-date-${o.value}`} />
              <div className="space-y-1">
                <div className="font-medium">{o.title}　<span className="tabular-nums text-muted-foreground font-normal">{fmtDate(today, { style: o.value, weekday: true })}</span></div>
                <p className="text-sm text-muted-foreground font-normal">{o.hint}</p>
              </div>
            </Label>
          ))}
        </RadioGroup>
      </CardContent>
    </Card>
  );
}
