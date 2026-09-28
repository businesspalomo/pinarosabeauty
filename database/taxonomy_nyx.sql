-- Taxonomía de NYX Professional Makeup: categorías, subcategorías y líneas (sin productos).
-- Se puede ejecutar más de una vez: lo que ya existe no se duplica ni se pisa.
-- Uso: Supabase → SQL Editor → pegar todo este archivo → Run.
begin;

insert into brands(name) values ('Nyx') on conflict (name) do nothing;

insert into categories(brand_id, name, example)
select b.id, v.name, v.example
from brands b, (values
  ('Labios', 'Ej.: Glosses, aceites labiales, labiales líquidos'),
  ('Cejas', 'Ej.: Lápices, geles y fijadores, pomadas y polvos'),
  ('Ojos', 'Ej.: Delineadores, máscaras de pestañas, sombras individuales'),
  ('Rostro', 'Ej.: Primers, bases y skin tints, correctores'),
  ('Skincare', 'Ej.: Sérums y tratamientos, bálsamos'),
  ('Brochas y accesorios', 'Ej.: Brochas para rostro, brochas para ojos, esponjas'),
  ('Kits y combos', 'Ej.: Kits de labios, kits de maquillaje')
) as v(name, example)
where b.name = 'Nyx'
on conflict (brand_id, name) do update set example = coalesce(categories.example, excluded.example), active = true;

insert into subcategories(category_id, name, example)
select c.id, v.sub, v.example
from (values
  ('Labios', 'Glosses', 'Ej.: Butter Gloss, Duck Plump, This Is Milky'),
  ('Labios', 'Aceites labiales', 'Ej.: Fat Oil Lip Drip, Fat Oil Slick Click'),
  ('Labios', 'Labiales líquidos', 'Ej.: Lip Lingerie XXL, Shine Loud, Soft Matte Lip Cream'),
  ('Labios', 'Labiales en barra', 'Ej.: Suede Matte Lipstick, Shout Loud Satin Lipstick'),
  ('Labios', 'Delineadores de labios', 'Ej.: Slim Lip Pencil, Line Loud Lip Liner'),
  ('Labios', 'Bálsamos y tratamientos', 'Ej.: Fat Oil Slick Click, Bare With Me Lip Conditioner'),
  ('Cejas', 'Lápices', 'Ej.: Micro Brow Pencil, Precision Brow Pencil'),
  ('Cejas', 'Geles y fijadores', 'Ej.: The Brow Glue, Control Freak Eyebrow Gel'),
  ('Cejas', 'Pomadas y polvos', 'Ej.: Tame & Frame Brow Pomade, Eyebrow Cake Powder'),
  ('Ojos', 'Delineadores', 'Ej.: Epic Ink Liner, Jumbo Eye Pencil, Matte Liquid Liner'),
  ('Ojos', 'Máscaras de pestañas', 'Ej.: Worth the Hype Mascara, Doll Eye Mascara'),
  ('Ojos', 'Sombras individuales', 'Ej.: Ultimate Glow Shots, Prismatic Eyeshadow'),
  ('Ojos', 'Paletas de sombras', 'Ej.: Ultimate Shadow Palette, Perfect Filter Shadow Palette'),
  ('Ojos', 'Primers para ojos', 'Ej.: HD Eyeshadow Base, Glitter Primer, Proof It!'),
  ('Rostro', 'Primers', 'Ej.: The Face Glue Gripping Primer, Marshmellow Smoothing Primer'),
  ('Rostro', 'Bases y skin tints', 'Ej.: Can''t Stop Won''t Stop Foundation, Bare With Me Skin Veil'),
  ('Rostro', 'Correctores', 'Ej.: Bare With Me Concealer Serum, HD Studio Concealer Wand'),
  ('Rostro', 'Rubores', 'Ej.: Buttermelt Blush, Sweet Cheeks Blush'),
  ('Rostro', 'Bronzers y contornos', 'Ej.: Buttermelt Bronzer, Wonder Stick Contour'),
  ('Rostro', 'Iluminadores', 'Ej.: Born to Glow Liquid Illuminator, Jumbo Multi-Use Face Stick'),
  ('Rostro', 'Polvos', 'Ej.: HD Studio Finishing Powder, Blotting Powder'),
  ('Rostro', 'Fijadores', 'Ej.: Matte Finish Setting Spray, Dewy Finish Setting Spray'),
  ('Skincare', 'Sérums y tratamientos', 'Ej.: Bare With Me Luminous Skin Serum'),
  ('Skincare', 'Bálsamos', 'Ej.: Bare With Me Lip Conditioner'),
  ('Brochas y accesorios', 'Brochas para rostro', 'Ej.: Pro Powder Brush, Pro Contour Brush'),
  ('Brochas y accesorios', 'Brochas para ojos', 'Ej.: Pro Blending Brush, Pro Crease Brush'),
  ('Brochas y accesorios', 'Esponjas', 'Ej.: Complete Control Blending Sponge'),
  ('Brochas y accesorios', 'Accesorios', 'Ej.: Sharpener, Eyelash Curler, Blotting Paper'),
  ('Kits y combos', 'Kits de labios', 'Ej.: Butter Gloss Sets, Fat Oil Sets'),
  ('Kits y combos', 'Kits de maquillaje', 'Ej.: Sets y cofres de edición limitada')
) as v(cat, sub, example)
join categories c on c.name = v.cat
join brands b on b.id = c.brand_id and b.name = 'Nyx'
on conflict (category_id, name) do update set example = coalesce(subcategories.example, excluded.example), active = true;

insert into product_lines(category_id, subcategory_id, name)
select c.id, s.id, v.line
from (values
  ('Labios', 'Glosses', 'Butter Gloss'),
  ('Labios', 'Glosses', 'Duck Plump'),
  ('Labios', 'Glosses', 'Fat Oil'),
  ('Labios', 'Glosses', 'This Is Milky'),
  ('Labios', 'Glosses', 'Filler Instinct'),
  ('Labios', 'Aceites labiales', 'Fat Oil'),
  ('Labios', 'Labiales líquidos', 'Lip Lingerie'),
  ('Labios', 'Labiales líquidos', 'Shine Loud'),
  ('Labios', 'Labiales líquidos', 'Soft Matte'),
  ('Labios', 'Labiales líquidos', 'Liquid Suede'),
  ('Labios', 'Labiales líquidos', 'Lip IV'),
  ('Labios', 'Labiales en barra', 'Suede Matte'),
  ('Labios', 'Labiales en barra', 'Shout Loud'),
  ('Labios', 'Labiales en barra', 'Smooth Whip'),
  ('Labios', 'Labiales en barra', 'Fat Oil'),
  ('Labios', 'Delineadores de labios', 'Slim'),
  ('Labios', 'Delineadores de labios', 'Suede Matte'),
  ('Labios', 'Delineadores de labios', 'Line Loud'),
  ('Labios', 'Delineadores de labios', 'Duck Plump'),
  ('Labios', 'Delineadores de labios', 'Lip Lingerie'),
  ('Labios', 'Bálsamos y tratamientos', 'Fat Oil'),
  ('Labios', 'Bálsamos y tratamientos', 'Bare With Me'),
  ('Cejas', 'Lápices', 'Micro Brow'),
  ('Cejas', 'Lápices', 'Precision Brow'),
  ('Cejas', 'Lápices', 'Fill & Fluff'),
  ('Cejas', 'Lápices', 'Blade & Shade'),
  ('Cejas', 'Lápices', 'Lift & Snatch'),
  ('Cejas', 'Geles y fijadores', 'The Brow Glue'),
  ('Cejas', 'Geles y fijadores', 'Thick It. Stick It!'),
  ('Cejas', 'Geles y fijadores', 'Control Freak'),
  ('Cejas', 'Pomadas y polvos', 'Tame & Frame'),
  ('Cejas', 'Pomadas y polvos', 'Can''t Stop Won''t Stop'),
  ('Ojos', 'Delineadores', 'Epic'),
  ('Ojos', 'Delineadores', 'Vivid'),
  ('Ojos', 'Delineadores', 'Jumbo'),
  ('Ojos', 'Delineadores', 'Slim'),
  ('Ojos', 'Delineadores', 'Mechanical'),
  ('Ojos', 'Máscaras de pestañas', 'Worth the Hype'),
  ('Ojos', 'Máscaras de pestañas', 'On the Rise'),
  ('Ojos', 'Máscaras de pestañas', 'The Face Glue'),
  ('Ojos', 'Sombras individuales', 'Jumbo'),
  ('Ojos', 'Sombras individuales', 'Ultimate'),
  ('Ojos', 'Paletas de sombras', 'Ultimate'),
  ('Ojos', 'Paletas de sombras', 'Warm Neutrals'),
  ('Rostro', 'Primers', 'The Face Glue'),
  ('Rostro', 'Primers', 'Plump Right Back'),
  ('Rostro', 'Primers', 'Marshmellow'),
  ('Rostro', 'Primers', 'Shine Killer'),
  ('Rostro', 'Primers', 'Pore Filler'),
  ('Rostro', 'Primers', 'Can''t Stop Won''t Stop'),
  ('Rostro', 'Bases y skin tints', 'Can''t Stop Won''t Stop'),
  ('Rostro', 'Bases y skin tints', 'Bare With Me'),
  ('Rostro', 'Bases y skin tints', 'Total Control'),
  ('Rostro', 'Bases y skin tints', 'Born to Glow'),
  ('Rostro', 'Correctores', 'Bare With Me'),
  ('Rostro', 'Correctores', 'Can''t Stop Won''t Stop'),
  ('Rostro', 'Correctores', 'HD'),
  ('Rostro', 'Correctores', 'Pro Fix Stick'),
  ('Rostro', 'Rubores', 'Buttermelt'),
  ('Rostro', 'Rubores', 'Sweet Cheeks'),
  ('Rostro', 'Rubores', 'Wonder Stick'),
  ('Rostro', 'Bronzers y contornos', 'Buttermelt'),
  ('Rostro', 'Bronzers y contornos', 'Wonder Stick'),
  ('Rostro', 'Bronzers y contornos', 'Wonder'),
  ('Rostro', 'Iluminadores', 'Born to Glow'),
  ('Rostro', 'Iluminadores', 'Wonder Stick'),
  ('Rostro', 'Polvos', 'Can''t Stop Won''t Stop'),
  ('Rostro', 'Polvos', 'HD'),
  ('Rostro', 'Fijadores', 'The Face Glue'),
  ('Rostro', 'Fijadores', 'Matte Finish'),
  ('Rostro', 'Fijadores', 'Dewy Finish'),
  ('Rostro', 'Fijadores', 'Bare With Me'),
  ('Skincare', 'Sérums y tratamientos', 'Bare With Me'),
  ('Skincare', 'Bálsamos', 'Bare With Me'),
  ('Kits y combos', 'Kits de labios', 'Butter Gloss'),
  ('Kits y combos', 'Kits de labios', 'Fat Oil')
) as v(cat, sub, line)
join categories c on c.name = v.cat
join brands b on b.id = c.brand_id and b.name = 'Nyx'
join subcategories s on s.category_id = c.id and s.name = v.sub
on conflict (category_id, subcategory_id, name) do update set active = true;

commit;

-- Resumen: cuántas subcategorías y líneas quedaron en cada categoría de Nyx.
select c.name as categoria,
       count(distinct s.id) as subcategorias,
       count(distinct l.id) as lineas
from categories c
join brands b on b.id = c.brand_id and b.name = 'Nyx'
left join subcategories s on s.category_id = c.id and s.active
left join product_lines l on l.category_id = c.id and l.active
where c.active
group by c.name
order by c.name;
