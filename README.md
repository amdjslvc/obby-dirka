# 🏁 Obby Dirka

3D parkour (obby) igra, ki teče v brskalniku. Proge narediš sam v urejevalniku,
jih deliš s povezavo in tekmuješ s prijatelji v isti sobi.

## Zagon

```bash
npm install      # samo prvič
npm run dev      # nato odpri naslov, ki ga izpiše (npr. http://localhost:5173)
```

Za igranje s prijatelji na drugih računalnikih mora biti igra objavljena na internetu
(glej spodaj). Ko je objavljena, en igralec klikne **Ustvari sobo** in drugim pove
4-črkovno kodo.

## Kontrole

| Igra | |
|---|---|
| WASD / puščice | premikanje |
| Space | skok |
| miška | pogled |
| R | znova (v dirki: nazaj na kontrolno točko) |
| 1–4 | emoti 👋 😂 🏆 ⏳ |
| E | v urejevalnik |
| Esc | meni |

| Telefon | |
|---|---|
| levi palec | joystick (pojavi se, kjer se dotakneš) |
| desni palec | vlečenje obrača kamero |
| ⤒ | skok (s palca na gumbu lahko vlečeš in obračaš kamero) |
| ↺ / 😀 / 🛠 / ☰ | znova / emoti / urejevalnik / meni |
| urejevalnik | tapni kocko zgoraj · ➕ postavi · ⛏ pobriši · ⬆⬇ gor/dol · ↶ razveljavi · ▶ preizkusi |

Na telefonu ti igra malo pomaga:
- če skok za las ne doseže roba, te dvigne nanj;
- skočiš lahko še malo po tem, ko padeš z roba;
- joystick gre naravnost, kadar je nagnjen skoraj naravnost.

**🐣 Lahki način** (stikalo v meniju, na telefonu privzeto vklopljen): ko padeš, se vrneš na zadnje mesto, kjer si varno stal, in ne na kontrolno točko. Na dirki je tvoj čas označen s 🐣.

**👻 Duh:** ko postaviš rekord na progi, igra posname tvoj tek. Naslednjič teče ob tebi prosojni ti, s katerim tekmuješ.

| Urejevalnik | |
|---|---|
| WASD | letenje |
| Space / Shift | gor / dol |
| Ctrl | hitreje |
| desni klik | postavi kocko |
| levi klik | pobriši kocko |
| kolešček, 1–9, 0, -, =, [, ], \\, ', ;, , | izberi kocko |
| Ctrl+Z | razveljavi |
| E | preizkusi progo |

## Posebne kocke

| Kocka | Kaj naredi |
|---|---|
| 🟦 Start | tu začneš (samo ena na progo) |
| 🏁 Cilj | konec proge |
| 🟩 Kontrolna točka | če padeš, začneš tukaj |
| 🟥 Lava | dotik = nazaj na kontrolno točko |
| 🩷 Trampolin | visok skok |
| 🟨 Pospešek | 2 sekundi hitrejši tek |
| 🧊 Led | drsi |
| 🪟 Steklo | prosojno, a trdno |
| 🟪 Premična ↔ | premika se levo-desno (3 kocke) |
| 🟦 Premična ↕ | premika se naprej-nazaj (3 kocke) |
| 🟧 Dvigalo ⇅ | premika se gor-dol (3 kocke) |

| 🪙 Kovanec | poberi ga; šteje se, ko prideš na cilj |
| 🟪 Izginjajoča | ko stopiš nanjo, se zatrese in izgine za 3 sekunde – teci! |
| 🌀 Portal | ko greš vanj, te prenese do naslednjega portala (po vrsti od leve proti desni, zadnji vodi nazaj do prvega) |

Premične kocke se vedno premikajo v pozitivni smeri od mesta, kamor jih postaviš.
Sosednje kocke iste vrste se premikajo skupaj, zato lahko zgradiš večjo platformo.
V urejevalniku mirujejo, v igri pa se premikajo.

## Lovljenje 🏃

V sobi pritisni **🏃 Lovljenje**. Eden od igralcev postane lovec in nad glavo dobi rdeč kristal. Kogar se lovec dotakne, postane novi lovec, prejšnjega pa 2 sekundi ne more ujeti nazaj. Lovec je malo hitrejši. Igra traja 90 sekund, zmaga pa tisti, ki je bil najmanj časa lovec. Prvi trije dobijo kovance.

## Kovanci in klobuki

- Kovance pobereš na progi, v denarnico pa gredo šele, **ko prideš na cilj**.
- Vsak kovanec na progi se izplača samo enkrat. Že izplačani so pri naslednjem teku sivi.
- Na **progah, ki si jih urejal sam, kovanci ne štejejo**. Za kovance igraj proge prijateljev!
- Na dirki dobiš nagrado za uvrstitev: 1. mesto +10, 2. +6, 3. +4, ostali +2
  (samo če je v sobi vsaj še en igralec).
- Za kovance v meniju kupuješ klobuke. Cene so v `HAT_INFO` v `src/world.js`.

## Jeziki

Igra govori 12 jezikov: slovensko, angleško, nemško, francosko, špansko, italijansko,
portugalsko, rusko, kitajsko, japonsko, hindijsko in arabsko. Jezik se izbere sam po
nastavitvi brskalnika, zamenjaš pa ga lahko v meniju zgoraj.
Vsa besedila so v `src/i18n.js` – nov jezik dodaš tako, da skopiraš blok `en` in ga prevedeš.

## Kako je narejena (kje kaj najdeš)

| Datoteka | Kaj je v njej |
|---|---|
| `src/level.js` | tipi kock, proga, koda za deljenje, vzorčna proga |
| `src/player.js` | fizika: skok, gravitacija, trki, posebne kocke (**`PHYSICS` na vrhu, kar spreminjaj!**) |
| `src/world.js` | 3D grafika: nebo, kocke, lik, klobuki |
| `src/editor.js` | urejevalnik |
| `src/net.js` | igranje s prijatelji (WebRTC prek knjižnice Trystero) |
| `src/main.js` | meni, glavna zanka, dirke |
| `src/touch.js` | kontrole za telefon (joystick, skok, gumbi urejevalnika) |
| `src/movers.js` | premikajoče se platforme |
| `src/sound.js` | zvoki, narejeni s kodo |
| `src/music.js` | glasba (note so v tabelah – kar spreminjaj!) |
| `src/fx.js` | delci: iskrice, prah, konfeti, ognjemet |
| `src/i18n.js` | prevodi v 12 jezikov |

JavaScript je podoben Pythonu: `function` je `def`, `{ }` zamenja zamik,
`const`/`let` ustvari spremenljivko, `//` je komentar (kot `#`).

## Ideje za nadaljevanje (od lažjih do težjih)

1. V `PHYSICS` spremeni moč skoka ali gravitacijo in poskusi, kako se igra spremeni.
2. Dodaj nov emote v `EMOTES` (main.js) in nov klobuk v `HAT_INFO` (world.js, obliko nariši v `addHat`).
3. Dodaj novo kocko, npr. **lepljivo** (počasna hoja) ali **tekoči trak**. Za zgled poglej, kako sta narejena portal in izginjajoča kocka.
4. Premične platforme z nastavljivo dolžino poti in hitrostjo (zdaj sta v `movers.js` za vse enaki).
5. Še več stvari za kovance: barve, sledi za likom, plesi.
6. Nov način v sobi, npr. kralj hriba (poglej, kako je narejeno lovljenje v `main.js`).

Če spremeniš kaj, kar morajo imeti vsi v sobi (npr. novo kocko), povečaj `GAME_VERSION` v `src/net.js`. Tako igra prijatelje s staro različico opozori, naj osvežijo stran.

## Objava na internetu (brezplačno, GitHub Pages)

```bash
npm run build    # naredi mapo dist/
```

Vsebino mape `dist/` naloži na GitHub Pages, Netlify ali Cloudflare Pages.
Strežnik ni potreben: igralci se povežejo neposredno med seboj.
