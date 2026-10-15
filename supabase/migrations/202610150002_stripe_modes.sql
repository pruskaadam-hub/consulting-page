-- Reserve the Stripe mode before creating Checkout. Test data never becomes revenue.
alter table public.orders add column is_test boolean not null default false;
alter table public.stripe_invoices add column is_test boolean not null default false;

drop function public.begin_checkout(uuid);
create function public.begin_checkout(p_order uuid,p_is_test boolean) returns public.orders language plpgsql security definer set search_path='' as $$
declare o public.orders;
begin
  if not public.is_admin() then raise exception 'Admin + MFA required' using errcode='42501'; end if;
  select * into o from public.orders where id=p_order for update;
  if not found or o.status<>'pending' or p_is_test is null then raise exception 'Order is not payable'; end if;
  if exists(select 1 from public.invoices where order_id=p_order) then raise exception 'A local invoice already exists'; end if;
  if o.source='stripe' and o.is_test<>p_is_test then raise exception 'Stripe mode mismatch: create a new order'; end if;
  update public.orders set is_test=p_is_test,source='stripe' where id=p_order returning * into o;
  return o;
end $$;
revoke all on function public.begin_checkout(uuid,boolean) from public;
grant execute on function public.begin_checkout(uuid,boolean) to authenticated;

drop function public.apply_payment(text,uuid,bigint,text,text);
create function public.apply_payment(p_event text,p_order uuid,p_amount bigint,p_currency text,p_provider text,p_is_test boolean)
returns boolean language plpgsql security definer set search_path='' as $$
declare o public.orders;
begin
  select * into o from public.orders where id=p_order for update;
  if not found or o.source<>'stripe' or o.is_test is distinct from p_is_test or o.amount_minor<>p_amount or lower(p_currency)<>'czk' or o.status='cancelled' then raise exception 'Payment mismatch'; end if;
  insert into public.webhook_events(id,provider) values(p_event,'stripe') on conflict(id) do nothing;
  if not found then return false; end if;
  update public.orders set status='paid',provider_id=p_provider,paid_at=now() where id=p_order and status='pending';
  return true;
end $$;
revoke all on function public.apply_payment(text,uuid,bigint,text,text,boolean) from public;
grant execute on function public.apply_payment(text,uuid,bigint,text,text,boolean) to service_role;

drop function public.apply_refund(text,uuid,bigint);
create function public.apply_refund(p_event text,p_order uuid,p_refunded bigint,p_is_test boolean) returns void language plpgsql security definer set search_path='' as $$
declare o public.orders;
begin
  select * into o from public.orders where id=p_order for update;
  if not found or o.source<>'stripe' or o.is_test is distinct from p_is_test or p_refunded<0 or p_refunded>o.amount_minor then raise exception 'Refund mismatch'; end if;
  insert into public.webhook_events(id,provider) values(p_event,'stripe') on conflict(id) do nothing;
  if not found then return; end if;
  update public.orders set refunded_minor=greatest(refunded_minor,p_refunded),
    status=case when p_refunded=amount_minor then 'refunded' else status end where id=p_order;
end $$;
revoke all on function public.apply_refund(text,uuid,bigint,boolean) from public;
grant execute on function public.apply_refund(text,uuid,bigint,boolean) to service_role;

drop function public.apply_stripe_invoice(jsonb,bigint);
create function public.apply_stripe_invoice(p_invoice jsonb,p_created bigint,p_is_test boolean) returns void
language plpgsql security definer set search_path='' as $$
declare o public.orders;
begin
  select * into o from public.orders where id=(p_invoice->>'order_id')::uuid for update;
  if not found or o.source<>'stripe' or o.is_test is distinct from p_is_test then raise exception 'Invoice mode mismatch'; end if;
  insert into public.stripe_invoices(id,order_id,number,status,amount_minor,tax_minor,currency,hosted_url,pdf_url,event_created,is_test)
  values(p_invoice->>'id',(p_invoice->>'order_id')::uuid,p_invoice->>'number',p_invoice->>'status',
    (p_invoice->>'amount_minor')::bigint,(p_invoice->>'tax_minor')::bigint,p_invoice->>'currency',p_invoice->>'hosted_url',p_invoice->>'pdf_url',p_created,p_is_test)
  on conflict(id) do update set number=excluded.number,status=excluded.status,amount_minor=excluded.amount_minor,
    tax_minor=excluded.tax_minor,hosted_url=excluded.hosted_url,pdf_url=excluded.pdf_url,event_created=excluded.event_created,updated_at=now()
    where excluded.event_created>=public.stripe_invoices.event_created
      and excluded.order_id=public.stripe_invoices.order_id and excluded.is_test=public.stripe_invoices.is_test;
end $$;
revoke all on function public.apply_stripe_invoice(jsonb,bigint,boolean) from public;
grant execute on function public.apply_stripe_invoice(jsonb,bigint,boolean) to service_role;

create or replace function public.business_summary() returns jsonb language sql stable security invoker set search_path='' as $$
  select jsonb_build_object(
    'revenue',coalesce((select sum(amount_minor-refunded_minor) from public.orders where status='paid' and not is_test),0),
    'month_revenue',coalesce((select sum(amount_minor-refunded_minor) from public.orders where status='paid' and not is_test and paid_at>=date_trunc('month',now() at time zone 'Europe/Prague') at time zone 'Europe/Prague'),0),
    'pending',(select count(*) from public.orders where status='pending' and not is_test),
    'clients',(select count(*) from public.clients),
    'bookings',(select count(*) from public.bookings where status='accepted' and starts_at>now())
  );
$$;
revoke all on function public.business_summary() from public;
grant execute on function public.business_summary() to authenticated;

insert into public.admin_backend_versions(version) values('202610150002');
notify pgrst, 'reload schema';
