-- CL360 only: human assignment and supervised release. Automatic sending is not enabled.
create or replace function public.cl360_messenger_control(p_conversation uuid,p_action text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare ws constant uuid := 'c7ab2a78-08e0-4a29-8a3b-fadaf244002f'; actor uuid := auth.uid(); current_owner uuid; current_status text;
begin
 if actor is null or not exists(select 1 from public.workspace_members m join public.workspaces w on w.id=m.workspace_id where m.workspace_id=ws and m.user_id=actor and m.status='active' and w.status='active' and m.role::text in ('owner','admin','manager','sales','support')) then
  raise exception 'access_denied' using errcode='42501';
 end if;
 if p_action is null or p_action not in ('take','release') then raise exception 'invalid_action' using errcode='22023'; end if;
 select c.assigned_user_id,c.status into current_owner,current_status from public.conversations c where c.id=p_conversation and c.workspace_id=ws and c.channel='messenger' for update;
 if not found or current_status in ('closed','archived') then raise exception 'conversation_unavailable' using errcode='42501'; end if;
 if current_owner is not null and current_owner<>actor then raise exception 'assigned_elsewhere' using errcode='42501'; end if;
 if p_action='take' then
  update public.conversations set assigned_user_id=actor,updated_at=now() where id=p_conversation and workspace_id=ws and channel='messenger';
  return jsonb_build_object('ok',true,'mode','human','assigned_user_id',actor);
 end if;
 if current_owner is distinct from actor then raise exception 'not_owner' using errcode='42501'; end if;
 update public.conversations set assigned_user_id=null,updated_at=now() where id=p_conversation and workspace_id=ws and channel='messenger';
 return jsonb_build_object('ok',true,'mode','supervised','assigned_user_id',null);
end;
$$;
revoke all on function public.cl360_messenger_control(uuid,text) from public,anon,authenticated;
grant execute on function public.cl360_messenger_control(uuid,text) to authenticated;
