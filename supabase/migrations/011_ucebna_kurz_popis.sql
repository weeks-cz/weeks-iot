-- ── Popis kurzu podle skutečnosti ───────────────────────────────────────────
--
-- Seed z migrace 003 sliboval „sedm lekcí po dvaceti minutách". Lekce mají
-- 20 až 30 minut a dohromady necelé tři hodiny. Rodič si tu větu čte jako
-- příslib času — má sedět.

update public.courses
   set summary = 'Postav si semafor, plynulý přechod jasu a noční světlo, které se rozsvítí samo. Sedm lekcí, dohromady necelé tři hodiny. První si zkusíš hned, bez registrace.'
 where slug = 'iot';
