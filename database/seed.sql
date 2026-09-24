insert into app_users (id, name, email, role)
values ('00000000-0000-0000-0000-000000000001', 'Administrador Piña Rosa', 'admin@pinarosa.local', 'ADMIN')
on conflict (email) do nothing;

insert into categories(name, example) values
('Maquillaje', 'Ej.: base, corrector, labial, delineador, máscara, rubor'),
('Skincare', 'Ej.: limpiador, sérum, hidratante, protector solar, tratamiento'),
('Accesorios', 'Ej.: brochas, esponjas, aplicadores, cosmetiqueras')
on conflict (name) do nothing;

insert into subcategories(category_id, name, example)
select c.id, v.name, v.example
from categories c
join (values
  ('Maquillaje','Labios','Ej.: gloss, tinta, labial, lip oil'),
  ('Maquillaje','Rostro','Ej.: base, corrector, polvo, rubor, iluminador, primer'),
  ('Maquillaje','Ojos y cejas','Ej.: máscara, delineador, lápiz de cejas, sombra'),
  ('Skincare','Limpieza','Ej.: gel, espuma, agua micelar'),
  ('Skincare','Tratamiento','Ej.: sérum, Cicaplast, antiacné, antimanchas'),
  ('Skincare','Protección solar','Ej.: protector solar facial o corporal'),
  ('Accesorios','Aplicadores','Ej.: brochas, esponjas y pinceles')
) as v(category_name,name,example) on v.category_name = c.name
on conflict (category_id, name) do nothing;

insert into locations(code,name,description) values
('A1','Estante A1','Ubicación inicial'),
('B3','Estante B3','Ubicación de ejemplo'),
('RECEPCION','Recepción','Zona temporal de recepción')
on conflict (code) do nothing;
