import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import {
  errorMessage,
  type MemberDetail,
  type ProfileUpdate,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const FIELDS: {
  key: keyof ProfileUpdate;
  label: string;
  type: string;
  placeholder?: string;
  required: boolean;
}[] = [
  {
    key: "name",
    label: "Nome e cognome",
    type: "text",
    required: true,
  },
  {
    key: "email",
    label: "Email",
    type: "email",
    required: true,
  },
  {
    key: "phone",
    label: "Telefono",
    type: "tel",
    placeholder: "+39 333 1234567",
    required: false,
  },
  {
    key: "level",
    label: "Livello",
    type: "text",
    placeholder: "Es. Intermedio, 4.2, NC…",
    required: false,
  },
];

const REFRESH_KEYS = [
  "me",
  "member",
  "members",
  "matches",
  "my-matches",
  "my-applications",
  "today",
  "challenges",
];

export default function EditProfileDialog({
  member,
  open,
  onOpenChange,
}: {
  member: MemberDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();

  const [form, setForm] = useState<ProfileUpdate>({
    name: member.name,
    email: member.email,
    phone: member.phone,
    level: member.level,
  });

  const save = useMutation({
    mutationFn: async (body: ProfileUpdate) => {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("Utente non autenticato");
      }

      const newEmail = body.email.trim().toLowerCase();
      const currentEmail = (user.email ?? "").trim().toLowerCase();

      const { error: profileError } = await supabase.rpc(
        "update_my_profile",
        {
          p_name: body.name.trim(),
          p_phone: body.phone.trim(),
          p_level: body.level.trim(),
        }
      );

      if (profileError) {
        throw profileError;
      }

      let emailChangeRequested = false;

      if (newEmail !== currentEmail) {
        const { error: emailError } = await supabase.auth.updateUser({
          email: newEmail,
        });

        if (emailError) {
          throw emailError;
        }

        emailChangeRequested = true;
      }

      return {
        emailChangeRequested,
      };
    },

    onSuccess: ({ emailChangeRequested }) => {
      if (emailChangeRequested) {
        toast.success(
          "Profilo aggiornato. Controlla la tua email per confermare il nuovo indirizzo."
        );
      } else {
        toast.success("Profilo aggiornato");
      }

      for (const key of REFRESH_KEYS) {
        void qc.invalidateQueries({
          queryKey: [key],
        });
      }

      onOpenChange(false);
    },

    onError: (error) => {
      toast.error(
        errorMessage(error, "Impossibile salvare il profilo")
      );
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (isOpen) {
          setForm({
            name: member.name,
            email: member.email,
            phone: member.phone,
            level: member.level,
          });
        }

        onOpenChange(isOpen);
      }}
    >
      <DialogContent
        data-testid="edit-profile-modal"
        className="max-w-sm"
      >
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">
            Modifica profilo
          </DialogTitle>

          <DialogDescription>
            I dati aggiornati saranno visibili agli altri soci.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate(form);
          }}
        >
          {FIELDS.map((field) => (
            <div
              key={field.key}
              className="space-y-1.5"
            >
              <Label
                htmlFor={`profile-${field.key}`}
                className="text-xs font-bold uppercase tracking-wider text-slate-400"
              >
                {field.label}
              </Label>

              <Input
                id={`profile-${field.key}`}
                type={field.type}
                required={field.required}
                minLength={
                  field.key === "name" ? 2 : undefined
                }
                placeholder={field.placeholder}
                data-testid={`profile-${field.key}-input`}
                value={form[field.key]}
                onChange={(event) =>
                  setForm({
                    ...form,
                    [field.key]: event.target.value,
                  })
                }
                className="h-11"
              />
            </div>
          ))}

          <DialogFooter>
            <Button
              type="submit"
              data-testid="profile-save-button"
              disabled={save.isPending}
              className="h-11 w-full font-semibold active:scale-95"
            >
              {save.isPending
                ? "Salvataggio…"
                : "Salva modifiche"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}