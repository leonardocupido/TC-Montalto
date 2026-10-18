import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiPost } from "@/lib/api";
import { beginSession } from "@/lib/session";
import { errorMessage, type RegisterIn, type User } from "@/lib/types";
import AuthLayout from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const FIELDS: { key: keyof RegisterIn; label: string; type: string; placeholder?: string; required: boolean }[] = [
  { key: "name", label: "Nome e cognome", type: "text", placeholder: "Mario Rossi", required: true },
  { key: "email", label: "Email", type: "email", required: true },
  { key: "phone", label: "Telefono", type: "tel", placeholder: "+39 333 1234567", required: false },
  { key: "level", label: "Il tuo livello", type: "text", placeholder: "Es. Intermedio, 4.2, NC…", required: false },
  { key: "password", label: "Password (min. 6 caratteri)", type: "password", required: true },
];

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState<RegisterIn>({ name: "", email: "", password: "", phone: "", level: "" });

  const register = useMutation({
    mutationFn: (body: RegisterIn) => apiPost<User>("/auth/register", body),
    onSuccess: () => {
      beginSession();
      toast.success("Benvenuto nella bacheca del club!");
      navigate("/");
    },
    onError: (e) => toast.error(errorMessage(e, "Registrazione non riuscita")),
  });

  return (
    <AuthLayout title="Diventa parte della bacheca." subtitle="Crea il tuo account socio in pochi secondi.">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          register.mutate(form);
        }}
      >
        {FIELDS.map((f) => (
          <div key={f.key} className="space-y-1.5">
            <Label htmlFor={`reg-${f.key}`} className="text-xs font-bold uppercase tracking-wider text-slate-400">{f.label}</Label>
            <Input
              id={`reg-${f.key}`}
              type={f.type}
              required={f.required}
              minLength={f.key === "password" ? 6 : undefined}
              placeholder={f.placeholder}
              data-testid={`register-${f.key}-input`}
              value={form[f.key]}
              onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
              className="h-11"
            />
          </div>
        ))}
        <Button type="submit" data-testid="register-submit-button" disabled={register.isPending} className="h-11 w-full font-semibold active:scale-95">
          {register.isPending ? "Creazione…" : "Crea account"}
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-400">
        Hai già un account?{" "}
        <Link to="/login" data-testid="go-login-link" className="font-semibold text-[#38BDF8] hover:underline">
          Accedi
        </Link>
      </p>
    </AuthLayout>
  );
}
