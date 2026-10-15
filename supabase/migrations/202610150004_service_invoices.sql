-- Direct service invoicing is atomic; failed invoice validation leaves no orphan order.
alter table public.orders add column service_details text not null default '' check(length(service_details)<=5000);
alter table public.invoices add column service_details text not null default '' check(length(service_details)<=5000);

create or replace function public.issue_invoice(p_order uuid, p_tax_rate numeric default 0, p_supply_date date default null,p_due_date date default null)
returns public.invoices language plpgsql security definer set search_path = '' as $$
declare o public.orders; c public.clients; b public.business_settings; inv public.invoices;
  issued date := (now() at time zone 'Europe/Prague')::date; yr integer; seq integer; net bigint;
begin
  if not public.is_admin() then raise exception 'Admin + MFA required' using errcode='42501'; end if;
  select * into o from public.orders where id=p_order for update;
  if not found or o.status in ('cancelled','refunded') then raise exception 'Order is not billable'; end if;
  if o.source='stripe' then raise exception 'Use the Stripe invoice for this order'; end if;
  select * into inv from public.invoices where order_id=p_order;
  if found then return inv; end if;
  select * into c from public.clients where id=o.client_id;
  select * into b from public.business_settings where id=true;
  if length(trim(b.legal_name))=0 or b.ico !~ '^[0-9]{8}$' or length(trim(b.address))=0
    or length(trim(b.bank_account))=0 or b.vat_registered is null or length(trim(c.address))=0
    or (b.vat_registered and length(trim(b.vat_id))=0) then raise exception 'Complete billing identities and VAT status first'; end if;
  if p_tax_rate is null or p_tax_rate not in (0,12,21) or (not b.vat_registered and p_tax_rate<>0) then raise exception 'Invalid VAT rate'; end if;
  if b.vat_registered and p_supply_date is null then raise exception 'Supply date required for VAT invoice'; end if;
  if p_due_date is not null and p_due_date<issued then raise exception 'Due date cannot precede issue date'; end if;
  yr := extract(year from issued);
  insert into public.invoice_counters(year,value) values(yr,1)
    on conflict(year) do update set value=public.invoice_counters.value+1 returning value into seq;
  net := round(o.amount_minor/(1+p_tax_rate/100.0));
  insert into public.invoices(order_id,number,issue_date,due_date,supply_date,supplier,recipient,description,service_details,amount_minor,net_minor,tax_minor,tax_rate)
    values(o.id,yr::text||lpad(seq::text,greatest(5,length(seq::text)),'0'),issued,coalesce(p_due_date,issued+14),p_supply_date,to_jsonb(b),to_jsonb(c),o.description,o.service_details,o.amount_minor,net,o.amount_minor-net,p_tax_rate)
    returning * into inv;
  return inv;
end $$;
revoke all on function public.issue_invoice(uuid,numeric,date,date) from public;
grant execute on function public.issue_invoice(uuid,numeric,date,date) to authenticated;

create function public.issue_service_invoice(
  p_request uuid,p_client uuid,p_name text,p_details text,p_amount bigint,
  p_tax_rate numeric default 0,p_supply_date date default null,p_due_date date default null
) returns public.invoices language plpgsql security definer set search_path='' as $$
declare o public.orders;
begin
  if not public.is_admin() then raise exception 'Admin + MFA required' using errcode='42501'; end if;
  if p_request is null or p_client is null or p_name is null or length(trim(p_name))=0
    or p_details is null or p_amount is null then raise exception 'Complete service details first'; end if;
  insert into public.orders(id,client_id,description,service_details,amount_minor)
    values(p_request,p_client,trim(p_name),trim(p_details),p_amount) on conflict(id) do nothing;
  select * into o from public.orders where id=p_request for update;
  if o.client_id<>p_client or o.description<>trim(p_name) or o.service_details<>trim(p_details)
    or o.amount_minor<>p_amount or o.source<>'manual' or o.is_test
    then raise exception 'Invoice request mismatch'; end if;
  return public.issue_invoice(p_request,p_tax_rate,p_supply_date,p_due_date);
end $$;
revoke all on function public.issue_service_invoice(uuid,uuid,text,text,bigint,numeric,date,date) from public;
grant execute on function public.issue_service_invoice(uuid,uuid,text,text,bigint,numeric,date,date) to authenticated;

insert into public.admin_backend_versions(version) values('202610150004');
notify pgrst, 'reload schema';
