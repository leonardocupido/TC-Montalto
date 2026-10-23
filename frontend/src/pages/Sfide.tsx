import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarDays, Check, Clock, Swords, X } from "lucide-react";
import { apiGet, apiPost } from "@/lib/api";
import { errorMessage, type Challenge, type ChallengeList } from "@/lib/types";
import { formatMatchDate, initials } from "@/lib/format";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STATUS = {
  in_attesa: { label: "In attesa", cls: "bg-[#713F12] text-[#FEF08A]" },
  accettata: { label: "Accettata", cls: "bg-[#14532D] text-[#DCFCE7]" },
  rifiutata: { label: "Rifiutata", cls: "bg-[#1E293B] text-[#94A3B8]" },
} as const;

function statusOf(c: Challenge) {
  if (c.expired) return { label: "Scaduta", cls: "bg-[#1E293B] text-[#94A3B8]" };
  return STATUS[c.status];
}

function ChallengeCard({ c, received, busy, onDecide }: { c: Challenge; received: boolean; busy: boolean; onDecide?: (a: "accept" | "reject") => void }) {
  const other = received ? c.challenger_name : c.challenged_name;
  const s = statusOf(c);
  const canDecide = received && c.status === "in_attesa" && !c.expired;
  return (
    <li
      data-testid={received ? "received-challenge-item" : "sent-challenge-item"}
      className={cn("rounded-2xl border bg-card p-4", canDecide ? "border-[#EA580C]/70 bg-[#221711]" : "border-border")}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#EA580C]/20 font-heading text-sm font-semibold text-[#FDBA74]">
            {initials(other)}
          </span>
          <div className="min-w-0">
            <p data-testid="challenge-other-name" className="truncate font-semibold text-white">
              {received ? `${other} ti ha sfidato` : `Hai sfidato ${other}`}
            </p>
            {received && c.challenger_level && <p className="text-xs text-slate-400">Livello: {c.challenger_level}</p>}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span data-testid="challenge-status" className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", s.cls)}>{s.label}</span>
          {c.unseen && <span data-testid="challenge-new-badge" className="rounded-full bg-[#EAB308] px-2 py-0.5 text-[10px] font-bold text-[#0B1118]">Nuovo</span>}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
        <p data-testid="challenge-date" className="flex items-center gap-1.5 font-heading font-semibold"><CalendarDays className="size-4 text-slate-400" /> {formatMatchDate(c.date)}</p>
        <p data-testid="challenge-time" className="flex items-center gap-1.5 font-mono font-semibold"><Clock className="size-4 text-slate-400" /> {c.time}</p>
      </div>
      {c.message && <p className="mt-2 rounded-xl bg-black/20 px-3 py-2 text-sm text-slate-300">“{c.message}”</p>}
      {canDecide && onDecide && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button data-testid="accept-challenge-btn" disabled={busy} onClick={() => onDecide("accept")} className="h-10 font-semibold active:scale-95">
            <Check className="size-4" /> Accetta
          </Button>
          <Button variant="outline" data-testid="reject-challenge-btn" disabled={busy} onClick={() => onDecide("reject")} className="h-10 font-semibold active:scale-95">
            <X className="size-4" /> Rifiuta
          </Button>
        </div>
      )}
      {c.status === "accettata" && (
        <p className="mt-3 text-sm text-[#86EFAC]">Partita confermata in bacheca 🎾</p>
      )}
    </li>
  );
}

export default function Sfide() {
  const qc = useQueryClient();
  const data = useQuery({ queryKey: ["challenges"], queryFn: () => apiGet<ChallengeList>("/challenges") });
  const received = data.isError ? [] : (data.data?.received ?? []);
  const sent = data.isError ? [] : (data.data?.sent ?? []);
  const hasUnseen = [...received, ...sent].some((c) => c.unseen);

  // Opening this page acknowledges notifications (idempotent, StrictMode-safe).
  const markSeen = useMutation({
    mutationFn: () => apiPost("/challenges/seen"),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["summary"] }),
  });
  const { mutate: seen } = markSeen;
  useEffect(() => {
    if (hasUnseen) seen();
  }, [hasUnseen, seen]);

  const decide = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "accept" | "reject" }) => apiPost<Challenge>(`/challenges/${id}/${action}`),
    onSuccess: (c) => {
      toast.success(c.status === "accettata" ? `Sfida accettata! Partita con ${c.challenger_name} confermata.` : "Sfida rifiutata");
      for (const k of ["challenges", "summary", "matches", "today", "my-applications"]) void qc.invalidateQueries({ queryKey: [k] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wider text-[#EA580C]">Uno contro uno</p>
      <h1 className="mt-1 flex items-center gap-2 font-heading text-3xl font-semibold tracking-tight">
        <Swords className="size-7 text-[#EA580C]" /> Le mie sfide
      </h1>
      <p className="mt-1 text-sm text-slate-400">Sfida un socio dalla sua scheda in “Soci”.</p>

      <h2 className="mt-6 text-xs font-bold uppercase tracking-wider text-slate-400">Ricevute</h2>
      <ul className="mt-2 space-y-3" data-testid="received-challenges">
        {data.isLoading && <li className="h-32 animate-pulse rounded-2xl bg-secondary" />}
        {!data.isLoading && received.length === 0 && (
          <li data-testid="received-empty" className="rounded-2xl border border-dashed border-border p-5 text-center text-sm text-slate-500">Nessuna sfida ricevuta.</li>
        )}
        {received.map((c) => (
          <ChallengeCard key={c.id} c={c} received busy={decide.isPending} onDecide={(action) => decide.mutate({ id: c.id, action })} />
        ))}
      </ul>

      <h2 className="mt-6 text-xs font-bold uppercase tracking-wider text-slate-400">Inviate</h2>
      <ul className="mt-2 space-y-3" data-testid="sent-challenges">
        {!data.isLoading && sent.length === 0 && (
          <li data-testid="sent-empty" className="rounded-2xl border border-dashed border-border p-5 text-center text-sm text-slate-500">
            Non hai ancora lanciato sfide.{" "}
            <Link to="/soci" data-testid="sent-empty-soci-link" className={cn(buttonVariants({ variant: "link" }), "h-auto p-0")}>Scegli un avversario</Link>
          </li>
        )}
        {sent.map((c) => (
          <ChallengeCard key={c.id} c={c} received={false} busy={false} />
        ))}
      </ul>
    </div>
  );
}
