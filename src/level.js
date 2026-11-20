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
}

// Vrstni red v orodni vrstici urejevalnika (tipke 1..9, 0, -, =)
export const HOTBAR = [1, 2, 3, 4, 12, 5, 6, 7, 8, 10, 9, 11, 13, 14, 15]

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
    if (!code.startsWith('OBBY-')) throw new Error('To ni koda proge (mora se začeti z OBBY-)')
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
export function sampleLevel() {
  const L = new Level('Prva proga')
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
  return L
}
