create or replace function public.cl360_messenger_inbox(p_conversation uuid default null)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  ws constant uuid := 'c7ab2a78-08e0-4a29-8a3b-fadaf244002f';
  result jsonb;
begin
  if auth.uid() is null or not exists (
    select 1 from public.workspace_members w where w.workspace_id=ws and w.user_id=auth.uid()
      and w.status='active' and w.role::text in ('owner','admin','manager','sales','support')
  ) then raise exception 'Access denied' using errcode='42501'; end if;
  if p_conversation is null then
    select coalesce(jsonb_agg(to_jsonb(t) order by t.last_message_at desc nulls last),'[]'::jsonb) into result
    from (select c.id, c.status::text, c.assigned_user_id, c.last_message_at, c.last_message_preview,
      coalesce(nullif(btrim(k.display_name),''),nullif(btrim(concat_ws(' ',k.first_name,k.last_name)),''),'Contacto de Facebook') as display_name
      from public.conversations c left join public.contacts k on k.id=c.contact_id and k.workspace_id=ws
      where c.workspace_id=ws and c.channel='messenger'
      order by c.last_message_at desc nulls last limit 300) t;
  else
    select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at,t.id),'[]'::jsonb) into result
    from (select m.id,m.direction::text,m.body,m.message_type::text,m.status::text,m.created_at
      from public.conversation_messages m join public.conversations c on c.id=m.conversation_id and c.workspace_id=m.workspace_id
      where c.workspace_id=ws and c.channel='messenger' and c.id=p_conversation
      order by m.created_at desc,m.id desc limit 150) t;
  end if;
  return result;
end;
$$;
revoke all on function public.cl360_messenger_inbox(uuid) from public,anon,authenticated;
grant execute on function public.cl360_messenger_inbox(uuid) to authenticated;
