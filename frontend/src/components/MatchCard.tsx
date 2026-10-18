import type { ReactNode } from "react";
import { motion } from "motion/react";
import { CalendarDays, Clock, Lock, StickyNote, Trophy, Users } from "lucide-react";
import type { Match } from "@/lib/types";
import { formatMatchDate, initials } from "@/lib/format";
import { cn } from "@/lib/utils";

export function StatusBadge({ match }: { match: Match }) {
  const open = match.status === "aperta";
  return (
    <span
      data-testid="match-status-badge"
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
        open ? "bg-[#14532D] text-[#DCFCE7]" : "bg-[#1E293B] text-[#CBD5E1]",
      )}
    >
      {open ? (
        <>
          <span className="size-1.5 rounded-full bg-[#4ADE80]" /> Aperta · {match.spots_left}{" "}
          {match.spots_left === 1 ? "posto" : "posti"}
        </>
      ) : (
        <>
          <Lock className="size-3" /> Confermata · posti esauriti
        </>
      )}
    </span>
  );
}

export default function MatchCard({ match, action, index = 0 }: { match: Match; action?: ReactNode; index?: number }) {
  const doppio = match.type === "doppio";
  const totalPlayers = match.spots_total + 1;
  const empty = Math.max(0, totalPlayers - match.players.length);
  const confirmed = match.status !== "aperta";

  return (
    <motion.article
      data-testid="match-card-item"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index, 6) * 0.04, ease: "easeOut" }}
      className={cn(
        "relative overflow-hidden rounded-2xl border p-4 transition-[transform,border-color] duration-150 active:scale-[0.99]",
        doppio ? "border-[#9A3412]/70 bg-[#221711]" : "border-[#166534]/70 bg-[#11221C]",
        confirmed && "opacity-80",
      )}
    >
      <span
        aria-hidden
        className={cn("absolute inset-y-0 left-0 w-1", doppio ? "bg-[#F97316]" : "bg-[#22C55E]")}
      />
      <div className="flex items-start justify-between gap-2">
        <span
          data-testid="match-type-pill"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-heading text-xs font-semibold uppercase tracking-wider",
            doppio ? "bg-[#F97316]/15 text-[#FDBA74]" : "bg-[#22C55E]/15 text-[#86EFAC]",
          )}
        >
          {doppio ? <Users className="size-3.5" /> : <Trophy className="size-3.5" />}
          {doppio ? "Doppio" : "Singolo"}
        </span>
        <StatusBadge match={match} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
        <p data-testid="match-date" className="flex items-center gap-1.5 font-heading text-lg font-semibold tracking-tight">
          <CalendarDays className="size-4 text-slate-400" /> {formatMatchDate(match.date)}
        </p>
        <p data-testid="match-time" className="flex items-center gap-1.5 font-mono text-base font-semibold text-white">
          <Clock className="size-4 text-slate-400" /> {match.time}
        </p>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-full bg-white/10 font-heading text-sm font-semibold">
          {initials(match.owner_name)}
        </div>
        <div className="min-w-0">
          <p data-testid="match-owner-name" className="truncate font-semibold text-white">
            {match.owner_name}
            {match.is_owner && <span className="ml-1.5 text-xs font-medium text-[#10B981]">(tu)</span>}
          </p>
          <p data-testid="match-level" className="truncate text-sm text-slate-300">
            Livello: <span className="font-medium text-white">{match.level}</span>
          </p>
        </div>
      </div>

      {match.notes && (
        <p data-testid="match-notes" className="mt-3 flex gap-2 rounded-xl bg-black/20 px-3 py-2 text-sm text-slate-300">
          <StickyNote className="mt-0.5 size-4 shrink-0 text-slate-500" /> {match.notes}
        </p>
      )}

      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="flex -space-x-2" data-testid="match-roster">
          {match.players.map((p) => (
            <span
              key={p.user_id}
              title={p.name}
              className="grid size-8 place-items-center rounded-full border-2 border-[#0B1118] bg-[#10B981] text-[11px] font-bold text-[#022C22]"
            >
              {initials(p.name)}
            </span>
          ))}
          {Array.from({ length: empty }, (_, n) => `${match.id}-open-slot-${match.players.length + n}`).map((slotId) => (
            <span
              key={slotId}
              className="grid size-8 place-items-center rounded-full border-2 border-dashed border-slate-600 bg-[#0B1118] text-[11px] text-slate-500"
            >
              ?
            </span>
          ))}
        </div>
        {action}
      </div>
    </motion.article>
  );
}
