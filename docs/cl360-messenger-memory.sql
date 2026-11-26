-- Human-confirmed conversational progress only. No copied name, personal attributes or suitability scoring.
create table if not exists public.cl360_messenger_memory_state (
 conversation_id uuid primary key references public.conversations(id) on delete cascade,
 workspace_id uuid not null check(workspace_id='c7ab2a78-08e0-4a29-8a3b-fadaf244002f'),
 name_confirmed boolean not null default false,
 job_slug text not null default '',
 shift_discussed boolean not null default false,
 human_requested boolean not null default false,
 revision integer not null default 1 check(revision>0),
 updated_at timestamptz not null default now()
);
alter table public.cl360_messenger_memory_state enable row level security;
revoke all on public.cl360_messenger_memory_state from public,anon,authenticated;
grant select on public.cl360_messenger_memory_state to service_role;
create or replace function public.cl360_messenger_memory(p_conversation uuid,p_patch jsonb default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare ws constant uuid := 'c7ab2a78-08e0-4a29-8a3b-fadaf244002f'; actor uuid := auth.uid();
 owner_id uuid; conv_status text; mem public.cl360_messenger_memory_state%rowtype; selected_job text; current_revision integer;
begin
 if actor is null or not exists(select 1 from public.workspace_members m join public.workspaces w on w.id=m.workspace_id where m.workspace_id=ws and m.user_id=actor and m.status='active' and w.status='active' and m.role::text in ('owner','admin','manager','sales','support')) then raise exception 'access_denied' using errcode='42501'; end if;
 select c.assigned_user_id,c.status into owner_id,conv_status from public.conversations c where c.id=p_conversation and c.workspace_id=ws and c.channel='messenger' for update;
 if not found or conv_status in ('closed','archived') or (owner_id is not null and owner_id<>actor) then raise exception 'conversation_unavailable' using errcode='42501'; end if;
 select * into mem from public.cl360_messenger_memory_state where conversation_id=p_conversation and workspace_id=ws;
 current_revision:=coalesce(mem.revision,0);
 if p_patch is not null then
  if jsonb_typeof(p_patch) is distinct from 'object' then raise exception 'invalid_patch' using errcode='22023'; end if;
  if exists(select 1 from jsonb_object_keys(p_patch) k where k not in ('revision','name_confirmed','job_slug','shift_discussed','human_requested')) or jsonb_typeof(p_patch->'revision') is distinct from 'number' or coalesce(p_patch->>'revision','') !~ '^[0-9]{1,9}$' or jsonb_typeof(p_patch->'name_confirmed') is distinct from 'boolean' or jsonb_typeof(p_patch->'job_slug') is distinct from 'string' or jsonb_typeof(p_patch->'shift_discussed') is distinct from 'boolean' or jsonb_typeof(p_patch->'human_requested') is distinct from 'boolean' then raise exception 'invalid_patch' using errcode='22023'; end if;
  if (p_patch->>'revision')::integer<>current_revision then raise exception 'stale_memory' using errcode='40001'; end if;
  selected_job:=p_patch->>'job_slug';
  if selected_job<>'' and (selected_job !~ '^[a-z0-9-]{3,80}$' or not exists(select 1 from public.cl360_jobs j where j.workspace_id=ws and j.status='active' and j.slug=selected_job)) then raise exception 'vacancy_unavailable' using errcode='22023'; end if;
  if selected_job='' and (p_patch->>'shift_discussed')::boolean then raise exception 'vacancy_required' using errcode='22023'; end if;
  insert into public.cl360_messenger_memory_state(conversation_id,workspace_id,name_confirmed,job_slug,shift_discussed,human_requested,revision)
  values(p_conversation,ws,(p_patch->>'name_confirmed')::boolean,selected_job,(p_patch->>'shift_discussed')::boolean,(p_patch->>'human_requested')::boolean,current_revision+1)
  on conflict(conversation_id) do update set name_confirmed=excluded.name_confirmed,job_slug=excluded.job_slug,shift_discussed=excluded.shift_discussed,human_requested=excluded.human_requested,revision=excluded.revision,updated_at=now()
  where public.cl360_messenger_memory_state.workspace_id=ws returning * into mem;
  if not found then raise exception 'memory_unavailable' using errcode='42501'; end if;
 end if;
 selected_job:=coalesce(mem.job_slug,'');
 if selected_job<>'' and not exists(select 1 from public.cl360_jobs j where j.workspace_id=ws and j.status='active' and j.slug=selected_job) then selected_job:=''; end if;
 return jsonb_build_object('revision',coalesce(mem.revision,0),'name_confirmed',coalesce(mem.name_confirmed,false),'job_slug',selected_job,'shift_discussed',selected_job<>'' and coalesce(mem.shift_discussed,false),'human_requested',coalesce(mem.human_requested,false),'next_topic',case when coalesce(mem.human_requested,false) then 'handoff' when not coalesce(mem.name_confirmed,false) then 'greeting' when selected_job='' then 'vacancies' when not coalesce(mem.shift_discussed,false) then 'schedule' else 'handoff' end);
end;
$$;
revoke all on function public.cl360_messenger_memory(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.cl360_messenger_memory(uuid,jsonb) to authenticated;
