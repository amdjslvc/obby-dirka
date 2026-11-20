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
}

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
    this.events = [] // dogodki za glavno zanko: 'death', 'checkpoint', 'finish', 'bounce', 'boost'
    this.lastCheckpoint = null
  }

  // Postavi igralca na start
  reset() {
    const s = this.level.find(9) || [0, 0, 0]
    this.spawn.set(s[0], s[1] + 0.5 + EPS, s[2])
    this.lastCheckpoint = null
    this.respawn()
  }

  respawn() {
    this.pos.copy(this.spawn)
    this.vel.set(0, 0, 0)
    this.boost = 0
  }

  pressJump() {
    this.jumpTimer = PHYSICS.jumpBuffer
  }

  // input: { forward: -1..1, right: -1..1 }, camYaw: smer kamere
  update(dt, input, camYaw) {
    const P = PHYSICS
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
    }
    this.boost -= dt

    // --- gravitacija in premik (razdeljen na manjše korake, da ne gremo skozi kocke) ---
    this.vel.y = Math.max(this.vel.y - P.gravity * dt, -40)
    const steps = Math.ceil((Math.abs(this.vel.x) + Math.abs(this.vel.y) + Math.abs(this.vel.z)) * dt / 0.3) || 1
    this.onGround = false
    for (let i = 0; i < steps; i++) {
      this.moveAxis('x', (this.vel.x * dt) / steps)
      this.moveAxis('z', (this.vel.z * dt) / steps)
      this.moveAxis('y', (this.vel.y * dt) / steps)
    }

    // --- posebne kocke ---
    const touch = this.touching(false)
    const under = this.onGround ? this.touching(true) : new Set()
    if (touch.has('kill') || this.pos.y < P.fallLimit) {
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
    for (const cp of this.checkpointsUnder()) {
      const key = cp.join(',')
      if (this.lastCheckpoint !== key) {
        this.lastCheckpoint = key
        this.spawn.set(cp[0], cp[1] + 0.5 + EPS, cp[2])
        this.events.push('checkpoint')
      }
    }
    if (touch.has('finish')) this.events.push('finish')
  }

  // Premik po eni osi; če se zaletimo v kocko, se ustavimo ob njej
  moveAxis(axis, d) {
    if (!d) return
    this.pos[axis] += d
    const hits = this.overlapping(0)
    if (!hits.length) return
    const coord = { x: 0, y: 1, z: 2 }[axis]
    if (d > 0) {
      const min = Math.min(...hits.map((h) => h[coord]))
      this.pos[axis] = min - 0.5 - (axis === 'y' ? HEIGHT : HALF_W) - EPS
    } else {
      const max = Math.max(...hits.map((h) => h[coord]))
      this.pos[axis] = max + 0.5 + (axis === 'y' ? 0 : HALF_W) + EPS
      if (axis === 'y') this.onGround = true
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
          if (t) out.push([x, y, z, t])
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

  checkpointsUnder() {
    if (!this.onGround) return []
    return this.overlapping(0, true).filter((b) => BLOCKS[b[3]].checkpoint)
  }

  get horizontalSpeed() {
    return Math.hypot(this.vel.x, this.vel.z)
  }
}
