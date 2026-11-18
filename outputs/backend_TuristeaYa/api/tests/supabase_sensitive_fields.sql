begin;
select set_config('request.jwt.claim.sub',(select r.user_id::text from public.reviews r join public.user_access a on a.user_id=r.user_id where a.role='tourist' and a.status='active' limit 1),true);
select set_config('test.review_id',(select id::text from public.reviews where user_id=auth.uid() limit 1),true);
insert into public.notifications(id,user_id,title,body,kind) values('f1234567-0000-4000-8000-000000000005',auth.uid(),'Prueba reversible','Prueba','system');
set local role authenticated;
do $test$
begin
 assert auth.uid() is not null, 'Falta usuario de prueba';
 update public.reviews set body=body where id=current_setting('test.review_id')::uuid;
 begin
  update public.reviews set hidden=not hidden where id=current_setting('test.review_id')::uuid;
  raise exception 'El autor pudo cambiar la moderación';
 exception when insufficient_privilege then null;
 end;
 update public.notifications set read_at=now() where id='f1234567-0000-4000-8000-000000000005';
 begin
  update public.notifications set body='Cambio no permitido' where id='f1234567-0000-4000-8000-000000000005';
  raise exception 'Se permitió editar una notificación';
 exception when insufficient_privilege then null;
 end;
end;
$test$;
reset role;
select set_config('request.jwt.claim.sub',(select user_id::text from public.user_access where role='admin' and status='active' limit 1),true);
set local role authenticated;
do $test$
declare before_count int;
begin
 select count(*) into before_count from public.moderation_actions where review_id=current_setting('test.review_id')::uuid;
 update public.reviews set hidden=not hidden where id=current_setting('test.review_id')::uuid;
 assert (select count(*) from public.moderation_actions where review_id=current_setting('test.review_id')::uuid)=before_count+1, 'Falta auditoría de moderación';
 begin
  update public.user_access set status='suspended' where user_id=auth.uid();
  raise exception 'Administrador pudo cambiar su propio acceso';
 exception when insufficient_privilege then null;
 end;
end;
$test$;
select 'Campos protegidos y auditoría: OK (rollback)' resultado;
rollback;
