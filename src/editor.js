// ============================================================
//  UREJEVALNIK PROG – letiš naokoli in postavljaš kocke (kot v Minecraftu).
//  Levi klik: odstrani kocko, desni klik: postavi kocko.
// ============================================================
import * as THREE from 'three'
import { BLOCKS, HOTBAR } from './level.js'

const REACH = 12 // kako daleč sežeš

export class Editor {
  constructor(scene, camera, input, levelView) {
    this.scene = scene
    this.camera = camera
    this.input = input
    this.levelView = levelView
    this.level = null
    this.active = false
    this.pos = new THREE.Vector3(0, 4, -8)
    this.yaw = Math.PI
    this.pitch = -0.3
    this.selected = 0 // indeks v HOTBAR
    this.history = [] // za razveljavitev (Ctrl+Z)
    this.onChange = () => {}
    this.onSelect = () => {}

    // Obris kocke, na katero meriš
    const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.02, 1.02, 1.02))
    this.cursor = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xffffff }))
    // Prosojna kocka, kamor bo postavljena nova
    this.ghost = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false })
    )
    this.grid = new THREE.GridHelper(200, 200, 0x334455, 0x556677)
    this.grid.position.y = -0.5
    this.grid.material.transparent = true
    this.grid.material.opacity = 0.35
    for (const o of [this.cursor, this.ghost, this.grid]) {
      o.visible = false
      scene.add(o)
    }

    input.onMouse((e) => this.active && this.click(e.button))
    input.onWheel((d) => this.active && this.select((this.selected + d + HOTBAR.length) % HOTBAR.length))
    input.onKey((e) => {
      if (!this.active) return
      const n = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0', 'Minus', 'Equal', 'BracketLeft', 'BracketRight', 'Backslash', 'Quote'].indexOf(e.code)
      if (n >= 0 && n < HOTBAR.length) this.select(n)
      if (e.code === 'KeyZ' && (e.ctrlKey || e.metaKey)) this.undo()
    })
  }

  get blockType() {
    return HOTBAR[this.selected]
  }

  select(i) {
    this.selected = i
    this.ghost.material.color.set(BLOCKS[this.blockType].color)
    this.onSelect(i)
  }

  start(level) {
    this.level = level
    this.active = true
    this.grid.visible = true
    this.select(this.selected)
  }

  stop() {
    this.active = false
    for (const o of [this.cursor, this.ghost, this.grid]) o.visible = false
  }

  // Kam merimo: kocka, ki jo zadanemo, in prosto mesto pred njo
  target() {
    const dir = new THREE.Vector3()
    this.camera.getWorldDirection(dir)
    const hit = this.level.raycast(this.camera.position, dir, REACH)
    if (hit) {
      return { hit, place: [hit.x + hit.normal[0], hit.y + hit.normal[1], hit.z + hit.normal[2]] }
    }
    // Nič ne zadanemo: postavimo na "tla" (mreža na višini 0)
    if (dir.y < -0.01) {
      const t = (-0.5 - this.camera.position.y) / dir.y
      if (t > 0 && t < REACH * 2) {
        const p = this.camera.position.clone().addScaledVector(dir, t)
        return { hit: null, place: [Math.round(p.x), 0, Math.round(p.z)] }
      }
    }
    return null
  }

  click(button) {
    const t = this.target()
    if (!t) return
    if (button === 0 && t.hit) {
      this.change([[t.hit.x, t.hit.y, t.hit.z, 0]])
    } else if (button === 2) {
      const [x, y, z] = t.place
      const ops = [[x, y, z, this.blockType]]
      // Start je lahko samo eden: starega odstranimo
      if (this.blockType === 9) {
        const old = this.level.find(9)
        if (old) ops.unshift([old[0], old[1], old[2], 0])
      }
      this.change(ops)
    }
  }

  // Spremeni kocke in si zapomni staro stanje za razveljavitev
  change(ops) {
    const undo = ops.map(([x, y, z]) => [x, y, z, this.level.get(x, y, z)]).reverse()
    for (const [x, y, z, t] of ops) this.level.set(x, y, z, t)
    this.history.push(undo)
    if (this.history.length > 200) this.history.shift()
    this.levelView.rebuild(this.level)
    this.onChange()
  }

  undo() {
    const ops = this.history.pop()
    if (!ops) return
    for (const [x, y, z, t] of ops) this.level.set(x, y, z, t)
    this.levelView.rebuild(this.level)
    this.onChange()
  }

  update(dt) {
    // --- pogled z miško ---
    const [lx, ly] = this.input.takeLook()
    this.yaw -= lx
    this.pitch = Math.max(-1.55, Math.min(1.55, this.pitch - ly))

    // --- letenje: WASD, Space gor, Shift dol ---
    const m = this.input.move
    const speed = this.input.down('ControlLeft') ? 25 : 10
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw)
    this.pos.x += (fx * m.forward + Math.cos(this.yaw) * m.right) * speed * dt
    this.pos.z += (fz * m.forward - Math.sin(this.yaw) * m.right) * speed * dt
    if (this.input.down('Space')) this.pos.y += speed * dt
    if (this.input.down('ShiftLeft', 'ShiftRight')) this.pos.y -= speed * dt

    this.camera.position.copy(this.pos)
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ')
    this.camera.updateMatrixWorld()

    // --- prikaz, kam merimo ---
    const t = this.input.locked ? this.target() : null
    this.cursor.visible = !!(t && t.hit)
    if (t && t.hit) this.cursor.position.set(t.hit.x, t.hit.y, t.hit.z)
    this.ghost.visible = !!t
    if (t) this.ghost.position.set(...t.place)
  }
}
