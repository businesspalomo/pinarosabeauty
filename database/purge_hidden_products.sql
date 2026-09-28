-- Borra definitivamente los productos que se "eliminaron" con la versión anterior (v1.2.0 a v1.4.1).
-- Esa versión solo los ocultaba (active=false): siguen en la base y ocupan su código de barras y su SKU.
-- Hace lo mismo que "Eliminar producto" desde v1.5.0: los quita de los pedidos (recalculando totales)
-- y borra su historial de movimientos, recepciones y picking. No se puede deshacer.
-- Uso: Supabase → SQL Editor → pegar todo este archivo → Run. Al final muestra la lista de lo borrado.
-- Todo el borrado es un solo bloque: si algo falla, no se borra nada.

do $$
declare
  variant_ids uuid[];
  product_ids uuid[];
  order_ids uuid[];
begin
  select array_agg(pv.id), array_agg(distinct pv.product_id)
    into variant_ids, product_ids
  from product_variants pv join products p on p.id = pv.product_id
  where pv.active = false or p.active = false;

  if variant_ids is null then
    raise notice 'No hay productos ocultos para borrar';
    return;
  end if;

  select array_agg(distinct order_id) into order_ids from order_items where variant_id = any(variant_ids);

  insert into audit_log(action, entity_type, entity_id, old_value)
  select 'DELETE', 'PRODUCT_VARIANT', pv.id,
         jsonb_build_object('brand', b.name, 'product', p.name, 'shade', pv.shade_name, 'sku', pv.internal_sku,
                            'barcode', (select bc.barcode from barcodes bc where bc.variant_id = pv.id and bc.is_primary limit 1),
                            'purge', 'hidden_products')
  from product_variants pv join products p on p.id = pv.product_id join brands b on b.id = p.brand_id
  where pv.id = any(variant_ids);

  delete from picking_scans    where variant_id = any(variant_ids);
  delete from reservations     where variant_id = any(variant_ids);
  delete from order_items      where variant_id = any(variant_ids);
  delete from receiving_items  where variant_id = any(variant_ids);
  delete from stock_movements  where variant_id = any(variant_ids);
  delete from product_variants where id = any(variant_ids);
  delete from products p
  where p.id = any(product_ids)
    and not exists (select 1 from product_variants pv where pv.product_id = p.id);

  update orders o
  set subtotal = coalesce((select sum(oi.subtotal) from order_items oi where oi.order_id = o.id), 0),
      total = greatest(coalesce((select sum(oi.subtotal) from order_items oi where oi.order_id = o.id), 0) - o.discount, 0),
      updated_at = now()
  where o.id = any(coalesce(order_ids, '{}'));
end $$;

-- Lista de lo borrado por este script (incluye ejecuciones anteriores, con su fecha).
select old_value->>'brand' as marca, old_value->>'product' as producto, old_value->>'shade' as tono,
       old_value->>'sku' as sku, old_value->>'barcode' as codigo_de_barras, created_at as borrado_el
from audit_log
where old_value->>'purge' = 'hidden_products'
order by created_at desc, marca, producto, tono;
