// Hand-written mirrors of backend/models/tennis.py — keep in sync.
import { ApiError } from "./api";

export type MatchType = "singolo" | "doppio";
export type MatchStatus = "aperta" | "confermata" | "annullata";
export type AppStatus = "in_attesa" | "accettata" | "rifiutata";

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  level: string;
}

export interface DemoUser {
  name: string;
  email: string;
}

export interface DemoLoginIn {
  email: string;
}

export interface RegisterIn {
  name: string;
  email: string;
  password: string;
  phone: string;
  level: string;
}

export interface LoginIn {
  email: string;
  password: string;
}

export interface MatchIn {
  type: MatchType;
  date: string;
  time: string;
  level: string;
  notes: string;
}

export interface Player {
  user_id: string;
  name: string;
  level: string;
}

export interface Match {
  id: string;
  owner_id: string;
  owner_name: string;
  owner_level: string;
  type: MatchType;
  date: string;
  time: string;
  level: string;
  notes: string;
  status: MatchStatus;
  spots_total: number;
  spots_left: number;
  players: Player[];
  is_owner: boolean;
  my_application_status: AppStatus | null;
  pending_count: number;
  created_at: string;
}

export interface ApplyIn {
  phone: string;
  message: string;
}

export interface Application {
  id: string;
  match_id: string;
  user_id: string;
  user_name: string;
  user_level: string;
  phone: string;
  message: string;
  status: AppStatus;
  applicant_seen: boolean;
  cancel_seen: boolean;
  created_at: string;
}

export interface OwnedMatch {
  match: Match;
  applications: Application[];
}

export interface Contact {
  name: string;
  phone: string;
  role: "proponente" | "giocatore";
}

export interface MyApplication {
  application: Application;
  match: Match;
  contacts: Contact[];
}

export interface Summary {
  pending_reviews: number;
  accepted_applications: number;
  new_acceptances: number;
  new_cancellations: number;
  pending_challenges: number;
  challenge_updates: number;
}

export type ChallengeStatus = "in_attesa" | "accettata" | "programmata" | "rifiutata";

export interface ScheduleIn {
  date: string;
  time: string;
}

export interface Challenge {
  id: string;
  challenger_id: string;
  challenger_name: string;
  challenger_level: string;
  challenged_id: string;
  challenged_name: string;
  date: string | null;
  time: string | null;
  status: ChallengeStatus;
  scheduled_by: string | null;
  match_id: string | null;
  unseen: boolean;
  created_at: string;
}

export interface ChallengeList {
  received: Challenge[];
  sent: Challenge[];
}

export interface History {
  last_30_days: number;
  singoli: number;
  doppi: number;
}

export interface MemberSummary {
  id: string;
  name: string;
  level: string;
  is_me: boolean;
  played_30d: number;
}

export interface MemberStats {
  played_total: number;
  played_30d: number;
  singoli: number;
  doppi: number;
  proposed_total: number;
}

export interface MemberDetail {
  id: string;
  name: string;
  email: string;
  phone: string;
  level: string;
  member_since: string | null;
  is_me: boolean;
  stats: MemberStats;
  upcoming: Match[];
}

export function errorMessage(err: unknown, fallback = "Si è verificato un errore"): string {
  if (err instanceof ApiError) {
    const body = err.body as { detail?: unknown } | null;
    if (body && typeof body.detail === "string") return body.detail;
    if (body && Array.isArray(body.detail)) return "Controlla i campi inseriti";
  }
  return fallback;
}
