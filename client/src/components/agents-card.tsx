import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Pencil, Plus, Trash2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { type Agent } from "@shared/schema";

type AgentDraft = { name: string; tel: string; fax: string; mobile: string };

const EMPTY: AgentDraft = { name: "", tel: "", fax: "", mobile: "" };

const toPayload = (d: AgentDraft) => ({
  name: d.name.trim(),
  tel: d.tel.trim() || null,
  fax: d.fax.trim() || null,
  mobile: d.mobile.trim() || null,
});

// 代理人資訊：代理人通訊錄（電話、傳真、手機），新增案件時可直接選代理人
export function AgentsCard() {
  const { toast } = useToast();
  const [draft, setDraft] = useState<AgentDraft>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<AgentDraft>(EMPTY);

  const { data: agentsList = [], isLoading } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  const onError = (error: Error) => {
    toast({
      title: "儲存失敗",
      description: error.message.includes("409") ? "代理人名稱已存在" : error.message,
      variant: "destructive",
    });
  };

  const createMutation = useMutation({
    mutationFn: (d: AgentDraft) => apiRequest("POST", "/api/agents", toPayload(d)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      setDraft(EMPTY);
      toast({ title: "已新增代理人" });
    },
    onError,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, d }: { id: string; d: AgentDraft }) => apiRequest("PATCH", `/api/agents/${id}`, toPayload(d)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      setEditingId(null);
      toast({ title: "已更新代理人" });
    },
    onError,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/agents/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      toast({ title: "已刪除代理人" });
    },
    onError,
  });

  const handleAdd = () => {
    if (!draft.name.trim()) {
      toast({ title: "請輸入代理人名稱", variant: "destructive" });
      return;
    }
    createMutation.mutate(draft);
  };

  const startEdit = (a: Agent) => {
    setEditingId(a.id);
    setEditDraft({ name: a.name, tel: a.tel || "", fax: a.fax || "", mobile: a.mobile || "" });
  };

  const saveEdit = () => {
    if (!editingId) return;
    if (!editDraft.name.trim()) {
      toast({ title: "代理人名稱不能空白", variant: "destructive" });
      return;
    }
    updateMutation.mutate({ id: editingId, d: editDraft });
  };

  const field = (d: AgentDraft, set: (d: AgentDraft) => void, key: keyof AgentDraft, placeholder: string, testId: string) => (
    <Input
      value={d[key]}
      onChange={(e) => set({ ...d, [key]: e.target.value })}
      placeholder={placeholder}
      className="h-8"
      data-testid={testId}
    />
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>代理人資訊</CardTitle>
        <CardDescription>
          代理人的電話、傳真、手機。新增或編輯案件時，代理人欄位可直接從這裡選
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-[1.2fr_1fr_1fr_1fr_auto] gap-2">
          {field(draft, setDraft, "name", "代理人", "input-new-agent-name")}
          {field(draft, setDraft, "tel", "電話", "input-new-agent-tel")}
          {field(draft, setDraft, "fax", "傳真", "input-new-agent-fax")}
          {field(draft, setDraft, "mobile", "手機", "input-new-agent-mobile")}
          <Button
            size="sm"
            onClick={handleAdd}
            disabled={createMutation.isPending}
            data-testid="button-add-agent"
          >
            <Plus className="h-4 w-4 mr-1" />
            新增
          </Button>
        </div>

        <div className="border rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="text-left font-medium px-3 py-2">代理人</th>
                <th className="text-left font-medium px-3 py-2">電話</th>
                <th className="text-left font-medium px-3 py-2">傳真</th>
                <th className="text-left font-medium px-3 py-2">手機</th>
                <th className="w-20"></th>
              </tr>
            </thead>
            <tbody>
              {agentsList.map((a) =>
                editingId === a.id ? (
                  <tr key={a.id} className="border-t" data-testid={`row-agent-${a.id}`}>
                    <td className="px-2 py-1">{field(editDraft, setEditDraft, "name", "代理人", "input-edit-agent-name")}</td>
                    <td className="px-2 py-1">{field(editDraft, setEditDraft, "tel", "電話", "input-edit-agent-tel")}</td>
                    <td className="px-2 py-1">{field(editDraft, setEditDraft, "fax", "傳真", "input-edit-agent-fax")}</td>
                    <td className="px-2 py-1">{field(editDraft, setEditDraft, "mobile", "手機", "input-edit-agent-mobile")}</td>
                    <td className="px-2 py-1 whitespace-nowrap">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={saveEdit} disabled={updateMutation.isPending} data-testid="button-save-agent">
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingId(null)} data-testid="button-cancel-agent">
                        <X className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ) : (
                  <tr key={a.id} className="border-t" data-testid={`row-agent-${a.id}`}>
                    <td className="px-3 py-2 font-medium">{a.name}</td>
                    <td className="px-3 py-2 tabular-nums">{a.tel || "—"}</td>
                    <td className="px-3 py-2 tabular-nums">{a.fax || "—"}</td>
                    <td className="px-3 py-2 tabular-nums">{a.mobile || "—"}</td>
                    <td className="px-2 py-1 whitespace-nowrap">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => startEdit(a)} data-testid={`button-edit-agent-${a.id}`}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive"
                        onClick={() => {
                          if (confirm(`確定刪除代理人「${a.name}」？`)) deleteMutation.mutate(a.id);
                        }}
                        disabled={deleteMutation.isPending}
                        data-testid={`button-delete-agent-${a.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ),
              )}
              {agentsList.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-muted-foreground p-3">
                    {isLoading ? "載入中..." : "尚未建立代理人資訊"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
