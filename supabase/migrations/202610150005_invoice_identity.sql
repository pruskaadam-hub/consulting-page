-- Invoice drafts save supplier, recipient, order and immutable document in one transaction.
alter table public.clients
  add column vat_registered boolean not null default false,
  add column first_name text not null default '' check(length(first_name)<=100),
  add column last_name text not null default '' check(length(last_name)<=100),
  add column company_name text not null default '' check(length(company_name)<=160),
  add column client_type text not null default 'person' check(client_type in ('person','company')),
  add column website text not null default '' check(length(website)<=500 and (website='' or website ~ '^https?://[^[:space:]]+$')),
  add column country_code text not null default '' check(country_code='' or country_code ~ '^[A-Z]{2}$');
update public.clients set vat_registered=true where vat_id<>'';
update public.clients set company_name=name,client_type='company' where ico<>'';
alter table public.business_settings
  add column registration text not null default '' check(length(registration)<=1000),
  add column brand_name text not null default 'Adam Pruška' check(length(brand_name)<=160),
  add column contact_email text not null default '' check(length(contact_email)<=254),
  add column contact_phone text not null default '' check(length(contact_phone)<=60),
  add column website text not null default 'https://adampruska.cz' check(length(website)<=500 and (website='' or website ~ '^https?://[^[:space:]]+$')),
  add column logo_style text not null default 'site' check(logo_style in ('site','original','none')),
  add column accent_color text not null default '#d7202b' check(accent_color ~ '^#[0-9a-fA-F]{6}$');
alter table public.invoices add column tax_note text not null default '' check(length(tax_note)<=1000);
create table public.invoice_requests (
  id uuid primary key,
  request_data jsonb not null,
  invoice_id uuid unique references public.invoices(id)
);
alter table public.invoice_requests enable row level security;
revoke all on public.invoice_requests from public,anon,authenticated;
grant all on public.invoice_requests to service_role;

create function public.issue_invoice_draft(p_request uuid,p_data jsonb) returns public.invoices
language plpgsql security definer set search_path='' as $$
declare r public.invoice_requests; c public.clients; b jsonb; v jsonb; o public.orders; inv public.invoices;
  c_name text; c_id uuid; tax numeric;
begin
  if not public.is_admin() then raise exception 'Admin + MFA required' using errcode='42501'; end if;
  if p_request is null or jsonb_typeof(p_data)<>'object' or pg_column_size(p_data)>30000 then raise exception 'Invalid invoice draft'; end if;
  insert into public.invoice_requests(id,request_data) values(p_request,p_data) on conflict(id) do nothing;
  select * into r from public.invoice_requests where id=p_request for update;
  if r.request_data<>p_data then raise exception 'Invoice request mismatch'; end if;
  if r.invoice_id is not null then select * into inv from public.invoices where id=r.invoice_id; return inv; end if;
  b:=p_data->'supplier'; v:=p_data->'recipient';
  if (b->>'vat_registered')::boolean and (p_data->>'tax_rate')::numeric=0 and coalesce(trim(p_data->>'tax_note'),'')='' then raise exception 'Tax exemption explanation required'; end if;
  if jsonb_typeof(b)<>'object' or jsonb_typeof(v)<>'object' then raise exception 'Complete billing identities'; end if;
  if coalesce(trim(b->>'registration'),'')='' then raise exception 'Supplier registration required'; end if;
  if coalesce(trim(v->>'address'),'')='' or coalesce(v->>'country_code','') !~ '^[A-Z]{2}$'
    or coalesce(v->>'email','') !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
    then raise exception 'Complete recipient address, country and email'; end if;
  if coalesce((v->>'vat_registered')::boolean,false) and coalesce(trim(v->>'vat_id'),'')='' then raise exception 'Recipient VAT ID required'; end if;
  if v->>'client_type'='company' then
    c_name:=trim(v->>'company_name');
    if coalesce(c_name,'')='' or (v->>'country_code'='CZ' and coalesce(v->>'ico','') !~ '^[0-9]{8}$') then raise exception 'Complete company identity'; end if;
  elsif v->>'client_type'='person' then
    if coalesce(trim(v->>'first_name'),'')='' or coalesce(trim(v->>'last_name'),'')='' then raise exception 'Complete recipient name'; end if;
    c_name:=trim(v->>'first_name')||' '||trim(v->>'last_name');
    v:=v||jsonb_build_object('company_name','','ico','');
  else raise exception 'Invalid recipient type'; end if;
  if nullif(p_data->>'order_id','') is not null then
    select * into o from public.orders where id=(p_data->>'order_id')::uuid for update;
    if not found or o.source<>'manual' or o.is_test or o.status in ('cancelled','refunded') then raise exception 'Order is not billable'; end if;
    if exists(select 1 from public.invoices where order_id=o.id) then raise exception 'Order already invoiced'; end if;
    if nullif(p_data->>'client_id','')::uuid is distinct from o.client_id then raise exception 'Recipient does not match order'; end if;
  end if;
  if nullif(p_data->>'client_id','') is null then
    insert into public.clients(name,email,address,ico,vat_id,first_name,last_name,company_name,client_type,website,country_code,vat_registered)
      values(c_name,lower(trim(v->>'email')),trim(v->>'address'),trim(coalesce(v->>'ico','')),trim(coalesce(v->>'vat_id','')),
        trim(coalesce(v->>'first_name','')),trim(coalesce(v->>'last_name','')),trim(coalesce(v->>'company_name','')),v->>'client_type',trim(coalesce(v->>'website','')),v->>'country_code',coalesce((v->>'vat_registered')::boolean,false)) returning id into c_id;
  else
    c_id:=(p_data->>'client_id')::uuid;
    update public.clients set name=c_name,email=lower(trim(v->>'email')),address=trim(v->>'address'),ico=trim(coalesce(v->>'ico','')),vat_id=trim(coalesce(v->>'vat_id','')),
      first_name=trim(coalesce(v->>'first_name','')),last_name=trim(coalesce(v->>'last_name','')),company_name=trim(coalesce(v->>'company_name','')),client_type=v->>'client_type',website=trim(coalesce(v->>'website','')),country_code=v->>'country_code',vat_registered=coalesce((v->>'vat_registered')::boolean,false) where id=c_id;
    if not found then raise exception 'Recipient not found'; end if;
  end if;
  update public.business_settings set legal_name=trim(b->>'legal_name'),ico=trim(b->>'ico'),address=trim(b->>'address'),bank_account=trim(b->>'bank_account'),
    vat_registered=(b->>'vat_registered')::boolean,vat_id=trim(coalesce(b->>'vat_id','')),invoice_note=coalesce(b->>'invoice_note',''),registration=trim(b->>'registration'),
    brand_name=trim(coalesce(b->>'brand_name','')),contact_email=trim(coalesce(b->>'contact_email','')),contact_phone=trim(coalesce(b->>'contact_phone','')),website=trim(coalesce(b->>'website','')),
    logo_style=coalesce(b->>'logo_style','site'),accent_color=coalesce(b->>'accent_color','#d7202b') where id=true;
  tax:=(p_data->>'tax_rate')::numeric;
  if o.id is null then
    inv:=public.issue_service_invoice(p_request,c_id,p_data->>'name',coalesce(p_data->>'details',''),(p_data->>'amount_minor')::bigint,tax,nullif(p_data->>'supply_date','')::date,(p_data->>'due_date')::date);
  else
    inv:=public.issue_invoice(o.id,tax,nullif(p_data->>'supply_date','')::date,(p_data->>'due_date')::date);
  end if;
  update public.invoices set tax_note=coalesce(p_data->>'tax_note','') where id=inv.id returning * into inv;
  update public.invoice_requests set invoice_id=inv.id where id=p_request;
  return inv;
end $$;
revoke all on function public.issue_invoice_draft(uuid,jsonb) from public;
grant execute on function public.issue_invoice_draft(uuid,jsonb) to authenticated;

insert into public.admin_backend_versions(version) values('202610150005');
notify pgrst, 'reload schema';
