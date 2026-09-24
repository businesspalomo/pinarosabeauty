with b as (
  insert into brands(name) values ('Maybelline') on conflict(name) do update set name=excluded.name returning id
), c as (
  select id from categories where name='Maquillaje'
), s as (
  select sc.id from subcategories sc join categories c2 on c2.id=sc.category_id where c2.name='Maquillaje' and sc.name='Labios'
), p as (
  insert into products(brand_id,category_id,subcategory_id,line,name)
  select b.id,c.id,s.id,'Lifter Gloss','Maybelline Lifter Gloss' from b,c,s
  on conflict(brand_id,name,line) do update set name=excluded.name returning id
), v as (
  insert into product_variants(product_id,shade_name,internal_sku,wholesale_price,low_stock_threshold)
  select p.id,'Moon','MAY-LIF-MOON',14000,4 from p
  on conflict(internal_sku) do update set shade_name=excluded.shade_name returning id
), bc as (
  insert into barcodes(variant_id,barcode) select v.id,'779000000001' from v
  on conflict(barcode) do nothing
)
insert into inventory_balance(variant_id,location_id,physical_quantity,reserved_quantity)
select v.id,l.id,12,0 from v cross join locations l where l.code='B3'
on conflict(variant_id,location_id) do update set physical_quantity=greatest(inventory_balance.physical_quantity,12);

insert into customers(name,business_name,phone,instagram,city,province)
select 'Cliente Demo','Beauty Store Demo','1111111111','@beautydemo','CABA','Buenos Aires'
where not exists (select 1 from customers where name='Cliente Demo');
