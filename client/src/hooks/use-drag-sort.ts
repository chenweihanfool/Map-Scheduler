import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

// 拖動排序：按住左側把手上下拖（滑鼠、觸控都可以），放開後回傳新的 id 順序；
// 把手取得焦點時也可用鍵盤 ↑ ↓ 移動。
// 拖動中清單會即時重排，列的 DOM 位置會變動，所以改在 window 上追蹤指標（元素上的 pointer capture 會在移動節點時遺失）
export function useDragSort<T extends { id: string }>(items: T[], onReorder: (ids: string[]) => void) {
  const [order, setOrder] = useState<string[] | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const rows = useRef(new Map<string, HTMLElement>());
  const orderRef = useRef<string[] | null>(null);
  const reorderRef = useRef(onReorder);
  reorderRef.current = onReorder;
  const itemsKey = items.map((i) => i.id).join("|");

  const ids = order ?? items.map((i) => i.id);
  const byId = new Map(items.map((i) => [i.id, i]));
  const ordered = ids.map((id) => byId.get(id)).filter((x): x is T => !!x);

  useEffect(() => {
    if (!draggingId) return;
    const move = (e: globalThis.PointerEvent) => {
      const current = orderRef.current ?? itemsKey.split("|");
      const others = current.filter((x) => x !== draggingId);
      // 新位置 = 中線在指標上方的其他列數
      const index = others.filter((x) => {
        const el = rows.current.get(x);
        if (!el) return false;
        const r = el.getBoundingClientRect();
        return r.top + r.height / 2 < e.clientY;
      }).length;
      const next = [...others.slice(0, index), draggingId, ...others.slice(index)];
      if (next.join("|") !== current.join("|")) {
        orderRef.current = next;
        setOrder(next);
      }
    };
    const end = (commit: boolean) => () => {
      const next = orderRef.current;
      if (commit && next && next.join("|") !== itemsKey) reorderRef.current(next);
      orderRef.current = null;
      setOrder(null);
      setDraggingId(null);
    };
    const up = end(true), cancel = end(false);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
    };
  }, [draggingId, itemsKey]);

  const rowProps = (id: string) => ({
    ref: (el: HTMLElement | null) => {
      if (el) rows.current.set(id, el);
      else rows.current.delete(id);
    },
    "data-dragging": draggingId === id ? "true" : undefined,
  });

  const handleProps = (id: string, label: string) => ({
    role: "button" as const,
    tabIndex: 0,
    "aria-label": `拖動排序：${label}`,
    title: "按住拖動排序（也可用鍵盤 ↑ ↓）",
    style: { touchAction: "none" as const },
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      if (e.button !== 0) return;
      e.preventDefault();
      orderRef.current = items.map((i) => i.id);
      setOrder(orderRef.current);
      setDraggingId(id);
    },
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
      e.preventDefault();
      const current = items.map((i) => i.id), i = current.indexOf(id), j = e.key === "ArrowUp" ? i - 1 : i + 1;
      if (i < 0 || j < 0 || j >= current.length) return;
      [current[i], current[j]] = [current[j], current[i]];
      onReorder(current);
    },
  });

  return { ordered, rowProps, handleProps, draggingId };
}
