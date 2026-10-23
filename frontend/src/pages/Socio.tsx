import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { ArrowLeft, Mail, Pencil, Phone, Swords } from "lucide-react";
import { apiGet } from "@/lib/api";
import type { MemberDetail } from "@/lib/types";
import { initials, telHref } from "@/lib/format";
import MatchCard from "@/components/MatchCard";
import ChallengeDialog from "@/components/ChallengeDialog";
import EditProfileDialog from "@/components/EditProfileDialog";
import { Button } from "@/components/ui/button";

function StatTile({ label, value, testid, accent }: { label: string; value: number; testid: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <p data-testid={testid} className={accent ? "font-mono text-2xl font-semibold text-[#10B981]" : "font-mono text-2xl font-semibold text-white"}>
        {value}
      </p>
      <p className="mt-0.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
    </div>
  );
}

export default function Socio() {
  const { id = "" } = useParams();
  const member = useQuery({ queryKey: ["member", id], queryFn: () => apiGet<MemberDetail>(`/members/${id}`) });
  const m = member.isError ? undefined : member.data;
  const [challengeOpen, setChallengeOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  return (
    <div>
      <Link to="/soci" data-testid="member-back-link" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-400 transition-colors duration-150 hover:text-white">
        <ArrowLeft className="size-4" /> Tutti i soci
      </Link>

      {member.isLoading && <div className="mt-4 h-40 animate-pulse rounded-2xl bg-secondary" />}
      {!member.isLoading && !m && (
        <div data-testid="member-not-found" className="mt-4 rounded-2xl border border-dashed border-border p-8 text-center text-sm text-slate-400">
          Socio non trovato.
        </div>
      )}

      {m && (
        <>
          <section data-testid="member-profile" className="mt-4 flex items-center gap-4">
            <span className="grid size-16 shrink-0 place-items-center rounded-full bg-[#10B981] font-heading text-xl font-semibold text-[#022C22]">
              {initials(m.name)}
            </span>
            <div className="min-w-0">
              <h1 data-testid="member-detail-name" className="truncate font-heading text-2xl font-semibold tracking-tight">
                {m.name}
                {m.is_me && <span className="ml-2 text-sm font-medium text-[#10B981]">(tu)</span>}
              </h1>
              <p data-testid="member-detail-level" className="text-sm text-slate-300">{m.level ? `Livello: ${m.level}` : "Livello non indicato"}</p>
              {m.member_since && (
                <p className="text-xs text-slate-500">Iscritto dal {format(parseISO(m.member_since), "d MMMM yyyy", { locale: it })}</p>
              )}
            </div>
          </section>

          {m.is_me && (
            <>
              <Button
                variant="outline"
                data-testid="edit-profile-button"
                onClick={() => setEditOpen(true)}
                className="mt-4 h-11 w-full font-semibold active:scale-95"
              >
                <Pencil className="size-4" /> Modifica profilo
              </Button>
              <EditProfileDialog member={m} open={editOpen} onOpenChange={setEditOpen} />
            </>
          )}
          {!m.is_me && (
            <Button
              data-testid="challenge-member-button"
              onClick={() => setChallengeOpen(true)}
              className="mt-4 h-12 w-full bg-[#EA580C] text-base font-semibold text-white hover:bg-[#C2410C] active:scale-95"
            >
              <Swords className="size-5" /> Sfida {m.name.split(" ")[0]}
            </Button>
          )}
          {!m.is_me && (
            <ChallengeDialog memberId={m.id} memberName={m.name} open={challengeOpen} onOpenChange={setChallengeOpen} />
          )}

          <div className="mt-4 space-y-2 rounded-2xl border border-border bg-card p-3" data-testid="member-contacts">
            {m.phone ? (
              <a href={telHref(m.phone)} data-testid="member-phone" className="flex items-center gap-2 text-sm font-medium text-[#38BDF8]">
                <Phone className="size-4" /> {m.phone}
              </a>
            ) : (
              <p className="flex items-center gap-2 text-sm text-slate-500"><Phone className="size-4" /> Telefono non indicato</p>
            )}
            <a href={`mailto:${m.email}`} data-testid="member-email" className="flex items-center gap-2 text-sm font-medium text-[#38BDF8]">
              <Mail className="size-4" /> {m.email}
            </a>
          </div>

          <h2 className="mt-6 text-xs font-bold uppercase tracking-wider text-slate-400">Statistiche</h2>
          <div className="mt-2 grid grid-cols-2 gap-2" data-testid="member-stats">
            <StatTile label="Partite giocate" value={m.stats.played_total} testid="stat-played-total" accent />
            <StatTile label="Ultimi 30 giorni" value={m.stats.played_30d} testid="stat-played-30d" />
            <StatTile label="Singoli" value={m.stats.singoli} testid="stat-singoli" />
            <StatTile label="Doppi" value={m.stats.doppi} testid="stat-doppi" />
            <StatTile label="Partite proposte" value={m.stats.proposed_total} testid="stat-proposed" />
          </div>

          <h2 className="mt-6 text-xs font-bold uppercase tracking-wider text-slate-400">Prossime partite</h2>
          <div className="mt-2 space-y-3" data-testid="member-upcoming">
            {m.upcoming.length === 0 && (
              <p data-testid="member-upcoming-empty" className="rounded-2xl border border-dashed border-border p-5 text-center text-sm text-slate-500">
                Nessuna partita in programma.
              </p>
            )}
            {m.upcoming.map((match, i) => (
              <MatchCard key={match.id} match={match} index={i} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
