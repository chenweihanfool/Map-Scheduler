import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Plus, Trash2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Assistant, Surveyor } from "@shared/schema";

const FLOAT = "__float";

// 助理名單：設定固定搭配的測量員，或「非固定」（哪位測量員的助理都請假時可支援）。助理不參與排件
export function AssistantsCard() {
  const { toast } = useToast();
  const { data: assistants = [] } = useQuery<Assistant[]>({ queryKey: ["/api/assistants"] });
  const { data: surveyors = [] } = useQuery<Surveyor[]>({ queryKey: ["/api/surveyors"] });
  const [name, setName] = useState("");
  const [partner, setPartner] = useState(FLOAT);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["/api/assistants"] });
  const onErr = (e: Error) => toast({ title: "儲存失敗", description: e.message, variant: "destructive" });

  const add = useMutation({
    mutationFn: () => apiRequest("POST", "/api/assistants", { name: name.trim(), surveyorId: partner === FLOAT ? null : partner, sortOrder: assistants.length }),
    onSuccess: () => { refresh(); setName(""); toast({ title: "已新增助理" }); },
    onError: onErr,
  });
  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Assistant> }) => apiRequest("PATCH", `/api/assistants/${id}`, data),
    onSuccess: refresh,
    onError: onErr,
  });
  const remove = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/assistants/${id}`),
    onSuccess: () => { refresh(); queryClient.invalidateQueries({ queryKey: ["/api/assistant-leaves"] }); toast({ title: "已刪除助理" }); },
    onError: onErr,
  });

  const partnerSelect = (value: string, onChange: (v: string) => void, testId: string) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-40" data-testid={testId}><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value={FLOAT}>非固定（支援用）</SelectItem>
        {surveyors.map((s) => <SelectItem key={s.id} value={s.id}>搭配 {s.name}</SelectItem>)}
      </SelectContent>
    </Select>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>助理</CardTitle>
        <CardDescription>
          設定每位助理固定搭配哪位測量員；非固定助理會在某位測量員的助理都請假時列為可支援人選。助理不參與排件，請假只在排件時提醒課長參考。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {assistants.length === 0 && <p className="text-sm text-muted-foreground">尚未設定助理</p>}
        {assistants.map((a) => (
          <div key={a.id} className="flex items-center gap-2" data-testid={`assistant-row-${a.name}`}>
            <UserRound className="h-4 w-4 text-muted-foreground shrink-0" />
            <Input
              defaultValue={a.name}
              className="flex-1 h-9"
              onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== a.name) update.mutate({ id: a.id, data: { name: v } }); }}
            />
            {partnerSelect(a.surveyorId ?? FLOAT, (v) => update.mutate({ id: a.id, data: { surveyorId: v === FLOAT ? null : v } }), `select-partner-${a.name}`)}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => { if (confirm(`刪除助理「${a.name}」？他的請假紀錄也會一起刪除。`)) remove.mutate(a.id); }}
              aria-label="刪除"
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
        <form
          className="flex items-center gap-2 pt-2 border-t"
          onSubmit={(e) => { e.preventDefault(); if (name.trim()) add.mutate(); }}
        >
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="助理姓名" className="flex-1 h-9" data-testid="input-assistant-name" />
          {partnerSelect(partner, setPartner, "select-new-partner")}
          <Button type="submit" disabled={!name.trim() || add.isPending} data-testid="button-add-assistant">
            <Plus className="h-4 w-4 mr-1" />新增
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
