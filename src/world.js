// ============================================================
//  SVET: risanje (3D grafika) – nebo, luči, kocke in liki.
//  Uporabljamo knjižnico Three.js.
// ============================================================
import * as THREE from 'three'
import { BLOCKS } from './level.js'
import { makeMovers, updateMovers } from './movers.js'

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.shadowMap.enabled = true

  const scene = new THREE.Scene()
  scene.background = skyTexture()
  scene.fog = new THREE.Fog(0xbfe3ff, 60, 160)

  const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 400)

  scene.add(new THREE.HemisphereLight(0xdff2ff, 0x5a6b4a, 1.3))
  const sun = new THREE.DirectionalLight(0xffffff, 2.2)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 120 })
  sun.shadow.bias = -0.0005
  scene.add(sun, sun.target)

  // Senca sledi igralcu, da je vedno ostra okoli njega
  const followSun = (p) => {
    sun.position.set(p.x + 20, p.y + 40, p.z + 10)
    sun.target.position.copy(p)
  }

  const resize = () => {
    renderer.setSize(window.innerWidth, window.innerHeight, false)
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
  }
  window.addEventListener('resize', resize)
  resize()

  return { renderer, scene, camera, followSun }
}

function skyTexture() {
  const c = document.createElement('canvas')
  c.width = 2; c.height = 256
  const g = c.getContext('2d')
  const grad = g.createLinearGradient(0, 0, 0, 256)
  grad.addColorStop(0, '#4f8fe8')
  grad.addColorStop(0.55, '#a9d6ff')
  grad.addColorStop(1, '#ffe9c7')
  g.fillStyle = grad
  g.fillRect(0, 0, 2, 256)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

// Tekstura z robom, da so kocke lepo vidne ena ob drugi
function blockTexture(checker = false) {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')
  if (checker) {
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      g.fillStyle = (i + j) % 2 ? '#222' : '#fff'
      g.fillRect(i * 16, j * 16, 16, 16)
    }
  } else {
    g.fillStyle = '#fff'
    g.fillRect(0, 0, 64, 64)
    // malo "šuma", da ni čisto gladko
    for (let i = 0; i < 120; i++) {
      const v = 225 + Math.random() * 30
      g.fillStyle = `rgb(${v},${v},${v})`
      g.fillRect(Math.random() * 64, Math.random() * 64, 4, 4)
    }
  }
  g.strokeStyle = 'rgba(0,0,0,0.28)'
  g.lineWidth = 4
  g.strokeRect(2, 2, 60, 60)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.magFilter = THREE.NearestFilter
  return t
}

// ============================================================
//  Kocke proge: za vsak tip ena "InstancedMesh" (hitro risanje)
// ============================================================
export class LevelView {
  constructor(scene) {
    this.scene = scene
    this.meshes = []
    this.geo = new THREE.BoxGeometry(1, 1, 1)
    this.materials = {}
    const tex = blockTexture()
    const checkerTex = blockTexture(true)
    for (const [id, b] of Object.entries(BLOCKS)) {
      this.materials[id] = new THREE.MeshStandardMaterial({
        color: b.color,
        map: b.checker ? checkerTex : tex,
        roughness: b.ice || b.glass ? 0.15 : 0.8,
        emissive: b.glow ? b.color : 0x000000,
        emissiveIntensity: b.glow || 0,
        transparent: !!b.glass,
        opacity: b.glass ? 0.45 : 1,
      })
    }
  }

  rebuild(level) {
    for (const m of this.meshes) {
      this.scene.remove(m)
      m.dispose()
    }
    this.meshes = []
    const byType = {}
    for (const [x, y, z, t] of level.blocks()) if (!BLOCKS[t].move) (byType[t] ||= []).push([x, y, z])
    const mat = new THREE.Matrix4()
    for (const [t, list] of Object.entries(byType)) {
      const mesh = new THREE.InstancedMesh(this.geo, this.materials[t], list.length)
      list.forEach(([x, y, z], i) => mesh.setMatrixAt(i, mat.makeTranslation(x, y, z)))
      mesh.castShadow = !BLOCKS[t].glass
      mesh.receiveShadow = true
      this.scene.add(mesh)
      this.meshes.push(mesh)
    }

    // Premične platforme: ena InstancedMesh na tip, položaje posodobimo vsak okvir
    this.movers = makeMovers(level)
    this.moverMeshes = []
    const groups = {}
    for (const m of this.movers) (groups[m.type] ||= []).push(m)
    for (const [t, list] of Object.entries(groups)) {
      const mesh = new THREE.InstancedMesh(this.geo, this.materials[t], list.length)
      mesh.castShadow = mesh.receiveShadow = true
      mesh.frustumCulled = false // premikajo se, zato jih vedno rišemo
      this.scene.add(mesh)
      this.meshes.push(mesh)
      this.moverMeshes.push({ mesh, list })
    }
    this.updateMovers(null)
  }

  // t = čas (null = vse na začetnem mestu, npr. v urejevalniku)
  updateMovers(t) {
    updateMovers(this.movers, t)
    const mat = new THREE.Matrix4()
    for (const { mesh, list } of this.moverMeshes) {
      list.forEach((m, i) => mesh.setMatrixAt(i, mat.makeTranslation(m.x, m.y, m.z)))
      mesh.instanceMatrix.needsUpdate = true
    }
  }

  // Lava malo "utripa"
  animate(time) {
    this.materials[6].emissiveIntensity = 0.7 + Math.sin(time * 4) * 0.25
    this.materials[10].emissiveIntensity = 0.3 + Math.sin(time * 3) * 0.15
  }
}

// ============================================================
//  Lik (avatar) – kockast možiček z imenom nad glavo
// ============================================================
export const SKINS = ['#ff4757', '#ffa502', '#ffd32a', '#2ed573', '#1e90ff', '#a55eea', '#ff6b81', '#2f3542']
export const HATS = ['brez', 'kapa', 'krona', 'rogovi']

export class Avatar {
  constructor(scene, { name = '', color = SKINS[4], hat = 'brez' } = {}) {
    this.scene = scene
    this.group = new THREE.Group()
    const mat = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 })
    const box = (w, h, d, m, x, y, z) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m)
      mesh.position.set(x, y, z)
      mesh.castShadow = true
      this.group.add(mesh)
      return mesh
    }
    this.bodyMat = mat(color)
    const skin = mat('#ffd6b0')
    const dark = mat('#2b2b3a')
    this.body = box(0.6, 0.7, 0.35, this.bodyMat, 0, 0.95, 0)
    this.head = box(0.5, 0.5, 0.5, skin, 0, 1.55, 0)
    box(0.08, 0.1, 0.02, dark, -0.11, 1.6, 0.26)
    box(0.08, 0.1, 0.02, dark, 0.11, 1.6, 0.26)
    this.legL = box(0.26, 0.6, 0.3, dark, -0.15, 0.3, 0)
    this.legR = box(0.26, 0.6, 0.3, dark, 0.15, 0.3, 0)
    this.armL = box(0.18, 0.6, 0.22, this.bodyMat, -0.4, 0.98, 0)
    this.armR = box(0.18, 0.6, 0.22, this.bodyMat, 0.4, 0.98, 0)
    // Noge in roke se vrtijo okoli zgornjega dela
    for (const limb of [this.legL, this.legR, this.armL, this.armR]) {
      limb.geometry.translate(0, -0.27, 0)
      limb.position.y += 0.27
    }
    this.addHat(hat, color)

    this.label = makeLabel(name)
    this.label.position.y = 2.25
    this.group.add(this.label)
    this.bubble = null
    this.bubbleTimer = 0

    this.walk = 0
    scene.add(this.group)
  }

  addHat(hat, color) {
    const m = new THREE.MeshStandardMaterial({ color: hat === 'krona' ? '#ffd700' : color, metalness: hat === 'krona' ? 0.6 : 0 })
    const add = (geo, x, y, z) => {
      const mesh = new THREE.Mesh(geo, m)
      mesh.position.set(x, y, z)
      this.group.add(mesh)
    }
    if (hat === 'kapa') {
      add(new THREE.BoxGeometry(0.54, 0.15, 0.54), 0, 1.86, 0)
      add(new THREE.BoxGeometry(0.5, 0.05, 0.3), 0, 1.81, 0.35)
    } else if (hat === 'krona') {
      add(new THREE.CylinderGeometry(0.28, 0.28, 0.2, 6, 1, true), 0, 1.9, 0)
    } else if (hat === 'rogovi') {
      const g = new THREE.ConeGeometry(0.07, 0.3, 6)
      add(g, -0.18, 1.93, 0)
      add(g, 0.18, 1.93, 0)
    }
  }

  // Oblaček z emotom ali sporočilom nad glavo
  say(text) {
    if (this.bubble) this.group.remove(this.bubble)
    this.bubble = makeLabel(text, true)
    this.bubble.position.y = 2.75
    this.group.add(this.bubble)
    this.bubbleTimer = 3
  }

  // pos = položaj stopal, yaw = smer, speed = hitrost hoje (za animacijo nog)
  update(dt, pos, yaw, speed, onGround) {
    this.group.position.copy(pos)
    this.group.rotation.y = yaw
    this.walk += dt * speed * 1.8
    const swing = onGround ? Math.sin(this.walk) * Math.min(speed / 6, 1) * 0.8 : 0.5
    this.legL.rotation.x = swing
    this.legR.rotation.x = -swing
    this.armL.rotation.x = -swing
    this.armR.rotation.x = swing
    if (this.bubble && (this.bubbleTimer -= dt) <= 0) {
      this.group.remove(this.bubble)
      this.bubble = null
    }
  }

  setVisible(v) {
    this.group.visible = v
  }

  dispose() {
    this.scene.remove(this.group)
  }
}

function makeLabel(text, bubble = false) {
  const c = document.createElement('canvas')
  const g = c.getContext('2d')
  const font = `bold ${bubble ? 44 : 34}px system-ui, sans-serif`
  g.font = font
  const w = Math.ceil(g.measureText(text).width) + 28
  c.width = w
  c.height = bubble ? 64 : 48
  g.font = font
  g.fillStyle = bubble ? 'rgba(255,255,255,0.95)' : 'rgba(0,0,0,0.45)'
  g.beginPath()
  g.roundRect(0, 0, c.width, c.height, 14)
  g.fill()
  g.fillStyle = bubble ? '#222' : '#fff'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(text, w / 2, c.height / 2 + 2)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }))
  const scale = 0.011
  sprite.scale.set(c.width * scale, c.height * scale, 1)
  sprite.renderOrder = 10
  return sprite
}
