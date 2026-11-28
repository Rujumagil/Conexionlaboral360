-- Private server dispatch ledger and scoped, token-authenticated batch claim.
create table if not exists public.cl360_push_delivery (
 subscription_id uuid not null references public.cl360_push_subscriptions(id) on delete cascade,
 event_key text not null,
 batch_id uuid not null,
 event_type text not null check(event_type in ('calls','handoff','review','interviews','overdue')),
 state text not null default 'claimed' check(state in ('claimed','accepted','failed','uncertain')),
 claimed_at timestamptz not null default now(),
 completed_at timestamptz,
 primary key(subscription_id,event_key)
);
alter table public.cl360_push_delivery enable row level security;
revoke all on public.cl360_push_delivery from public,anon,authenticated;
grant select,update,insert on public.cl360_push_delivery to service_role;
do $$ begin
 if not exists(select 1 from vault.secrets where name='cl360_push_dispatch_token') then
  perform vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'),'cl360_push_dispatch_token','Token scoped to CL360 push dispatcher',null);
 end if;
end $$;
create or replace function public.cl360_claim_push_batch(p_token text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare ws constant uuid:='c7ab2a78-08e0-4a29-8a3b-fadaf244002f'; secret text; batch uuid:=gen_random_uuid(); result jsonb;
begin
 select decrypted_secret into secret from vault.decrypted_secrets where name='cl360_push_dispatch_token' limit 1;
 if secret is null or p_token is null or length(p_token)<>64 or p_token<>secret then raise exception 'access_denied' using errcode='42501'; end if;
 if not pg_try_advisory_xact_lock(hashtext('cl360_push_dispatch')) then return '[]'::jsonb; end if;
 if not exists(select 1 from public.cl360_push_subscriptions s join public.workspace_members m on m.workspace_id=s.workspace_id and m.user_id=s.user_id where s.workspace_id=ws and s.enabled and m.status='active' and m.role::text in ('owner','admin','manager')) then return '[]'::jsonb; end if;
 with devices as materialized (
  select s.id,s.user_id,s.endpoint,s.p256dh,s.auth_key from public.cl360_push_subscriptions s
  join public.workspace_members m on m.workspace_id=s.workspace_id and m.user_id=s.user_id
  join public.workspaces w on w.id=s.workspace_id
  where s.workspace_id=ws and s.enabled and m.status='active' and m.role::text in ('owner','admin','manager') and w.status='active'
 ),
 contacts as materialized (
  select c.id,c.assigned_user_id,c.status,l.candidate_id,
   public.cl360_extract_intake(coalesce(hist.messages,'[]'::jsonb)) as intake,
   coalesce(mem.human_requested,false) or exists(select 1 from public.cl360_andy_auto_attempts a where a.workspace_id=ws and a.conversation_id=c.id and a.status='sent' and a.topic='handoff') as handoff
  from public.conversations c
  left join public.cl360_messenger_candidate_links l on l.workspace_id=ws and l.conversation_id=c.id
  left join public.cl360_messenger_memory_state mem on mem.workspace_id=ws and mem.conversation_id=c.id
  left join lateral (select jsonb_agg(to_jsonb(t) order by t.created_at,t.id) messages from (select m.id,m.direction,m.message_type,m.body,m.status,m.created_at from public.conversation_messages m where m.workspace_id=ws and m.conversation_id=c.id order by m.created_at desc,m.id desc limit 150)t) hist on true
  where c.workspace_id=ws and c.channel='messenger'
 ),
 contact_events as (
  select c.id::text as key_id,c.assigned_user_id,
  case when (c.intake->>'call_requested')::boolean then 'calls'
       when c.handoff then 'handoff'
       when c.candidate_id is null and ((select count(*) from jsonb_each(coalesce(c.intake->'fields','{}'::jsonb)) f where not coalesce((c.intake->'conflicts'->>f.key)::boolean,false))>=3 or coalesce(c.intake->'conflicts','{}'::jsonb)<>'{}'::jsonb) then 'review' end as kind
  from contacts c where c.status not in ('closed','archived') and not coalesce((c.intake->>'declined')::boolean,false)
 ),
 task_events as (
  select f.id::text||':'||extract(epoch from f.due_at)::text as key_id,f.assigned_user_id,
  case when f.due_at<now() then 'overdue' when f.due_at<=now()+interval '24 hours' and f.title ~* '\mentrevista(s)?\M' then 'interviews' end as kind
  from public.cl360_followups f where f.workspace_id=ws and f.status='pending' and f.due_at is not null
   and not exists(select 1 from contacts c where c.candidate_id=f.candidate_id and coalesce((c.intake->>'declined')::boolean,false))
 ),
 events as (select * from contact_events union all select * from task_events),
 eligible as (
  select distinct d.id as subscription_id,e.kind||':'||e.key_id as event_key,e.kind
  from devices d join events e on (e.assigned_user_id is null or e.assigned_user_id=d.user_id)
  where e.kind is not null and not exists(select 1 from public.cl360_push_delivery q where q.subscription_id=d.id and q.event_key=e.kind||':'||e.key_id)
 ),
 selected_devices as (select distinct subscription_id from eligible order by subscription_id limit 12),
 claimed as (
  insert into public.cl360_push_delivery(subscription_id,event_key,batch_id,event_type)
  select e.subscription_id,e.event_key,batch,e.kind from eligible e join selected_devices s using(subscription_id)
  order by e.subscription_id,e.event_key limit 1000
  on conflict do nothing returning subscription_id,event_type
 ),
 counts as (select subscription_id,event_type,count(*) n from claimed group by subscription_id,event_type),
 grouped as (select subscription_id,jsonb_object_agg(event_type,n) as counts from counts group by subscription_id)
 select coalesce(jsonb_agg(jsonb_build_object('subscription_id',d.id,'endpoint',d.endpoint,'p256dh',d.p256dh,'auth_key',d.auth_key,'batch_id',batch,'counts',g.counts)),'[]'::jsonb) into result
 from grouped g join devices d on d.id=g.subscription_id;
 return result;
end $$;
revoke all on function public.cl360_claim_push_batch(text) from public,anon,authenticated;
grant execute on function public.cl360_claim_push_batch(text) to service_role;

-- Called only from pg_cron. Token stays in Vault; no request is sent without a registered device.
create or replace function public.cl360_request_push_dispatch()
returns void language plpgsql set search_path='' as $$
begin
 if exists(select 1 from public.cl360_push_subscriptions where workspace_id='c7ab2a78-08e0-4a29-8a3b-fadaf244002f' and enabled) then
  perform net.http_post(url:='https://qwxydjotwhniahaovrff.supabase.co/functions/v1/cl360-push-dispatch',
   headers:=jsonb_build_object('Content-Type','application/json','X-CL360-Dispatch',(select decrypted_secret from vault.decrypted_secrets where name='cl360_push_dispatch_token' limit 1)),
   body:='{}'::jsonb,timeout_milliseconds:=45000);
 end if;
end $$;
revoke all on function public.cl360_request_push_dispatch() from public,anon,authenticated,service_role;
