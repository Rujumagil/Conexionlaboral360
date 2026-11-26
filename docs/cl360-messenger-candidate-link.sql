-- Link an existing consented candidate to an owned Messenger conversation.
-- No automatic matching, creation, transcript duplication or candidate stage changes.
create table if not exists public.cl360_messenger_candidate_links (
 conversation_id uuid primary key references public.conversations(id) on delete cascade,
 workspace_id uuid not null check(workspace_id='c7ab2a78-08e0-4a29-8a3b-fadaf244002f'),
 candidate_id uuid not null,
 linked_by uuid references auth.users(id) on delete set null,
 linked_at timestamptz not null default now(),
 foreign key(workspace_id,candidate_id) references public.cl360_candidates(workspace_id,id) on delete cascade
);
alter table public.cl360_messenger_candidate_links enable row level security;
revoke all on public.cl360_messenger_candidate_links from public,anon,authenticated;
create or replace function public.cl360_messenger_candidate_link(p_conversation uuid,p_candidate uuid default null,p_confirm boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare ws constant uuid:='c7ab2a78-08e0-4a29-8a3b-fadaf244002f'; actor uuid:=auth.uid(); owner_id uuid; conv_status text; existing uuid; target public.cl360_candidates%rowtype; 
begin
 if actor is null or not exists(select 1 from public.workspace_members m join public.workspaces w on w.id=m.workspace_id where m.workspace_id=ws and m.user_id=actor and m.status='active' and w.status='active' and m.role::text in ('owner','admin','manager','sales','support')) then raise exception 'access_denied' using errcode='42501'; end if;
 select c.assigned_user_id,c.status into owner_id,conv_status from public.conversations c where c.id=p_conversation and c.workspace_id=ws and c.channel='messenger' for update;
 if not found or (owner_id is not null and owner_id<>actor) then raise exception 'conversation_unavailable' using errcode='42501'; end if;
 select l.candidate_id into existing from public.cl360_messenger_candidate_links l where l.conversation_id=p_conversation and l.workspace_id=ws;
 if p_candidate is null then return jsonb_build_object('candidate_id',existing); end if;
 if p_confirm is distinct from true or owner_id is distinct from actor or conv_status in ('closed','archived') then raise exception 'confirmation_or_assignment_required' using errcode='42501'; end if;
 if existing is not null then
  if existing=p_candidate then return jsonb_build_object('candidate_id',existing,'already_linked',true); end if;
  raise exception 'already_linked' using errcode='23505';
 end if;
 select * into target from public.cl360_candidates c where c.workspace_id=ws and c.id=p_candidate and c.consent_at is not null for key share;
 if not found then raise exception 'candidate_unavailable' using errcode='42501'; end if;
 insert into public.cl360_messenger_candidate_links(conversation_id,workspace_id,candidate_id,linked_by) values(p_conversation,ws,p_candidate,actor);
 insert into public.cl360_events(workspace_id,candidate_id,kind,origin,actor_user_id,note) values(ws,p_candidate,'note','human',actor,'Conversación de Messenger vinculada por el equipo tras confirmar identidad y autorización.');
 return jsonb_build_object('candidate_id',p_candidate,'already_linked',false);
end;
$$;
revoke all on function public.cl360_messenger_candidate_link(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.cl360_messenger_candidate_link(uuid,uuid,boolean) to authenticated;
