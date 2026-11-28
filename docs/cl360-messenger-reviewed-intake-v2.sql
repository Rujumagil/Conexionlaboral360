-- Confirmed human-reviewed screening values; original RPC remains compatible.
create or replace function public.cl360_messenger_candidate_register_v2(
  p_conversation uuid,
  p_name text,
  p_phone text,
  p_job_slug text,
  p_zone text,
  p_experience text,
  p_consent boolean,
  p_review_confirm boolean,
  p_due_at timestamptz,
  p_assignee uuid,
  p_shift_declared text,
  p_availability text,
  p_experience_level text
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  ws constant uuid := 'c7ab2a78-08e0-4a29-8a3b-fadaf244002f';
  actor uuid := auth.uid();
  assignee uuid := coalesce(p_assignee,auth.uid());
  conversation_owner uuid;
  conversation_state text;
  existing_candidate uuid;
  normalized_phone text;
  full_name text := btrim(coalesce(p_name,''));
  zone text := btrim(coalesce(p_zone,''));
  experience text := btrim(coalesce(p_experience,''));
  job_area text;
  shift_declared text := btrim(coalesce(p_shift_declared,''));
  new_candidate uuid;
  new_followup uuid;
begin
  if actor is null or not exists (
    select 1 from public.workspace_members m join public.workspaces w on w.id=m.workspace_id
    where m.workspace_id=ws and m.user_id=actor and m.status='active' and w.status='active'
      and m.role::text in ('owner','admin','manager','sales','support')
  ) then raise exception 'access_denied' using errcode='42501'; end if;

  -- Bloquea la conversación: reintentos y llamadas simultáneas no crean dobles expedientes.
  select c.assigned_user_id,c.status::text into conversation_owner,conversation_state
  from public.conversations c
  where c.id=p_conversation and c.workspace_id=ws and c.channel='messenger'
  for update;
  if not found or conversation_owner is distinct from actor
    or conversation_state in ('closed','archived') then
    raise exception 'conversation_not_owned' using errcode='42501';
  end if;

  select l.candidate_id into existing_candidate
  from public.cl360_messenger_candidate_links l
  where l.workspace_id=ws and l.conversation_id=p_conversation;
  if existing_candidate is not null then
    return jsonb_build_object('candidate_id',existing_candidate,'already_linked',true);
  end if;

  if p_consent is distinct from true or p_review_confirm is distinct from true then
    raise exception 'explicit_consent_and_review_required' using errcode='22023';
  end if;

  normalized_phone := regexp_replace(coalesce(p_phone,''),'[^0-9]','','g');
  if length(normalized_phone)=13 and left(normalized_phone,3)='521' then
    normalized_phone := right(normalized_phone,10);
  elsif length(normalized_phone)=12 and left(normalized_phone,2)='52' then
    normalized_phone := right(normalized_phone,10);
  end if;
  if length(full_name)<3 or length(full_name)>120
    or normalized_phone !~ '^[0-9]{10}$'
    or length(zone)>120 or length(experience)>1000 or length(shift_declared)>120
    or coalesce(p_availability,'consultar') not in ('si','no','consultar')
    or coalesce(p_experience_level,'prefiero_comentarlo') not in ('si','no','prefiero_comentarlo') then
    raise exception 'invalid_candidate_fields' using errcode='22023';
  end if;

  if p_due_at is null or p_due_at <= now() + interval '1 minute'
    or p_due_at > now() + interval '30 days' then
    raise exception 'invalid_followup_time' using errcode='22023';
  end if;

  select j.area into job_area from public.cl360_jobs j
  where j.workspace_id=ws and j.slug=p_job_slug and j.status='active';
  if job_area is null then raise exception 'job_not_active' using errcode='22023'; end if;

  if not exists(
    select 1 from public.workspace_members m
    join public.profiles p on p.id=m.user_id
    where m.workspace_id=ws and m.user_id=assignee and m.status='active'
      and m.role::text in ('owner','admin','manager','sales','support')
  ) then raise exception 'assignee_not_available' using errcode='22023'; end if;

  -- Serializa altas Messenger del mismo teléfono/vacante, incluso desde chats distintos.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(ws::text || ':' || p_job_slug || ':' || normalized_phone, 0));
  -- Nunca vincular de forma silenciosa un número que ya está asociado a la misma vacante.
  if exists(
    select 1 from public.cl360_candidates c
    where c.workspace_id=ws and c.job_slug=p_job_slug
      and regexp_replace(c.phone,'[^0-9]','','g') in (normalized_phone,'52'||normalized_phone,'521'||normalized_phone)
  ) then raise exception 'candidate_already_exists_use_manual_link' using errcode='23505'; end if;

  insert into public.cl360_candidates(
    workspace_id, full_name, phone, job_slug, area, experience, source, stage,
    consent_at, assigned_user_id, next_followup_at, screening_data
  ) values(
    ws,full_name,normalized_phone,p_job_slug,job_area,experience,'facebook','new',
    now(),assignee,p_due_at,
    jsonb_strip_nulls(jsonb_build_object('preferred_zone',nullif(zone,''),'source_channel','facebook_messenger',
      'review_mode','human_confirmed',
      'declared_shift',nullif(shift_declared,''),'availability',coalesce(p_availability,'consultar'),
      'experience_level',coalesce(p_experience_level,'prefiero_comentarlo')))
  ) returning id into new_candidate;

  insert into public.cl360_messenger_candidate_links(
    conversation_id,workspace_id,candidate_id,linked_by
  ) values(p_conversation,ws,new_candidate,actor);

  insert into public.cl360_followups(
    workspace_id,candidate_id,title,due_at,status,assigned_user_id,created_by
  ) values(
    ws,new_candidate,'Revisar postulación recibida por Messenger',p_due_at,'pending',assignee,actor
  ) returning id into new_followup;

  insert into public.cl360_events(workspace_id,candidate_id,kind,origin,actor_user_id,note)
  values(ws,new_candidate,'note','human',actor,
    'Registro de Messenger con revisión y autorización confirmadas por integrante autorizado; seguimiento creado.');

  return jsonb_build_object('candidate_id',new_candidate,'followup_id',new_followup,
    'assigned_user_id',assignee,'already_linked',false);
end;
$$;
revoke all on function public.cl360_messenger_candidate_register_v2(uuid,text,text,text,text,text,boolean,boolean,timestamptz,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.cl360_messenger_candidate_register_v2(uuid,text,text,text,text,text,boolean,boolean,timestamptz,uuid,text,text,text) to authenticated;
