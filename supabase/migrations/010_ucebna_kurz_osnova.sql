-- ── Osnova kurzu IoT po dopsání obsahu ──────────────────────────────────────
--
-- Seed z migrace 003 byl plán, ne obsah. Teď je obsah napsaný v
-- src/features/lessons/content/ a tahle migrace srovnává databázi s ním.
--
-- Co se změnilo proti plánu a proč:
--
--   • Přibyly „blikani" a „tlacitko". Původní lekce 1 měla dítě naučit
--     dvě věci najednou — že elektřina teče a že program rozhoduje.
--     Rozpadlo se to na tři lekce, každá s jednou myšlenkou.
--
--   • „nocni-svetlo" je finále, ne šestá lekce. Závěrečný projekt má být
--     věc, kterou dítě přinese ukázat: zakryješ senzor rukou a rozsvítí se.
--
--   • „a-nebo" (logické operátory) a „otocny-knoflik" (potenciometr)
--     vypadly. Nejsou špatné, ale nedají se předvést a kurz o osmi
--     lekcích už začíná být na dvě odpoledne dlouhý. Vrátí se jako
--     bonusový obsah, až bude na čem stavět.
--
--   • Všechny lekce se publikují. Kurz je od téhle chvíle dokončitelný —
--     to je celý smysl tasku 3.
--
-- Pořadí i slugy musí sedět s COURSE_LESSONS. Hlídá to test
-- src/features/lessons/__tests__/seed.test.ts, který tenhle soubor čte.

begin;

-- Přejmenování, ne smazání — kdyby na lekci někdo měl postup, zůstane mu.
update public.lessons l
   set slug = 'zvuk'
  from public.courses c
 where l.course_id = c.id
   and c.slug = 'iot'
   and l.slug = 'zvuk-na-stisk';

-- Lekce, které v kurzu už nejsou. Postup na ně kaskádou zmizí — obě byly
-- nepublikované, takže ho nikdo mít nemůže.
delete from public.lessons l
 using public.courses c
 where l.course_id = c.id
   and c.slug = 'iot'
   and l.slug not in (
     'rozsvit-ledku',
     'blikani',
     'tlacitko',
     'semafor',
     'plynuly-jas',
     'zvuk',
     'nocni-svetlo'
   );

insert into public.lessons
  (course_id, slug, title, summary, order_index, legacy_task_id, estimated_minutes, is_published)
select
  c.id, v.slug, v.title, v.summary, v.order_index, v.legacy_task_id, v.minutes, true
from public.courses c
cross join (values
  ('rozsvit-ledku', 'Rozsviť LEDku', 'Pochopíš, že Arduino je vypínač, který se ovládá slovem v programu.', 1, 'beginner-led', 20),
  ('blikani', 'Blikání', 'Pochopíš, že loop() běží pořád dokola a že delay() je pauza mezi kroky.', 2, 'beginner-led', 20),
  ('tlacitko', 'Tlačítko', 'Naučíš se, jak se Arduino ptá na okolní svět a rozhoduje se podle odpovědi.', 3, 'beginner-led', 25),
  ('semafor', 'Semafor', 'Postavíš posloupnost, kde na pořadí kroků záleží.', 4, 'beginner-traffic-light', 30),
  ('plynuly-jas', 'Plynulý jas', 'Zjistíš, že mezi zapnuto a vypnuto je 256 mezistupňů — a jak je projet smyčkou.', 5, 'beginner-pwm-led', 25),
  ('zvuk', 'Zvuk na stisk', 'Vyrobíš tón a spojíš vstup s výstupem — zmáčkni a ozve se.', 6, 'beginner-buzzer-button', 25),
  ('nocni-svetlo', 'Noční světlo', 'Postavíš zařízení, které se samo rozsvítí, když se setmí.', 7, 'beginner-light-sensor', 30)
) as v(slug, title, summary, order_index, legacy_task_id, minutes)
where c.slug = 'iot'
on conflict (course_id, slug) do update
  set title             = excluded.title,
      summary           = excluded.summary,
      order_index       = excluded.order_index,
      legacy_task_id    = excluded.legacy_task_id,
      estimated_minutes = excluded.estimated_minutes,
      is_published      = excluded.is_published;

commit;
