# Arquitectura Piña Rosa V1

## Regla de consistencia
El frontend nunca modifica stock. Todas las mutaciones pasan por NestJS y las operaciones críticas usan transacciones PostgreSQL y bloqueos `FOR UPDATE`.

## Modelo de inventario
`inventory_balance` mantiene el balance rápido por `variant_id + location_id`.
`stock_movements` es el historial inmutable para auditoría.

Disponible = físico - reservado.

## Escáner
Los lectores USB/HID habituales emulan teclado. El hook `useBarcodeScanner` acumula caracteres enviados rápidamente y procesa el código al recibir Enter. La misma entrada se usa en Recepción y Picking; el contexto decide la operación backend.

## Reserva
Crear pedido no altera inventario. `POST /orders/:id/confirm` bloquea filas de balance, verifica disponibilidad y distribuye la reserva entre ubicaciones. Si un SKU no alcanza, la transacción completa se revierte.

## Picking
Cada barcode se resuelve a una variante. Se valida que exista en el pedido y que la cantidad escaneada no exceda lo solicitado. Al completar todos los ítems, el pedido pasa a READY.

## Despacho
Solo READY. Consume reservas, disminuye físico y reservado en la misma transacción, registra SALE y marca DISPATCHED.
