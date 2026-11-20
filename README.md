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
| ⤒ | skok |
| ↺ / 😀 / ☰ | znova / emoti / meni |

Urejevalnik zaenkrat deluje samo na računalniku.

| Urejevalnik | |
|---|---|
| WASD | letenje |
| Space / Shift | gor / dol |
| Ctrl | hitreje |
| desni klik | postavi kocko |
| levi klik | pobriši kocko |
| kolešček, 1–9, 0, -, =, [, ], \\ | izberi kocko |
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

Premične kocke se vedno premikajo v pozitivni smeri od mesta, kamor jih postaviš.
Sosednje kocke iste vrste se premikajo skupaj, zato lahko zgradiš večjo platformo.
V urejevalniku mirujejo, v igri pa se premikajo.

## Kako je narejena (kje kaj najdeš)

| Datoteka | Kaj je v njej |
|---|---|
| `src/level.js` | tipi kock, proga, koda za deljenje, vzorčna proga |
| `src/player.js` | fizika: skok, gravitacija, trki, posebne kocke (**`PHYSICS` na vrhu, kar spreminjaj!**) |
| `src/world.js` | 3D grafika: nebo, kocke, lik, klobuki |
| `src/editor.js` | urejevalnik |
| `src/net.js` | igranje s prijatelji (WebRTC prek knjižnice Trystero) |
| `src/main.js` | meni, glavna zanka, dirke |
| `src/touch.js` | kontrole za telefon (joystick, skok) |
| `src/movers.js` | premikajoče se platforme |
| `src/sound.js` | zvoki, narejeni s kodo |

JavaScript je podoben Pythonu: `function` je `def`, `{ }` zamenja zamik,
`const`/`let` ustvari spremenljivko, `//` je komentar (kot `#`).

## Ideje za nadaljevanje (od lažjih do težjih)

1. V `PHYSICS` spremeni moč skoka ali gravitacijo in poskusi, kako se igra spremeni.
2. Dodaj nov emote v `EMOTES` (main.js) in nov klobuk v `HATS` (world.js).
3. Dodaj novo kocko, npr. **lepljivo** (počasna hoja) ali **teleport**.
4. Premične platforme z nastavljivo dolžino poti in hitrostjo (zdaj sta v `movers.js` za vse enaki).
5. Kovanci na progi, za kovance pa odkleneš klobuke.
6. Urejevalnik na telefonu.

## Objava na internetu (brezplačno, GitHub Pages)

```bash
npm run build    # naredi mapo dist/
```

Vsebino mape `dist/` naloži na GitHub Pages, Netlify ali Cloudflare Pages.
Strežnik ni potreben: igralci se povežejo neposredno med seboj.
