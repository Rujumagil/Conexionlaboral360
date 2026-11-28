-- Read-only evidence projection. No applicant creation, scoring or automatic messaging.
-- Fields are suggestions from incoming text, not verified facts.
create or replace function public.cl360_extract_intake(p_messages jsonb)
returns jsonb language plpgsql immutable security invoker set search_path='' as $$
declare m jsonb; body text; norm text; pending text; field_key text; value text; digits text; matches text[]; evidence jsonb:='{}'; conflicts jsonb:='{}'; item jsonb; call_requested boolean:=false; declined boolean:=false;
begin
 if jsonb_typeof(p_messages) is distinct from 'array' then return jsonb_build_object('fields','{}'::jsonb,'conflicts','{}'::jsonb,'call_requested',false,'declined',false); end if;
 for m in select value from jsonb_array_elements(p_messages) loop
  body:=btrim(coalesce(m->>'body',''));
  norm:=lower(translate(body,'ÁÉÍÓÚÜÑáéíóúüñ','AEIOUUNaeiouun'));
  if m->>'direction'='outgoing' then
   pending:=null;
   if coalesce(m->>'status','') in ('failed','pending') then continue; end if;
   pending:=case when norm ~ 'con quien tengo el gusto|cual es tu nombre' then 'name'
     when norm ~ 'por que colonia o zona vives|en que (colonia|zona|municipio) vives|donde vives' then 'zone'
     when norm ~ 'has trabajado antes en seguridad privada|tienes experiencia trabajando en seguridad privada|tienes experiencia en seguridad' then 'experience'
     when norm ~ 'compartes tu numero|numero de telefono|cual es tu telefono' then 'phone'
     when norm ~ 'que turno (prefieres|buscas|puedes cubrir)|que horario prefieres' then 'shift'
     else null end;
   continue;
  end if;
  if m->>'direction' is distinct from 'incoming' or m->>'message_type' is distinct from 'text' then pending:=null;continue;end if;
  if norm ~ '(no me (escribas|contactes|interesa)|no estoy interesad[oa]|eliminar mis datos|no quiero continuar)' then declined:=true; end if;
  if norm ~ '(llamame|marcame|contactame|contacteme|puedes llamar|pueden llamar|puede llamarme)' then call_requested:=true; end if;
  field_key:=null;value:=null;
  if char_length(body) between 2 and 180 and body !~ '[?¿]|https?://|@' then
   if norm ~ '^(mi nombre es|me llamo) ' then field_key:='name';value:=btrim(regexp_replace(body,'^(mi nombre es|me llamo) +','','i'));
   elsif norm ~ '^(vivo en|radico en|mi colonia es) ' then field_key:='zone';value:=btrim(regexp_replace(body,'^(vivo en|radico en|mi colonia es) +','','i'));
   elsif norm ~ '^(si tengo experiencia|tengo experiencia|no tengo experiencia|sin experiencia|he trabajado|no he trabajado)' then field_key:='experience';value:=body;
   elsif pending in ('name','zone','experience','shift') and norm !~ '^(hola|gracias|ok|sale|perfecto|no gracias|buenas|buenos dias|no me interesa)$' and body !~ '[0-9]{7,}' then
    if pending='experience' or (pending in ('name','zone','shift') and norm !~ '^(si|no|claro|de acuerdo)$') then field_key:=pending;value:=body; end if;
   end if;
   if field_key='name' and (value ~ '[0-9]' or char_length(value)<3 or norm ~ '(vacante|informacion|sueldo|trabajo|horario|turno)') then field_key:=null;end if;
   if field_key='zone' and norm ~ '(vacante|informacion|sueldo|horario|turno|busco)' then field_key:=null;end if;
   if field_key='shift' and norm !~ '(24 *[x×/] *48|24 *[x×/] *24|12 *[x×/] *12|12 *[x×/] *24|diurno|nocturno|vespertino)' then field_key:=null;end if;
   if field_key is not null and nullif(value,'') is not null then
    item:=jsonb_build_object('value',value,'message_id',m->>'id','created_at',m->>'created_at');
    if evidence ? field_key and lower(evidence->field_key->>'value')<>lower(value) then conflicts:=conflicts||jsonb_build_object(field_key,true);end if;
    evidence:=evidence||jsonb_build_object(field_key,item);
   end if;
  end if;
  -- Only explicitly labeled or standalone phone-like text, not numbers in links or unrelated IDs.
  if body !~ 'https?://|@' and (pending='phone' or norm ~ '(telefono|celular|mi numero|contacteme|contactame)' or norm ~ '^[+0-9 ().-]+$') then
   for matches in select regexp_matches(body,'(?<![0-9])(?:\+?52[ .()-]*(?:1[ .()-]*)?)?\(?[0-9]{2,3}\)?[ .-]*[0-9]{3,4}[ .-]*[0-9]{4}(?![0-9])','g') loop
    digits:=regexp_replace(matches[1],'[^0-9]','','g');
    if length(digits)=13 and left(digits,3)='521' then digits:=right(digits,10);elsif length(digits)=12 and left(digits,2)='52' then digits:=right(digits,10);end if;
    if length(digits)=10 then
     if evidence ? 'phone' and evidence->'phone'->>'value'<>digits then conflicts:=conflicts||jsonb_build_object('phone',true);end if;
     evidence:=evidence||jsonb_build_object('phone',jsonb_build_object('value',digits,'message_id',m->>'id','created_at',m->>'created_at'));
    end if;
   end loop;
  end if;
  if body !~ '[?¿]|https?://' then
   for matches in select regexp_matches(norm,'\m(24 *[x×/] *48|24 *[x×/] *24|12 *[x×/] *12|12 *[x×/] *24|diurno|nocturno|vespertino)\M','g') loop
    value:=regexp_replace(replace(replace(matches[1],'×','x'),'/','x'),' ','','g');
    if evidence ? 'shift' and lower(evidence->'shift'->>'value')<>value then conflicts:=conflicts||jsonb_build_object('shift',true);end if;
    evidence:=evidence||jsonb_build_object('shift',jsonb_build_object('value',value,'message_id',m->>'id','created_at',m->>'created_at'));
   end loop;
  end if;
  pending:=null;
 end loop;
 return jsonb_build_object('fields',evidence,'conflicts',conflicts,'call_requested',call_requested,'declined',declined);
end $$;
revoke all on function public.cl360_extract_intake(jsonb) from public,anon,authenticated;
grant execute on function public.cl360_extract_intake(jsonb) to authenticated;

create or replace function public.cl360_messenger_live_intake(p_conversation uuid)
returns jsonb language sql stable security invoker set search_path='' as $$
 select public.cl360_extract_intake(public.cl360_messenger_inbox(p_conversation));
$$;
revoke all on function public.cl360_messenger_live_intake(uuid) from public,anon,authenticated;
grant execute on function public.cl360_messenger_live_intake(uuid) to authenticated;
