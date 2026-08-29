-- ═══════════════════════════════════════════════════════════════════════════
-- Učebna v2 — seed
--
-- Kraje jsou číselník, ne konstanta v kódu. Rozšíření spádu na další kraj
-- je pak UPDATE, ne nasazení.
--
-- Spád k 29. 8. 2026: Praha, Středočeský a Karlovarský. Dokument říká
-- „Praha a Karlovarsko", ale příměstský tábor se dojíždí denně a Středočeši
-- do Prahy dojíždějí — pro ně je karta termínu nabídka, ne šum.
-- ═══════════════════════════════════════════════════════════════════════════

insert into public.regions (code, name, is_camp_catchment, sort_order) values
  ('CZ-PR', 'Praha',                  true,  10),
  ('CZ-ST', 'Středočeský kraj',       true,  20),
  ('CZ-KA', 'Karlovarský kraj',       true,  30),
  ('CZ-JC', 'Jihočeský kraj',         false, 40),
  ('CZ-PL', 'Plzeňský kraj',          false, 50),
  ('CZ-US', 'Ústecký kraj',           false, 60),
  ('CZ-LI', 'Liberecký kraj',         false, 70),
  ('CZ-KR', 'Královéhradecký kraj',   false, 80),
  ('CZ-PA', 'Pardubický kraj',        false, 90),
  ('CZ-VY', 'Kraj Vysočina',          false, 100),
  ('CZ-JM', 'Jihomoravský kraj',      false, 110),
  ('CZ-OL', 'Olomoucký kraj',         false, 120),
  ('CZ-ZL', 'Zlínský kraj',           false, 130),
  ('CZ-MO', 'Moravskoslezský kraj',   false, 140)
on conflict (code) do update
  set name = excluded.name,
      is_camp_catchment = excluded.is_camp_catchment,
      sort_order = excluded.sort_order;

-- ── Kurz 1: IoT ────────────────────────────────────────────────────────────
-- Sedm lekcí poskládaných z existujících úloh sekce beginner. Všechny mají
-- hotovou kontrolu kódu, takže se píše zadání, ne mechanika (audit 4.4).
--
-- Publikovaná je zatím jen lekce 1 — před bránou 1 stačí jedna hotová lekce,
-- ne celý kurz (Brána 0, bod 9). Zbytek čeká na obsah v bloku 2.3.

insert into public.courses (slug, title, summary, order_index, is_published)
values (
  'iot',
  'Elektronika a IoT',
  'Postav si semafor, noční světlo a vlastní obvod. Sedm lekcí po dvaceti minutách — první si zkusíš hned, bez registrace.',
  10,
  true
)
on conflict (slug) do update
  set title = excluded.title,
      summary = excluded.summary,
      is_published = excluded.is_published;

insert into public.lessons
  (course_id, slug, title, summary, order_index, legacy_task_id, estimated_minutes, is_published)
select
  c.id, v.slug, v.title, v.summary, v.order_index, v.legacy_task_id, v.minutes, v.published
from public.courses c
cross join (values
  ('rozsvit-ledku',   'Rozsviť LEDku',        'Jednu LED rozsvítíš tlačítkem, druhou kódem.',                 1, 'beginner-led',            20, true),
  ('plynuly-jas',     'Plynulý jas',          'Necháš LED pomalu zesilovat a zeslabovat přes PWM.',            2, 'beginner-pwm-led',        25, false),
  ('semafor',         'Semafor',              'Tři LEDky rozblikáš ve správném pořadí jako na křižovatce.',    3, 'beginner-traffic-light',  25, false),
  ('zvuk-na-stisk',   'Zvuk na stisk',        'Po stisku tlačítka se ozve buzzer.',                            4, 'beginner-buzzer-button',  20, false),
  ('otocny-knoflik',  'Otočný knoflík',       'Přečteš potenciometr a uvidíš hodnotu v sériovém monitoru.',    5, 'beginner-potentiometer',  25, false),
  ('nocni-svetlo',    'Noční světlo',         'Obvod, který se rozsvítí sám, když se setmí.',                  6, 'beginner-light-sensor',   30, false),
  ('a-nebo',          'A / NEBO',             'Spojíš dvě tlačítka logikou A a NEBO — závěrečný projekt.',     7, 'beginner-and-or',         30, false)
) as v(slug, title, summary, order_index, legacy_task_id, minutes, published)
where c.slug = 'iot'
on conflict (course_id, slug) do update
  set title = excluded.title,
      summary = excluded.summary,
      order_index = excluded.order_index,
      legacy_task_id = excluded.legacy_task_id,
      estimated_minutes = excluded.estimated_minutes,
      is_published = excluded.is_published;
