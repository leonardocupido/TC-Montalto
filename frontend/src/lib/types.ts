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
}

export function errorMessage(err: unknown, fallback = "Si è verificato un errore"): string {
  if (err instanceof ApiError) {
    const body = err.body as { detail?: unknown } | null;
    if (body && typeof body.detail === "string") return body.detail;
    if (body && Array.isArray(body.detail)) return "Controlla i campi inseriti";
  }
  return fallback;
}
