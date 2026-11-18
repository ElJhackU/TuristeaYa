-- Ejecutar completo: todos los datos de prueba se revierten.
begin;
select set_config('request.jwt.claim.sub',(select user_id::text from public.user_access where role='tourist' and status='active' limit 1),true);
insert into public.experiences (id,business_id,place_id,title,description,starts_at,price_per_person,capacity,vip_only,published)
select 'f1234567-0000-4000-8000-000000000001',business_id,id,'Prueba reversible','Validación',now()+interval '2 days',25,2,false,true from public.places where business_id is not null limit 1;
insert into public.promotions (id,business_id,place_id,title,code,discount_percent,starts_at,ends_at,max_redemptions,per_user_limit,conditions,status)
select 'f1234567-0000-4000-8000-000000000003',business_id,id,'Prueba reversible','TEST-'||gen_random_uuid(),20,now()-interval '1 day',now()+interval '1 day',1,1,'Prueba','active' from public.places where business_id is not null limit 1;
set local role authenticated;
do $test$
declare first_id uuid; second_id uuid; amount numeric;
begin
  assert auth.uid() is not null, 'Falta turista activo de prueba';
  assert (select count(*) from public.profiles where id<>auth.uid())=0, 'Fuga de perfiles';
  assert (select count(*) from public.tickets where user_id<>auth.uid())=0, 'Fuga de tickets';
  assert (select count(*) from public.notifications where user_id<>auth.uid())=0, 'Fuga de notificaciones';
  select id,total into first_id,amount from public.book_experience('f1234567-0000-4000-8000-000000000001',2,'f1234567-0000-4000-8000-000000000002');
  assert amount=50, 'Total incorrecto';
  select id into second_id from public.book_experience('f1234567-0000-4000-8000-000000000001',2,'f1234567-0000-4000-8000-000000000002');
  assert first_id=second_id, 'Reserva duplicada';
  begin
    perform public.book_experience('f1234567-0000-4000-8000-000000000001',1,gen_random_uuid());
    raise exception 'No rechazó sobrecupo';
  exception when sqlstate '22023' then
    assert sqlerrm='No capacity', sqlerrm;
  end;
  begin
    perform public.book_experience('f1234567-0000-4000-8000-000000000001',1,'f1234567-0000-4000-8000-000000000002');
    raise exception 'No rechazó cambio de participantes';
  exception when sqlstate '22023' then
    assert sqlerrm='Idempotency conflict', sqlerrm;
  end;
  select id,savings into first_id,amount from public.redeem_coupon('f1234567-0000-4000-8000-000000000003','f1234567-0000-4000-8000-000000000004',100);
  assert amount=20, 'Ahorro incorrecto';
  select id into second_id from public.redeem_coupon('f1234567-0000-4000-8000-000000000003','f1234567-0000-4000-8000-000000000004',100);
  assert first_id=second_id, 'Canje duplicado';
  begin
    perform public.redeem_coupon('f1234567-0000-4000-8000-000000000003',gen_random_uuid(),100);
    raise exception 'No rechazó límite de canjes';
  exception when sqlstate '22023' then
    assert sqlerrm='Redemption limit reached', sqlerrm;
  end;
end;
$test$;
select 'RLS, reservas, cupos, canjes e idempotencia: OK (rollback)' as resultado;
rollback;
