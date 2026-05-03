# 3D Print Studio - stav implementace

Aktualizovano: 2026-05-01

Tento dokument popisuje aktualni stav nove 3D modelovaci casti pro 3D tisk ve Weeks IoT aplikaci. Slouzi jako rychla mapa toho, co uz je hotove, kde to v projektu lezi a co je potreba hlidat pri dalsim vyvoji.

## Kde to zije

- Hlavni editor: `src/components/3d/Workspace3D.jsx`
- Stav editoru: `src/components/3d/Workspace3DStore.js`
- Vstup z aplikace: `src/components/screens/TopicSelect.tsx`
- Zapnuti tematu: `src/lib/topics.ts` (`3d-print`)
- Globalni styly: `src/app/globals.css`

Editor je napojeny z obrazovky vyberu temat. Tema 3D tisk ma vlastni menu a rezim Studio. Tlacitko `Opustit Studio` v levem hornim rohu vraci uzivatele zpet do menu 3D tisku.

## Stav uzivatelskeho rozhrani

- Studio bezi jako full-screen 3D pracovni plocha.
- Horni toolbar obsahuje nastroje pro pridani objektu, transformace, seskupeni, rez plochou, pivot a export.
- Tlacitka Move, Rotate a Scale jsou ikonova, bez textovych popisku.
- Vlevo nahore je pevne umistene tlacitko pro opusteni Studia.
- Panel vlastnosti je posunuty pod toolbar, ma omezenou vysku a vlastni scroll, aby neprekryval nastroje.
- Knihovna tvaru je take pod toolbarem a pri delsim obsahu scrolluje uvnitr panelu.
- Z globalniho CSS byl odstranen puvodni svetle sedy "stain" artefakt z absolutne pozicovaneho pseudo-elementu.

## Modelovani a objekty

Podporovane zakladni tvary:

- kostka / kvadr
- koule
- valec
- kuzel
- pyramida
- klin
- polokoule
- torus
- hvezda
- 3D text

Kazdy objekt ma transformaci, velikost, material a metadata ulozena ve Zustand store. Textovy objekt pouziva malou hloubku a normalizovane meritko, aby se pri vlozeni nechoval jako natazeny nebo prilis tenky artefakt.

## Transformace a pivot

- TransformControls jsou kotvene na geometricky stred vybraneho objektu.
- Stred se pocita pres `new THREE.Box3().setFromObject(object).getCenter(vector)`.
- Pri zmene vyberu a pri transformaci se poloha gizma aktualizuje podle skutecneho bounding boxu objektu.
- Editor podporuje rucni editaci pivotu a reset pivotu zpet na stred objektu.
- Pri rotaci se drzi stred objektu, aby se objekt netocil okolo vzdaleneho originu.

## Rozmery a jednotky

- Editor pracuje s internimi jednotkami a umi zobrazovat rozmery v `mm`, `cm`, `m` a `inch`.
- Hodnoty v properties panelu jsou odvozene ze skutecne vyrenderovane geometrie, ne jen z puvodniho zadani tvaru.
- Pri exportu STL se souradnice prepocitaji podle vybrane jednotky a jednotka je pridana do nazvu souboru.
- Pozor: STL format sam o sobe neuklada metadata o jednotkach. Jiny slicer vidi jen ciselne souradnice, proto je spravne meritko resene prepocitem souradnic a nazvem souboru.

## CSG, spojovani a rez plochou

- Spojovani objektu pouziva CSG evaluator.
- Pri CSG operacich se pouzivaji atributy `position` a `normal`, aby operace nepadaly na geometriich bez `uv`.
- Vysledna geometrie se pred ulozenim bakeuje s `matrixWorld`, aby po spojeni neposkocila.
- Rez plochou funguje i pro vice vybranych objektu najednou.
- Opakovany rez uz rozriznuteho objektu by nemel menit jeho polohu, protoze vysledky rezu se take ukladaji po bake world transformace.

## Kamera a navigace

- Leve tlacitko mysi otaci kamerou.
- Stredni tlacitko mysi posouva pohled stejne jako prave tlacitko.
- Spodni pravy navigation gizmo je vlastni komponenta, ne standardni Drei `GizmoViewport`.
- Klik na osu prepne kameru do zarovnaneho ortografickeho pohledu bez perspektivni hloubky.
- Zarovnany ortograficky pohled se ma vratit zpet do perspektivy pri dalsim levem otaceni pohledu.
- Kliknuta osa kratce blikne jako odezva.

## Barvy gizma

Aktualni kontrastni barvy transformacnich a navigacnich prvku:

- X osa: `#cc2222`
- Y osa: `#008800`
- Z osa: `#1f5cff`
- aktivni/hover stav: `#333333`
- screen-space rotacni kruh: `#000000`
- bliknuti navigation gizma: `#ffffff`

## Export pro 3D tisk

- Editor umi exportovat vybrane objekty do STL.
- Pred exportem se geometrie zkompaktni na trojuhelniky, odstrani se degenerovane trojuhelniky a prepocitaji se normaly.
- Export bere v potaz zvolenou jednotku, ale stale je potreba testovat vystup v realnem sliceru, protoze STL nema vlastni jednotkova metadata a CSG geometrie muze v narocnych pripadech vytvorit spatne uzavreny mesh.

## Aktualni rizika a watchlist

- CSG a rezani je potreba dal testovat na slozitych kombinacich tvaru, hlavne kvuli deravym nebo neuzavrenym meshum.
- STL export je funkcni, ale kvalita vysledku zavisi na tom, jestli vstupni geometrie po CSG zustane manifold.
- Ortograficky osovy pohled je citlive misto UX: musi se prepnout az po kliknuti na osu, ne po hoveru, a musi zustat bez perspektivni hloubky jen v zarovnanem modu.
- Rozmery v properties panelu jsou prakticke bounding-box rozmery pro editor. Nejsou to plnohodnotne CAD k-sty constraints.
- Editor zatim nema projektove ukladani modelu do cloudu; hlavni vystup je prace v relaci a STL export.

## Rychla kontrola po dalsich upravach

1. Pridat kostku, text a kouli.
2. Zkontrolovat, ze Move/Rotate/Scale gizmo sedi ve stredu vybraneho objektu.
3. Zmenit rozmery v properties panelu a overit, ze objekt odpovida zadanym hodnotam.
4. Spojit dva objekty a overit, ze neposkoci.
5. Rozriznout jeden objekt, potom vice objektu naraz.
6. Kliknout na osu navigation gizma a overit ortograficky pohled bez perspektivy.
7. Pohnout kamerou levym otacenim a overit navrat do perspektivy.
8. Exportovat STL ve zvolene jednotce a otevrit ho ve sliceru.
