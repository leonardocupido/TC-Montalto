import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiGet, apiPost } from "@/lib/api";
import { beginSession } from "@/lib/session";
import { errorMessage, type DemoLoginIn, type DemoUser, type LoginIn, type User } from "@/lib/types";
import AuthLayout from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // Demo accounts come from the backend (gated by DEMO_LOGIN_ENABLED) — no credentials live in the frontend.
  const demo = useQuery({ queryKey: ["demo-users"], queryFn: () => apiGet<DemoUser[]>("/auth/demo-users") });
  const demoUsers = demo.isError ? [] : (demo.data ?? []);

  const onLoggedIn = (u: User) => {
    beginSession();
    toast.success(`Bentornato, ${u.name.split(" ")[0]}!`);
    navigate("/");
  };

  const login = useMutation({
    mutationFn: (body: LoginIn) => apiPost<User>("/auth/login", body),
    onSuccess: onLoggedIn,
    onError: (e) => toast.error(errorMessage(e, "Accesso non riuscito")),
  });

  const demoLogin = useMutation({
    mutationFn: (body: DemoLoginIn) => apiPost<User>("/auth/demo-login", body),
    onSuccess: onLoggedIn,
    onError: (e) => toast.error(errorMessage(e, "Accesso demo non riuscito")),
  });

  const busy = login.isPending || demoLogin.isPending;

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
        <Button type="submit" data-testid="login-submit-button" disabled={busy} className="h-11 w-full font-semibold active:scale-95">
          {login.isPending ? "Accesso…" : "Accedi"}
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-400">
        Nuovo socio?{" "}
        <Link to="/register" data-testid="go-register-link" className="font-semibold text-[#38BDF8] hover:underline">
          Registrati
        </Link>
      </p>
      {demoUsers.length > 0 && (
        <div className="mt-5 border-t border-border pt-4" data-testid="demo-login-section">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Accesso rapido soci demo</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {demoUsers.map((d) => {
              const first = d.name.split(" ")[0];
              return (
                <button
                  key={d.email}
                  type="button"
                  data-testid={`demo-login-${first.toLowerCase()}`}
                  disabled={busy}
                  onClick={() => demoLogin.mutate({ email: d.email })}
                  className="rounded-full border border-border bg-secondary px-3 py-1.5 text-sm font-medium text-slate-200 transition-[background-color,transform] duration-150 hover:bg-[#223145] active:scale-95"
                >
                  {first}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </AuthLayout>
  );
}
