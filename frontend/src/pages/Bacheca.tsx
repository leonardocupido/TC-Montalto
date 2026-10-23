import { useState } from "react";
import { Link } from "react-router-dom";
import { useIsFetching, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, RefreshCw } from "lucide-react";
import { apiGet } from "@/lib/api";
import type { Match } from "@/lib/types";
import MatchCard from "@/components/MatchCard";
import ApplyDialog from "@/components/ApplyDialog";
import TodayReminder from "@/components/TodayReminder";
import HistoryStat from "@/components/HistoryStat";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const FILTERS = [
  { id: "tutte", label: "Tutte" },
  { id: "aperte", label: "Aperte" },
  { id: "singolo", label: "Singolo" },
  { id: "doppio", label: "Doppio" },
] as const;
type Filter = (typeof FILTERS)[number]["id"];
const SKELETONS = ["skeleton-a", "skeleton-b", "skeleton-c"];

function matchesFilter(m: Match, filter: Filter): boolean {
  if (filter === "tutte") return true;
  if (filter === "aperte") return m.status === "aperta";
  return m.type === filter;
}

const APP_LABEL = { in_attesa: "In attesa", accettata: "Sei in campo!", rifiutata: "Non accettata" } as const;

function MatchAction({ match, onApply }: { match: Match; onApply: () => void }) {
  if (match.is_owner) {
    return (
      <Link to="/le-mie-partite" data-testid="match-owner-link" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-9")}>
        Tua partita{match.pending_count > 0 ? ` · ${match.pending_count}` : ""}
      </Link>
    );
  }
  if (match.my_application_status) {
    return (
      <span data-testid="match-my-application-status" className="rounded-full bg-[#1E293B] px-3 py-1.5 text-xs font-semibold text-slate-200">
        {APP_LABEL[match.my_application_status]}
      </span>
    );
  }
  if (match.status !== "aperta") {
    return <span className="text-xs font-semibold text-slate-400">Posti esauriti</span>;
  }
  return (
    <Button data-testid="apply-match-button" onClick={onApply} className="h-10 px-4 font-semibold active:scale-95">
      Mi candido
    </Button>
  );
}

export default function Bacheca() {
  const [filter, setFilter] = useState<Filter>("tutte");
  const [selected, setSelected] = useState<Match | null>(null);
  const matches = useQuery({ queryKey: ["matches"], queryFn: () => apiGet<Match[]>("/matches") });

  const list = (matches.isError ? [] : (matches.data ?? [])).filter((m) => matchesFilter(m, filter));
  const openCount = (matches.data ?? []).filter((m) => m.status === "aperta" && !m.is_owner).length;
  const qc = useQueryClient();
  const refreshing = useIsFetching() > 0;
  const refresh = () => {
    for (const k of ["matches", "today", "history", "summary"]) void qc.invalidateQueries({ queryKey: [k] });
  };

  return (
    <div>
      <section className="mb-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider text-[#EA580C]">Bacheca soci</p>
          <h1 className="mt-1 font-heading text-3xl font-semibold tracking-tight">Partite in programma</h1>
          <p data-testid="open-matches-count" className="mt-1 text-sm text-slate-400">
            {matches.isLoading ? "Caricamento…" : `${openCount} partite cercano giocatori`}
          </p>
        </div>
        <Button
          variant="outline"
          size="icon-lg"
          aria-label="Aggiorna bacheca"
          data-testid="refresh-board-button"
          disabled={refreshing}
          onClick={refresh}
          className="mt-1 shrink-0 rounded-full active:scale-95"
        >
          <RefreshCw className={cn("size-5", refreshing && "animate-spin")} />
        </Button>
      </section>

      <TodayReminder />
      <HistoryStat />

      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            data-testid={`filter-${f.id}`}
            onClick={() => setFilter(f.id)}
            className={cn(
              "shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition-[background-color,color,border-color] duration-150",
              filter === f.id ? "border-[#10B981] bg-[#10B981] text-[#022C22]" : "border-border bg-secondary text-slate-300 hover:border-slate-500",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="space-y-3" data-testid="matches-list">
        {matches.isLoading &&
          SKELETONS.map((id) => <div key={id} className="h-48 animate-pulse rounded-2xl bg-secondary" />)}
        {!matches.isLoading && list.length === 0 && (
          <div data-testid="matches-empty" className="rounded-2xl border border-dashed border-border p-8 text-center">
            <p className="font-heading text-lg font-semibold">Nessuna partita qui</p>
            <p className="mt-1 text-sm text-slate-400">
              {matches.isError ? "Impossibile caricare le partite al momento." : "Sii il primo a proporne una!"}
            </p>
            <Link to="/proponi" data-testid="empty-propose-link" className={cn(buttonVariants(), "mt-4")}>
              Proponi una partita
            </Link>
          </div>
        )}
        {list.map((m, i) => (
          <MatchCard key={m.id} match={m} index={i} action={<MatchAction match={m} onApply={() => setSelected(m)} />} />
        ))}
      </div>

      <Link
        to="/proponi"
        aria-label="Proponi partita"
        data-testid="propose-fab"
        className="fixed bottom-24 right-[max(1rem,calc(50%-14rem+1rem))] z-20 grid size-14 place-items-center rounded-full bg-[#EA580C] text-white shadow-lg shadow-black/40 transition-transform duration-150 hover:scale-105 active:scale-95"
      >
        <Plus className="size-6" />
      </Link>

      <ApplyDialog match={selected} open={!!selected} onOpenChange={(o) => !o && setSelected(null)} />
    </div>
  );
}
