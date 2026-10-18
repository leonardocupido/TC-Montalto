import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format, addDays, nextSaturday } from "date-fns";
import { Trophy, Users } from "lucide-react";
import { apiPost } from "@/lib/api";
import { errorMessage, type Match, type MatchIn, type MatchType } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const iso = (d: Date) => format(d, "yyyy-MM-dd");
const LEVEL_HINTS = ["Aperto a tutti", "Principiante", "Intermedio", "Avanzato"];
const labelCls = "text-xs font-bold uppercase tracking-wider text-slate-400";
const ACTIVE_TYPE_CLASS: Record<MatchType, string> = {
  singolo: "border-[#22C55E] bg-[#11221C]",
  doppio: "border-[#F97316] bg-[#221711]",
};

function typeCardClass(t: MatchType, active: boolean): string {
  if (!active) return "border-border bg-secondary";
  return ACTIVE_TYPE_CLASS[t];
}

export default function Proponi() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const today = new Date();
  const [form, setForm] = useState<MatchIn>({ type: "singolo", date: iso(addDays(today, 1)), time: "18:00", level: "", notes: "" });
  const set = <K extends keyof MatchIn>(k: K, v: MatchIn[K]) => setForm((f) => ({ ...f, [k]: v }));

  const create = useMutation({
    mutationFn: (body: MatchIn) => apiPost<Match>("/matches", body),
    onSuccess: () => {
      toast.success("Partita pubblicata in bacheca!");
      void qc.invalidateQueries({ queryKey: ["matches"] });
      void qc.invalidateQueries({ queryKey: ["my-matches"] });
      void qc.invalidateQueries({ queryKey: ["today"] });
      navigate("/le-mie-partite");
    },
    onError: (e) => toast.error(errorMessage(e, "Impossibile pubblicare la partita")),
  });

  const quickDates = [
    { label: "Oggi", value: iso(today) },
    { label: "Domani", value: iso(addDays(today, 1)) },
    { label: "Sabato", value: iso(nextSaturday(today)) },
  ];

  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wider text-[#EA580C]">Nuova partita</p>
      <h1 className="mt-1 font-heading text-3xl font-semibold tracking-tight">Proponi una partita</h1>

      <form
        className="mt-6 space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate(form);
        }}
      >
        <div className="space-y-2">
          <span className={labelCls}>Tipo di partita</span>
          <div className="grid grid-cols-2 gap-3">
            {(["singolo", "doppio"] as MatchType[]).map((t) => {
              const active = form.type === t;
              const doppio = t === "doppio";
              return (
                <button
                  key={t}
                  type="button"
                  data-testid={`propose-type-${t}`}
                  onClick={() => set("type", t)}
                  className={cn(
                    "rounded-2xl border p-4 text-left transition-[border-color,background-color,transform] duration-150 active:scale-[0.98]",
                    typeCardClass(t, active),
                  )}
                >
                  {doppio ? <Users className="size-5 text-[#FDBA74]" /> : <Trophy className="size-5 text-[#86EFAC]" />}
                  <p className="mt-2 font-heading text-lg font-semibold capitalize">{t}</p>
                  <p className="text-xs text-slate-400">{doppio ? "Cerchi 3 giocatori" : "Cerchi 1 avversario"}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="p-date" className={labelCls}>Data</Label>
          <div className="flex gap-2">
            {quickDates.map((q) => (
              <button
                key={q.label}
                type="button"
                data-testid={`propose-date-${q.label.toLowerCase()}`}
                onClick={() => set("date", q.value)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors duration-150",
                  form.date === q.value ? "border-[#10B981] text-[#10B981]" : "border-border text-slate-300",
                )}
              >
                {q.label}
              </button>
            ))}
          </div>
          <Input id="p-date" type="date" required min={iso(today)} data-testid="propose-date-input" value={form.date} onChange={(e) => set("date", e.target.value)} className="h-11 [color-scheme:dark]" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="p-time" className={labelCls}>Ora di inizio</Label>
          <Input id="p-time" type="time" required step={900} data-testid="propose-time-input" value={form.time} onChange={(e) => set("time", e.target.value)} className="h-11 font-mono [color-scheme:dark]" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="p-level" className={labelCls}>Livello</Label>
          <Input id="p-level" required maxLength={80} placeholder="Es. Intermedio 4.x, Aperto a tutti…" data-testid="propose-level-input" value={form.level} onChange={(e) => set("level", e.target.value)} className="h-11" />
          <div className="flex flex-wrap gap-2">
            {LEVEL_HINTS.map((l) => (
              <button key={l} type="button" data-testid={`propose-level-hint-${l.toLowerCase().replace(/\s+/g, "-")}`} onClick={() => set("level", l)} className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-slate-300 transition-colors duration-150 hover:bg-[#223145]">
                {l}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="p-notes" className={labelCls}>Note (facoltative)</Label>
          <Textarea id="p-notes" maxLength={500} placeholder="Es. Campo 2 già prenotato, porto le palline" data-testid="propose-notes-input" value={form.notes} onChange={(e) => set("notes", e.target.value)} />
        </div>

        <Button type="submit" data-testid="propose-match-submit-button" disabled={create.isPending} className="h-12 w-full text-base font-semibold active:scale-95">
          {create.isPending ? "Pubblicazione…" : "Pubblica in bacheca"}
        </Button>
      </form>
    </div>
  );
}
