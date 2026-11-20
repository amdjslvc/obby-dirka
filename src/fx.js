// ============================================================
//  UČINKI: delci (iskrice, prah, konfeti, ognjemet)
//  Vsak delec je majhna kocka, ki leti, pada in izgine.
// ============================================================
import * as THREE from 'three'

const MAX = 600 // največ delcev naenkrat

export class Particles {
  constructor(scene) {
    this.mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
      MAX
    )
    this.mesh.frustumCulled = false
    this.mesh.count = 0
    scene.add(this.mesh)
    this.list = []
    this.m = new THREE.Matrix4()
    this.q = new THREE.Quaternion()
    this.e = new THREE.Euler()
    this.c = new THREE.Color()
  }

  // pos: kje, opts: { count, colors, speed, up, life, size, gravity, spread }
  burst(pos, opts = {}) {
    const {
      count = 12, colors = [0xffffff], speed = 4, up = 2, life = 0.8,
      size = 0.12, gravity = 12, spread = 0.2,
    } = opts
    for (let i = 0; i < count; i++) {
      if (this.list.length >= MAX) this.list.shift()
      const a = Math.random() * Math.PI * 2
      const r = Math.random() * speed
      this.list.push({
        x: pos.x + (Math.random() - 0.5) * spread,
        y: pos.y + (Math.random() - 0.5) * spread,
        z: pos.z + (Math.random() - 0.5) * spread,
        vx: Math.cos(a) * r,
        vy: up * (0.5 + Math.random()),
        vz: Math.sin(a) * r,
        rot: Math.random() * 6,
        spin: (Math.random() - 0.5) * 12,
        life: life * (0.6 + Math.random() * 0.6),
        maxLife: life,
        size: size * (0.6 + Math.random() * 0.8),
        gravity,
        color: colors[Math.floor(Math.random() * colors.length)],
      })
    }
  }

  update(dt) {
    let n = 0
    const keep = []
    for (const p of this.list) {
      p.life -= dt
      if (p.life <= 0) continue
      p.vy -= p.gravity * dt
      p.vx *= 1 - dt * 1.5
      p.vz *= 1 - dt * 1.5
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.z += p.vz * dt
      p.rot += p.spin * dt
      const s = p.size * Math.min(1, (p.life / p.maxLife) * 2) // na koncu se skrči
      this.e.set(p.rot, p.rot * 0.7, 0)
      this.q.setFromEuler(this.e)
      this.m.compose(new THREE.Vector3(p.x, p.y, p.z), this.q, new THREE.Vector3(s, s, s))
      this.mesh.setMatrixAt(n, this.m)
      this.mesh.setColorAt(n, this.c.set(p.color))
      n++
      keep.push(p)
    }
    this.list = keep
    this.mesh.count = n
    this.mesh.instanceMatrix.needsUpdate = true
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true
  }
}

// Barve za učinke
export const FX = {
  coin: { count: 14, colors: [0xffd23f, 0xffe98a, 0xffffff], speed: 3, up: 3, life: 0.6, size: 0.1, gravity: 6 },
  dust: { count: 8, colors: [0xffffff, 0xdddddd], speed: 2.5, up: 0.8, life: 0.45, size: 0.14, gravity: 2 },
  land: { count: 14, colors: [0xffffff, 0xe8e8e8], speed: 4, up: 0.6, life: 0.5, size: 0.16, gravity: 2 },
  death: { count: 30, colors: [0xff3b30, 0xff9500, 0x333333], speed: 6, up: 6, life: 0.9, size: 0.2, gravity: 14 },
  bounce: { count: 18, colors: [0xff4fd8, 0xffffff], speed: 3, up: 5, life: 0.6, size: 0.12, gravity: 10 },
  checkpoint: { count: 40, colors: [0x2ee6a6, 0xffffff, 0xffd23f], speed: 3, up: 9, life: 1.4, size: 0.13, gravity: 9 },
  boost: { count: 2, colors: [0xffd23f, 0xff9500], speed: 0.5, up: 0.5, life: 0.4, size: 0.12, gravity: 0 },
  firework: { count: 50, colors: [0xff4757, 0xffd23f, 0x2ed573, 0x1e90ff, 0xa55eea, 0xffffff], speed: 9, up: 4, life: 1.6, size: 0.16, gravity: 5, spread: 0.1 },
}
