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

## Soci (members)
Bottom nav 4th tab is now "Soci" (/soci) — replaced the "Proponi" tab (proposing stays reachable via the orange + FAB on Bacheca and empty-state links; /proponi route unchanged).
- GET /api/members → [{id, name, level, is_me, played_30d}] me first then alphabetical. Page /soci with search (members-search-input), items member-item.
- GET /api/members/{id} → {id, name, email, phone, level, member_since, is_me, stats{played_total, played_30d, singoli, doppi, proposed_total}, upcoming: Match[]}; 404 if unknown. Page /soci/:id. Visible to every logged-in member (club-internal directory).
- played counts = confirmed matches before today (played_history archive + not-yet-cleaned confirmed matches); proposed_total = live non-cancelled proposals + archived owner entries (played_history.owner).

## Sfide (challenges)
- Member detail (/soci/:id, not self) has "Sfida <nome>" button (challenge-member-button) → dialog (date, time, message) → POST /api/members/{id}/challenge. 400: self, past date, already a pending challenge to same member; 404 unknown member.
- Collection challenges {id, challenger_*, challenged_*, date, time, message, status in_attesa|accettata|rifiutata, match_id, seen_by_challenged, result_seen}.
- Challenged gets notice: /api/me/summary.pending_challenges (pending, date>=today) → orange header badge "Sfidato!" (header-challenge-badge, highest priority), orange count on Soci tab (nav-soci-count), toast with "Apri" → /sfide.
- /sfide page (also linked from Soci page "Le mie sfide"): received (from whom, date/time/message, Accetta/Rifiuta) + sent with status. GET /api/challenges → {received, sent}. Visiting calls POST /api/challenges/seen.
- POST /api/challenges/{id}/accept (challenged only; 400 if handled/expired) → creates a confermata singolo match (owner=challenger, level "Sfida") + accepted application for challenged; it shows on Bacheca, today reminder, stats. POST /api/challenges/{id}/reject.
- Challenger notified of answer: summary.challenge_updates → Soci tab count + toast.
- Nightly cleanup also deletes challenges with date < today.

## Storico
GET /api/me/history → {last_30_days, singoli, doppi}: confirmed matches with date in [today-30, today) from played_history + not-yet-cleaned matches. Shown on Bacheca as history-stat card.

## Cancellation notice
Owner cancel → accepted applications get cancel_seen=false → /api/me/summary.new_cancellations → red header badge (header-cancelled-badge, takes priority over the green one), red count on Candidature tab, error toast. Cleared by POST /api/me/applications/seen (visiting Candidature).
`.emergent/crons.yml` → `cleanup-past-matches` daily 03:00 Europe/Rome → POST /api/cron/cleanup-past (Bearer WEBHOOK_CRON_SECRET from backend/.env; 401 on bad auth, 400 bad body, 202 ack; idempotent via cron_runs.run_id; deletes in background matches with date < today (Europe/Rome) and their applications).

## Seed (python seed.py, idempotent)
4 demo users only (password tennis123): marco@club.it, matteo@club.it, giulia@club.it, lorenzo@club.it.
No seeded matches: per user request all demo matches/applications were deleted; the board starts empty.
