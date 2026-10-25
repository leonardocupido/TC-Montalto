SET local check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.apply_to_match (
  p_match_id uuid,
  p_phone    text,
  p_message  text DEFAULT ''::text
)
  RETURNS public.applications
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_user_id uuid := auth.uid();
  v_match public.matches;
  v_spots_total integer;
  v_accepted_count integer;
  v_application public.applications;
begin
  if v_user_id is null then
    raise exception 'Utente non autenticato';
  end if;

  if char_length(trim(coalesce(p_phone, ''))) < 3 then
    raise exception 'Inserisci un numero di telefono valido';
  end if;

  if char_length(trim(coalesce(p_phone, ''))) > 30 then
    raise exception 'Il numero di telefono è troppo lungo';
  end if;

  if char_length(trim(coalesce(p_message, ''))) > 300 then
    raise exception 'Il messaggio è troppo lungo';
  end if;

  select *
  into v_match
  from public.matches
  where id = p_match_id
  for update;

  if not found then
    raise exception 'Partita non trovata';
  end if;

  if v_match.owner_id = v_user_id then
    raise exception 'Non puoi candidarti alla tua partita';
  end if;

  if v_match.status <> 'aperta' then
    raise exception 'Non ci sono più posti disponibili';
  end if;

  if v_match.date < (now() at time zone 'Europe/Rome')::date then
    raise exception 'La partita è già trascorsa';
  end if;

  if exists (
    select 1
    from public.applications
    where match_id = p_match_id
      and user_id = v_user_id
  ) then
    raise exception 'Ti sei già candidato a questa partita';
  end if;

  v_spots_total :=
    case
      when v_match.type = 'singolo' then 1
      else 3
    end;

  select count(*)::integer
  into v_accepted_count
  from public.applications
  where match_id = p_match_id
    and status = 'accettata';

  if v_accepted_count >= v_spots_total then
    raise exception 'Non ci sono più posti disponibili';
  end if;

  insert into public.applications (
    match_id,
    user_id,
    phone,
    message,
    status,
    applicant_seen,
    cancel_seen
  )
  values (
    p_match_id,
    v_user_id,
    trim(p_phone),
    trim(coalesce(p_message, '')),
    'in_attesa',
    true,
    true
  )
  returning *
  into v_application;

  return v_application;
end;
$function$;

CREATE OR REPLACE FUNCTION public.cancel_owned_match (
  p_match_id uuid
)
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_user_id uuid := auth.uid();
  v_match public.matches;
begin
  if v_user_id is null then
    raise exception 'Utente non autenticato';
  end if;

  select *
  into v_match
  from public.matches
  where id = p_match_id
  for update;

  if not found then
    raise exception 'Partita non trovata';
  end if;

  if v_match.owner_id <> v_user_id then
    raise exception 'Solo il proponente può annullare la partita';
  end if;

  if v_match.status = 'annullata' then
    return true;
  end if;

  update public.matches
  set
    status = 'annullata',
    updated_at = now()
  where id = p_match_id;

  update public.applications
  set
    status = 'rifiutata',
    updated_at = now()
  where match_id = p_match_id
    and status = 'in_attesa';

  update public.applications
  set
    cancel_seen = false,
    applicant_seen = true,
    updated_at = now()
  where match_id = p_match_id
    and status = 'accettata';

  return true;
end;
$function$;

CREATE OR REPLACE FUNCTION public.create_challenge (
  p_challenged_id uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_user_id uuid := auth.uid();
  v_challenge public.challenges;
begin
  if v_user_id is null then
    raise exception 'Utente non autenticato';
  end if;

  if p_challenged_id = v_user_id then
    raise exception 'Non puoi sfidare te stesso';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = p_challenged_id
  ) then
    raise exception 'Socio non trovato';
  end if;

  if exists (
    select 1
    from public.challenges
    where challenger_id = v_user_id
      and challenged_id = p_challenged_id
      and status in ('in_attesa', 'accettata')
  ) then
    raise exception 'Hai già una sfida aperta con questo socio';
  end if;

  insert into public.challenges (
    challenger_id,
    challenged_id,
    status,
    seen_by_challenged,
    result_seen
  )
  values (
    v_user_id,
    p_challenged_id,
    'in_attesa',
    false,
    true
  )
  returning *
  into v_challenge;

  return jsonb_build_object(
    'id', v_challenge.id,
    'challenger_id', v_challenge.challenger_id,

    'challenger_name', (
      select name
      from public.profiles
      where id = v_challenge.challenger_id
    ),

    'challenger_level', (
      select level
      from public.profiles
      where id = v_challenge.challenger_id
    ),

    'challenged_id', v_challenge.challenged_id,

    'challenged_name', (
      select name
      from public.profiles
      where id = v_challenge.challenged_id
    ),

    'date',
      case
        when v_challenge.date is null then null
        else to_char(v_challenge.date, 'YYYY-MM-DD')
      end,

    'time',
      case
        when v_challenge.time is null then null
        else to_char(v_challenge.time, 'HH24:MI')
      end,

    'status', v_challenge.status,
    'scheduled_by', v_challenge.scheduled_by,
    'match_id', v_challenge.match_id,

    'unseen',
      case
        when v_challenge.challenged_id = v_user_id
          then not v_challenge.seen_by_challenged
        else not v_challenge.result_seen
      end,

    'created_at', v_challenge.created_at
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.decide_application (
  p_application_id uuid,
  p_action         text
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_user_id uuid := auth.uid();
  v_application public.applications;
  v_match public.matches;
  v_new_status public.application_status;
  v_spots_total integer;
  v_accepted_count integer;
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'Utente non autenticato';
  end if;

  if p_action not in ('accept', 'reject') then
    raise exception 'Azione non valida';
  end if;

  select *
  into v_application
  from public.applications
  where id = p_application_id
  for update;

  if not found then
    raise exception 'Candidatura non trovata';
  end if;

  select *
  into v_match
  from public.matches
  where id = v_application.match_id
  for update;

  if not found then
    raise exception 'Partita non trovata';
  end if;

  if v_match.owner_id <> v_user_id then
    raise exception 'Solo il proponente può decidere';
  end if;

  if v_application.status <> 'in_attesa' then
    raise exception 'Candidatura già gestita';
  end if;

  if v_match.status <> 'aperta' then
    raise exception 'La partita non è più aperta';
  end if;

  if p_action = 'accept' then
    v_spots_total :=
      case
        when v_match.type = 'singolo' then 1
        else 3
      end;

    select count(*)::integer
    into v_accepted_count
    from public.applications
    where match_id = v_match.id
      and status = 'accettata';

    if v_accepted_count >= v_spots_total then
      raise exception 'Non ci sono più posti disponibili';
    end if;

    v_new_status := 'accettata';

    update public.applications
    set
      status = v_new_status,
      applicant_seen = false,
      updated_at = now()
    where id = v_application.id;

    v_accepted_count := v_accepted_count + 1;

    if v_accepted_count >= v_spots_total then
      update public.matches
      set
        status = 'confermata',
        updated_at = now()
      where id = v_match.id;

      update public.applications
      set
        status = 'rifiutata',
        updated_at = now()
      where match_id = v_match.id
        and status = 'in_attesa';
    end if;
  else
    v_new_status := 'rifiutata';

    update public.applications
    set
      status = v_new_status,
      updated_at = now()
    where id = v_application.id;
  end if;

  select jsonb_build_object(
    'id', app.id,
    'match_id', app.match_id,
    'user_id', app.user_id,
    'user_name', profile.name,
    'user_level', profile.level,
    'phone', app.phone,
    'message', app.message,
    'status', app.status,
    'applicant_seen', app.applicant_seen,
    'cancel_seen', app.cancel_seen,
    'created_at', app.created_at
  )
  into v_result
  from public.applications app
  join public.profiles profile
    on profile.id = app.user_id
  where app.id = p_application_id;

  return v_result;
end;
$function$;

CREATE OR REPLACE FUNCTION public.decide_challenge (
  p_challenge_id uuid,
  p_action       text
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_user_id uuid := auth.uid();
  v_challenge public.challenges;
  v_new_status public.challenge_status;
begin
  if v_user_id is null then
    raise exception 'Utente non autenticato';
  end if;

  if p_action not in ('accept', 'reject') then
    raise exception 'Azione non valida';
  end if;

  select *
  into v_challenge
  from public.challenges
  where id = p_challenge_id
  for update;

  if not found then
    raise exception 'Sfida non trovata';
  end if;

  if v_challenge.challenged_id <> v_user_id then
    raise exception 'Solo lo sfidato può rispondere';
  end if;

  if v_challenge.status <> 'in_attesa' then
    raise exception 'Sfida già gestita';
  end if;

  if p_action = 'accept' then
    v_new_status := 'accettata';
  else
    v_new_status := 'rifiutata';
  end if;

  update public.challenges
  set
    status = v_new_status,
    seen_by_challenged = true,
    result_seen = false,
    updated_at = now()
  where id = p_challenge_id
  returning *
  into v_challenge;

  return jsonb_build_object(
    'id', v_challenge.id,

    'challenger_id',
    v_challenge.challenger_id,

    'challenger_name',
    (
      select name
      from public.profiles
      where id = v_challenge.challenger_id
    ),

    'challenger_level',
    (
      select level
      from public.profiles
      where id = v_challenge.challenger_id
    ),

    'challenged_id',
    v_challenge.challenged_id,

    'challenged_name',
    (
      select name
      from public.profiles
      where id = v_challenge.challenged_id
    ),

    'date',
    case
      when v_challenge.date is null then null
      else to_char(v_challenge.date, 'YYYY-MM-DD')
    end,

    'time',
    case
      when v_challenge.time is null then null
      else to_char(v_challenge.time, 'HH24:MI')
    end,

    'status',
    v_challenge.status,

    'scheduled_by',
    v_challenge.scheduled_by,

    'match_id',
    v_challenge.match_id,

    'unseen',
    false,

    'created_at',
    v_challenge.created_at
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.delete_rejected_challenge (
  p_challenge_id uuid
)
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_user_id uuid := auth.uid();
  v_challenge public.challenges;
begin
  if v_user_id is null then
    raise exception 'Utente non autenticato';
  end if;

  select *
  into v_challenge
  from public.challenges
  where id = p_challenge_id
  for update;

  if not found then
    raise exception 'Sfida non trovata';
  end if;

  if v_user_id <> v_challenge.challenger_id
     and v_user_id <> v_challenge.challenged_id then
    raise exception 'Non puoi eliminare questa sfida';
  end if;

  if v_challenge.status <> 'rifiutata' then
    raise exception 'Puoi eliminare solo le sfide rifiutate';
  end if;

  delete from public.challenges
  where id = p_challenge_id;

  return true;
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_board_matches()
  RETURNS jsonb
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', m.id,
        'owner_id', m.owner_id,
        'owner_name', owner_profile.name,
        'owner_level', owner_profile.level,
        'type', m.type,
        'date', to_char(m.date, 'YYYY-MM-DD'),
        'time', to_char(m.time, 'HH24:MI'),
        'level', m.level,
        'notes', m.notes,
        'status', m.status,

        'spots_total',
          case
            when m.type = 'singolo' then 1
            else 3
          end,

        'spots_left',
          greatest(
            0,
            case
              when m.type = 'singolo' then 1
              else 3
            end - (
              select count(*)::integer
              from public.applications accepted_app
              where accepted_app.match_id = m.id
                and accepted_app.status = 'accettata'
            )
          ),

        'players',
          (
            select coalesce(
              jsonb_agg(
                jsonb_build_object(
                  'user_id', players_data.user_id,
                  'name', players_data.name,
                  'level', players_data.level
                )
                order by players_data.player_order
              ),
              '[]'::jsonb
            )
            from (
              select
                m.owner_id as user_id,
                owner_profile.name,
                owner_profile.level,
                0 as player_order

              union all

              select
                accepted_app.user_id,
                accepted_profile.name,
                accepted_profile.level,
                1 as player_order
              from public.applications accepted_app
              join public.profiles accepted_profile
                on accepted_profile.id = accepted_app.user_id
              where accepted_app.match_id = m.id
                and accepted_app.status = 'accettata'
            ) as players_data
          ),

        'is_owner',
          m.owner_id = auth.uid(),

        'my_application_status',
          (
            select my_app.status
            from public.applications my_app
            where my_app.match_id = m.id
              and my_app.user_id = auth.uid()
            limit 1
          ),

        'pending_count',
          case
            when m.owner_id = auth.uid() then (
              select count(*)::integer
              from public.applications pending_app
              where pending_app.match_id = m.id
                and pending_app.status = 'in_attesa'
            )
            else 0
          end,

        'created_at', m.created_at
      )
      order by m.date, m.time
    ),
    '[]'::jsonb
  )
  from public.matches m
  join public.profiles owner_profile
    on owner_profile.id = m.owner_id
  where m.date >= (now() at time zone 'Europe/Rome')::date
    and m.status <> 'annullata'
    and auth.uid() is not null;
$function$;

CREATE OR REPLACE FUNCTION public.get_challenges()
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_user_id uuid := auth.uid();
  v_received jsonb;
  v_sent jsonb;
begin
  if v_user_id is null then
    raise exception 'Utente non autenticato';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', c.id,
        'challenger_id', c.challenger_id,
        'challenger_name', challenger.name,
        'challenger_level', challenger.level,
        'challenged_id', c.challenged_id,
        'challenged_name', challenged.name,

        'date',
        case
          when c.date is null then null
          else to_char(c.date, 'YYYY-MM-DD')
        end,

        'time',
        case
          when c.time is null then null
          else to_char(c.time, 'HH24:MI')
        end,

        'status', c.status,
        'scheduled_by', c.scheduled_by,
        'match_id', c.match_id,
        'unseen', not c.seen_by_challenged,
        'created_at', c.created_at
      )
      order by c.created_at desc
    ),
    '[]'::jsonb
  )
  into v_received
  from public.challenges c
  join public.profiles challenger
    on challenger.id = c.challenger_id
  join public.profiles challenged
    on challenged.id = c.challenged_id
  where c.challenged_id = v_user_id;


  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', c.id,
        'challenger_id', c.challenger_id,
        'challenger_name', challenger.name,
        'challenger_level', challenger.level,
        'challenged_id', c.challenged_id,
        'challenged_name', challenged.name,

        'date',
        case
          when c.date is null then null
          else to_char(c.date, 'YYYY-MM-DD')
        end,

        'time',
        case
          when c.time is null then null
          else to_char(c.time, 'HH24:MI')
        end,

        'status', c.status,
        'scheduled_by', c.scheduled_by,
        'match_id', c.match_id,
        'unseen', not c.result_seen,
        'created_at', c.created_at
      )
      order by c.created_at desc
    ),
    '[]'::jsonb
  )
  into v_sent
  from public.challenges c
  join public.profiles challenger
    on challenger.id = c.challenger_id
  join public.profiles challenged
    on challenged.id = c.challenged_id
  where c.challenger_id = v_user_id;


  return jsonb_build_object(
    'received', v_received,
    'sent', v_sent
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_member_detail (
  p_member_id uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_member public.profiles;
  v_today date := (now() at time zone 'Europe/Rome')::date;
  v_cutoff date := (now() at time zone 'Europe/Rome')::date - 30;

  v_played_total integer;
  v_played_30d integer;
  v_singoli integer;
  v_doppi integer;
  v_proposed_total integer;

  v_upcoming jsonb;
begin
  if auth.uid() is null then
    raise exception 'Utente non autenticato';
  end if;

  select *
  into v_member
  from public.profiles
  where id = p_member_id;

  if not found then
    raise exception 'Socio non trovato';
  end if;

  -- Totale partite giocate
  with played as (
    select ph.match_id, ph.type
    from public.played_history ph
    where ph.user_id = p_member_id

    union

    select m.id, m.type
    from public.matches m
    where m.status = 'confermata'
      and m.date < v_today
      and (
        m.owner_id = p_member_id
        or exists (
          select 1
          from public.applications a
          where a.match_id = m.id
            and a.user_id = p_member_id
            and a.status = 'accettata'
        )
      )
  )
  select
    count(*)::integer,
    count(*) filter (where type = 'singolo')::integer,
    count(*) filter (where type = 'doppio')::integer
  into
    v_played_total,
    v_singoli,
    v_doppi
  from played;

  -- Ultimi 30 giorni
  with recent_played as (
    select ph.match_id
    from public.played_history ph
    where ph.user_id = p_member_id
      and ph.date >= v_cutoff
      and ph.date < v_today

    union

    select m.id
    from public.matches m
    where m.status = 'confermata'
      and m.date >= v_cutoff
      and m.date < v_today
      and (
        m.owner_id = p_member_id
        or exists (
          select 1
          from public.applications a
          where a.match_id = m.id
            and a.user_id = p_member_id
            and a.status = 'accettata'
        )
      )
  )
  select count(*)::integer
  into v_played_30d
  from recent_played;

  -- Partite proposte ancora presenti nel database.
  select count(*)::integer
  into v_proposed_total
  from public.matches
  where owner_id = p_member_id
    and status <> 'annullata';

  -- Prossime partite del socio
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', match_data.id,
        'owner_id', match_data.owner_id,
        'owner_name', match_data.owner_name,
        'owner_level', match_data.owner_level,
        'type', match_data.type,
        'date', to_char(match_data.date, 'YYYY-MM-DD'),
        'time', to_char(match_data.time, 'HH24:MI'),
        'level', match_data.level,
        'notes', match_data.notes,
        'status', match_data.status,
        'spots_total', match_data.spots_total,
        'spots_left', match_data.spots_left,
        'players', match_data.players,
        'is_owner', match_data.owner_id = auth.uid(),
        'my_application_status', match_data.my_application_status,
        'pending_count', match_data.pending_count,
        'created_at', match_data.created_at
      )
      order by match_data.date, match_data.time
    ),
    '[]'::jsonb
  )
  into v_upcoming
  from (
    select
      m.id,
      m.owner_id,
      owner_profile.name as owner_name,
      owner_profile.level as owner_level,
      m.type,
      m.date,
      m.time,
      m.level,
      m.notes,
      m.status,
      m.created_at,

      case
        when m.type = 'singolo' then 1
        else 3
      end as spots_total,

      greatest(
        0,
        case
          when m.type = 'singolo' then 1
          else 3
        end - (
          select count(*)::integer
          from public.applications accepted_app
          where accepted_app.match_id = m.id
            and accepted_app.status = 'accettata'
        )
      ) as spots_left,

      (
        select coalesce(
          jsonb_agg(
            jsonb_build_object(
              'user_id', player_data.user_id,
              'name', player_data.name,
              'level', player_data.level
            )
            order by player_data.player_order
          ),
          '[]'::jsonb
        )
        from (
          select
            m.owner_id as user_id,
            owner_profile.name,
            owner_profile.level,
            0 as player_order

          union all

          select
            accepted_app.user_id,
            accepted_profile.name,
            accepted_profile.level,
            1 as player_order
          from public.applications accepted_app
          join public.profiles accepted_profile
            on accepted_profile.id = accepted_app.user_id
          where accepted_app.match_id = m.id
            and accepted_app.status = 'accettata'
        ) player_data
      ) as players,

      (
        select my_app.status
        from public.applications my_app
        where my_app.match_id = m.id
          and my_app.user_id = auth.uid()
        limit 1
      ) as my_application_status,

      case
        when m.owner_id = auth.uid() then (
          select count(*)::integer
          from public.applications pending_app
          where pending_app.match_id = m.id
            and pending_app.status = 'in_attesa'
        )
        else 0
      end as pending_count

    from public.matches m

    join public.profiles owner_profile
      on owner_profile.id = m.owner_id

    where m.date >= v_today
      and m.status <> 'annullata'
      and (
        m.owner_id = p_member_id

        or exists (
          select 1
          from public.applications accepted_app
          where accepted_app.match_id = m.id
            and accepted_app.user_id = p_member_id
            and accepted_app.status = 'accettata'
        )
      )
  ) match_data;

  return jsonb_build_object(
    'id', v_member.id,
    'name', v_member.name,
    'email', v_member.email,
    'phone', v_member.phone,
    'level', v_member.level,
    'member_since', v_member.created_at,
    'is_me', v_member.id = auth.uid(),

    'stats', jsonb_build_object(
      'played_total', coalesce(v_played_total, 0),
      'played_30d', coalesce(v_played_30d, 0),
      'singoli', coalesce(v_singoli, 0),
      'doppi', coalesce(v_doppi, 0),
      'proposed_total', coalesce(v_proposed_total, 0)
    ),

    'upcoming', coalesce(v_upcoming, '[]'::jsonb)
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_members()
  RETURNS jsonb
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', member_data.id,
        'name', member_data.name,
        'level', member_data.level,
        'is_me', member_data.is_me,
        'played_30d', member_data.played_30d
      )
      order by
        member_data.is_me desc,
        lower(member_data.name)
    ),
    '[]'::jsonb
  )
  from (
    select
      p.id,
      p.name,
      p.level,
      p.id = auth.uid() as is_me,

      (
        select count(distinct played.match_id)::integer
        from (
          select ph.match_id
          from public.played_history ph
          where ph.user_id = p.id
            and ph.date >=
              ((now() at time zone 'Europe/Rome')::date - 30)
            and ph.date <
              (now() at time zone 'Europe/Rome')::date

          union

          select m.id
          from public.matches m
          where m.status = 'confermata'
            and m.date >=
              ((now() at time zone 'Europe/Rome')::date - 30)
            and m.date <
              (now() at time zone 'Europe/Rome')::date
            and (
              m.owner_id = p.id
              or exists (
                select 1
                from public.applications a
                where a.match_id = m.id
                  and a.user_id = p.id
                  and a.status = 'accettata'
              )
            )
        ) as played
      ) as played_30d

    from public.profiles p
    where auth.uid() is not null
  ) as member_data;
$function$;

CREATE OR REPLACE FUNCTION public.get_my_applications()
  RETURNS jsonb
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'application',
        jsonb_build_object(
          'id', app.id,
          'match_id', app.match_id,
          'user_id', app.user_id,
          'user_name', applicant.name,
          'user_level', applicant.level,
          'phone', app.phone,
          'message', app.message,
          'status', app.status,
          'applicant_seen', app.applicant_seen,
          'cancel_seen', app.cancel_seen,
          'created_at', app.created_at
        ),

        'match',
        jsonb_build_object(
          'id', m.id,
          'owner_id', m.owner_id,
          'owner_name', owner_profile.name,
          'owner_level', owner_profile.level,
          'type', m.type,
          'date', to_char(m.date, 'YYYY-MM-DD'),
          'time', to_char(m.time, 'HH24:MI'),
          'level', m.level,
          'notes', m.notes,
          'status', m.status,

          'spots_total',
          case
            when m.type = 'singolo' then 1
            else 3
          end,

          'spots_left',
          greatest(
            0,
            case
              when m.type = 'singolo' then 1
              else 3
            end - (
              select count(*)::integer
              from public.applications accepted_app
              where accepted_app.match_id = m.id
                and accepted_app.status = 'accettata'
            )
          ),

          'players',
          (
            select coalesce(
              jsonb_agg(
                jsonb_build_object(
                  'user_id', player_data.user_id,
                  'name', player_data.name,
                  'level', player_data.level
                )
                order by player_data.player_order
              ),
              '[]'::jsonb
            )
            from (
              select
                m.owner_id as user_id,
                owner_profile.name,
                owner_profile.level,
                0 as player_order

              union all

              select
                accepted_app.user_id,
                accepted_profile.name,
                accepted_profile.level,
                1 as player_order
              from public.applications accepted_app
              join public.profiles accepted_profile
                on accepted_profile.id = accepted_app.user_id
              where accepted_app.match_id = m.id
                and accepted_app.status = 'accettata'
            ) as player_data
          ),

          'is_owner', false,
          'my_application_status', app.status,
          'pending_count', 0,
          'created_at', m.created_at
        ),

        'contacts',
        case
          when app.status = 'accettata'
               and m.status <> 'annullata'
          then (
            select coalesce(
              jsonb_agg(
                jsonb_build_object(
                  'name', contact_data.name,
                  'phone', contact_data.phone,
                  'role', contact_data.role
                )
                order by contact_data.contact_order
              ),
              '[]'::jsonb
            )
            from (
              select
                owner_profile.name,
                owner_profile.phone,
                'proponente'::text as role,
                0 as contact_order

              union all

              select
                other_profile.name,
                other_app.phone,
                'giocatore'::text as role,
                1 as contact_order
              from public.applications other_app
              join public.profiles other_profile
                on other_profile.id = other_app.user_id
              where other_app.match_id = m.id
                and other_app.status = 'accettata'
                and other_app.user_id <> auth.uid()
            ) as contact_data
          )
          else '[]'::jsonb
        end
      )
      order by app.created_at desc
    ),
    '[]'::jsonb
  )
  from public.applications app
  join public.matches m
    on m.id = app.match_id
  join public.profiles applicant
    on applicant.id = app.user_id
  join public.profiles owner_profile
    on owner_profile.id = m.owner_id
  where app.user_id = auth.uid()
    and auth.uid() is not null;
$function$;

CREATE OR REPLACE FUNCTION public.get_my_history()
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_user_id uuid := auth.uid();
  v_today date := (now() at time zone 'Europe/Rome')::date;
  v_cutoff date := (now() at time zone 'Europe/Rome')::date - 30;

  v_total integer;
  v_singoli integer;
  v_doppi integer;
begin
  if v_user_id is null then
    raise exception 'Utente non autenticato';
  end if;

  with played as (

    select
      ph.match_id,
      ph.type
    from public.played_history ph
    where ph.user_id = v_user_id
      and ph.date >= v_cutoff
      and ph.date < v_today

    union

    select
      m.id,
      m.type
    from public.matches m
    where m.status = 'confermata'
      and m.date >= v_cutoff
      and m.date < v_today
      and (
        m.owner_id = v_user_id

        or exists (
          select 1
          from public.applications a
          where a.match_id = m.id
            and a.user_id = v_user_id
            and a.status = 'accettata'
        )
      )
  )

  select
    count(*)::integer,
    count(*) filter (
      where type = 'singolo'
    )::integer,
    count(*) filter (
      where type = 'doppio'
    )::integer

  into
    v_total,
    v_singoli,
    v_doppi

  from played;

  return jsonb_build_object(
    'last_30_days', coalesce(v_total, 0),
    'singoli', coalesce(v_singoli, 0),
    'doppi', coalesce(v_doppi, 0)
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_my_owned_matches()
  RETURNS jsonb
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'match',
        jsonb_build_object(
          'id', m.id,
          'owner_id', m.owner_id,
          'owner_name', owner_profile.name,
          'owner_level', owner_profile.level,
          'type', m.type,
          'date', to_char(m.date, 'YYYY-MM-DD'),
          'time', to_char(m.time, 'HH24:MI'),
          'level', m.level,
          'notes', m.notes,
          'status', m.status,

          'spots_total',
          case
            when m.type = 'singolo' then 1
            else 3
          end,

          'spots_left',
          greatest(
            0,
            case
              when m.type = 'singolo' then 1
              else 3
            end - (
              select count(*)::integer
              from public.applications accepted_app
              where accepted_app.match_id = m.id
                and accepted_app.status = 'accettata'
            )
          ),

          'players',
          (
            select coalesce(
              jsonb_agg(
                jsonb_build_object(
                  'user_id', player_data.user_id,
                  'name', player_data.name,
                  'level', player_data.level
                )
                order by player_data.player_order
              ),
              '[]'::jsonb
            )
            from (
              select
                m.owner_id as user_id,
                owner_profile.name,
                owner_profile.level,
                0 as player_order

              union all

              select
                accepted_app.user_id,
                accepted_profile.name,
                accepted_profile.level,
                1 as player_order
              from public.applications accepted_app
              join public.profiles accepted_profile
                on accepted_profile.id = accepted_app.user_id
              where accepted_app.match_id = m.id
                and accepted_app.status = 'accettata'
            ) as player_data
          ),

          'is_owner', true,
          'my_application_status', null,

          'pending_count',
          (
            select count(*)::integer
            from public.applications pending_app
            where pending_app.match_id = m.id
              and pending_app.status = 'in_attesa'
          ),

          'created_at', m.created_at
        ),

        'applications',
        (
          select coalesce(
            jsonb_agg(
              jsonb_build_object(
                'id', app.id,
                'match_id', app.match_id,
                'user_id', app.user_id,
                'user_name', applicant.name,
                'user_level', applicant.level,
                'phone', app.phone,
                'message', app.message,
                'status', app.status,
                'applicant_seen', app.applicant_seen,
                'cancel_seen', app.cancel_seen,
                'created_at', app.created_at
              )
              order by app.created_at
            ),
            '[]'::jsonb
          )
          from public.applications app
          join public.profiles applicant
            on applicant.id = app.user_id
          where app.match_id = m.id
        )
      )
      order by m.date, m.time
    ),
    '[]'::jsonb
  )
  from public.matches m
  join public.profiles owner_profile
    on owner_profile.id = m.owner_id
  where m.owner_id = auth.uid()
    and m.status <> 'annullata'
    and auth.uid() is not null;
$function$;

CREATE OR REPLACE FUNCTION public.get_my_today_matches()
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_user_id uuid := auth.uid();
  v_today date := (now() at time zone 'Europe/Rome')::date;
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'Utente non autenticato';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', m.id,
        'owner_id', m.owner_id,
        'owner_name', owner_profile.name,
        'owner_level', owner_profile.level,
        'type', m.type,
        'date', to_char(m.date, 'YYYY-MM-DD'),
        'time', to_char(m.time, 'HH24:MI'),
        'level', m.level,
        'notes', m.notes,
        'status', m.status,

        'spots_total',
        case
          when m.type = 'singolo' then 1
          else 3
        end,

        'spots_left',
        greatest(
          0,
          case
            when m.type = 'singolo' then 1
            else 3
          end - (
            select count(*)::integer
            from public.applications accepted_app
            where accepted_app.match_id = m.id
              and accepted_app.status = 'accettata'
          )
        ),

        'players',
        (
          select coalesce(
            jsonb_agg(
              jsonb_build_object(
                'user_id', player_data.user_id,
                'name', player_data.name,
                'level', player_data.level
              )
              order by player_data.player_order
            ),
            '[]'::jsonb
          )
          from (
            select
              m.owner_id as user_id,
              owner_profile.name,
              owner_profile.level,
              0 as player_order

            union all

            select
              accepted_app.user_id,
              accepted_profile.name,
              accepted_profile.level,
              1 as player_order
            from public.applications accepted_app
            join public.profiles accepted_profile
              on accepted_profile.id = accepted_app.user_id
            where accepted_app.match_id = m.id
              and accepted_app.status = 'accettata'
          ) as player_data
        ),

        'is_owner',
        m.owner_id = v_user_id,

        'my_application_status',
        (
          select my_app.status
          from public.applications my_app
          where my_app.match_id = m.id
            and my_app.user_id = v_user_id
          limit 1
        ),

        'pending_count',
        case
          when m.owner_id = v_user_id then (
            select count(*)::integer
            from public.applications pending_app
            where pending_app.match_id = m.id
              and pending_app.status = 'in_attesa'
          )
          else 0
        end,

        'created_at',
        m.created_at
      )
      order by m.time
    ),
    '[]'::jsonb
  )
  into v_result
  from public.matches m

  join public.profiles owner_profile
    on owner_profile.id = m.owner_id

  where m.date = v_today

    and m.status <> 'annullata'

    and (
      m.owner_id = v_user_id

      or exists (
        select 1
        from public.applications participant_app
        where participant_app.match_id = m.id
          and participant_app.user_id = v_user_id
          and participant_app.status = 'accettata'
      )
    );

  return v_result;
end;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  insert into public.profiles (
    id,
    name,
    email,
    phone,
    level
  )
  values (
    new.id,
    trim(coalesce(new.raw_user_meta_data ->> 'name', 'Nuovo socio')),
    lower(coalesce(new.email, '')),
    trim(coalesce(new.raw_user_meta_data ->> 'phone', '')),
    trim(coalesce(new.raw_user_meta_data ->> 'level', ''))
  );

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.mark_challenges_seen()
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Utente non autenticato';
  end if;

  update public.challenges
  set
    seen_by_challenged = true,
    updated_at = now()
  where challenged_id = v_user_id
    and seen_by_challenged = false;

  update public.challenges
  set
    result_seen = true,
    updated_at = now()
  where challenger_id = v_user_id
    and result_seen = false;

  return true;
end;
$function$;

CREATE OR REPLACE FUNCTION public.mark_my_applications_seen()
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Utente non autenticato';
  end if;

  update public.applications
  set
    applicant_seen = true,
    cancel_seen = true,
    updated_at = now()
  where user_id = v_user_id
    and (
      applicant_seen = false
      or cancel_seen = false
    );

  return true;
end;
$function$;

CREATE OR REPLACE FUNCTION public.schedule_challenge (
  p_challenge_id uuid,
  p_date         date,
  p_time         time without time zone
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_user_id uuid := auth.uid();
  v_challenge public.challenges;
  v_match_id uuid;
  v_challenged_phone text;
begin
  if v_user_id is null then
    raise exception 'Utente non autenticato';
  end if;

  select *
  into v_challenge
  from public.challenges
  where id = p_challenge_id
  for update;

  if not found then
    raise exception 'Sfida non trovata';
  end if;

  if v_user_id <> v_challenge.challenger_id
     and v_user_id <> v_challenge.challenged_id then
    raise exception 'Solo i due sfidanti possono programmare la partita';
  end if;

  if v_challenge.status <> 'accettata' then
    raise exception 'La sfida non è da programmare';
  end if;

  if p_date < (now() at time zone 'Europe/Rome')::date then
    raise exception 'La data non può essere nel passato';
  end if;

  select phone
  into v_challenged_phone
  from public.profiles
  where id = v_challenge.challenged_id;

  insert into public.matches (
    owner_id,
    type,
    date,
    time,
    level,
    notes,
    status,
    challenge_id
  )
  values (
    v_challenge.challenger_id,
    'singolo',
    p_date,
    p_time,
    'Sfida',
    'Sfida programmata',
    'confermata',
    v_challenge.id
  )
  returning id
  into v_match_id;

  insert into public.applications (
    match_id,
    user_id,
    phone,
    message,
    status,
    applicant_seen,
    cancel_seen
  )
  values (
    v_match_id,
    v_challenge.challenged_id,
    coalesce(v_challenged_phone, ''),
    'Sfida accettata',
    'accettata',
    true,
    true
  );

  update public.challenges
  set
    status = 'programmata',
    date = p_date,
    time = p_time,
    match_id = v_match_id,
    scheduled_by = v_user_id,

    seen_by_challenged =
      case
        when v_user_id = challenger_id then false
        else true
      end,

    result_seen =
      case
        when v_user_id = challenged_id then false
        else true
      end,

    updated_at = now()
  where id = p_challenge_id
  returning *
  into v_challenge;

  return jsonb_build_object(
    'id', v_challenge.id,

    'challenger_id',
    v_challenge.challenger_id,

    'challenger_name',
    (
      select name
      from public.profiles
      where id = v_challenge.challenger_id
    ),

    'challenger_level',
    (
      select level
      from public.profiles
      where id = v_challenge.challenger_id
    ),

    'challenged_id',
    v_challenge.challenged_id,

    'challenged_name',
    (
      select name
      from public.profiles
      where id = v_challenge.challenged_id
    ),

    'date',
    to_char(v_challenge.date, 'YYYY-MM-DD'),

    'time',
    to_char(v_challenge.time, 'HH24:MI'),

    'status',
    v_challenge.status,

    'scheduled_by',
    v_challenge.scheduled_by,

    'match_id',
    v_challenge.match_id,

    'unseen',
    false,

    'created_at',
    v_challenge.created_at
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.update_my_profile (
  p_name  text,
  p_phone text,
  p_level text
)
  RETURNS public.profiles
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_user_id uuid := auth.uid();
  v_profile public.profiles;
begin
  if v_user_id is null then
    raise exception 'Utente non autenticato';
  end if;

  if char_length(trim(coalesce(p_name, ''))) < 2 then
    raise exception 'Inserisci nome e cognome';
  end if;

  if char_length(trim(p_name)) > 60 then
    raise exception 'Nome troppo lungo';
  end if;

  if char_length(trim(coalesce(p_phone, ''))) > 30 then
    raise exception 'Numero di telefono troppo lungo';
  end if;

  if char_length(trim(coalesce(p_level, ''))) > 60 then
    raise exception 'Livello troppo lungo';
  end if;

  update public.profiles
  set
    name = trim(p_name),
    phone = trim(coalesce(p_phone, '')),
    level = trim(coalesce(p_level, '')),
    updated_at = now()
  where id = v_user_id
  returning *
  into v_profile;

  if not found then
    raise exception 'Profilo non trovato';
  end if;

  return v_profile;
end;
$function$;

REVOKE ALL ON FUNCTION "public"."delete_rejected_challenge"(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."delete_rejected_challenge"(uuid) TO "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."delete_rejected_challenge"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."delete_rejected_challenge"(uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."delete_rejected_challenge"(uuid) TO "service_role";

