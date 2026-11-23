-- Only reference and inventory fields cross from the storefront to Trefil OS.
create schema if not exists trefil_exchange;
revoke all on schema trefil_exchange from public, anon, authenticated;
do $$
begin
  if not exists (select from pg_roles where rolname = 'trefil_inventory_reader') then
    create role trefil_inventory_reader nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls;
  end if;
end $$;
create or replace view trefil_exchange.offers as
select 'p:' || p.id as source_id, p.sku, p.name as product_name,
       null::text as variant_name, p.unit, p.stock::numeric as reported_stock,
       p."updatedAt" at time zone 'UTC' as updated_at
from public."Product" p
where p.status::text = 'PUBLISHED'
  and not exists (select 1 from public."Variant" v where v."productId"=p.id and v.active)
union all
select 'v:' || v.id, v.sku, p.name, v.name, p.unit, v.stock::numeric,
       greatest(v."updatedAt",p."updatedAt") at time zone 'UTC'
from public."Variant" v join public."Product" p on p.id=v."productId"
where v.active and p.status::text='PUBLISHED';
revoke all on trefil_exchange.offers from public, anon, authenticated;
grant usage on schema trefil_exchange to trefil_inventory_reader;
grant select on trefil_exchange.offers to trefil_inventory_reader;
