import { useEffect } from "react";
import { NavLink, Navigate, Outlet } from "react-router-dom";
import { toast } from "sonner";
import { CalendarCheck, Handshake, LayoutList, LogOut, PlusCircle } from "lucide-react";
import { ApiError } from "@/lib/api";
import { useMe, useSummary } from "@/lib/hooks";
import { endSession } from "@/lib/session";
import { initials } from "@/lib/format";
import type { User } from "@/lib/types";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Bacheca", icon: LayoutList, testid: "nav-bacheca-tab" },
  { to: "/le-mie-partite", label: "Mie partite", icon: CalendarCheck, testid: "nav-mie-partite-tab" },
  { to: "/le-mie-candidature", label: "Candidature", icon: Handshake, testid: "nav-mie-candidature-tab" },
  { to: "/proponi", label: "Proponi", icon: PlusCircle, testid: "nav-proponi-tab" },
];

function navLinkClass({ isActive }: { isActive: boolean }) {
  return cn(
    "relative flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors duration-150",
    isActive ? "text-[#10B981]" : "text-slate-400 hover:text-slate-200",
  );
}

function AppHeader({ user, pending, newAcc }: { user: User | undefined; pending: number; newAcc: number }) {
  return (
    <header
      data-testid="app-header"
      className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-[#0B1118]/85 px-4 py-3 backdrop-blur-xl"
    >
      <div className="flex min-w-0 items-center gap-2.5" data-testid="club-brand-logo">
        <img src="/crest.png" alt="Stemma Tennis Club Montalto" data-testid="club-crest" className="size-9 shrink-0 rounded-full bg-white ring-2 ring-white/70" />
        <div className="min-w-0 leading-tight">
          <p className="truncate font-heading text-[15px] font-semibold tracking-tight">Tennis Club Montalto</p>
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Bacheca partite</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {newAcc > 0 && (
          <NavLink
            to="/le-mie-candidature"
            data-testid="header-accepted-badge"
            className="whitespace-nowrap rounded-full bg-[#14532D] px-2.5 py-1 text-xs font-semibold text-[#DCFCE7] ring-1 ring-[#4ADE80]/60"
          >
            {newAcc === 1 ? "In campo!" : `${newAcc} accettate`}
          </NavLink>
        )}
        {pending > 0 && (
          <NavLink
            to="/le-mie-partite"
            data-testid="header-pending-badge"
            className="animate-pulse-ring whitespace-nowrap rounded-full bg-[#713F12] px-2.5 py-1 text-xs font-semibold text-[#FEF08A]"
          >
            {pending} da valutare
          </NavLink>
        )}
        <div
          data-testid="header-user-avatar"
          title={user?.name}
          className="grid size-9 place-items-center rounded-full bg-[#14532D] font-heading text-sm font-semibold text-[#DCFCE7]"
        >
          {user ? initials(user.name) : "·"}
        </div>
        <button
          type="button"
          aria-label="Esci"
          data-testid="logout-button"
          onClick={() => void endSession()}
          className="grid size-9 place-items-center rounded-full text-slate-400 transition-colors duration-150 hover:bg-secondary hover:text-white active:scale-95"
        >
          <LogOut className="size-4" />
        </button>
      </div>
    </header>
  );
}

function BottomNav({ pending, newAcc }: { pending: number; newAcc: number }) {
  return (
    <nav
      data-testid="bottom-nav"
      className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md border-t border-border bg-[#0B1118]/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl"
    >
      <ul className="grid grid-cols-4">
        {NAV.map(({ to, label, icon: Icon, testid }) => (
          <li key={to}>
            <NavLink to={to} end data-testid={testid} className={navLinkClass}>
              <span className="relative">
                <Icon className={cn("size-5", to === "/proponi" && "size-6")} />
                {to === "/le-mie-partite" && pending > 0 && (
                  <span
                    data-testid="nav-pending-count"
                    className="absolute -right-2.5 -top-1.5 grid size-4 place-items-center rounded-full bg-[#EAB308] text-[10px] font-bold text-[#0B1118]"
                  >
                    {pending}
                  </span>
                )}
                {to === "/le-mie-candidature" && newAcc > 0 && (
                  <span
                    data-testid="nav-accepted-count"
                    className="absolute -right-2.5 -top-1.5 grid size-4 place-items-center rounded-full bg-[#4ADE80] text-[10px] font-bold text-[#0B1118]"
                  >
                    {newAcc}
                  </span>
                )}
              </span>
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export default function AppShell() {
  const me = useMe();
  const summary = useSummary(!!me.data && !me.isError);

  const pending = summary.data?.pending_reviews ?? 0;
  const newAcc = summary.data?.new_acceptances ?? 0;

  useEffect(() => {
    if (newAcc > 0) {
      // Fixed id: StrictMode double-run and 30s polling never stack duplicate toasts.
      toast.success(
        newAcc === 1 ? "La tua candidatura è stata accettata! Sei in campo 🎾" : `${newAcc} candidature accettate! Sei in campo 🎾`,
        { id: "new-acceptances", description: "Apri Candidature per vedere i contatti dei giocatori." },
      );
    }
  }, [newAcc]);

  if (me.error instanceof ApiError && me.error.status === 401) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-dvh bg-background">
      <div className="mx-auto flex min-h-dvh max-w-md flex-col border-x border-border/60 bg-background">
        <AppHeader user={me.data} pending={pending} newAcc={newAcc} />
        <main className="flex-1 px-4 pb-28 pt-4">
          {me.isLoading ? <div className="h-48 animate-pulse rounded-2xl bg-secondary" /> : <Outlet />}
        </main>
        <BottomNav pending={pending} newAcc={newAcc} />
      </div>
      <Toaster richColors />
    </div>
  );
}
