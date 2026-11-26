-- First stage: staff-authored knowledge, NOT consumed by live Messenger yet.
create table if not exists public.cl360_andy_knowledge (
 workspace_id uuid not null check(workspace_id='c7ab2a78-08e0-4a29-8a3b-fadaf244002f'),
 job_slug text not null check(length(job_slug)<=80),
 topic text not null check(topic in ('functions','pay_frequency','schedule','experience','requirements','benefits','uniform','start','interview','application','faq')),
 answer text not null check(length(answer) between 1 and 800),
 state text not null default 'draft' check(state in ('draft','reviewed')),
 revision integer not null default 1 check(revision>0),
 updated_by uuid not null references auth.users(id),
 updated_at timestamptz not null default now(),
 primary key(workspace_id,job_slug,topic)
);
alter table public.cl360_andy_knowledge enable row level security;
revoke all on public.cl360_andy_knowledge from public,anon,authenticated;
create or replace function public.cl360_andy_academy(p_action text default 'read',p_job text default '',p_topic text default '',p_answer text default '',p_revision integer default 0)
returns jsonb language plpgsql security definer set search_path='' as $$
declare ws constant uuid:='c7ab2a78-08e0-4a29-8a3b-fadaf244002f'; actor uuid:=auth.uid(); row_now public.cl360_andy_knowledge%rowtype;
begin
 if actor is null or not exists(select 1 from public.workspace_members m join public.workspaces w on w.id=m.workspace_id where m.workspace_id=ws and m.user_id=actor and m.status='active' and w.status='active' and m.role::text in ('owner','admin','manager')) then raise exception 'access_denied' using errcode='42501'; end if;
 if p_action='read' then
  return jsonb_build_object('jobs',coalesce((select jsonb_agg(jsonb_build_object('slug',j.slug,'title',j.title,'location',j.location,'shift',j.shift) order by j.title) from public.cl360_jobs j where j.workspace_id=ws and j.status='active'),'[]'::jsonb),
  'entries',coalesce((select jsonb_agg(jsonb_build_object('job_slug',k.job_slug,'topic',k.topic,'answer',k.answer,'state',k.state,'revision',k.revision,'updated_at',k.updated_at)) from public.cl360_andy_knowledge k where k.workspace_id=ws),'[]'::jsonb));
 end if;
 if p_action not in ('save','review','delete') or p_action is null or p_revision is null or p_revision<0 or p_topic is null or p_topic not in ('functions','pay_frequency','schedule','experience','requirements','benefits','uniform','start','interview','application','faq') or p_job is null or not (p_job='' or exists(select 1 from public.cl360_jobs j where j.workspace_id=ws and j.slug=p_job and j.status='active')) then raise exception 'invalid_input' using errcode='22023'; end if;
 -- Serializes new rows as well as edits so revisions cannot be overwritten.
 perform pg_advisory_xact_lock(hashtextextended(ws::text||':'||p_job||':'||p_topic,0));
 select * into row_now from public.cl360_andy_knowledge k where k.workspace_id=ws and k.job_slug=p_job and k.topic=p_topic;
 if coalesce(row_now.revision,0)<>p_revision then raise exception 'stale_revision' using errcode='40001'; end if;
 if p_action='delete' then delete from public.cl360_andy_knowledge where workspace_id=ws and job_slug=p_job and topic=p_topic; return jsonb_build_object('deleted',true); end if;
 if p_action='review' then
  if row_now.revision is null or row_now.state<>'draft' then raise exception 'draft_required' using errcode='22023'; end if;
  update public.cl360_andy_knowledge set state='reviewed',revision=revision+1,updated_at=now(),updated_by=actor where workspace_id=ws and job_slug=p_job and topic=p_topic returning * into row_now;
 else
  if p_answer is null or length(btrim(p_answer)) not between 1 and 800 then raise exception 'invalid_answer' using errcode='22023'; end if;
  insert into public.cl360_andy_knowledge(workspace_id,job_slug,topic,answer,updated_by)
  values(ws,p_job,p_topic,btrim(p_answer),actor)
  on conflict(workspace_id,job_slug,topic) do update set answer=excluded.answer,state='draft',revision=public.cl360_andy_knowledge.revision+1,updated_by=actor,updated_at=now()
  returning * into row_now;
 end if;
 return jsonb_build_object('revision',row_now.revision,'state',row_now.state);
end;
$$;
revoke all on function public.cl360_andy_academy(text,text,text,text,integer) from public,anon,authenticated;
grant execute on function public.cl360_andy_academy(text,text,text,text,integer) to authenticated;
