# Changelog

Todas las versiones importantes del proyecto se documentan acá.

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
