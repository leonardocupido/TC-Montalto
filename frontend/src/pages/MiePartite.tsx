import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Phone, X } from "lucide-react";
import { apiDelete, apiGet, apiPost } from "@/lib/api";
import { errorMessage, type Application, type OwnedMatch } from "@/lib/types";
import { telHref } from "@/lib/format";
import MatchCard from "@/components/MatchCard";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STATUS = {
  in_attesa: { label: "In attesa", cls: "bg-[#713F12] text-[#FEF08A]" },
  accettata: { label: "Accettata", cls: "bg-[#14532D] text-[#DCFCE7]" },
  rifiutata: { label: "Rifiutata", cls: "bg-[#1E293B] text-[#94A3B8]" },
} as const;

export default function MiePartite() {
  const qc = useQueryClient();
  const data = useQuery({ queryKey: ["my-matches"], queryFn: () => apiGet<OwnedMatch[]>("/me/matches") });

  const refresh = () => {
    for (const k of ["my-matches", "matches", "summary", "today"]) void qc.invalidateQueries({ queryKey: [k] });
  };

  const decide = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "accept" | "reject" }) =>
      apiPost<Application>(`/applications/${id}/${action}`),
    onSuccess: (a) => {
      toast.success(a.status === "accettata" ? `${a.user_name} è in campo!` : "Candidatura rifiutata");
      refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const cancel = useMutation({
    mutationFn: (id: string) => apiDelete(`/matches/${id}`),
    onSuccess: () => {
      toast.success("Partita annullata");
      refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const items = data.isError ? [] : (data.data ?? []);

  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wider text-[#EA580C]">Proponente</p>
      <h1 className="mt-1 font-heading text-3xl font-semibold tracking-tight">Le mie partite</h1>
      <p className="mt-1 text-sm text-slate-400">Valuta le candidature: la partita si conferma quando i posti sono pieni.</p>

      <div className="mt-5 space-y-6" data-testid="my-matches-list">
        {data.isLoading && <div className="h-48 animate-pulse rounded-2xl bg-secondary" />}
        {!data.isLoading && items.length === 0 && (
          <div data-testid="my-matches-empty" className="rounded-2xl border border-dashed border-border p-8 text-center">
            <p className="font-heading text-lg font-semibold">Non hai ancora proposto partite</p>
            <Link to="/proponi" data-testid="my-matches-propose-link" className={cn(buttonVariants(), "mt-4")}>Proponi una partita</Link>
          </div>
        )}
        {items.map(({ match, applications }, i) => (
          <section key={match.id} data-testid="owned-match-section" className="space-y-2">
            <MatchCard
              match={match}
              index={i}
              action={
                <Button
                  variant="ghost"
                  size="sm"
                  data-testid="cancel-match-btn"
                  disabled={cancel.isPending}
                  onClick={() => {
                    if (window.confirm("Annullare questa partita?")) cancel.mutate(match.id);
                  }}
                  className="text-slate-400 hover:text-[#F87171]"
                >
                  Annulla
                </Button>
              }
            />
            <div className="rounded-2xl border border-border bg-card p-3">
              <p className="px-1 text-xs font-bold uppercase tracking-wider text-slate-400">
                Candidature ({applications.length})
              </p>
              {applications.length === 0 && <p className="px-1 py-2 text-sm text-slate-500">Nessuna candidatura per ora.</p>}
              <ul className="mt-2 space-y-2">
                {applications.map((a) => (
                  <li
                    key={a.id}
                    data-testid="candidate-item"
                    className={cn(
                      "rounded-xl border bg-[#0B1118]/60 p-3",
                      a.status === "in_attesa" ? "border-[#EAB308]/50" : "border-border",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p data-testid="candidate-name" className="font-semibold text-white">{a.user_name}</p>
                        {a.user_level && <p className="text-xs text-slate-400">Livello: {a.user_level}</p>}
                      </div>
                      <span data-testid="candidate-status" className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold", STATUS[a.status].cls)}>
                        {STATUS[a.status].label}
                      </span>
                    </div>
                    {a.message && <p className="mt-2 text-sm text-slate-300">“{a.message}”</p>}
                    <a href={telHref(a.phone)} data-testid="candidate-phone" className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-[#38BDF8]">
                      <Phone className="size-3.5" /> {a.phone}
                    </a>
                    {a.status === "in_attesa" && match.status === "aperta" && (
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <Button
                          data-testid="accept-candidate-btn"
                          disabled={decide.isPending}
                          onClick={() => decide.mutate({ id: a.id, action: "accept" })}
                          className="h-10 font-semibold active:scale-95"
                        >
                          <Check className="size-4" /> Accetta
                        </Button>
                        <Button
                          variant="outline"
                          data-testid="reject-candidate-btn"
                          disabled={decide.isPending}
                          onClick={() => decide.mutate({ id: a.id, action: "reject" })}
                          className="h-10 font-semibold active:scale-95"
                        >
                          <X className="size-4" /> Rifiuta
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
