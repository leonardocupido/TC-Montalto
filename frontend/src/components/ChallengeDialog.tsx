import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Swords } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { errorMessage, type Challenge } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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
  const send = useMutation({
    mutationFn: async () => {
  const { data, error } = await supabase.rpc(
    "create_challenge",
    {
      p_challenged_id: memberId,
    }
  );

  if (error) {
    throw error;
  }

  return data as Challenge;
},
    onSuccess: () => {
      toast.success(`Sfida lanciata! ${memberName} riceverà la notifica.`);
      void qc.invalidateQueries({ queryKey: ["challenges"] });
      onOpenChange(false);
    },
    onError: (e) => toast.error(errorMessage(e, "Impossibile lanciare la sfida")),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="challenge-modal" className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-heading text-xl">
            <Swords className="size-5 text-[#EA580C]" /> Sfida {memberName}
          </DialogTitle>
          <DialogDescription>
            {memberName} riceverà la notifica che è stato sfidato. Se accetta, deciderete insieme data e ora della partita.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            data-testid="challenge-submit-button"
            disabled={send.isPending}
            onClick={() => send.mutate()}
            className="h-11 w-full bg-[#EA580C] font-semibold text-white hover:bg-[#C2410C] active:scale-95"
          >
            {send.isPending ? "Invio…" : "Lancia la sfida"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
