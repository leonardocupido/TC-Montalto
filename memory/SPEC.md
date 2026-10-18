# Bacheca Partite – Tennis Club (SPEC)

Mobile-first web app (Italian UI) where club members propose tennis matches and others apply.

## Stack
FastAPI + MongoDB (backend/routers/auth.py, backend/routers/matches.py, models in backend/models/tennis.py), React/Vite frontend (pages in frontend/src/pages, types mirrored in frontend/src/lib/types.ts).

## Auth
Email + password, free registration. Session = httpOnly cookie `tc_session` (sessions collection). No admin role.

## Data model
- users {id, name, email, phone, level, password_hash}
- matches {id, owner_id, owner_name, owner_level, type singolo|doppio, date YYYY-MM-DD, time HH:MM, level (free text), notes, status aperta|confermata|annullata}
- applications {id, match_id, user_id, user_name, user_level, phone, message, status in_attesa|accettata|rifiutata}

## Rules
- Spots: singolo = 1 extra player, doppio = 3 extra players.
- Owner accepts/rejects. When accepted == spots → match "confermata", remaining pending apps auto-rejected; board shows "Confermata · posti esauriti".
- Cannot apply to own match, twice, or to non-open match (400).
- Board shows matches with date >= today (Europe/Rome), not annullata.
- Accepted applicant sees contacts (proponente + other accepted players) in "Le mie candidature".
- Owner sees pending badge (header + nav) via /api/me/summary.
- Promemoria: GET /api/me/today returns today's (Europe/Rome) non-cancelled matches where user is proponent or accepted player; Bacheca shows a yellow "Oggi si gioca!" banner with time, type, status and confirmed players.

## Endpoints (/api)
auth/register, auth/login, auth/logout, auth/me; GET/POST /matches; DELETE /matches/{id}; POST /matches/{id}/apply; POST /applications/{id}/accept|reject; GET /me/matches, /me/applications, /me/summary.

## Seed (python seed.py, idempotent)
4 users (password tennis123): marco@club.it, matteo@club.it, giulia@club.it, lorenzo@club.it.
Matches: Marco singolo (+1d, Lorenzo pending), Matteo doppio (+2d, Marco accepted), Lorenzo singolo (+3d, confermata with Giulia), Giulia doppio (+4d, no apps).
