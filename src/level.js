// ============================================================
//  PROGA (level): katere kocke obstajajo in kje so.
//  Vsaka kocka ima celoštevilske koordinate (x, y, z) in tip.
//  Kocka s središčem v (x, y, z) zaseda prostor od x-0.5 do x+0.5 itd.
// ============================================================

// Vsi tipi kock. Številka je "id" tipa, ki se shrani v kodo proge.
// Nov tip dodaš tako, da dodaš novo vrstico (in mu v player.js dodaš obnašanje).
export const BLOCKS = {
  1: { name: 'Kamen', color: 0x9aa3ad },
  2: { name: 'Trava', color: 0x5cc05c },
  3: { name: 'Les', color: 0xb07a45 },
  4: { name: 'Opeka', color: 0xd0574a },
  5: { name: 'Led', color: 0xa8e4ff, ice: true },
  6: { name: 'Lava', color: 0xff5a1f, kill: true, glow: 0.9 },
  7: { name: 'Trampolin', color: 0xff4fd8, bounce: true, glow: 0.25 },
  8: { name: 'Pospešek', color: 0xffd23f, speed: true, glow: 0.35 },
  9: { name: 'Start', color: 0x3fa9ff, start: true, glow: 0.3 },
  10: { name: 'Kontrolna točka', color: 0x2ee6a6, checkpoint: true, glow: 0.4 },
  11: { name: 'Cilj', color: 0xffffff, finish: true, checker: true },
  12: { name: 'Steklo', color: 0xcfefff, glass: true },
  // Premične kocke (glej movers.js): move = os, po kateri se premikajo
  13: { name: 'Premična ↔ levo-desno', color: 0x8e6cff, move: 'x', glow: 0.15 },
  14: { name: 'Premična ↕ naprej-nazaj', color: 0x4f7dff, move: 'z', glow: 0.15 },
  15: { name: 'Dvigalo ⇅ gor-dol', color: 0xff8e3c, move: 'y', glow: 0.15 },
  // Kovanec: ni trden, pobereš ga, ko greš skozi
  16: { name: 'Kovanec 🪙', color: 0xffcc33, coin: true, solid: false },
  // Izginjajoča: ko stopiš nanjo, se zatrese in za nekaj sekund izgine (glej player.js)
  17: { name: 'Izginjajoča', color: 0xd9b8ff, fade: true, glow: 0.2 },
  // Portal: ni trden; ko greš vanj, te prenese do naslednjega portala (zadnji do prvega)
  18: { name: 'Portal', color: 0x7a2cff, portal: true, solid: false, glow: 0.9 },
}

// Vrstni red v orodni vrstici urejevalnika (tipke 1..9, 0, -, =)
export const HOTBAR = [1, 2, 3, 4, 12, 5, 6, 7, 8, 10, 9, 11, 16, 13, 14, 15, 17, 18]

const key = (x, y, z) => `${x},${y},${z}`

export class Level {
  constructor(name = 'Moja proga') {
    this.name = name
    this.cells = new Map() // "x,y,z" -> tip
  }

  get(x, y, z) {
    return this.cells.get(key(x, y, z)) || 0
  }

  set(x, y, z, type) {
    if (type) this.cells.set(key(x, y, z), type)
    else this.cells.delete(key(x, y, z))
  }

  // Vse kocke kot seznam [x, y, z, tip]
  *blocks() {
    for (const [k, t] of this.cells) {
      const [x, y, z] = k.split(',').map(Number)
      yield [x, y, z, t]
    }
  }

  find(type) {
    for (const b of this.blocks()) if (b[3] === type) return b
    return null
  }

  get size() {
    return this.cells.size
  }

  // "Prstni odtis" vsebine proge (brez imena) – za kovance in rekorde
  contentHash() {
    const s = [...this.cells.entries()].map(([k, t]) => k + ':' + t).sort().join(';')
    let h = 0
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
    return (h >>> 0).toString(36)
  }

  clone() {
    const l = new Level(this.name)
    l.cells = new Map(this.cells)
    return l
  }

  // ---- Žarek skozi mrežo kock (algoritem "DDA") ----
  // Vrne prvo kocko, ki jo žarek zadene, in stranico, ki jo je zadel.
  raycast(origin, dir, maxDist, ignore = null) {
    // Premaknemo za 0.5, da so celice od n do n+1 (lažje računanje)
    const ox = origin.x + 0.5, oy = origin.y + 0.5, oz = origin.z + 0.5
    let x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz)
    const stepX = Math.sign(dir.x), stepY = Math.sign(dir.y), stepZ = Math.sign(dir.z)
    const tDeltaX = Math.abs(1 / dir.x), tDeltaY = Math.abs(1 / dir.y), tDeltaZ = Math.abs(1 / dir.z)
    let tMaxX = stepX > 0 ? (x + 1 - ox) * tDeltaX : (ox - x) * tDeltaX
    let tMaxY = stepY > 0 ? (y + 1 - oy) * tDeltaY : (oy - y) * tDeltaY
    let tMaxZ = stepZ > 0 ? (z + 1 - oz) * tDeltaZ : (oz - z) * tDeltaZ
    if (!stepX) tMaxX = Infinity
    if (!stepY) tMaxY = Infinity
    if (!stepZ) tMaxZ = Infinity
    let normal = [0, 0, 0]
    let t = 0
    while (t <= maxDist) {
      const type = this.get(x, y, z)
      if (type && !(ignore && ignore(type))) return { x, y, z, type, normal, dist: t }
      if (tMaxX < tMaxY && tMaxX < tMaxZ) {
        x += stepX; t = tMaxX; tMaxX += tDeltaX; normal = [-stepX, 0, 0]
      } else if (tMaxY < tMaxZ) {
        y += stepY; t = tMaxY; tMaxY += tDeltaY; normal = [0, -stepY, 0]
      } else {
        z += stepZ; t = tMaxZ; tMaxZ += tDeltaZ; normal = [0, 0, -stepZ]
      }
    }
    return null
  }

  // ---- Koda proge: proga -> kratko besedilo, ki ga lahko deliš ----
  async toCode() {
    const flat = []
    for (const b of this.blocks()) flat.push(...b)
    const json = JSON.stringify({ v: 1, n: this.name, b: flat })
    const bytes = await compress(new TextEncoder().encode(json))
    return 'OBBY-' + toBase64Url(bytes)
  }

  static async fromCode(code) {
    code = code.trim().replace(/^.*#proga=/, '') // dovoli tudi celo povezavo
    if (!code.startsWith('OBBY-')) throw new Error('NOT_CODE') // prevod v main.js
    const bytes = await decompress(fromBase64Url(code.slice(5)))
    const data = JSON.parse(new TextDecoder().decode(bytes))
    const level = new Level(String(data.n || 'Proga').slice(0, 40))
    const b = data.b
    for (let i = 0; i + 3 < b.length; i += 4) {
      if (BLOCKS[b[i + 3]]) level.set(b[i] | 0, b[i + 1] | 0, b[i + 2] | 0, b[i + 3])
    }
    return level
  }
}

// --- stiskanje (da je koda krajša) ---
async function compress(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}
async function decompress(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}
function toBase64Url(bytes) {
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function fromBase64Url(str) {
  const s = atob(str.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(s, (c) => c.charCodeAt(0))
}

// ============================================================
//  Vzorčna proga, da je takoj kaj za igrati
// ============================================================
export function sampleLevel(name = 'Prva proga') {
  const L = new Level(name)
  const plat = (x0, y, z0, w, d, type) => {
    for (let x = x0; x < x0 + w; x++) for (let z = z0; z < z0 + d; z++) L.set(x, y, z, type)
  }
  // Začetni otok
  plat(-2, 0, -2, 5, 5, 2)
  L.set(0, 0, 0, 9) // start
  // Skoki po stebrih (2×2, da je lažje tudi na telefonu)
  let z = 4
  for (let i = 0; i < 4; i++) {
    plat(i % 2 ? 0 : -1, i, z, 2, 2, 3)
    z += 3
  }
  // Mostiček čez lavo
  plat(-2, 3, z, 5, 6, 6)
  for (let i = 0; i < 6; i++) L.set(0, 4, z + i, 1)
  z += 6
  plat(-1, 4, z, 3, 3, 2)
  L.set(0, 4, z + 1, 10) // kontrolna točka
  z += 3
  // Ledena drsalnica
  plat(-1, 4, z, 3, 6, 5)
  z += 6
  // Trampolin navzgor
  plat(-1, 4, z, 3, 2, 1)
  L.set(0, 4, z + 1, 7)
  plat(-2, 8, z + 3, 5, 4, 4)
  z += 7
  // Pospešek in dolg skok
  plat(-1, 8, z, 3, 3, 1)
  L.set(0, 8, z + 2, 8)
  z += 3 + 5
  plat(-2, 7, z, 5, 4, 2)
  L.set(0, 7, z + 1, 10)
  z += 4
  // Stopnice iz stekla
  for (let i = 0; i < 4; i++) L.set(0, 8 + i, z + i * 2, 12)
  z += 8
  // Premična platforma te zapelje do cilja
  plat(-1, 11, z, 2, 2, 14)
  z += 6
  // Cilj
  plat(-2, 11, z, 5, 5, 11)
  // Kovanci (nekateri so lahki, nekateri tvegani)
  const coins = [[1, 1, 1], [0, 2, 7], [1, 4, 14], [0, 5, 18], [-2, 5, 20], [1, 5, 28], [0, 8, 32], [0, 10, 43], [0, 11, 54], [-1, 12, 61]]
  for (const [x, y, w] of coins) if (!L.get(x, y, w)) L.set(x, y, w, 16)
  return L
}

// ---------- Še nekaj vgrajenih prog ----------
function builder(name) {
  const L = new Level(name)
  const plat = (x0, y, z0, w, d, type) => {
    for (let x = x0; x < x0 + w; x++) for (let z = z0; z < z0 + d; z++) L.set(x, y, z, type)
  }
  const coin = (x, y, z) => !L.get(x, y, z) && L.set(x, y, z, 16)
  return { L, plat, coin }
}

// Izginjajoče kocke in portal
export function purpleLevel(name = 'Vijolični svet') {
  const { L, plat, coin } = builder(name)
  plat(-2, 0, -2, 5, 5, 2)
  L.set(0, 0, 0, 9)
  for (let z = 3; z <= 10; z++) L.set(0, 0, z, 17) // izginjajoči most – ne ustavljaj se!
  plat(-2, 0, 11, 5, 4, 1)
  L.set(0, 0, 13, 10)
  let z = 16
  for (let i = 0; i < 5; i++) { // izginjajoče skakalnice navzgor
    plat(i % 2 ? 0 : -1, i, z, 2, 2, 17)
    z += 3
  }
  plat(-2, 4, 31, 5, 4, 2)
  L.set(-1, 4, 32, 10)
  L.set(0, 5, 34, 18) // portal …
  plat(18, 12, 40, 5, 5, 4)
  L.set(20, 13, 42, 18) // … te prenese sem gor
  plat(19, 12, 46, 2, 2, 15) // dvigalo
  plat(18, 15, 49, 5, 4, 11)
  for (const c of [[0, 1, 6], [0, 1, 9], [-1, 1, 16], [0, 3, 22], [0, 5, 28], [1, 5, 33], [20, 14, 44], [21, 16, 51]]) coin(...c)
  return L
}

// Navzgor: stopnice, trampolin, dvigalo, steklo
export function towerLevel(name = 'Stolp v oblakih') {
  const { L, plat, coin } = builder(name)
  plat(-3, 0, -3, 7, 7, 1)
  L.set(0, 0, 0, 9)
  for (let i = 0; i < 6; i++) plat(-1, i + 1, 4 + i * 2, 3, 2, 3) // stopnice
  plat(-1, 6, 16, 3, 3, 1)
  L.set(0, 6, 17, 7) // trampolin
  plat(-2, 10, 20, 5, 4, 2)
  L.set(0, 10, 21, 10)
  plat(-1, 10, 25, 2, 2, 15) // dvigalo
  plat(-2, 13, 28, 5, 4, 1)
  L.set(0, 13, 30, 10)
  for (let i = 0; i < 4; i++) L.set(0, 14 + i, 33 + i * 2, 12) // steklene stopnice
  for (let z = 41; z <= 44; z++) L.set(0, 17, z, 17)
  plat(-2, 17, 45, 5, 5, 11)
  for (const c of [[0, 2, 5], [1, 5, 11], [0, 8, 17], [-2, 11, 22], [0, 12, 26], [0, 15, 33], [0, 18, 39], [0, 18, 43]]) coin(...c)
  return L
}

// Velik prostor za lovljenje (in malo igranja)
export function arenaLevel(name = 'Arena za lovljenje') {
  const { L, plat, coin } = builder(name)
  plat(-12, 0, -12, 25, 25, 2)
  plat(-4, 0, 7, 9, 3, 5) // led
  for (let z = -4; z <= 4; z++) L.set(-10, 0, z, 8) // pospešek
  L.set(0, 0, -8, 9)
  for (let y = 1; y <= 2; y++) { plat(-6, y, -3, 1, 6, 4); plat(6, y, -3, 1, 6, 4) } // zidova
  for (const [x, z] of [[-9, -9], [8, -9], [-9, 8], [8, 8]]) for (let y = 1; y <= 3; y++) plat(x, y, z, 2, 2, 1) // stebri
  for (const [x, z] of [[-9, -6], [8, -6], [-9, 6], [8, 6]]) L.set(x, 0, z, 7) // trampolini ob stebrih
  L.set(-11, 1, -11, 18) // portala v kotih
  L.set(11, 1, 11, 18)
  for (let y = 1; y <= 4; y++) plat(-1, y, -1, 3, 3, 1) // stolp na sredini …
  L.set(0, 4, 0, 11) // … s ciljem na vrhu
  L.set(2, 1, 0, 15) // dvigalo na stolp
  for (const c of [[-9, 4, -9], [8, 4, -9], [-9, 4, 8], [8, 4, 8], [0, 1, 9], [-10, 1, 0], [-6, 3, 0], [6, 3, 0]]) coin(...c)
  return L
}

export const SAMPLES = [sampleLevel, purpleLevel, towerLevel, arenaLevel]
