import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiPatch } from "@/lib/api";
import { errorMessage, type MemberDetail, type ProfileUpdate, type User } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const FIELDS: { key: keyof ProfileUpdate; label: string; type: string; placeholder?: string; required: boolean }[] = [
  { key: "name", label: "Nome e cognome", type: "text", required: true },
  { key: "email", label: "Email", type: "email", required: true },
  { key: "phone", label: "Telefono", type: "tel", placeholder: "+39 333 1234567", required: false },
  { key: "level", label: "Livello", type: "text", placeholder: "Es. Intermedio, 4.2, NC…", required: false },
];

// Everything that shows a member's name/level/contacts.
const REFRESH_KEYS = ["me", "member", "members", "matches", "my-matches", "my-applications", "today", "challenges"];

export default function EditProfileDialog({ member, open, onOpenChange }: { member: MemberDetail; open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<ProfileUpdate>({ name: member.name, email: member.email, phone: member.phone, level: member.level });

  const save = useMutation({
    mutationFn: (body: ProfileUpdate) => apiPatch<User>("/auth/me", body),
    onSuccess: () => {
      toast.success("Profilo aggiornato");
      for (const k of REFRESH_KEYS) void qc.invalidateQueries({ queryKey: [k] });
      onOpenChange(false);
    },
    onError: (e) => toast.error(errorMessage(e, "Impossibile salvare il profilo")),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) setForm({ name: member.name, email: member.email, phone: member.phone, level: member.level });
        onOpenChange(o);
      }}
    >
      <DialogContent data-testid="edit-profile-modal" className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">Modifica profilo</DialogTitle>
          <DialogDescription>I dati aggiornati saranno visibili agli altri soci.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate(form);
          }}
        >
          {FIELDS.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <Label htmlFor={`profile-${f.key}`} className="text-xs font-bold uppercase tracking-wider text-slate-400">{f.label}</Label>
              <Input
                id={`profile-${f.key}`}
                type={f.type}
                required={f.required}
                minLength={f.key === "name" ? 2 : undefined}
                placeholder={f.placeholder}
                data-testid={`profile-${f.key}-input`}
                value={form[f.key]}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                className="h-11"
              />
            </div>
          ))}
          <DialogFooter>
            <Button type="submit" data-testid="profile-save-button" disabled={save.isPending} className="h-11 w-full font-semibold active:scale-95">
              {save.isPending ? "Salvataggio…" : "Salva modifiche"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
