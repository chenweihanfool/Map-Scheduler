import { ToastAction } from "@/components/ui/toast";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { SurveyCase, SurveyorLeave } from "@shared/schema";

const refreshCases = () => queryClient.invalidateQueries({ queryKey: ["/api/cases"] });
const refreshLeaves = () => queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith("/api/leaves") });

// 刪除後跳出「復原」提示：10 秒內按「復原」就放回去
export function useUndoToast() {
  const { toast } = useToast();
  return (title: string, description: string | undefined, undo: () => Promise<unknown>) => {
    toast({
      title,
      description,
      duration: 10000,
      action: (
        <ToastAction
          altText="復原"
          data-testid="button-undo"
          onClick={async () => {
            try {
              await undo();
              toast({ title: "已復原" });
            } catch (e) {
              toast({ title: "復原失敗", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
            }
          }}
        >
          復原
        </ToastAction>
      ),
    });
  };
}

// 刪除案件，回傳刪除前的完整內容（給復原用）
export async function deleteCase(id: string): Promise<SurveyCase | null> {
  const res = await apiRequest("DELETE", `/api/cases/${id}`);
  const json = await res.json().catch(() => ({}));
  return json.deleted ?? null;
}
export async function restoreCase(row: SurveyCase) {
  await apiRequest("POST", "/api/cases/restore", { case: row });
  await refreshCases();
}

export async function deleteLeave(id: string): Promise<SurveyorLeave | null> {
  const res = await apiRequest("DELETE", `/api/leaves/${id}`);
  const json = await res.json().catch(() => ({}));
  return json.deleted ?? null;
}
export async function restoreLeave(row: SurveyorLeave) {
  await apiRequest("POST", "/api/leaves/restore", { leave: row });
  await refreshLeaves();
}

// 修改案件並檢查是否被別人改過：被改過時丟出 StaleError（帶目前內容）
export class StaleError extends Error {
  constructor(public current: SurveyCase) { super("這件案件在你編輯期間已被其他人修改"); }
}
export async function patchCase(id: string, data: Record<string, unknown>, expectedUpdatedAt?: string | Date | null): Promise<SurveyCase> {
  const res = await fetch(`/api/cases/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(expectedUpdatedAt ? { ...data, expectedUpdatedAt } : data),
    credentials: "include",
  });
  const json = await res.json().catch(() => ({}));
  if (res.status === 409 && json.error === "STALE") throw new StaleError(json.current);
  if (!res.ok) throw new Error(json.message || json.error || `${res.status}`);
  return json as SurveyCase;
}
