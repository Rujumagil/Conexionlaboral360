-- Read-only projection. Sent topics are not candidate answers or verification.
create or replace function public.cl360_messenger_pipeline()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare ws constant uuid:='c7ab2a78-08e0-4a29-8a3b-fadaf244002f'; result jsonb;
begin
 if auth.uid() is null or not exists(select 1 from public.workspace_members m join public.workspaces w on w.id=m.workspace_id where m.workspace_id=ws and m.user_id=auth.uid() and m.status='active' and w.status='active' and m.role in ('owner','admin','manager','sales','support')) then raise exception 'access_denied' using errcode='42501'; end if;
 select coalesce(jsonb_agg(x.item || jsonb_build_object('candidate_id',l.candidate_id,'last_incoming_id',incoming.id,'last_incoming_at',incoming.created_at,'andy',jsonb_build_object(
  'sent_count',coalesce(a.sent_count,0),'topics_sent',coalesce(a.topics,'[]'::jsonb),'last_topic',coalesce(last_sent.topic,''),
  'handoff_sent',coalesce(a.handoff_sent,false),'memory_revision',coalesce(mem.revision,0),
  'name_confirmed',coalesce(mem.name_confirmed,false),'job_slug',coalesce(j.slug,''),
  'shift_discussed',j.slug is not null and coalesce(mem.shift_discussed,false),
  'experience_discussed',j.slug is not null and coalesce(mem.experience_discussed,false),
  'application_discussed',j.slug is not null and coalesce(mem.application_discussed,false),
  'human_requested',coalesce(mem.human_requested,false)
 ),'intake',jsonb_build_object(
   'available_count',(select count(*) from jsonb_each(coalesce(i.data->'fields','{}'::jsonb)) z where not coalesce((i.data->'conflicts'->>z.key)::boolean,false)),
   'field_count',5,'needs_review',coalesce(i.data->'conflicts','{}'::jsonb)<>'{}'::jsonb,
   'call_requested',coalesce((i.data->>'call_requested')::boolean,false),
   'declined',coalesce((i.data->>'declined')::boolean,false)
 )) order by x.ord),'[]'::jsonb) into result
 from jsonb_array_elements(public.cl360_messenger_inbox()) with ordinality as x(item,ord)
 left join public.cl360_messenger_candidate_links l on l.workspace_id=ws and l.conversation_id=(x.item->>'id')::uuid
 left join public.cl360_messenger_memory_state mem on mem.workspace_id=ws and mem.conversation_id=(x.item->>'id')::uuid
 left join public.cl360_jobs j on j.workspace_id=ws and j.slug=mem.job_slug and j.status='active'
 left join lateral (select count(*) as sent_count,jsonb_agg(distinct aa.topic) filter(where aa.topic is not null and aa.topic<>'') as topics,bool_or(aa.topic='handoff') as handoff_sent from public.cl360_andy_auto_attempts aa where aa.workspace_id=ws and aa.conversation_id=(x.item->>'id')::uuid and aa.status='sent') a on true
 left join lateral (select public.cl360_messenger_live_intake((x.item->>'id')::uuid) as data offset 0) i on true
 left join lateral (select m.id,m.created_at from public.conversation_messages m where m.workspace_id=ws and m.conversation_id=(x.item->>'id')::uuid and m.direction='incoming' order by m.created_at desc,m.id desc limit 1) incoming on true
 left join lateral (select aa.topic from public.cl360_andy_auto_attempts aa where aa.workspace_id=ws and aa.conversation_id=(x.item->>'id')::uuid and aa.status='sent' order by aa.created_at desc,aa.message_id desc limit 1) last_sent on true;
 return result;
end $$;
revoke all on function public.cl360_messenger_pipeline() from public,anon,authenticated;
grant execute on function public.cl360_messenger_pipeline() to authenticated;