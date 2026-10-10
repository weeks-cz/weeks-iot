# Písmo pro `/opengraph-image`

Bricolage Grotesque, [Google Fonts](https://github.com/google/fonts/tree/main/ofl/bricolagegrotesque),
licence **SIL Open Font License 1.1** — text licence je v `OFL.txt` v téhle
složce (SIL OFL redistribuci povoluje, ale podmiňuje přiložením licenčního
textu).

## Proč tu jsou dva statické soubory, ne jeden variabilní

Google distribuuje tenhle font jako jeden variabilní soubor (osy
`opsz`/`wdth`/`wght`). `src/app/opengraph-image.tsx` (generátor náhledového
obrázku pro sdílení) ho ale takhle použít nemůže — satori, parser na kterém
staví `next/og`, na jeho `fvar` tabulce padá. Google Fonts přiřazují
názvům os vlastní `nameID` ≥ 256 (běžná OpenType konvence pro
font-specifická jména) a bundlovaný parser uvnitř `@vercel/og` tenhle rozsah
neumí dohledat — `names[p.parseUShort()]` spadne na `undefined`. Jde o
known-class nekompatibilitu satori s variabilními fonty, ne o vadný soubor.

Řešení: z variabilního souboru se lokálně vyexportovaly dvě **statické**
instance — přesně ty dvě váhy, které stránka používá:

- `bricolage-grotesque-700.ttf` — tučně (nadpisy)
- `bricolage-grotesque-500.ttf` — normálně (podnadpisy, popisky)

Použité hodnoty os (`opsz=14, wdth=100`) odpovídají výchozím pojmenovaným
instancím fontu ("Bold"/"Medium").

## Jak je znovu vyrobit

Pro případ, že se aktualizuje zdrojový variabilní font nebo přibude další
váha. Vyžaduje `pip install fonttools` (jednorázově, není to
build/runtime závislost webu):

```bash
curl -sL "https://github.com/google/fonts/raw/main/ofl/bricolagegrotesque/BricolageGrotesque%5Bopsz%2Cwdth%2Cwght%5D.ttf" \
  -o /tmp/bricolage-variable.ttf

python -m fontTools.varLib.instancer /tmp/bricolage-variable.ttf \
  wght=700 wdth=100 opsz=14 -o public/fonts/bricolage-grotesque-700.ttf

python -m fontTools.varLib.instancer /tmp/bricolage-variable.ttf \
  wght=500 wdth=100 opsz=14 -o public/fonts/bricolage-grotesque-500.ttf
```

Výstup instanceru by měl obsahovat `Dropping fvar table` — to je znak, že
vznikl běžný statický TTF, který satori bez potíží přečte.
