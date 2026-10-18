# Bacheca Partite – Tennis Club (SPEC)

Mobile-first web app (Italian UI) where club members propose tennis matches and others apply.

## Stack
FastAPI + MongoDB (backend/routers/auth.py, backend/routers/matches.py, models in backend/models/tennis.py), React/Vite frontend (pages in frontend/src/pages, types mirrored in frontend/src/lib/types.ts).

## Auth
Email + password, free registration. Session = httpOnly cookie `tc_session` (sessions collection). No admin role.
Demo 1-tap login: GET /api/auth/demo-users (empty list if DEMO_LOGIN_ENABLED!=true), POST /api/auth/demo-login {email} (404 if disabled or user not demo:true).

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
- Applicant acceptance notification: accepting sets application.applicant_seen=false; /api/me/summary.new_acceptances counts them → green header badge "In campo!" (header-accepted-badge), green count on Candidature tab (nav-accepted-count), toast. Opening /le-mie-candidature calls POST /api/me/applications/seen which clears them; items show "Nuovo" badge (my-application-new-badge) for that visit.
- Promemoria: GET /api/me/today returns today's (Europe/Rome) non-cancelled matches where user is proponent or accepted player; Bacheca shows a yellow "Oggi si gioca!" banner with time, type, status and confirmed players.

## Endpoints (/api)
auth/register, auth/login, auth/logout, auth/me; GET/POST /matches; DELETE /matches/{id}; POST /matches/{id}/apply; POST /applications/{id}/accept|reject; GET /me/matches, /me/applications, /me/summary.

## Scheduled cleanup
Before deleting, confirmed past matches are archived into `played_history` {user_id, match_id, date, type} for proponent + accepted players (upsert, idempotent).

## Storico
GET /api/me/history → {last_30_days, singoli, doppi}: confirmed matches with date in [today-30, today) from played_history + not-yet-cleaned matches. Shown on Bacheca as history-stat card.

## Cancellation notice
Owner cancel → accepted applications get cancel_seen=false → /api/me/summary.new_cancellations → red header badge (header-cancelled-badge, takes priority over the green one), red count on Candidature tab, error toast. Cleared by POST /api/me/applications/seen (visiting Candidature).
`.emergent/crons.yml` → `cleanup-past-matches` daily 03:00 Europe/Rome → POST /api/cron/cleanup-past (Bearer WEBHOOK_CRON_SECRET from backend/.env; 401 on bad auth, 400 bad body, 202 ack; idempotent via cron_runs.run_id; deletes in background matches with date < today (Europe/Rome) and their applications).

## Seed (python seed.py, idempotent)
4 demo users only (password tennis123): marco@club.it, matteo@club.it, giulia@club.it, lorenzo@club.it.
No seeded matches: per user request all demo matches/applications were deleted; the board starts empty.
