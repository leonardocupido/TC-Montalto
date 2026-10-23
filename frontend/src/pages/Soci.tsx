import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { ChevronRight, Search, Swords } from "lucide-react";
import { apiGet } from "@/lib/api";
import type { MemberSummary } from "@/lib/types";
import { useSummary } from "@/lib/hooks";
import { initials } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const SKELETONS = ["sk-a", "sk-b", "sk-c", "sk-d"];

export default function Soci() {
  const [q, setQ] = useState("");
  const members = useQuery({ queryKey: ["members"], queryFn: () => apiGet<MemberSummary[]>("/members") });
  const all = members.isError ? [] : (members.data ?? []);
  const list = all.filter((m) => m.name.toLowerCase().includes(q.trim().toLowerCase()));
  const pendingCh = useSummary(true).data?.pending_challenges ?? 0;

  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wider text-[#EA580C]">Il club</p>
      <h1 className="mt-1 font-heading text-3xl font-semibold tracking-tight">Soci iscritti</h1>
      <p data-testid="members-count" className="mt-1 text-sm text-slate-400">
        {members.isLoading ? "Caricamento…" : `${all.length} ${all.length === 1 ? "socio" : "soci"} in bacheca`}
      </p>

      <Link
        to="/sfide"
        data-testid="challenges-link"
        className="mt-4 flex items-center gap-3 rounded-2xl border border-[#9A3412]/70 bg-[#221711] px-4 py-3 transition-[border-color,transform] duration-150 hover:border-[#EA580C] active:scale-[0.99]"
      >
        <Swords className="size-5 text-[#FDBA74]" />
        <span className="flex-1 font-semibold text-white">Le mie sfide</span>
        {pendingCh > 0 && (
          <span data-testid="challenges-link-count" className="rounded-full bg-[#EA580C] px-2 py-0.5 text-xs font-bold text-white">
            {pendingCh} da rispondere
          </span>
        )}
        <ChevronRight className="size-4 text-slate-500" />
      </Link>

      <div className="relative mt-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
        <Input
          data-testid="members-search-input"
          placeholder="Cerca un socio"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="h-11 pl-9"
        />
      </div>

      <ul className="mt-4 space-y-2" data-testid="members-list">
        {members.isLoading && SKELETONS.map((id) => <li key={id} className="h-16 animate-pulse rounded-2xl bg-secondary" />)}
        {!members.isLoading && list.length === 0 && (
          <li data-testid="members-empty" className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-slate-400">
            {members.isError ? "Impossibile caricare i soci al momento." : "Nessun socio trovato."}
          </li>
        )}
        {list.map((m, i) => (
          <motion.li
            key={m.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: Math.min(i, 8) * 0.03 }}
          >
            <Link
              to={`/soci/${m.id}`}
              data-testid="member-item"
              className={cn(
                "flex items-center gap-3 rounded-2xl border bg-card px-3 py-3 transition-[border-color,transform] duration-150 hover:border-slate-500 active:scale-[0.99]",
                m.is_me ? "border-[#10B981]/60" : "border-border",
              )}
            >
              <span
                className={cn(
                  "grid size-11 shrink-0 place-items-center rounded-full font-heading text-sm font-semibold",
                  m.is_me ? "bg-[#10B981] text-[#022C22]" : "bg-[#1E293B] text-white",
                )}
              >
                {initials(m.name)}
              </span>
              <div className="min-w-0 flex-1">
                <p data-testid="member-name" className="truncate font-semibold text-white">
                  {m.name}
                  {m.is_me && <span className="ml-1.5 text-xs font-medium text-[#10B981]">(tu)</span>}
                </p>
                <p className="truncate text-xs text-slate-400">{m.level ? `Livello: ${m.level}` : "Livello non indicato"}</p>
              </div>
              <div className="text-right">
                <p data-testid="member-played-30d" className="font-mono text-lg font-semibold leading-none text-[#10B981]">{m.played_30d}</p>
                <p className="text-[10px] uppercase tracking-wider text-slate-500">30 gg</p>
              </div>
              <ChevronRight className="size-4 shrink-0 text-slate-500" />
            </Link>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}
