import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { beginSession } from "@/lib/session";
import { errorMessage, type LoginIn } from "@/lib/types";
import AuthLayout from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const login = useMutation({
    mutationFn: async (body: LoginIn) => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: body.email.trim().toLowerCase(),
        password: body.password,
      });

      if (error) {
        throw error;
      }

      if (!data.user || !data.session) {
        throw new Error("Sessione non creata");
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", data.user.id)
        .single();

      if (profileError) {
        throw profileError;
      }

      return {
        session: data.session,
        name: profile?.name || "Socio",
      };
    },

    onSuccess: ({ name }) => {
      // Temporaneo: mantiene compatibilità con il controllo
      // di sessione già presente nell'app.
      beginSession();

      const firstName = name.trim().split(/\s+/)[0] || "Socio";

      toast.success(`Bentornato, ${firstName}!`);
      navigate("/");
    },

    onError: (error) => {
      toast.error(errorMessage(error, "Email o password errati"));
    },
  });

  return (
    <AuthLayout
      title="Trova la tua prossima partita."
      subtitle="La bacheca dei soci per organizzare singoli e doppi, senza chat infinite."
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          login.mutate({ email, password });
        }}
      >
        <div className="space-y-1.5">
          <Label
            htmlFor="email"
            className="text-xs font-bold uppercase tracking-wider text-slate-400"
          >
            Email
          </Label>

          <Input
            id="email"
            type="email"
            required
            autoComplete="email"
            data-testid="login-email-input"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="h-11"
          />
        </div>

        <div className="space-y-1.5">
          <Label
            htmlFor="password"
            className="text-xs font-bold uppercase tracking-wider text-slate-400"
          >
            Password
          </Label>

          <Input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            data-testid="login-password-input"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="h-11"
          />
        </div>

        <Button
          type="submit"
          data-testid="login-submit-button"
          disabled={login.isPending}
          className="h-11 w-full font-semibold active:scale-95"
        >
          {login.isPending ? "Accesso…" : "Accedi"}
        </Button>
      </form>

      <p className="mt-4 text-center text-sm text-slate-400">
        Nuovo socio?{" "}
        <Link
          to="/register"
          data-testid="go-register-link"
          className="font-semibold text-[#38BDF8] hover:underline"
        >
          Registrati
        </Link>
      </p>
    </AuthLayout>
  );
}