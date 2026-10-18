import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { BellRing, Clock } from "lucide-react";
import { apiGet } from "@/lib/api";
import type { Match } from "@/lib/types";
import { initials } from "@/lib/format";

export default function TodayReminder() {
  const today = useQuery({
    queryKey: ["today"],
    queryFn: () => apiGet<Match[]>("/me/today"),
    refetchInterval: 60000,
  });
  const items = today.isError ? [] : (today.data ?? []);
  if (items.length === 0) return null;

  return (
    <div className="mb-5 space-y-3" data-testid="today-reminder">
      {items.map((m) => {
        const confirmed = m.status === "confermata";
        return (
          <motion.div
            key={m.id}
            data-testid="today-reminder-item"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="relative overflow-hidden rounded-2xl border border-[#EAB308]/60 bg-gradient-to-br from-[#2A2108] to-[#131C28] p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#FDE047]">
                <BellRing className="size-4" /> Oggi si gioca!
              </p>
              <span
                data-testid="today-reminder-status"
                className={
                  confirmed
                    ? "rounded-full bg-[#14532D] px-2.5 py-0.5 text-xs font-semibold text-[#DCFCE7]"
                    : "rounded-full bg-[#713F12] px-2.5 py-0.5 text-xs font-semibold text-[#FEF08A]"
                }
              >
                {confirmed ? "Confermata" : `Mancano ${m.spots_left} ${m.spots_left === 1 ? "giocatore" : "giocatori"}`}
              </span>
            </div>
            <p className="mt-2 flex items-baseline gap-2 font-heading text-2xl font-semibold tracking-tight text-white">
              <Clock className="size-5 self-center text-[#FDE047]" />
              <span data-testid="today-reminder-time" className="font-mono">{m.time}</span>
              <span className="text-base font-medium text-slate-300">· {m.type === "doppio" ? "Doppio" : "Singolo"}</span>
            </p>
            <p className="mt-3 text-xs font-bold uppercase tracking-wider text-slate-400">Giocatori confermati</p>
            <ul className="mt-1.5 flex flex-wrap gap-2" data-testid="today-reminder-players">
              {m.players.map((p) => (
                <li
                  key={p.user_id}
                  className="flex items-center gap-1.5 rounded-full bg-white/10 py-1 pl-1 pr-3 text-sm text-white"
                >
                  <span className="grid size-6 place-items-center rounded-full bg-[#10B981] text-[10px] font-bold text-[#022C22]">
                    {initials(p.name)}
                  </span>
                  {p.name}
                </li>
              ))}
            </ul>
            {m.notes && <p className="mt-3 text-sm text-slate-300">{m.notes}</p>}
          </motion.div>
        );
      })}
    </div>
  );
}
