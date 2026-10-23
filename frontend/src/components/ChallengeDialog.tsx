import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { addDays, format, nextSaturday } from "date-fns";
import { apiPost } from "@/lib/api";
import { errorMessage, type Challenge, type ChallengeIn } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const iso = (d: Date) => format(d, "yyyy-MM-dd");
const labelCls = "text-xs font-bold uppercase tracking-wider text-slate-400";

export default function ChallengeDialog({
  memberId,
  memberName,
  open,
  onOpenChange,
}: {
  memberId: string;
  memberName: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const qc = useQueryClient();
  const today = new Date();
  const [form, setForm] = useState<ChallengeIn>({ date: iso(addDays(today, 1)), time: "18:00", message: "" });
  const quick = [
    { label: "Oggi", value: iso(today) },
    { label: "Domani", value: iso(addDays(today, 1)) },
    { label: "Sabato", value: iso(nextSaturday(today)) },
  ];

  const send = useMutation({
    mutationFn: (body: ChallengeIn) => apiPost<Challenge>(`/members/${memberId}/challenge`, body),
    onSuccess: () => {
      toast.success(`Sfida lanciata a ${memberName}! Riceverà subito la notifica.`);
      void qc.invalidateQueries({ queryKey: ["challenges"] });
      setForm((f) => ({ ...f, message: "" }));
      onOpenChange(false);
    },
    onError: (e) => toast.error(errorMessage(e, "Impossibile lanciare la sfida")),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="challenge-modal" className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">Sfida {memberName}</DialogTitle>
          <DialogDescription>Singolo uno contro uno: se accetta, la partita è confermata in bacheca.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            send.mutate(form);
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="ch-date" className={labelCls}>Data</Label>
            <div className="flex gap-2">
              {quick.map((q) => (
                <button
                  key={q.label}
                  type="button"
                  data-testid={`challenge-date-${q.label.toLowerCase()}`}
                  onClick={() => setForm((f) => ({ ...f, date: q.value }))}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors duration-150",
                    form.date === q.value ? "border-[#EA580C] text-[#FDBA74]" : "border-border text-slate-300",
                  )}
                >
                  {q.label}
                </button>
              ))}
            </div>
            <Input id="ch-date" type="date" required min={iso(today)} data-testid="challenge-date-input" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} className="h-11 [color-scheme:dark]" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ch-time" className={labelCls}>Ora</Label>
            <Input id="ch-time" type="time" required step={900} data-testid="challenge-time-input" value={form.time} onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))} className="h-11 font-mono [color-scheme:dark]" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ch-msg" className={labelCls}>Messaggio (facoltativo)</Label>
            <Textarea id="ch-msg" maxLength={300} placeholder="Es. Rivincita? Campo 2 già prenotato" data-testid="challenge-message-input" value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} />
          </div>
          <DialogFooter>
            <Button type="submit" data-testid="challenge-submit-button" disabled={send.isPending} className="h-11 w-full bg-[#EA580C] font-semibold text-white hover:bg-[#C2410C] active:scale-95">
              {send.isPending ? "Invio…" : "Lancia la sfida"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
