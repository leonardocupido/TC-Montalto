import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import {
  addDays,
  format,
  nextSaturday,
} from "date-fns";
import {
  CalendarDays,
  Check,
  Clock,
  Swords,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  errorMessage,
  type Challenge,
  type ChallengeList,
  type ScheduleIn,
} from "@/lib/types";
import {
  formatMatchDate,
  initials,
} from "@/lib/format";
import { useMe } from "@/lib/hooks";
import {
  Button,
  buttonVariants,
} from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const STATUS = {
  in_attesa: {
    label: "In attesa",
    cls: "bg-[#713F12] text-[#FEF08A]",
  },
  accettata: {
    label: "Da programmare",
    cls: "bg-[#14532D] text-[#DCFCE7]",
  },
  programmata: {
    label: "Confermata",
    cls: "bg-[#14532D] text-[#DCFCE7]",
  },
  rifiutata: {
    label: "Rifiutata",
    cls: "bg-[#1E293B] text-[#94A3B8]",
  },
} as const;

const iso = (date: Date) =>
  format(date, "yyyy-MM-dd");

const REFRESH_KEYS = [
  "challenges",
  "summary",
  "matches",
  "today",
  "my-applications",
  "my-matches",
];

function ScheduleForm({
  busy,
  onSubmit,
}: {
  busy: boolean;
  onSubmit: (body: ScheduleIn) => void;
}) {
  const today = new Date();

  const [form, setForm] = useState<ScheduleIn>({
    date: iso(addDays(today, 1)),
    time: "18:00",
  });

  const quick = [
    {
      label: "Oggi",
      value: iso(today),
    },
    {
      label: "Domani",
      value: iso(addDays(today, 1)),
    },
    {
      label: "Sabato",
      value: iso(nextSaturday(today)),
    },
  ];

  return (
    <form
      data-testid="schedule-form"
      className="mt-3 space-y-2 rounded-xl bg-black/20 p-3"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(form);
      }}
    >
      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
        Programma la partita
      </p>

      <div className="flex gap-2">
        {quick.map((item) => (
          <button
            key={item.label}
            type="button"
            data-testid={`schedule-date-${item.label.toLowerCase()}`}
            onClick={() =>
              setForm((current) => ({
                ...current,
                date: item.value,
              }))
            }
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors duration-150",
              form.date === item.value
                ? "border-[#10B981] text-[#10B981]"
                : "border-border text-slate-300"
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Input
          type="date"
          required
          min={iso(today)}
          data-testid="schedule-date-input"
          value={form.date}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              date: event.target.value,
            }))
          }
          className="h-11 [color-scheme:dark]"
        />

        <Input
          type="time"
          required
          step={900}
          data-testid="schedule-time-input"
          value={form.time}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              time: event.target.value,
            }))
          }
            className="h-11 font-mono [color-scheme:dark]"
/>
      </div>

      <Button
        type="submit"
        data-testid="schedule-submit-button"
        disabled={busy}
        className="h-10 w-full font-semibold active:scale-95"
      >
        Conferma data e ora
      </Button>
    </form>
  );
}
function ChallengeCard({
  c,
  received,
  busy,
  onDecide,
  onSchedule,
  myId,
}: {
  c: Challenge;
  received: boolean;
  busy: boolean;
  onDecide: (action: "accept" | "reject") => void;
  onSchedule: (body: ScheduleIn) => void;
  myId: string | undefined;
}) {
  const other = received
    ? c.challenger_name
    : c.challenged_name;

  const status = STATUS[c.status];
  const canDecide =
    received && c.status === "in_attesa";

  return (
    <li
      data-testid={
        received
          ? "received-challenge-item"
          : "sent-challenge-item"
      }
      className={cn(
        "rounded-2xl border bg-card p-4",
        canDecide || c.status === "accettata"
          ? "border-[#EA580C]/70 bg-[#221711]"
          : "border-border"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#EA580C]/20 font-heading text-sm font-semibold text-[#FDBA74]">
            {initials(other)}
          </span>

          <div className="min-w-0">
            <p
              data-testid="challenge-other-name"
              className="truncate font-semibold text-white"
            >
              {received
                ? `${other} ti ha sfidato`
                : `Hai sfidato ${other}`}
            </p>

            {received && c.challenger_level && (
              <p className="text-xs text-slate-400">
                Livello: {c.challenger_level}
              </p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1">
          <span
            data-testid="challenge-status"
            className={cn(
              "rounded-full px-2.5 py-0.5 text-xs font-semibold",
              status.cls
            )}
          >
            {status.label}
          </span>

          {c.unseen && (
            <span
              data-testid="challenge-new-badge"
              className="rounded-full bg-[#EAB308] px-2 py-0.5 text-[10px] font-bold text-[#0B1118]"
            >
              Nuovo
            </span>
          )}
        </div>
      </div>

      {c.status === "programmata" && c.date && c.time && (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
            <p
              data-testid="challenge-date"
              className="flex items-center gap-1.5 font-heading font-semibold"
            >
              <CalendarDays className="size-4 text-slate-400" />
              {formatMatchDate(c.date)}
            </p>

            <p
              data-testid="challenge-time"
              className="flex items-center gap-1.5 font-mono font-semibold"
            >
              <Clock className="size-4 text-slate-400" />
              {c.time}
            </p>
          </div>

          <p className="mt-2 text-sm text-[#86EFAC]">
            Partita confermata in bacheca 🎾
            {c.scheduled_by && c.scheduled_by !== myId
              ? ` · programmata da ${other}`
              : ""}
          </p>
        </>
      )}

      {c.status === "in_attesa" && !received && (
        <p className="mt-3 text-sm text-slate-400">
          In attesa che {other} risponda.
        </p>
      )}

      {canDecide && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button
            data-testid="accept-challenge-btn"
            disabled={busy}
            onClick={() => onDecide("accept")}
            className="h-10 font-semibold active:scale-95"
          >
            <Check className="size-4" />
            Accetta
          </Button>

          <Button
            variant="outline"
            data-testid="reject-challenge-btn"
            disabled={busy}
            onClick={() => onDecide("reject")}
            className="h-10 font-semibold active:scale-95"
          >
            <X className="size-4" />
            Rifiuta
          </Button>
        </div>
      )}

      {c.status === "accettata" && (
        <>
          <p className="mt-3 text-sm text-slate-300">
            Sfida accettata! Mettetevi d&apos;accordo e inserite
            data e ora: la partita apparirà confermata in bacheca.
          </p>

          <ScheduleForm
            busy={busy}
            onSubmit={onSchedule}
          />
        </>
      )}
    </li>
  );
}

export default function Sfide() {
  const qc = useQueryClient();
  const me = useMe();

  const data = useQuery<ChallengeList>({
    queryKey: ["challenges"],

    queryFn: async () => {
      const { data, error } =
        await supabase.rpc("get_challenges");

      if (error) {
        throw error;
      }

      return data as ChallengeList;
    },
  });

  const received = data.isError
    ? []
    : data.data?.received ?? [];

  const sent = data.isError
    ? []
    : data.data?.sent ?? [];

  const hasUnseen = [...received, ...sent].some(
    (challenge) => challenge.unseen
  );

  const markSeen = useMutation({
    mutationFn: async () => {
      const { data, error } =
        await supabase.rpc("mark_challenges_seen");

      if (error) {
        throw error;
      }

      return data;
    },

    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: ["summary"],
      });

      void qc.invalidateQueries({
        queryKey: ["challenges"],
      });
    },
  });

  const { mutate: seen } = markSeen;

  useEffect(() => {
    if (hasUnseen) {
      seen();
    }
  }, [hasUnseen, seen]);

  const refresh = () => {
    for (const key of REFRESH_KEYS) {
      void qc.invalidateQueries({
        queryKey: [key],
      });
    }
  };

  const decide = useMutation({
    mutationFn: async ({
      id,
      action,
    }: {
      id: string;
      action: "accept" | "reject";
    }) => {
      const { data, error } =
        await supabase.rpc("decide_challenge", {
          p_challenge_id: id,
          p_action: action,
        });

      if (error) {
        throw error;
      }

      return data as Challenge;
    },

    onSuccess: (challenge) => {
      toast.success(
        challenge.status === "accettata"
          ? "Sfida accettata! Ora programmate data e ora."
          : "Sfida rifiutata"
      );

      refresh();
    },

    onError: (error) => {
      toast.error(errorMessage(error));
    },
  });

  const schedule = useMutation({
    mutationFn: async ({
      id,
      body,
    }: {
      id: string;
      body: ScheduleIn;
    }) => {
      const { data, error } =
        await supabase.rpc("schedule_challenge", {
          p_challenge_id: id,
          p_date: body.date,
          p_time: body.time,
        });

      if (error) {
        throw error;
      }

      return data as Challenge;
    },

    onSuccess: () => {
      toast.success(
        "Partita programmata e confermata in bacheca!"
      );

      refresh();
    },

    onError: (error) => {
      toast.error(errorMessage(error));
    },
  });

  const busy =
    decide.isPending || schedule.isPending;

  const renderCard = (
    challenge: Challenge,
    isReceived: boolean
  ) => (
    <ChallengeCard
      key={challenge.id}
      c={challenge}
      received={isReceived}
      busy={busy}
      myId={me.data?.id}
      onDecide={(action) =>
        decide.mutate({
          id: challenge.id,
          action,
        })
      }
      onSchedule={(body) =>
        schedule.mutate({
          id: challenge.id,
          body,
        })
      }
    />
  );

  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wider text-[#EA580C]">
        Uno contro uno
      </p>

      <h1 className="mt-1 flex items-center gap-2 font-heading text-3xl font-semibold tracking-tight">
        <Swords className="size-7 text-[#EA580C]" />
        Le mie sfide
      </h1>

      <p className="mt-1 text-sm text-slate-400">
        Sfida un socio dalla sua scheda in “Soci”. Data e ora si
        decidono dopo l&apos;accettazione.
      </p>

      <h2 className="mt-6 text-xs font-bold uppercase tracking-wider text-slate-400">
        Ricevute
      </h2>

      <ul
        className="mt-2 space-y-3"
        data-testid="received-challenges"
      >
        {data.isLoading && (
          <li className="h-32 animate-pulse rounded-2xl bg-secondary" />
        )}

        {!data.isLoading && received.length === 0 && (
          <li
            data-testid="received-empty"
            className="rounded-2xl border border-dashed border-border p-5 text-center text-sm text-slate-500"
          >
            Nessuna sfida ricevuta.
          </li>
        )}

        {received.map((challenge) =>
          renderCard(challenge, true)
        )}
      </ul>

      <h2 className="mt-6 text-xs font-bold uppercase tracking-wider text-slate-400">
        Inviate
      </h2>

      <ul
        className="mt-2 space-y-3"
        data-testid="sent-challenges"
      >
        {!data.isLoading && sent.length === 0 && (
          <li
            data-testid="sent-empty"
            className="rounded-2xl border border-dashed border-border p-5 text-center text-sm text-slate-500"
          >
            Non hai ancora lanciato sfide.{" "}
            <Link
              to="/soci"
              data-testid="sent-empty-soci-link"
              className={cn(
                buttonVariants({
                  variant: "link",
                }),
                "h-auto p-0"
              )}
            >
              Scegli un avversario
            </Link>
          </li>
        )}

        {sent.map((challenge) =>
          renderCard(challenge, false)
        )}
      </ul>
    </div>
  );
}