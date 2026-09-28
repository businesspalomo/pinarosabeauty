# Changelog

Todas las versiones importantes del proyecto se documentan acá.

## v1.5.1 — 2026-09-28
- Los errores de la base de datos ya no aparecen como "Internal server error": se muestra un mensaje que dice qué falló (por ejemplo, qué dato está repetido) y el detalle queda en los logs del servidor.
- Corregido el error 500 al guardar un producto (por ejemplo con una línea nueva) cuando el SKU automático coincidía con el de otro producto. Como el SKU automático usa solo las primeras letras de la línea y del tono y los últimos 4 números del código, dos productos parecidos podían coincidir (por ejemplo "Butter Gloss" y "Butter Gloss Bling"). Ahora, si ya existe, se le agrega -2, -3, etc.
- Si el SKU o el código de barras se escriben a mano y ya existen, aparece un aviso claro en lugar del error 500.
- Si el código de barras ya lo tiene otro producto, el aviso dice cuál. Si es un producto eliminado con la versión anterior (que solo lo ocultaba), también lo aclara.
- Nuevo script `database/purge_hidden_products.sql` para borrar definitivamente los productos que quedaron ocultos con la versión anterior y liberar sus códigos de barras y SKU.

## v1.5.0 — 2026-09-28
- "Eliminar producto" ahora lo borra definitivamente de la base de datos. Es para corregir un producto cargado por error y solo lo puede hacer un administrador.
- Antes de borrar se muestra una advertencia con los pedidos donde está el producto y cuántos movimientos de stock tiene. Al confirmar, se quita de esos pedidos (recalculando sus totales) y se borra su historial de movimientos, recepciones y picking. Si era el último tono del producto, también se borra el producto.
- Queda registrado en la auditoría qué se borró, quién lo borró y cuántos pedidos afectó.

## v1.4.1 — 2026-09-28
- Al editar un producto, la "Cantidad física" es el stock total y se guarda exactamente el número escrito, sin sumarlo ni restarlo a lo que había. Antes, si el producto tenía stock en más de una ubicación o se cambiaba la ubicación, el resultado terminaba siendo una suma. El stock libre queda en la ubicación elegida y no se puede bajar de lo reservado en pedidos. El cambio sigue quedando en Movimientos como ajuste manual.

## v1.4.0 — 2026-09-28
- En "Nuevo SKU" y "Editar producto", los campos de números (costo, precio mayorista y cantidades) ya no cambian si pasás la ruedita del mouse por encima, y no muestran las flechitas para subir o bajar. El valor solo se cambia escribiéndolo.

## v1.3.1 — 2026-09-27
- Taxonomía completa de NYX: 7 categorías, 30 subcategorías y 76 líneas, en `database/taxonomy_nyx.sql`. Se ejecuta en el SQL Editor de Supabase; se puede correr más de una vez sin duplicar nada.

## v1.3.0 — 2026-09-27
- En "Nuevo SKU", botón "+ Nueva" al lado de Categoría (y opción "+ Agregar categoría nueva" en la lista) para crear una categoría al vuelo. Se guarda para la marca elegida junto con el producto; al elegirla también se abre el campo para escribir la subcategoría nueva.

## v1.2.0 — 2026-09-27
- Botón "Eliminar producto" en la edición — lo saca del catálogo (borrado lógico) sin perder su historial de movimientos. Bloquea el borrado si tiene stock reservado en un pedido.
- Botón "Agregar variante" en cada fila — abre "Nuevo SKU" precargado con la marca, categoría, subcategoría, línea, nombre, presentación, costo y precio del producto elegido, dejando solo el tono, código de barras y SKU para completar.

## v1.1.0 — 2026-09-27
- Se puede editar la cantidad física de stock de un producto directamente desde "Editar producto" — queda registrado como un movimiento de ajuste, sin perder el historial.

## v1.0.0 — 2026-09-26
- Login con usuario y contraseña (Supabase Auth), reemplazando el modo de desarrollo sin autenticación.
- Migración de la base de datos de Docker local a Supabase (Postgres administrado).
- Catálogo de productos organizado como Marca → Categoría → Subcategoría → Línea, específico por cada marca.
- Taxonomía cargada para Elf, Nyx, Starface, Pixi, Maybelline, L'Oréal, CoverGirl y Milani.
- El formulario de productos permite agregar subcategorías y líneas nuevas al vuelo, sin tocar la base a mano.
- Botón para editar cualquier campo de un producto ya cargado (antes solo se podía crear).
- Deploy en producción: frontend en Vercel, backend en Render, ambos conectados a la misma base de Supabase.
