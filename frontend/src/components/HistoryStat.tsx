import { useQuery } from "@tanstack/react-query";
import { History as HistoryIcon } from "lucide-react";
import { apiGet } from "@/lib/api";
import type { History } from "@/lib/types";

export default function HistoryStat() {
  const history = useQuery({ queryKey: ["history"], queryFn: () => apiGet<History>("/me/history") });
  if (history.isError || !history.data) return null;
  const { last_30_days: n, singoli, doppi } = history.data;

  return (
    <div
      data-testid="history-stat"
      className="mb-5 flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3"
    >
      <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#10B981]/15 text-[#10B981]">
        <HistoryIcon className="size-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Ultimi 30 giorni</p>
        <p className="font-heading text-base font-semibold text-white">
          <span data-testid="history-count" className="font-mono text-xl text-[#10B981]">{n}</span>{" "}
          {n === 1 ? "partita giocata" : "partite giocate"}
        </p>
        {n > 0 && (
          <p data-testid="history-breakdown" className="text-xs text-slate-400">
            {singoli} {singoli === 1 ? "singolo" : "singoli"} · {doppi} {doppi === 1 ? "doppio" : "doppi"}
          </p>
        )}
      </div>
    </div>
  );
}
