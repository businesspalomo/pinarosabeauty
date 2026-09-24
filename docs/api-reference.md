# Piña Rosa Inventory — Referencia de API y arquitectura

Documento para compartir con otro desarrollador que va a construir una app en paralelo, conectada a la misma base de datos.

## Stack

- **Frontend**: Next.js 16 + React 19 + TypeScript — `http://localhost:3001` en desarrollo
- **Backend / API**: NestJS + TypeScript — `http://localhost:4000/api` en desarrollo
- **Base de datos**: PostgreSQL 16 en **Supabase** (proyecto compartido — pedir credenciales aparte, no van en este documento)
- **Auth**: Supabase Auth (email + contraseña). El backend valida el JWT de Supabase en cada request.

## Cómo se conecta todo

```
Navegador → Next.js (3001) → NestJS API (4000) → PostgreSQL (Supabase)
                                     ↑
                          valida el JWT contra Supabase Auth
```

Cualquier app nueva que quiera compartir datos tiene dos formas de integrarse:
1. **Recomendado**: consumir la misma API REST de NestJS (ver endpoints abajo), reusando la lógica de negocio y transacciones ya escritas.
2. Conectarse directo a la base de Supabase (Postgres) — solo si necesita leer/escribir tablas que la API no expone. Requiere el `DATABASE_URL` del proyecto (pedirlo aparte, es sensible).

## Autenticación

Todos los endpoints requieren un header `Authorization: Bearer <access_token>`, excepto `GET /api/health`.

El `access_token` se obtiene logueándose contra Supabase Auth (`supabase.auth.signInWithPassword`) con el **Supabase URL** y **anon key** del proyecto (pedirlos aparte). El backend valida ese token contra Supabase en cada request y auto-provisiona el usuario en la tabla `app_users` la primera vez que loguea.

## Endpoints

Prefijo base: `/api`

| Método | Ruta | Descripción | Auth |
|---|---|---|---|
| GET | `/health` | Estado del servicio y la DB | Público |
| GET | `/auth/me` | Datos del usuario logueado (id, email, rol) | Sí |
| GET | `/dashboard` | Métricas generales (stock, pedidos activos, movimientos recientes) | Sí |
| GET | `/dashboard/metadata?brand=<nombre>` | Categorías/subcategorías/líneas de una marca, ubicaciones, marcas | Sí |
| GET | `/products?q=<texto>` | Buscar/listar variantes de producto con stock | Sí |
| GET | `/products/shade-suggestions?brand=&product=` | Tonos ya cargados para una marca+producto | Sí |
| POST | `/products` | Crear producto/variante nueva (marca, categoría, subcategoría, línea, tono, SKU, stock inicial) | Sí |
| GET | `/customers?q=<texto>` | Buscar/listar clientes | Sí |
| POST | `/customers` | Crear cliente | Sí |
| POST | `/receiving` | Iniciar sesión de recepción de mercadería | Sí |
| GET | `/receiving/:id` | Progreso de una recepción | Sí |
| POST | `/receiving/:id/scan` | Escanear un código de barras (recepción) | Sí |
| POST | `/receiving/:id/complete` | Cerrar la recepción | Sí |
| GET | `/orders` | Listar pedidos | Sí |
| GET | `/orders/:id` | Detalle de un pedido | Sí |
| POST | `/orders` | Crear pedido (no reserva stock todavía) | Sí |
| POST | `/orders/:id/confirm` | Confirmar stock: reserva transaccionalmente | Sí |
| POST | `/orders/:id/dispatch` | Despachar: descuenta físico, libera reserva | Sí |
| POST | `/picking/:orderId/start` | Iniciar picking de un pedido | Sí |
| GET | `/picking/:orderId` | Progreso de picking | Sí |
| POST | `/picking/:orderId/scan` | Escanear unidad durante picking | Sí |
| GET | `/movements` | Historial de movimientos de stock (auditoría) | Sí |
| GET | `/catalog` | Catálogo público con stock disponible por variante | Sí |
| GET | `/users` | Listar usuarios (`app_users`) | Sí |

## Modelo de datos

Ver [`database/schema.sql`](../database/schema.sql) para el DDL completo. Tablas principales:

- `app_users` — usuarios (vinculados 1:1 con Supabase Auth por `id`)
- `brands`, `categories`, `subcategories`, `product_lines` — taxonomía de catálogo (categorías/líneas son específicas por marca vía `categories.brand_id`)
- `products`, `product_variants`, `barcodes`, `product_images` — catálogo
- `inventory_balance` (balance rápido), `stock_movements` (historial inmutable) — inventario
- `customers`, `orders`, `order_items`, `reservations` — ventas
- `receiving_sessions`, `receiving_items`, `picking_sessions`, `picking_scans` — operación
- `audit_log` — auditoría de cambios

Regla clave (ver también [`architecture.md`](architecture.md)): el frontend nunca modifica stock directamente — todas las mutaciones pasan por la API con transacciones y `FOR UPDATE`.

## Qué pedir para integrarse

Para que la nueva app funcione en paralelo, quien la construya necesita (fuera de este documento, por canal seguro):
1. `SUPABASE_URL` y `SUPABASE_ANON_KEY` del proyecto (para loguear usuarios via Supabase Auth).
2. La URL de la API una vez desplegada (o un túnel temporal mientras se prueba en local).
3. Si necesita acceso directo a la base: el `DATABASE_URL` (connection string del pooler de Supabase).
