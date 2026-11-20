// ============================================================
//  PREMIKAJOČE SE PLATFORME
//  Vsaka premična kocka se premika od svojega mesta 3 kocke daleč in nazaj.
//  Sosednje kocke iste vrste se premikajo skupaj, zato iz njih zgradiš večjo platformo.
//  Čas vzamemo iz ure računalnika, zato vsi igralci vidijo platforme na istem mestu.
// ============================================================
import { BLOCKS } from './level.js'

export const MOVE_RANGE = 3 // koliko kock daleč se premakne
export const MOVE_PERIOD = 4 // koliko sekund traja pot tja in nazaj

// Naredi seznam premičnih kock iz proge
export function makeMovers(level) {
  const list = []
  for (const [x, y, z, type] of level.blocks()) {
    const axis = BLOCKS[type].move
    if (axis) list.push({ type, axis, ox: x, oy: y, oz: z, x, y, z, dx: 0, dy: 0, dz: 0 })
  }
  return list
}

// Izračuna nove položaje; t = čas v sekundah (null = vse na začetnem mestu, za urejevalnik)
export function updateMovers(list, t) {
  const off = t === null ? 0 : (MOVE_RANGE * (1 - Math.cos((2 * Math.PI * t) / MOVE_PERIOD))) / 2
  for (const m of list) {
    const nx = m.ox + (m.axis === 'x' ? off : 0)
    const ny = m.oy + (m.axis === 'y' ? off : 0)
    const nz = m.oz + (m.axis === 'z' ? off : 0)
    m.dx = nx - m.x
    m.dy = ny - m.y
    m.dz = nz - m.z
    m.x = nx
    m.y = ny
    m.z = nz
  }
}

// Skupni čas za vse igralce (ura računalnika v sekundah)
export function worldTime() {
  return (performance.timeOrigin + performance.now()) / 1000
}
