CREATE OR REPLACE FUNCTION public.cl360_register_whatsapp_candidate(p_name text, p_phone text, p_job_slug text, p_zone text, p_experience text, p_note text, p_consent boolean, p_contacted boolean, p_due_at timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 ws constant uuid := 'c7ab2a78-08e0-4a29-8a3b-fadaf244002f';
 actor uuid := auth.uid();
 normalized_phone text;
 candidate_name text := btrim(coalesce(p_name,''));
 zone text := btrim(coalesce(p_zone,''));
 experience text := btrim(coalesce(p_experience,''));
 note text := btrim(coalesce(p_note,''));
 job_area text;
 candidate_id uuid;
begin
 if actor is null or not exists (
  select 1 from public.workspace_members m join public.workspaces w on w.id=m.workspace_id
  join public.profiles p on p.id=m.user_id
  where m.workspace_id=ws and m.user_id=actor and m.status='active' and w.status='active'
  and m.role::text in ('owner','admin','manager','sales','support')
 ) then raise exception 'access_denied' using errcode='42501'; end if;
 if p_consent is distinct from true then raise exception 'consent_required' using errcode='22023'; end if;
 if coalesce(p_phone,'') !~ '^[+0-9(). -]{10,30}$' then raise exception 'invalid_phone' using errcode='22023'; end if;
 normalized_phone := regexp_replace(p_phone,'[^0-9]','','g');
 if length(normalized_phone)=13 and left(normalized_phone,3)='521' then normalized_phone:=right(normalized_phone,10);
 elsif length(normalized_phone)=12 and left(normalized_phone,2)='52' then normalized_phone:=right(normalized_phone,10); end if;
 if normalized_phone !~ '^[0-9]{10}$' or length(candidate_name) not between 3 and 120
 or length(zone)>120 or length(experience)>1000 or length(note)>1300 then
 raise exception 'invalid_candidate_fields' using errcode='22023'; end if;
 if p_due_at is not null and (p_due_at<=now() or p_due_at>now()+interval '90 days') then
 raise exception 'invalid_followup_time' using errcode='22023'; end if;
 select j.area into job_area from public.cl360_jobs j where j.workspace_id=ws and j.slug=p_job_slug and j.status='active';
 if job_area is null then raise exception 'job_not_active' using errcode='22023'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(ws::text||':'||p_job_slug||':'||normalized_phone,0));
 select c.id into candidate_id from public.cl360_candidates c where c.workspace_id=ws and c.job_slug=p_job_slug
 and regexp_replace(c.phone,'[^0-9]','','g') in (normalized_phone,'52'||normalized_phone,'521'||normalized_phone)
 order by c.created_at,c.id limit 1;
 if candidate_id is not null then return jsonb_build_object('candidate_id',candidate_id,'already_exists',true); end if;
 insert into public.cl360_candidates(workspace_id,full_name,phone,job_slug,area,experience,source,stage,consent_at,assigned_user_id,last_contact_at,next_followup_at,screening_data)
 values(ws,candidate_name,normalized_phone,p_job_slug,job_area,experience,'whatsapp',case when p_contacted is true then 'contacted' else 'new' end,now(),actor,case when p_contacted is true then now() else null end,p_due_at,
 jsonb_strip_nulls(jsonb_build_object('source_channel','whatsapp_manual','review_mode','human_confirmed','preferred_zone',nullif(zone,''))))
 on conflict(workspace_id,phone,job_slug) do nothing returning id into candidate_id;
 if candidate_id is null then
 select c.id into candidate_id from public.cl360_candidates c where c.workspace_id=ws and c.phone=normalized_phone and c.job_slug=p_job_slug;
 if candidate_id is null then raise exception 'registration_conflict' using errcode='40001'; end if;
 return jsonb_build_object('candidate_id',candidate_id,'already_exists',true);
 end if;
 insert into public.cl360_events(workspace_id,candidate_id,kind,origin,actor_user_id,note)
 values(ws,candidate_id,'application_received','human',actor,'Alta manual de WhatsApp. Autorización de registro confirmada por el reclutador.');
 if note<>'' then insert into public.cl360_events(workspace_id,candidate_id,kind,origin,actor_user_id,note)
 values(ws,candidate_id,'note','human',actor,note); end if;
 if p_due_at is not null then
 insert into public.cl360_followups(workspace_id,candidate_id,title,due_at,status,assigned_user_id,created_by)
 values(ws,candidate_id,'Dar seguimiento por WhatsApp',p_due_at,'pending',actor,actor);
 end if;
 return jsonb_build_object('candidate_id',candidate_id,'already_exists',false);
end;
$function$;
revoke all on function public.cl360_register_whatsapp_candidate(text,text,text,text,text,text,boolean,boolean,timestamptz) from public,anon,authenticated;
grant execute on function public.cl360_register_whatsapp_candidate(text,text,text,text,text,text,boolean,boolean,timestamptz) to authenticated;
