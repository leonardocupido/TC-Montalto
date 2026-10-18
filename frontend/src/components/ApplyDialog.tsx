import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiPost } from "@/lib/api";
import { useMe } from "@/lib/hooks";
import { errorMessage, type Application, type ApplyIn, type Match } from "@/lib/types";
import { formatMatchDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function ApplyDialog({ match, open, onOpenChange }: { match: Match | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const me = useMe();
  const qc = useQueryClient();
  const [phone, setPhone] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const phoneValue = phone ?? me.data?.phone ?? "";

  const apply = useMutation({
    mutationFn: (body: ApplyIn) => apiPost<Application>(`/matches/${match?.id}/apply`, body),
    onSuccess: () => {
      toast.success("Candidatura inviata! Il proponente riceverà la tua richiesta.");
      void qc.invalidateQueries({ queryKey: ["matches"] });
      void qc.invalidateQueries({ queryKey: ["my-applications"] });
      setMessage("");
      onOpenChange(false);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="candidacy-modal" className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">Mi candido</DialogTitle>
          <DialogDescription>
            {match && (
              <>
                {match.type === "doppio" ? "Doppio" : "Singolo"} di {match.owner_name} · {formatMatchDate(match.date)} alle {match.time}
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            apply.mutate({ phone: phoneValue, message });
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="apply-phone" className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Telefono di contatto
            </Label>
            <Input
              id="apply-phone"
              data-testid="candidacy-phone-input"
              type="tel"
              required
              minLength={3}
              placeholder="+39 333 1234567"
              value={phoneValue}
              onChange={(e) => setPhone(e.target.value)}
              className="h-11"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="apply-msg" className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Messaggio (facoltativo)
            </Label>
            <Textarea
              id="apply-msg"
              data-testid="candidacy-message-input"
              placeholder="Es. posso arrivare 10 minuti prima, gioco a destra"
              value={message}
              maxLength={300}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              type="submit"
              data-testid="candidacy-modal-submit"
              disabled={apply.isPending}
              className="h-11 w-full font-semibold active:scale-95"
            >
              {apply.isPending ? "Invio…" : "Invia candidatura"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
