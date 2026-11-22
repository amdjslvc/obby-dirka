// ============================================================
//  IGRALEC: premikanje, skakanje, trki s kockami in posebne kocke.
//  Tukaj je dobro mesto za eksperimentiranje s številkami spodaj!
// ============================================================
import * as THREE from 'three'
import { BLOCKS } from './level.js'

export const PHYSICS = {
  gravity: 30, // kako močno vleče navzdol
  walkSpeed: 7, // hitrost hoje
  boostSpeed: 12, // hitrost po pospešku
  boostTime: 2, // koliko sekund traja pospešek
  jump: 10.5, // moč skoka (≈ 1.8 kocke visoko)
  bounce: 18, // moč trampolina (≈ 5 kock visoko)
  groundAccel: 20, // kako hitro se ustaviš / pospešiš na tleh
  iceAccel: 2.5, // na ledu drsi
  airAccel: 7, // nadzor v zraku
  coyoteTime: 0.1, // še lahko skočiš malo po tem, ko padeš z roba
  jumpBuffer: 0.12, // skok šteje, tudi če pritisneš malo prezgodaj
  fallLimit: -25, // pod to višino se vrneš na kontrolno točko
  ledgeAssist: 0.35, // če skok za las ne doseže roba, te dvigne nanj (v kockah)
}

// Izginjajoče kocke: koliko sekund zdržijo, ko stopiš nanje, in kdaj se vrnejo
export const FADE_TIME = 0.6
export const FADE_BACK = 3

const HALF_W = 0.3 // pol širine igralca
const HEIGHT = 1.8 // višina igralca
const EPS = 0.001

export class Player {
  constructor(level) {
    this.level = level
    this.pos = new THREE.Vector3()
    this.vel = new THREE.Vector3()
    this.yaw = 0 // smer, kamor gleda lik
    this.onGround = false
    this.coyote = 0
    this.jumpTimer = 0
    this.boost = 0
    this.spawn = new THREE.Vector3()
    this.movers = [] // premične platforme (glej movers.js)
    this.groundMover = null // platforma, na kateri stojimo
    this.events = [] // dogodki za glavno zanko: 'death', 'checkpoint', 'finish', 'bounce', 'boost'
    this.lastCheckpoint = null
    this.easy = false // lahki način: po padcu se vrneš na zadnje varno mesto
    this.safe = null // zadnje varno mesto (za lahki način)
    this.groundY = 0 // višina zadnjih tal, na katerih smo stali
    this.fade = new Map() // izginjajoče kocke: "x,y,z" -> sekunde, odkar smo stopili nanje
    this.safeTimer = 0
  }

  // Postavi igralca na start
  reset() {
    const s = this.level.find(9) || [0, 0, 0]
    this.spawn.set(s[0], s[1] + 0.5 + EPS, s[2])
    this.lastCheckpoint = null
    this.safe = null
    this.fade.clear()
    this.respawn()
  }

  respawn() {
    this.pos.copy(this.easy && this.safe ? this.safe : this.spawn)
    this.vel.set(0, 0, 0)
    this.boost = 0
    this.groundMover = null
  }

  // Premične platforme: peljemo se z njimi, in te nas potisnejo, če se zaletijo v nas
  rideMovers() {
    const m = this.groundMover
    if (m && (m.dx || m.dy || m.dz)) {
      const v = this.vel.clone()
      this.moveAxis('y', m.dy)
      this.moveAxis('x', m.dx)
      this.moveAxis('z', m.dz)
      this.vel.copy(v) // vožnja ne spremeni naše lastne hitrosti
    }
    for (const b of this.overlapping(0)) {
      const o = b[4]
      if (!o) continue
      // potisni nas iz platforme v smeri, v katero se premika
      if (o.dy > 0) { this.pos.y = o.y + 0.5 + EPS; this.vel.y = Math.max(this.vel.y, 0); this.groundMover = o }
      else if (o.dy < 0) this.pos.y = o.y - 0.5 - HEIGHT - EPS
      else if (o.dx) this.pos.x = o.x + Math.sign(o.dx) * (0.5 + HALF_W + EPS)
      else if (o.dz) this.pos.z = o.z + Math.sign(o.dz) * (0.5 + HALF_W + EPS)
    }
  }

  pressJump() {
    this.jumpTimer = PHYSICS.jumpBuffer
  }

  // input: { forward: -1..1, right: -1..1 }, camYaw: smer kamere
  update(dt, input, camYaw) {
    const P = PHYSICS
    // izginjajoče kocke: štejemo čas, po FADE_BACK sekundah se vrnejo
    for (const [k, t] of this.fade) {
      if (t + dt > FADE_BACK && !this.blockedBy(k)) this.fade.delete(k)
      else this.fade.set(k, t + dt)
    }
    this.rideMovers()
    // --- želena smer gibanja glede na kamero ---
    const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw)
    const rx = Math.cos(camYaw), rz = -Math.sin(camYaw)
    let wx = fx * input.forward + rx * input.right
    let wz = fz * input.forward + rz * input.right
    const len = Math.hypot(wx, wz)
    if (len > 1) { wx /= len; wz /= len }

    const ground = this.onGround ? this.touching(true) : new Set()
    const speed = this.boost > 0 ? P.boostSpeed : P.walkSpeed
    let accel = this.onGround ? P.groundAccel : P.airAccel
    if (ground.has('ice')) accel = P.iceAccel
    const k = Math.min(1, accel * dt)
    this.vel.x += (wx * speed - this.vel.x) * k
    this.vel.z += (wz * speed - this.vel.z) * k

    // obrni lik v smer gibanja
    if (len > 0.1) {
      const target = Math.atan2(wx, wz)
      let d = target - this.yaw
      d = Math.atan2(Math.sin(d), Math.cos(d))
      this.yaw += d * Math.min(1, 12 * dt)
    }

    // --- skok ---
    this.coyote = this.onGround ? P.coyoteTime : this.coyote - dt
    this.jumpTimer -= dt
    if (this.jumpTimer > 0 && this.coyote > 0) {
      this.vel.y = P.jump
      this.jumpTimer = 0
      this.coyote = 0
      this.events.push('jump')
    }
    this.boost -= dt

    // --- gravitacija in premik (razdeljen na manjše korake, da ne gremo skozi kocke) ---
    this.vel.y = Math.max(this.vel.y - P.gravity * dt, -40)
    const wasGround = this.onGround
    const fallSpeed = -this.vel.y
    const steps = Math.ceil((Math.abs(this.vel.x) + Math.abs(this.vel.y) + Math.abs(this.vel.z)) * dt / 0.3) || 1
    this.onGround = false
    this.groundMover = null
    for (let i = 0; i < steps; i++) {
      this.moveAxis('x', (this.vel.x * dt) / steps)
      this.moveAxis('z', (this.vel.z * dt) / steps)
      this.moveAxis('y', (this.vel.y * dt) / steps)
    }

    if (!wasGround && this.onGround && fallSpeed > 9) this.events.push('land')
    if (this.onGround) this.groundY = this.pos.y

    // --- posebne kocke ---
    const touch = this.touching(false)
    const under = this.onGround ? this.touching(true) : new Set()
    if (touch.has('kill') || this.pos.y < P.fallLimit) {
      this.deathPos = this.pos.clone()
      this.events.push('death')
      this.respawn()
      return
    }
    if (under.has('bounce')) {
      this.vel.y = P.bounce
      this.onGround = false
      this.events.push('bounce')
    }
    if (under.has('speed')) {
      if (this.boost <= 0) this.events.push('boost')
      this.boost = P.boostTime
    }
    if (this.onGround) for (const b of this.overlapping(0, true)) {
      const k = `${b[0]},${b[1]},${b[2]}`
      if (BLOCKS[b[3]].fade && !this.fade.has(k)) { this.fade.set(k, 0); this.events.push('fade') }
    }
    for (const cp of this.checkpointsUnder()) {
      const key = cp.join(',')
      if (this.lastCheckpoint !== key) {
        this.lastCheckpoint = key
        this.spawn.set(cp[0], cp[1] + 0.5 + EPS, cp[2])
        this.events.push('checkpoint')
      }
    }
    if (touch.has('finish')) this.events.push('finish')

    // --- varno mesto: trdna, navadna tla, na katerih stojiš vsaj četrt sekunde ---
    const plain = this.onGround && !this.groundMover && !under.has('bounce') && !under.has('speed') && !touch.size
    this.safeTimer = plain ? this.safeTimer + dt : 0
    if (this.safeTimer > 0.25) (this.safe ||= new THREE.Vector3()).copy(this.pos)
  }

  // Premik po eni osi; če se zaletimo v kocko, se ustavimo ob njej
  moveAxis(axis, d) {
    if (!d) return
    this.pos[axis] += d
    const hits = this.overlapping(0)
    if (!hits.length) return
    // pomoč pri robu: skok je bil za las prekratek – dvignemo te na kocko
    if (axis !== 'y' && this.vel.y < 4 && PHYSICS.ledgeAssist > 0 && !hits.some((h) => BLOCKS[h[3]].kill)) {
      const top = Math.max(...hits.map((h) => h[1])) + 0.5
      const lift = top - this.pos.y
      // samo do ene kocke nad tlemi, s katerih smo skočili – stena 2 kock ostane stena
      if (lift > 0 && lift <= PHYSICS.ledgeAssist && top <= this.groundY + 1.05) {
        const y = this.pos.y
        this.pos.y = top + EPS
        if (!this.overlapping(0).length) {
          this.vel.y = Math.max(this.vel.y, 0)
          return
        }
        this.pos.y = y
      }
    }
    const coord = { x: 0, y: 1, z: 2 }[axis]
    if (d > 0) {
      const min = Math.min(...hits.map((h) => h[coord]))
      this.pos[axis] = min - 0.5 - (axis === 'y' ? HEIGHT : HALF_W) - EPS
    } else {
      const max = Math.max(...hits.map((h) => h[coord]))
      this.pos[axis] = max + 0.5 + (axis === 'y' ? 0 : HALF_W) + EPS
      if (axis === 'y') {
        this.onGround = true
        this.groundMover = hits.find((h) => h[4] && h[1] === max)?.[4] || null
      }
    }
    this.vel[axis] = 0
  }

  // Seznam kock, ki se prekrivajo z igralcem (grow = malo povečan igralec)
  overlapping(grow, onlyBelow = false) {
    const x0 = this.pos.x - HALF_W - grow, x1 = this.pos.x + HALF_W + grow
    const z0 = this.pos.z - HALF_W - grow, z1 = this.pos.z + HALF_W + grow
    let y0 = this.pos.y - grow, y1 = this.pos.y + HEIGHT + grow
    if (onlyBelow) { y0 = this.pos.y - 0.05; y1 = this.pos.y - 0.01 }
    const cell = (v) => Math.floor(v + 0.5)
    const out = []
    for (let x = cell(x0); x <= cell(x1 - EPS); x++)
      for (let y = cell(y0); y <= cell(y1 - EPS); y++)
        for (let z = cell(z0); z <= cell(z1 - EPS); z++) {
          const t = this.level.get(x, y, z)
          // premične kocke niso na svojem mestu, kovanci pa niso trdni
          if (t && !BLOCKS[t].move && BLOCKS[t].solid !== false && !this.isFaded(x, y, z, t)) out.push([x, y, z, t])
        }
    // premične platforme (na trenutnem položaju)
    for (const m of this.movers) {
      if (m.x + 0.5 > x0 && m.x - 0.5 < x1 && m.y + 0.5 > y0 && m.y - 0.5 < y1 && m.z + 0.5 > z0 && m.z - 0.5 < z1) {
        out.push([m.x, m.y, m.z, m.type, m])
      }
    }
    return out
  }

  // Lastnosti kock, ki se jih dotikamo (npr. 'kill', 'ice', ...)
  touching(onlyBelow) {
    const props = new Set()
    for (const b of this.overlapping(0.03, onlyBelow)) {
      for (const p of ['kill', 'ice', 'bounce', 'speed', 'finish', 'checkpoint']) if (BLOCKS[b[3]][p]) props.add(p)
    }
    return props
  }

  // Kovanci, ki se jih dotikamo (vrne seznam "x,y,z")
  coinsTouched() {
    const cell = (v) => Math.floor(v + 0.5)
    const out = []
    for (let x = cell(this.pos.x - HALF_W); x <= cell(this.pos.x + HALF_W); x++)
      for (let y = cell(this.pos.y); y <= cell(this.pos.y + HEIGHT); y++)
        for (let z = cell(this.pos.z - HALF_W); z <= cell(this.pos.z + HALF_W); z++)
          if (BLOCKS[this.level.get(x, y, z)]?.coin) out.push(`${x},${y},${z}`)
    return out
  }

  checkpointsUnder() {
    if (!this.onGround) return []
    return this.overlapping(0, true).filter((b) => BLOCKS[b[3]].checkpoint)
  }

  // Ali je izginjajoča kocka trenutno izginila?
  isFaded(x, y, z, t) {
    return BLOCKS[t].fade && this.fade.get(`${x},${y},${z}`) > FADE_TIME
  }

  // Ali bi se kocka, ki se vrača, pojavila v nas? (potem še malo počaka)
  blockedBy(k) {
    const [x, y, z] = k.split(',').map(Number)
    return Math.abs(this.pos.x - x) < 0.5 + HALF_W && Math.abs(this.pos.z - z) < 0.5 + HALF_W &&
      this.pos.y < y + 0.5 && this.pos.y + HEIGHT > y - 0.5
  }

  get horizontalSpeed() {
    return Math.hypot(this.vel.x, this.vel.z)
  }
}
