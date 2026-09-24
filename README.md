# Piña Rosa Inventory — MVP técnico

MVP real de frontend + backend para el flujo mayorista validado.

## Stack
- Next.js + React + TypeScript (frontend dinámico)
- NestJS + TypeScript (API)
- PostgreSQL 16 (misma familia de base que Supabase)
- Lógica de pistola de código de barras en TypeScript
- Docker Compose para desarrollo y posterior despliegue en VPS

## Flujo implementado
1. Productos por variante/tono, SKU y barcode.
2. Clientes persistentes.
3. Recepción: cada escaneo suma +1 y contabiliza unidades/modelos/tonos.
4. Pedido: se crea sin reservar stock.
5. Confirmar stock / OK: reserva transaccionalmente.
6. Picking: escaneo obligatorio unidad por unidad, rechaza productos incorrectos o cantidades excedidas.
7. Despacho: descuenta stock físico y libera reserva.
8. Historial de movimientos y auditoría.
9. Catálogo con stock disponible exacto por tono.

## Arranque recomendado con Docker
1. Copiar `.env.example` a `.env` y cambiar la contraseña local.
2. `docker compose up --build`
3. Abrir `http://localhost:3000`
4. API: `http://localhost:4000/api/health`

La base se inicializa con categorías, ubicaciones, admin local y un producto demo con barcode `779000000001`.

## Sin Docker
Se requiere PostgreSQL 16. Ejecutar `database/schema.sql`, `database/seed.sql`, y opcional `database/demo.sql`; luego instalar dependencias en `backend/` y `frontend/`.

## Migración posterior a Supabase
No se cambia la lógica de negocio. Se reemplaza `DATABASE_URL` por el pooler/direct connection de Supabase, el usuario local por Supabase Auth y el futuro adaptador de imágenes por Supabase Storage.

## Seguridad actual
Esta entrega es para desarrollo local. El `DEV_USER_ID` evita bloquear el trabajo antes de conectar Auth. **No publicar en Internet con este modo de autenticación.** Antes de producción se incorpora Supabase Auth/JWT, secretos del servidor y HTTPS.
