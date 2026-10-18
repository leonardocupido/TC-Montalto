import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PartyPopper, Phone } from "lucide-react";
import { apiGet, apiPost } from "@/lib/api";
import type { MyApplication, Summary } from "@/lib/types";
import { telHref } from "@/lib/format";
import MatchCard from "@/components/MatchCard";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STATUS = {
  in_attesa: { label: "In attesa", cls: "bg-[#713F12] text-[#FEF08A]" },
  accettata: { label: "Accettata · Sei in campo!", cls: "bg-[#14532D] text-[#DCFCE7]" },
  rifiutata: { label: "Non accettata", cls: "bg-[#1E293B] text-[#94A3B8]" },
} as const;

export default function MieCandidature() {
  const data = useQuery({ queryKey: ["my-applications"], queryFn: () => apiGet<MyApplication[]>("/me/applications") });
  const items = data.isError ? [] : (data.data ?? []);
  const qc = useQueryClient();
  const hasUnseen = items.some((x) => !x.application.applicant_seen || !x.application.cancel_seen);
  // Opening this page acknowledges new acceptances (idempotent, so StrictMode's double effect is harmless).
  const markSeen = useMutation({
    mutationFn: () => apiPost<Summary>("/me/applications/seen"),
    onSuccess: (s) => qc.setQueryData(["summary"], s),
  });
  const { mutate } = markSeen;
  useEffect(() => {
    if (hasUnseen) mutate();
  }, [hasUnseen, mutate]);

  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wider text-[#EA580C]">Giocatore</p>
      <h1 className="mt-1 font-heading text-3xl font-semibold tracking-tight">Le mie candidature</h1>
      <p className="mt-1 text-sm text-slate-400">Quando vieni accettato vedi i contatti degli altri giocatori.</p>

      <div className="mt-5 space-y-5" data-testid="my-applications-list">
        {data.isLoading && <div className="h-48 animate-pulse rounded-2xl bg-secondary" />}
        {!data.isLoading && items.length === 0 && (
          <div data-testid="my-applications-empty" className="rounded-2xl border border-dashed border-border p-8 text-center">
            <p className="font-heading text-lg font-semibold">Nessuna candidatura</p>
            <p className="mt-1 text-sm text-slate-400">Sfoglia la bacheca e premi “Mi candido”.</p>
            <Link to="/" data-testid="my-applications-board-link" className={cn(buttonVariants(), "mt-4")}>Vai alla bacheca</Link>
          </div>
        )}
        {items.map(({ application: a, match, contacts }, i) => (
          <section key={a.id} data-testid="my-application-item" className="space-y-2">
            <div className="flex items-center justify-between">
              {match.status === "annullata" ? (
                <span data-testid="my-application-cancelled" className="rounded-full bg-[#7F1D1D] px-3 py-1 text-xs font-semibold text-[#FECACA]">
                  Partita annullata dal proponente
                </span>
              ) : (
                <span data-testid="my-application-status" className={cn("rounded-full px-3 py-1 text-xs font-semibold", STATUS[a.status].cls)}>
                  {STATUS[a.status].label}
                </span>
              )}
              {(!a.applicant_seen || !a.cancel_seen) && (
                <span data-testid="my-application-new-badge" className="inline-flex items-center gap-1 rounded-full bg-[#EAB308] px-2.5 py-1 text-xs font-bold text-[#0B1118]">
                  <PartyPopper className="size-3.5" /> Nuovo
                </span>
              )}
            </div>
            <MatchCard match={match} index={i} />
            {contacts.length > 0 && (
              <div data-testid="my-application-contacts" className="rounded-2xl border border-[#166534] bg-[#11221C] p-3">
                <p className="text-xs font-bold uppercase tracking-wider text-[#86EFAC]">Contatti partita</p>
                <ul className="mt-2 space-y-1.5">
                  {contacts.map((c) => (
                    <li key={c.name + c.phone} className="flex items-center justify-between gap-2 text-sm">
                      <span className="text-white">
                        {c.name} <span className="text-xs text-slate-400">· {c.role}</span>
                      </span>
                      {c.phone && (
                        <a href={telHref(c.phone)} data-testid="contact-phone" className="inline-flex items-center gap-1 font-medium text-[#38BDF8]">
                          <Phone className="size-3.5" /> {c.phone}
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
