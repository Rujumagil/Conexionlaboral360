-- Read-only projection of Messenger inbox and confirmed CRM links.
-- Applied to Compás One on 2026-11-28. Does not create applicants or copy chat transcripts.
create or replace function public.cl360_messenger_pipeline()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare ws constant uuid:='c7ab2a78-08e0-4a29-8a3b-fadaf244002f'; result jsonb;
begin
 if auth.uid() is null or not exists(select 1 from public.workspace_members m join public.workspaces w on w.id=m.workspace_id where m.workspace_id=ws and m.user_id=auth.uid() and m.status='active' and w.status='active' and m.role in ('owner','admin','manager','sales','support')) then raise exception 'access_denied' using errcode='42501'; end if;
 select coalesce(jsonb_agg(x.item || jsonb_build_object('candidate_id',l.candidate_id) order by x.ord),'[]'::jsonb) into result
 from jsonb_array_elements(public.cl360_messenger_inbox()) with ordinality as x(item,ord)
 left join public.cl360_messenger_candidate_links l on l.workspace_id=ws and l.conversation_id=(x.item->>'id')::uuid;
 return result;
end $$;
revoke all on function public.cl360_messenger_pipeline() from public,anon,authenticated;
grant execute on function public.cl360_messenger_pipeline() to authenticated;