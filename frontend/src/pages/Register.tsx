import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { errorMessage, type RegisterIn } from "@/lib/types";
import AuthLayout from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const FIELDS: {
  key: keyof RegisterIn;
  label: string;
  type: string;
  placeholder?: string;
  required: boolean;
}[] = [
  {
    key: "name",
    label: "Nome e cognome",
    type: "text",
    placeholder: "Mario Rossi",
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
    label: "Il tuo livello",
    type: "text",
    placeholder: "Es. Intermedio, 4.2, NC…",
    required: false,
  },
  {
    key: "password",
    label: "Password (min. 6 caratteri)",
    type: "password",
    required: true,
  },
];

export default function Register() {
  const navigate = useNavigate();

  const [form, setForm] = useState<RegisterIn>({
    name: "",
    email: "",
    password: "",
    phone: "",
    level: "",
  });

  const register = useMutation({
    mutationFn: async (body: RegisterIn) => {
      const { data, error } = await supabase.auth.signUp({
        email: body.email.trim().toLowerCase(),
        password: body.password,
        options: {
          data: {
            name: body.name.trim(),
            phone: body.phone.trim(),
            level: body.level.trim(),
          },
        },
      });

      if (error) {
        throw error;
      }

      if (!data.user) {
        throw new Error("Utente non creato");
      }

      return data;
    },

    onSuccess: (data) => {
      if (data.session) {
        toast.success("Account creato correttamente.");
      } else {
        toast.success(
          "Account creato. Controlla la tua email per confermare la registrazione."
        );
      }

      navigate("/login");
    },

    onError: (error) => {
      toast.error(errorMessage(error, "Registrazione non riuscita"));
    },
  });

  return (
    <AuthLayout
      title="Diventa parte della bacheca."
      subtitle="Crea il tuo account socio in pochi secondi."
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          register.mutate(form);
        }}
      >
        {FIELDS.map((field) => (
          <div key={field.key} className="space-y-1.5">
            <Label
              htmlFor={`reg-${field.key}`}
              className="text-xs font-bold uppercase tracking-wider text-slate-400"
            >
              {field.label}
            </Label>

            <Input
              id={`reg-${field.key}`}
              type={field.type}
              required={field.required}
              minLength={
                field.key === "password"
                  ? 6
                  : field.key === "name"
                    ? 2
                    : undefined
              }
              maxLength={
                field.key === "name"
                  ? 60
                  : field.key === "email"
                    ? 120
                    : field.key === "phone"
                      ? 30
                      : field.key === "level"
                        ? 60
                        : field.key === "password"
                          ? 100
                          : undefined
              }
              placeholder={field.placeholder}
              data-testid={`register-${field.key}-input`}
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

        <Button
          type="submit"
          data-testid="register-submit-button"
          disabled={register.isPending}
          className="h-11 w-full font-semibold active:scale-95"
        >
          {register.isPending ? "Creazione…" : "Crea account"}
        </Button>
      </form>

      <p className="mt-4 text-center text-sm text-slate-400">
        Hai già un account?{" "}
        <Link
          to="/login"
          data-testid="go-login-link"
          className="font-semibold text-[#38BDF8] hover:underline"
        >
          Accedi
        </Link>
      </p>
    </AuthLayout>
  );
}