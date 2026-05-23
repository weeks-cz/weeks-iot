# NFC Camp Terms Source

Tento dokument popisuje, jak dostat reálné termíny z `weeks.cz` do horních bloků nad NFC návodem.

Aktuální stav v kódu:

- route používá statické `NFC_CAMP_TERM_PLACEHOLDERS`
- bloky se renderují nad bílým panelem návodu
- data dnes nejsou tahána z webu automaticky

## Cílový shape dat

Do tickeru chceme držet jednoduchý shape:

```ts
type NfcCampTerm = {
  id: string;
  label: string;
  theme: "cyan" | "violet" | "green" | "amber";
  dateText: string;
  location: string;
  href: string;
};
```

Poznámka:

- `theme` může být zatím dopočítaná lokálně podle názvu tématu
- `href` má vést na konkrétní přihlášku nebo detail termínu

## Doporučený způsob tahání z weeks.cz

Nejpraktičtější mezikrok:

1. V `GET` handleru NFC route udělat server-side `fetch("https://weeks.cz/")`.
2. Z homepage vytáhnout sekci `Nejbližší termíny`.
3. Z opakujících se bloků přečíst:
   - název tématu
   - datum
   - místo nebo lokalitu
   - cílový odkaz
4. Výsledek normalizovat do `NfcCampTerm[]`.
5. Když parsing selže, vrátit placeholdery.

## Proč server-side parsování

- route už stejně generuje HTML na serveru
- není potřeba kvůli tomu přidávat nový klientský JS
- při výpadku nebo změně HTML se stránka pořád nerozbije

## Lepší dlouhodobá verze

Jakmile to půjde upravit na `weeks.cz`, je lepší:

- přidat malý JSON endpoint s termíny
- nebo vložit serializovaný JSON přímo do homepage

Pak NFC route nebude parsovat HTML, ale jen přečte stabilní data.

## Minimální fallback pravidlo

Když nepůjde stáhnout nebo naparsovat reálný obsah:

- zobrazit placeholder bloky
- neházet chybu uživateli
- odkazy fallbacknout na `NFC_GUIDE_CAMP_TERMS_FALLBACK_URL` nebo na `https://weeks.cz/`
