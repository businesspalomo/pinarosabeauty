import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from './database.service';

function compact(value?: string | null) {
  return (value || '').trim();
}
function skuPart(value: string, len = 4) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '').toUpperCase().slice(0, len) || 'GEN';
}

@Injectable()
export class CoreService {
  constructor(private readonly db: DatabaseService) {}

  async dashboard() {
    const [stock, orders, recent] = await Promise.all([
      this.db.query(`select coalesce(sum(physical_quantity),0)::int physical, coalesce(sum(reserved_quantity),0)::int reserved, coalesce(sum(physical_quantity-reserved_quantity),0)::int available from inventory_balance`),
      this.db.query(`select count(*)::int count from orders where status in ('PENDING_CONFIRMATION','CONFIRMED','PICKING','READY')`),
      this.db.query(`select sm.id, sm.created_at, sm.movement_type, sm.quantity, sm.stock_before, sm.stock_after, sm.reserved_before, sm.reserved_after,
        b.name brand, p.name product, pv.shade_name shade, pv.internal_sku sku, l.code location
        from stock_movements sm
        join product_variants pv on pv.id=sm.variant_id join products p on p.id=pv.product_id join brands b on b.id=p.brand_id join locations l on l.id=sm.location_id
        order by sm.created_at desc limit 12`),
    ]);
    return { stock: stock.rows[0], pendingOrders: orders.rows[0].count, recentMovements: recent.rows };
  }

  async metadata(brand?: string) {
    const [categories, locations, brands, lines] = await Promise.all([
      this.db.query(`select c.id,c.name,c.example, coalesce(json_agg(json_build_object('id',s.id,'name',s.name,'example',s.example) order by s.name) filter (where s.id is not null),'[]') subcategories from categories c join brands b on b.id=c.brand_id left join subcategories s on s.category_id=c.id and s.active=true where c.active=true and b.name=$1 group by c.id order by c.name`, [brand || null]),
      this.db.query(`select id,code,name,description from locations where active=true order by code`),
      this.db.query(`select id,name from brands where active=true order by name`),
      this.db.query<{ category_id: string; subcategory_id: string | null; name: string }>(`select category_id,subcategory_id,name from product_lines where active=true order by name`),
    ]);
    const categoryLines = new Map<string, string[]>();
    const subcategoryLines = new Map<string, string[]>();
    for (const l of lines.rows) {
      const map = l.subcategory_id ? subcategoryLines : categoryLines;
      const key = l.subcategory_id || l.category_id;
      const arr = map.get(key) || [];
      arr.push(l.name);
      map.set(key, arr);
    }
    const categoriesWithLines = categories.rows.map((c: any) => ({
      ...c,
      lines: categoryLines.get(c.id) || [],
      subcategories: c.subcategories.map((s: any) => ({ ...s, lines: subcategoryLines.get(s.id) || [] })),
    }));
    return { categories: categoriesWithLines, locations: locations.rows, brands: brands.rows };
  }

  async listProducts(search = '') {
    const q = `%${search.trim()}%`;
    const r = await this.db.query(`select pv.id variant_id,p.id product_id,b.name brand,p.line,p.name product,pv.shade_name shade,pv.presentation,pv.size_value,pv.size_unit,pv.internal_sku sku,
      pv.cost_ars::float cost_ars,pv.wholesale_price::float wholesale_price,pv.low_stock_threshold,
      bc.barcode, c.name category, sc.name subcategory,
      coalesce(sum(ib.physical_quantity),0)::int physical,coalesce(sum(ib.reserved_quantity),0)::int reserved,coalesce(sum(ib.physical_quantity-ib.reserved_quantity),0)::int available,
      (select pi.url from product_images pi where pi.variant_id=pv.id order by pi.is_primary desc,pi.created_at asc limit 1) image_url
      from product_variants pv join products p on p.id=pv.product_id join brands b on b.id=p.brand_id
      left join categories c on c.id=p.category_id left join subcategories sc on sc.id=p.subcategory_id
      left join barcodes bc on bc.variant_id=pv.id and bc.is_primary=true left join inventory_balance ib on ib.variant_id=pv.id
      where pv.active=true and p.active=true and ($1='' or b.name ilike $2 or p.name ilike $2 or coalesce(p.line,'') ilike $2 or coalesce(pv.shade_name,'') ilike $2 or pv.internal_sku ilike $2 or coalesce(bc.barcode,'') ilike $2)
      group by pv.id,p.id,b.name,p.line,p.name,pv.shade_name,pv.presentation,pv.size_value,pv.size_unit,pv.internal_sku,pv.cost_ars,pv.wholesale_price,pv.low_stock_threshold,bc.barcode,c.name,sc.name
      order by b.name,p.name,pv.shade_name nulls first`, [search.trim(), q]);
    return r.rows;
  }

  async shadeSuggestions(brand: string, product: string) {
    const r = await this.db.query<{ shade: string }>(`select distinct pv.shade_name shade from product_variants pv join products p on p.id=pv.product_id join brands b on b.id=p.brand_id where lower(b.name)=lower($1) and lower(p.name)=lower($2) and pv.shade_name is not null and pv.shade_name<>'' order by 1`, [brand, product]);
    return r.rows.map(x => x.shade);
  }

  async createProduct(input: any, userId: string) {
    const required = ['brand','product','barcode','category','subcategory'];
    for (const key of required) if (!compact(input[key])) throw new BadRequestException(`Falta ${key}`);
    return this.db.transaction(async c => {
      const brand = await c.query(`insert into brands(name) values($1) on conflict(name) do update set name=excluded.name returning id`, [compact(input.brand)]);
      const cat = await c.query(`insert into categories(brand_id,name,example) values($1,$2,$3) on conflict(brand_id,name) do update set example=coalesce(excluded.example,categories.example) returning id`, [brand.rows[0].id, compact(input.category), compact(input.categoryExample) || null]);
      const sub = await c.query(`insert into subcategories(category_id,name,example) values($1,$2,$3) on conflict(category_id,name) do update set example=coalesce(excluded.example,subcategories.example) returning id`, [cat.rows[0].id, compact(input.subcategory), compact(input.subcategoryExample) || null]);
      const prod = await c.query(`insert into products(brand_id,category_id,subcategory_id,line,name,description) values($1,$2,$3,$4,$5,$6)
        on conflict(brand_id,name,line) do update set category_id=excluded.category_id,subcategory_id=excluded.subcategory_id,description=coalesce(excluded.description,products.description),updated_at=now() returning id`,
        [brand.rows[0].id,cat.rows[0].id,sub.rows[0].id,compact(input.line)||null,compact(input.product),compact(input.description)||null]);
      let sku = compact(input.sku);
      if (!sku) {
        const base = `${skuPart(input.brand,3)}-${skuPart(input.line || input.product,4)}-${skuPart(input.shade || input.presentation || 'STD',5)}`;
        sku = `${base}-${String(input.barcode).slice(-4)}`;
      }
      const variant = await c.query(`insert into product_variants(product_id,shade_name,shade_code,presentation,size_value,size_unit,internal_sku,cost_ars,wholesale_price,low_stock_threshold)
        values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id`,
        [prod.rows[0].id,compact(input.shade)||null,compact(input.shadeCode)||null,compact(input.presentation)||null,input.sizeValue||null,compact(input.sizeUnit)||null,sku,input.costArs||null,input.wholesalePrice||0,input.lowStockThreshold??5]);
      await c.query(`insert into barcodes(variant_id,barcode,is_primary) values($1,$2,true)`, [variant.rows[0].id, compact(input.barcode)]);
      if (compact(input.imageUrl)) await c.query(`insert into product_images(variant_id,url,is_primary) values($1,$2,true)`, [variant.rows[0].id, compact(input.imageUrl)]);
      if ((Number(input.initialQuantity)||0) > 0) {
        const locationCode = compact(input.locationCode) || 'RECEPCION';
        const loc = await c.query(`select id from locations where code=$1`, [locationCode]);
        if (!loc.rowCount) throw new BadRequestException(`Ubicación ${locationCode} no existe`);
        await c.query(`insert into inventory_balance(variant_id,location_id,physical_quantity,reserved_quantity) values($1,$2,$3,0) on conflict(variant_id,location_id) do update set physical_quantity=inventory_balance.physical_quantity+excluded.physical_quantity,updated_at=now()`, [variant.rows[0].id,loc.rows[0].id,Number(input.initialQuantity)]);
        await c.query(`insert into stock_movements(variant_id,location_id,movement_type,quantity,stock_before,stock_after,reserved_before,reserved_after,reference_type,user_id,reason) values($1,$2,'ADJUSTMENT',$3,0,$3,0,0,'PRODUCT_CREATE',$4,'Stock inicial')`, [variant.rows[0].id,loc.rows[0].id,Number(input.initialQuantity),userId]);
      }
      await c.query(`insert into audit_log(user_id,action,entity_type,entity_id,new_value) values($1,'CREATE','PRODUCT_VARIANT',$2,$3::jsonb)`, [userId,variant.rows[0].id,JSON.stringify({ sku, barcode: input.barcode })]);
      return { id: variant.rows[0].id, sku };
    });
  }

  async listCustomers(search='') {
    const q=`%${search.trim()}%`;
    const r=await this.db.query(`select * from customers where ($1='' or name ilike $2 or coalesce(business_name,'') ilike $2 or coalesce(phone,'') ilike $2 or coalesce(instagram,'') ilike $2) order by name limit 200`,[search.trim(),q]);
    return r.rows;
  }
  async createCustomer(input:any,userId:string){
    if(!compact(input.name)) throw new BadRequestException('Nombre obligatorio');
    const r=await this.db.query(`insert into customers(name,business_name,phone,email,instagram,address,city,province,notes) values($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *`,[compact(input.name),compact(input.businessName)||null,compact(input.phone)||null,compact(input.email)||null,compact(input.instagram)||null,compact(input.address)||null,compact(input.city)||null,compact(input.province)||null,compact(input.notes)||null]);
    await this.db.query(`insert into audit_log(user_id,action,entity_type,entity_id,new_value) values($1,'CREATE','CUSTOMER',$2,$3::jsonb)`,[userId,r.rows[0].id,JSON.stringify(r.rows[0])]);
    return r.rows[0];
  }

  async startReceiving(input:any,userId:string){
    const r=await this.db.query(`insert into receiving_sessions(reference,supplier,user_id) values($1,$2,$3) returning *`,[compact(input.reference)||null,compact(input.supplier)||null,userId]);
    return r.rows[0];
  }
  async receivingProgress(id:string){
    const s=await this.db.query(`select * from receiving_sessions where id=$1`,[id]);
    if(!s.rowCount) throw new NotFoundException('Recepción no encontrada');
    const rows=await this.db.query(`select ri.quantity,b.name brand,p.name product,pv.shade_name shade,pv.internal_sku sku,l.code location from receiving_items ri join product_variants pv on pv.id=ri.variant_id join products p on p.id=pv.product_id join brands b on b.id=p.brand_id join locations l on l.id=ri.location_id where ri.receiving_session_id=$1 order by b.name,p.name,pv.shade_name`,[id]);
    const totals=await this.db.query(`select coalesce(sum(quantity),0)::int units,count(distinct pv.product_id)::int models,count(distinct ri.variant_id)::int variants from receiving_items ri join product_variants pv on pv.id=ri.variant_id where receiving_session_id=$1`,[id]);
    return {session:s.rows[0],totals:totals.rows[0],items:rows.rows};
  }
  async receiveScan(sessionId:string,barcode:string,locationCode:string,userId:string){
    return this.db.transaction(async c=>{
      const session=await c.query(`select * from receiving_sessions where id=$1 for update`,[sessionId]);
      if(!session.rowCount) throw new NotFoundException('Recepción no encontrada');
      if(session.rows[0].status!=='OPEN') throw new ConflictException('La recepción está cerrada');
      const found=await c.query(`select pv.id variant_id,pv.internal_sku,b.name brand,p.name product,pv.shade_name shade from barcodes bc join product_variants pv on pv.id=bc.variant_id join products p on p.id=pv.product_id join brands b on b.id=p.brand_id where bc.barcode=$1 and pv.active=true`,[barcode]);
      if(!found.rowCount) return {ok:false,code:'UNKNOWN_BARCODE',barcode};
      const loc=await c.query(`select id,code from locations where code=$1 and active=true`,[locationCode]);
      if(!loc.rowCount) throw new BadRequestException('Ubicación inválida');
      const v=found.rows[0]; const locationId=loc.rows[0].id;
      await c.query(`insert into inventory_balance(variant_id,location_id,physical_quantity,reserved_quantity) values($1,$2,0,0) on conflict do nothing`,[v.variant_id,locationId]);
      const bal=await c.query(`select * from inventory_balance where variant_id=$1 and location_id=$2 for update`,[v.variant_id,locationId]);
      const before=Number(bal.rows[0].physical_quantity), reserved=Number(bal.rows[0].reserved_quantity), after=before+1;
      await c.query(`update inventory_balance set physical_quantity=$3,updated_at=now() where variant_id=$1 and location_id=$2`,[v.variant_id,locationId,after]);
      await c.query(`insert into receiving_items(receiving_session_id,variant_id,location_id,quantity) values($1,$2,$3,1) on conflict(receiving_session_id,variant_id,location_id) do update set quantity=receiving_items.quantity+1,updated_at=now()`,[sessionId,v.variant_id,locationId]);
      await c.query(`insert into stock_movements(variant_id,location_id,movement_type,quantity,stock_before,stock_after,reserved_before,reserved_after,reference_type,reference_id,user_id,reason) values($1,$2,'RECEIPT',1,$3,$4,$5,$5,'RECEIVING',$6,$7,'Escaneo de recepción')`,[v.variant_id,locationId,before,after,reserved,sessionId,userId]);
      const totals=await c.query(`select coalesce(sum(quantity),0)::int units,count(distinct pv.product_id)::int models,count(distinct ri.variant_id)::int variants from receiving_items ri join product_variants pv on pv.id=ri.variant_id where receiving_session_id=$1`,[sessionId]);
      return {ok:true,product:v,totals:totals.rows[0]};
    });
  }
  async completeReceiving(id:string,userId:string){
    const r=await this.db.query(`update receiving_sessions set status='COMPLETED',completed_at=now() where id=$1 and status='OPEN' returning *`,[id]);
    if(!r.rowCount) throw new ConflictException('No se pudo cerrar la recepción');
    await this.db.query(`insert into audit_log(user_id,action,entity_type,entity_id,new_value) values($1,'COMPLETE','RECEIVING',$2,$3::jsonb)`,[userId,id,JSON.stringify(r.rows[0])]);
    return r.rows[0];
  }

  async listOrders(){
    const r=await this.db.query(`select o.*,c.name customer_name,coalesce(sum(oi.quantity),0)::int units from orders o left join customers c on c.id=o.customer_id left join order_items oi on oi.order_id=o.id group by o.id,c.name order by o.created_at desc limit 200`);
    return r.rows;
  }
  async getOrder(id:string){
    const o=await this.db.query(`select o.*,c.name customer_name,c.phone,c.instagram from orders o left join customers c on c.id=o.customer_id where o.id=$1`,[id]);
    if(!o.rowCount) throw new NotFoundException('Pedido no encontrado');
    const items=await this.db.query(`select oi.*,b.name brand,p.name product,pv.shade_name shade,pv.internal_sku sku,bc.barcode,
      coalesce((select sum(r.quantity) from reservations r where r.order_id=oi.order_id and r.variant_id=oi.variant_id and r.status='ACTIVE'),0)::int reserved,
      coalesce((select sum(psc.quantity) from picking_sessions ps join picking_scans psc on psc.picking_session_id=ps.id where ps.order_id=oi.order_id and psc.variant_id=oi.variant_id),0)::int picked,
      coalesce((select string_agg(l.code || ' ×' || r.quantity, ', ' order by l.code) from reservations r join locations l on l.id=r.location_id where r.order_id=oi.order_id and r.variant_id=oi.variant_id and r.status='ACTIVE'),'') locations
      from order_items oi join product_variants pv on pv.id=oi.variant_id join products p on p.id=pv.product_id join brands b on b.id=p.brand_id left join barcodes bc on bc.variant_id=pv.id and bc.is_primary=true where oi.order_id=$1 order by b.name,p.name,pv.shade_name`,[id]);
    return {...o.rows[0],items:items.rows};
  }
  async createOrder(input:any,userId:string){
    if(!input.customerId) throw new BadRequestException('Seleccioná un cliente');
    if(!Array.isArray(input.items)||!input.items.length) throw new BadRequestException('El pedido está vacío');
    return this.db.transaction(async c=>{
      const num=await c.query(`select 'PED-' || lpad(nextval('order_number_seq')::text,6,'0') order_number`);
      const order=await c.query(`insert into orders(order_number,customer_id,status,channel,notes,created_by) values($1,$2,'PENDING_CONFIRMATION',$3,$4,$5) returning *`,[num.rows[0].order_number,input.customerId,compact(input.channel)||'WhatsApp',compact(input.notes)||null,userId]);
      let subtotal=0;
      for(const item of input.items){
        const v=await c.query(`select wholesale_price from product_variants where id=$1 and active=true`,[item.variantId]);
        if(!v.rowCount) throw new BadRequestException('Producto inválido');
        const qty=Math.max(1,Number(item.quantity)||1),price=Number(v.rows[0].wholesale_price),line=qty*price; subtotal+=line;
        await c.query(`insert into order_items(order_id,variant_id,quantity,unit_price,subtotal) values($1,$2,$3,$4,$5)`,[order.rows[0].id,item.variantId,qty,price,line]);
      }
      await c.query(`update orders set subtotal=$2,total=$2,updated_at=now() where id=$1`,[order.rows[0].id,subtotal]);
      await c.query(`insert into audit_log(user_id,action,entity_type,entity_id,new_value) values($1,'CREATE','ORDER',$2,$3::jsonb)`,[userId,order.rows[0].id,JSON.stringify({orderNumber:num.rows[0].order_number,subtotal})]);
      return this.getOrderWithClient(c,order.rows[0].id);
    });
  }
  private async getOrderWithClient(c:PoolClient,id:string){
    const r=await c.query(`select o.*,c.name customer_name from orders o left join customers c on c.id=o.customer_id where o.id=$1`,[id]); return r.rows[0];
  }
  async confirmOrder(id:string,userId:string){
    return this.db.transaction(async c=>{
      const order=await c.query(`select * from orders where id=$1 for update`,[id]);
      if(!order.rowCount) throw new NotFoundException('Pedido no encontrado');
      if(order.rows[0].status!=='PENDING_CONFIRMATION'&&order.rows[0].status!=='DRAFT') throw new ConflictException('El pedido ya fue confirmado');
      const items=await c.query(`select * from order_items where order_id=$1 order by id`,[id]);
      for(const item of items.rows){
        let needed=Number(item.quantity);
        const balances=await c.query(`select ib.*,l.code from inventory_balance ib join locations l on l.id=ib.location_id where ib.variant_id=$1 and (ib.physical_quantity-ib.reserved_quantity)>0 order by l.code for update of ib`,[item.variant_id]);
        const available=balances.rows.reduce((s:any,b:any)=>s+Number(b.physical_quantity)-Number(b.reserved_quantity),0);
        if(available<needed) throw new ConflictException(`Stock insuficiente para un producto. Necesario ${needed}, disponible ${available}.`);
        for(const bal of balances.rows){
          if(needed<=0) break;
          const free=Number(bal.physical_quantity)-Number(bal.reserved_quantity), take=Math.min(free,needed), before=Number(bal.reserved_quantity), after=before+take;
          if(take<=0) continue;
          await c.query(`update inventory_balance set reserved_quantity=$3,updated_at=now() where id=$1 and variant_id=$2`,[bal.id,item.variant_id,after]);
          await c.query(`insert into reservations(order_id,variant_id,location_id,quantity,status) values($1,$2,$3,$4,'ACTIVE')`,[id,item.variant_id,bal.location_id,take]);
          await c.query(`insert into stock_movements(variant_id,location_id,movement_type,quantity,stock_before,stock_after,reserved_before,reserved_after,reference_type,reference_id,user_id,reason) values($1,$2,'RESERVATION',$3,$4,$4,$5,$6,'ORDER',$7,$8,'Reserva al confirmar pedido')`,[item.variant_id,bal.location_id,take,Number(bal.physical_quantity),before,after,id,userId]);
          needed-=take;
        }
      }
      await c.query(`update orders set status='CONFIRMED',updated_at=now() where id=$1`,[id]);
      await c.query(`insert into audit_log(user_id,action,entity_type,entity_id,new_value) values($1,'CONFIRM','ORDER',$2,$3::jsonb)`,[userId,id,JSON.stringify({status:'CONFIRMED'})]);
      return this.getOrderWithClient(c,id);
    });
  }

  async startPicking(orderId:string,userId:string){
    return this.db.transaction(async c=>{
      const o=await c.query(`select * from orders where id=$1 for update`,[orderId]);
      if(!o.rowCount) throw new NotFoundException('Pedido no encontrado');
      if(!['CONFIRMED','PICKING','READY'].includes(o.rows[0].status)) throw new ConflictException('Primero confirmá el stock del pedido');
      const ps=await c.query(`insert into picking_sessions(order_id,user_id,status) values($1,$2,'OPEN') on conflict(order_id) do update set user_id=excluded.user_id returning *`,[orderId,userId]);
      if(o.rows[0].status==='CONFIRMED') await c.query(`update orders set status='PICKING',updated_at=now() where id=$1`,[orderId]);
      return ps.rows[0];
    });
  }
  async pickingProgress(orderId:string){
    return this.getOrder(orderId);
  }
  async pickScan(orderId:string,barcode:string,userId:string){
    return this.db.transaction(async c=>{
      const ps=await c.query(`select ps.*,o.status from picking_sessions ps join orders o on o.id=ps.order_id where ps.order_id=$1 for update of ps`,[orderId]);
      if(!ps.rowCount) throw new ConflictException('Iniciá el picking');
      if(ps.rows[0].status!=='OPEN') throw new ConflictException('El picking ya está cerrado');
      const v=await c.query(`select pv.id variant_id,pv.internal_sku,b.name brand,p.name product,pv.shade_name shade from barcodes bc join product_variants pv on pv.id=bc.variant_id join products p on p.id=pv.product_id join brands b on b.id=p.brand_id where bc.barcode=$1`,[barcode]);
      if(!v.rowCount) return {ok:false,code:'UNKNOWN_BARCODE',barcode};
      const item=await c.query(`select quantity from order_items where order_id=$1 and variant_id=$2`,[orderId,v.rows[0].variant_id]);
      if(!item.rowCount) throw new ConflictException('Este producto no pertenece al pedido');
      const picked=await c.query(`select coalesce(sum(psc.quantity),0)::int qty from picking_scans psc join picking_sessions ps on ps.id=psc.picking_session_id where ps.order_id=$1 and psc.variant_id=$2`,[orderId,v.rows[0].variant_id]);
      if(Number(picked.rows[0].qty)>=Number(item.rows[0].quantity)) throw new ConflictException('Ya completaste la cantidad de este producto');
      await c.query(`insert into picking_scans(picking_session_id,variant_id,barcode,quantity,user_id) values($1,$2,$3,1,$4)`,[ps.rows[0].id,v.rows[0].variant_id,barcode,userId]);
      const check=await c.query(`select bool_and(coalesce(picked,0)>=quantity) complete from (select oi.quantity,(select coalesce(sum(psc.quantity),0) from picking_scans psc join picking_sessions ps2 on ps2.id=psc.picking_session_id where ps2.order_id=oi.order_id and psc.variant_id=oi.variant_id) picked from order_items oi where oi.order_id=$1) x`,[orderId]);
      const complete=Boolean(check.rows[0].complete);
      if(complete){ await c.query(`update picking_sessions set status='COMPLETED',completed_at=now() where id=$1`,[ps.rows[0].id]); await c.query(`update orders set status='READY',updated_at=now() where id=$1`,[orderId]); }
      return {ok:true,product:v.rows[0],complete};
    });
  }
  async dispatchOrder(id:string,userId:string){
    return this.db.transaction(async c=>{
      const order=await c.query(`select * from orders where id=$1 for update`,[id]);
      if(!order.rowCount) throw new NotFoundException('Pedido no encontrado');
      if(order.rows[0].status!=='READY') throw new ConflictException('El picking todavía no está completo');
      const reservations=await c.query(`select r.*,ib.physical_quantity,ib.reserved_quantity from reservations r join inventory_balance ib on ib.variant_id=r.variant_id and ib.location_id=r.location_id where r.order_id=$1 and r.status='ACTIVE' for update of ib,r`,[id]);
      for(const r of reservations.rows){
        const phys=Number(r.physical_quantity),res=Number(r.reserved_quantity),qty=Number(r.quantity);
        if(phys<qty||res<qty) throw new ConflictException('Inconsistencia de stock detectada');
        await c.query(`update inventory_balance set physical_quantity=$3,reserved_quantity=$4,updated_at=now() where variant_id=$1 and location_id=$2`,[r.variant_id,r.location_id,phys-qty,res-qty]);
        await c.query(`update reservations set status='CONSUMED',released_at=now() where id=$1`,[r.id]);
        await c.query(`insert into stock_movements(variant_id,location_id,movement_type,quantity,stock_before,stock_after,reserved_before,reserved_after,reference_type,reference_id,user_id,reason) values($1,$2,'SALE',$3,$4,$5,$6,$7,'ORDER',$8,$9,'Despacho confirmado')`,[r.variant_id,r.location_id,-qty,phys,phys-qty,res,res-qty,id,userId]);
      }
      await c.query(`update orders set status='DISPATCHED',updated_at=now() where id=$1`,[id]);
      await c.query(`insert into audit_log(user_id,action,entity_type,entity_id,new_value) values($1,'DISPATCH','ORDER',$2,$3::jsonb)`,[userId,id,JSON.stringify({status:'DISPATCHED'})]);
      return this.getOrderWithClient(c,id);
    });
  }

  async movements(){
    const r=await this.db.query(`select sm.*,b.name brand,p.name product,pv.shade_name shade,pv.internal_sku sku,l.code location,u.name user_name from stock_movements sm join product_variants pv on pv.id=sm.variant_id join products p on p.id=pv.product_id join brands b on b.id=p.brand_id join locations l on l.id=sm.location_id left join app_users u on u.id=sm.user_id order by sm.created_at desc limit 500`);return r.rows;
  }
  async catalog(){
    const r=await this.db.query(`select b.name brand,p.name product,p.line,pv.id variant_id,pv.shade_name shade,pv.presentation,pv.internal_sku sku,pv.wholesale_price::float price,coalesce(sum(ib.physical_quantity-ib.reserved_quantity),0)::int available,(select pi.url from product_images pi where pi.variant_id=pv.id order by pi.is_primary desc,pi.created_at limit 1) image_url from product_variants pv join products p on p.id=pv.product_id join brands b on b.id=p.brand_id left join inventory_balance ib on ib.variant_id=pv.id where p.active=true and pv.active=true group by pv.id,b.name,p.name,p.line,pv.shade_name,pv.presentation,pv.internal_sku,pv.wholesale_price order by b.name,p.name,pv.shade_name`);return r.rows;
  }
  async users(){ const r=await this.db.query(`select id,name,email,role,active,created_at from app_users order by name`); return r.rows; }
  async ensureUser(id:string,email:string,name:string){
    const r=await this.db.query(
      `insert into app_users (id,name,email) values ($1,$2,$3)
       on conflict (email) do update set id=excluded.id, updated_at=now()
       returning id,name,email,role,active`,
      [id,name,email],
    );
    return r.rows[0];
  }
}
