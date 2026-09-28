-- Borra definitivamente los productos que se "eliminaron" con la versión anterior (v1.2.0 a v1.4.1).
-- Esa versión solo los ocultaba (active=false): siguen en la base y ocupan su código de barras y su SKU.
-- Hace lo mismo que "Eliminar producto" desde v1.5.0: los quita de los pedidos (recalculando totales)
-- y borra su historial de movimientos, recepciones y picking. No se puede deshacer.
-- Uso: Supabase → SQL Editor → pegar todo este archivo → Run. Al final muestra la lista de lo borrado.
begin;

create temp table hidden_variants on commit drop as
select pv.id, pv.product_id, b.name brand, p.name product, pv.shade_name shade, pv.internal_sku sku,
       (select bc.barcode from barcodes bc where bc.variant_id = pv.id and bc.is_primary limit 1) barcode
from product_variants pv
join products p on p.id = pv.product_id
join brands b on b.id = p.brand_id
where pv.active = false or p.active = false;

create temp table hidden_orders on commit drop as
select distinct order_id from order_items where variant_id in (select id from hidden_variants);

delete from picking_scans    where variant_id in (select id from hidden_variants);
delete from reservations     where variant_id in (select id from hidden_variants);
delete from order_items      where variant_id in (select id from hidden_variants);
delete from receiving_items  where variant_id in (select id from hidden_variants);
delete from stock_movements  where variant_id in (select id from hidden_variants);
delete from product_variants where id in (select id from hidden_variants);
delete from products p
where p.id in (select product_id from hidden_variants)
  and not exists (select 1 from product_variants pv where pv.product_id = p.id);

update orders o set subtotal = t.s, total = greatest(t.s - o.discount, 0), updated_at = now()
from (select h.order_id, coalesce(sum(oi.subtotal), 0) s
      from hidden_orders h left join order_items oi on oi.order_id = h.order_id
      group by h.order_id) t
where o.id = t.order_id;

insert into audit_log(action, entity_type, entity_id, old_value)
select 'DELETE', 'PRODUCT_VARIANT', id,
       jsonb_build_object('brand', brand, 'product', product, 'shade', shade, 'sku', sku, 'barcode', barcode, 'purge', 'hidden_products')
from hidden_variants;

select brand as marca, product as producto, shade as tono, sku, barcode as codigo_de_barras,
       (select count(*) from hidden_orders) as pedidos_recalculados
from hidden_variants
order by brand, product, shade;

commit;
