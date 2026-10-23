import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiPost } from "@/lib/api";
import { beginSession } from "@/lib/session";
import { errorMessage, type LoginIn, type User } from "@/lib/types";
import AuthLayout from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const login = useMutation({
    mutationFn: (body: LoginIn) => apiPost<User>("/auth/login", body),
    onSuccess: (u) => {
      beginSession();
      toast.success(`Bentornato, ${u.name.split(" ")[0]}!`);
      navigate("/");
    },
    onError: (e) => toast.error(errorMessage(e, "Accesso non riuscito")),
  });

  return (
    <AuthLayout title="Trova la tua prossima partita." subtitle="La bacheca dei soci per organizzare singoli e doppi, senza chat infinite.">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          login.mutate({ email, password });
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-slate-400">Email</Label>
          <Input id="email" type="email" required autoComplete="email" data-testid="login-email-input" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-xs font-bold uppercase tracking-wider text-slate-400">Password</Label>
          <Input id="password" type="password" required autoComplete="current-password" data-testid="login-password-input" value={password} onChange={(e) => setPassword(e.target.value)} className="h-11" />
        </div>
        <Button type="submit" data-testid="login-submit-button" disabled={login.isPending} className="h-11 w-full font-semibold active:scale-95">
          {login.isPending ? "Accesso…" : "Accedi"}
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-400">
        Nuovo socio?{" "}
        <Link to="/register" data-testid="go-register-link" className="font-semibold text-[#38BDF8] hover:underline">
          Registrati
        </Link>
      </p>
    </AuthLayout>
  );
}
