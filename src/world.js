// ============================================================
//  SVET: risanje (3D grafika) – nebo, luči, kocke in liki.
//  Uporabljamo knjižnico Three.js.
// ============================================================
import * as THREE from 'three'
import { BLOCKS } from './level.js'
import { FADE_TIME, FADE_BACK } from './player.js'
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

  // Oblaki in morje oblakov spodaj
  const clouds = makeClouds()
  scene.add(clouds)
  const sea = cloudSea()
  scene.add(sea)

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

  const render = () => renderer.render(scene, camera)

  // Oblaki počasi plujejo, morje oblakov pa sledi kameri (da nikoli ne vidiš roba)
  const animateSky = (dt, center) => {
    for (const c of clouds.children) {
      c.position.x += c.userData.speed * dt
      if (c.position.x > 120) c.position.x = -120
    }
    clouds.position.set(center.x, 0, center.z)
    sea.position.set(center.x, -18, center.z)
    sea.material.map.offset.x += dt * 0.004
  }

  // Kakovost slike: 0 = najboljša, vsak korak navzdol je hitrejši (za šibkejše telefone)
  let quality = 0
  const setQuality = (q) => {
    quality = q
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, [2, 1.25, 1, 0.75][q]))
    const shadows = q < 2
    if (renderer.shadowMap.enabled !== shadows) {
      renderer.shadowMap.enabled = shadows
      scene.traverse((o) => o.material && (o.material.needsUpdate = true))
    }
    clouds.visible = q < 3
    resize()
  }

  return { renderer, scene, camera, followSun, render, animateSky, setQuality, get quality() { return quality } }
}

// Kockasti oblaki iz belih škatel
function makeClouds() {
  const group = new THREE.Group()
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xdfeeff, emissiveIntensity: 0.45, transparent: true, opacity: 0.85, roughness: 1 })
  const geo = new THREE.BoxGeometry(1, 1, 1)
  for (let i = 0; i < 28; i++) {
    const cloud = new THREE.Group()
    const parts = 3 + Math.floor(Math.random() * 4)
    for (let j = 0; j < parts; j++) {
      const b = new THREE.Mesh(geo, mat)
      b.scale.set(4 + Math.random() * 6, 1.5 + Math.random() * 2, 3 + Math.random() * 4)
      b.position.set(j * 3 - parts * 1.5, Math.random() * 1.5, (Math.random() - 0.5) * 3)
      cloud.add(b)
    }
    const a = Math.random() * Math.PI * 2
    const r = 45 + Math.random() * 70
    cloud.position.set(Math.cos(a) * r, -6 + Math.random() * 40, Math.sin(a) * r)
    cloud.userData.speed = 0.5 + Math.random()
    group.add(cloud)
  }
  return group
}

// Ravnina z mehkim vzorcem oblakov daleč spodaj
function cloudSea() {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const g = c.getContext('2d')
  g.fillStyle = '#eaf4ff'
  g.fillRect(0, 0, 256, 256)
  for (let i = 0; i < 160; i++) {
    const x = Math.random() * 256, y = Math.random() * 256, r = 10 + Math.random() * 30
    const grad = g.createRadialGradient(x, y, 0, x, y, r)
    grad.addColorStop(0, 'rgba(255,255,255,0.9)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = grad
    g.fillRect(x - r, y - r, r * 2, r * 2)
  }
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(12, 12)
  tex.colorSpace = THREE.SRGBColorSpace
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(600, 600),
    new THREE.MeshBasicMaterial({ map: tex, fog: true })
  )
  sea.rotation.x = -Math.PI / 2
  return sea
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
    this.coinGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.08, 20).rotateX(Math.PI / 2)
    this.coinMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.15, roughness: 0.35, emissive: 0xffaa00, emissiveIntensity: 0.35 })
    this.coinState = new Map()
    this.coins = []
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
    const coins = []
    for (const [x, y, z, t] of level.blocks()) {
      if (BLOCKS[t].coin) coins.push({ key: `${x},${y},${z}`, x, y, z })
      else if (!BLOCKS[t].move) (byType[t] ||= []).push([x, y, z])
    }
    const mat = new THREE.Matrix4()
    this.fadeMesh = null
    for (const [t, list] of Object.entries(byType)) {
      const mesh = new THREE.InstancedMesh(this.geo, this.materials[t], list.length)
      if (BLOCKS[t].fade) { this.fadeMesh = mesh; this.fadeList = list; mesh.frustumCulled = false }
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

    // Kovanci: vrtljivi zlati kolački
    this.coins = coins
    this.coinMesh = null
    if (coins.length) {
      this.coinMesh = new THREE.InstancedMesh(this.coinGeo, this.coinMat, coins.length)
      this.coinMesh.castShadow = true
      this.coinMesh.frustumCulled = false
      this.scene.add(this.coinMesh)
      this.meshes.push(this.coinMesh)
    }
  }

  // Stanje kovanca: 'gold' (še ni pobran), 'ghost' (pobran že prej), 'hidden' (pobran v tem teku)
  setCoinState(key, state) {
    if (state === 'gold') this.coinState.delete(key)
    else this.coinState.set(key, state)
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

  // Izginjajoče kocke: tresejo se, izginejo in spet zrastejo. fade = player.fade
  animateFade(time, fade) {
    if (!this.fadeMesh) return
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3()
    this.fadeList.forEach(([x, y, z], i) => {
      const e = fade.get(`${x},${y},${z}`)
      p.set(x, y, z)
      let k = 1
      if (e !== undefined) {
        if (e < FADE_TIME) { p.x += Math.sin(time * 70) * 0.05; p.z += Math.cos(time * 60) * 0.05 } // trese se
        else k = Math.max(0, Math.min(1, (e - (FADE_BACK - 0.3)) / 0.3)) // izginila, na koncu zraste nazaj
      }
      this.fadeMesh.setMatrixAt(i, m.compose(p, q, s.setScalar(k)))
    })
    this.fadeMesh.instanceMatrix.needsUpdate = true
  }

  // Lava malo "utripa"
  animate(time) {
    this.materials[6].emissiveIntensity = 0.7 + Math.sin(time * 4) * 0.25
    this.materials[10].emissiveIntensity = 0.3 + Math.sin(time * 3) * 0.15
    if (!this.coinMesh) return
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3()
    const gold = new THREE.Color(0xffcc33), ghost = new THREE.Color(0x8fa3c0)
    const up = new THREE.Vector3(0, 1, 0)
    this.coins.forEach((c, i) => {
      const state = this.coinState.get(c.key) || 'gold'
      p.set(c.x, c.y + Math.sin(time * 2 + c.x + c.z) * 0.1, c.z)
      q.setFromAxisAngle(up, time * 2.5 + c.x)
      s.setScalar(state === 'hidden' ? 0 : 1)
      this.coinMesh.setMatrixAt(i, m.compose(p, q, s))
      this.coinMesh.setColorAt(i, state === 'ghost' ? ghost : gold)
    })
    this.coinMesh.instanceMatrix.needsUpdate = true
    this.coinMesh.instanceColor.needsUpdate = true
  }
}

// ============================================================
//  Lik (avatar) – kockast možiček z imenom nad glavo
// ============================================================
export const SKINS = ['#ff4757', '#ffa502', '#ffd32a', '#2ed573', '#1e90ff', '#a55eea', '#ff6b81', '#2f3542']
// Klobuki: cena v kovancih (0 = zastonj)
export const HAT_INFO = {
  brez: { label: 'Brez', icon: '🙂', price: 0 },
  kapa: { label: 'Kapa', icon: '🧢', price: 0 },
  usesa: { label: 'Mačja ušesa', icon: '🐱', price: 10 },
  rogovi: { label: 'Rogovi', icon: '😈', price: 20 },
  cilinder: { label: 'Cilinder', icon: '🎩', price: 30 },
  carovnik: { label: 'Čarovnik', icon: '🧙', price: 45 },
  propeler: { label: 'Propeler', icon: '🚁', price: 60 },
  sij: { label: 'Svetniški sij', icon: '😇', price: 80 },
  krona: { label: 'Krona', icon: '👑', price: 120 },
}
export const HATS = Object.keys(HAT_INFO)

export class Avatar {
  constructor(scene, { name = '', color = SKINS[4], hat = 'brez' } = {}) {
    this.scene = scene
    this.group = new THREE.Group()
    // rig = telo lika (se razteguje in stiska), ime nad glavo pa ostane v group
    this.rig = new THREE.Group()
    this.group.add(this.rig)
    this.squash = 0 // >0 stisnjen, <0 raztegnjen
    this.squashVel = 0
    this.wasGround = true
    const mat = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 })
    const box = (w, h, d, m, x, y, z) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m)
      mesh.position.set(x, y, z)
      mesh.castShadow = true
      this.rig.add(mesh)
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
    this.label.position.y = 2.5
    this.group.add(this.label)
    this.bubble = null
    this.bubbleTimer = 0

    this.walk = 0
    scene.add(this.group)
  }

  addHat(hat, color) {
    const m = new THREE.MeshStandardMaterial({ color: hat === 'krona' ? '#ffd700' : color, metalness: hat === 'krona' ? 0.6 : 0 })
    const add = (geo, x, y, z, mat = m) => {
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.set(x, y, z)
      mesh.castShadow = true
      this.rig.add(mesh)
      return mesh
    }
    const black = new THREE.MeshStandardMaterial({ color: '#1d1d24' })
    const purple = new THREE.MeshStandardMaterial({ color: '#5b3cc4' })
    const goldGlow = new THREE.MeshStandardMaterial({ color: '#ffe066', emissive: '#ffcc00', emissiveIntensity: 0.8 })
    if (hat === 'usesa') {
      const g = new THREE.ConeGeometry(0.1, 0.22, 4)
      add(g, -0.17, 1.9, 0)
      add(g, 0.17, 1.9, 0)
    } else if (hat === 'cilinder') {
      add(new THREE.CylinderGeometry(0.34, 0.34, 0.04, 20), 0, 1.82, 0, black)
      add(new THREE.CylinderGeometry(0.22, 0.22, 0.38, 20), 0, 2.02, 0, black)
    } else if (hat === 'carovnik') {
      add(new THREE.CylinderGeometry(0.4, 0.4, 0.04, 20), 0, 1.82, 0, purple)
      const cone = add(new THREE.ConeGeometry(0.26, 0.62, 16), 0, 2.13, 0, purple)
      cone.rotation.z = 0.15
    } else if (hat === 'propeler') {
      add(new THREE.SphereGeometry(0.27, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0, 1.79, 0)
      this.propeller = new THREE.Group()
      this.propeller.position.y = 2.1
      const blade = new THREE.BoxGeometry(0.6, 0.02, 0.09)
      for (const [mat, rot] of [[goldGlow, 0], [black, Math.PI / 2]]) {
        const b = new THREE.Mesh(blade, mat)
        b.rotation.y = rot
        this.propeller.add(b)
      }
      add(new THREE.CylinderGeometry(0.02, 0.02, 0.07), 0, 2.07, 0, black)
      this.rig.add(this.propeller)
    } else if (hat === 'sij') {
      const halo = add(new THREE.TorusGeometry(0.24, 0.035, 8, 24), 0, 2.08, 0, goldGlow)
      halo.rotation.x = Math.PI / 2
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
    this.bubble.position.y = 3.0
    this.group.add(this.bubble)
    this.bubbleTimer = 3
  }

  // pos = položaj stopal, yaw = smer, speed = hitrost hoje (za animacijo nog)
  update(dt, pos, yaw, speed, onGround) {
    this.group.position.copy(pos)
    this.group.rotation.y = yaw
    this.walk += dt * speed * 1.8
    if (this.propeller) this.propeller.rotation.y += dt * (6 + speed * 2)
    const swing = onGround ? Math.sin(this.walk) * Math.min(speed / 6, 1) * 0.8 : 0.5
    this.legL.rotation.x = swing
    this.legR.rotation.x = -swing
    this.armL.rotation.x = -swing
    this.armR.rotation.x = swing
    // v zraku: roke gor ("juhuu!")
    const armsUp = onGround ? 0 : 2.6
    this.armL.rotation.z += (-armsUp - this.armL.rotation.z) * Math.min(1, dt * 12)
    this.armR.rotation.z += (armsUp - this.armR.rotation.z) * Math.min(1, dt * 12)

    // raztegni ob odskoku, stisni ob pristanku (vzmet)
    if (onGround && !this.wasGround) this.squashVel += 6
    if (!onGround && this.wasGround) this.squashVel -= 5
    this.wasGround = onGround
    this.squashVel += (-this.squash * 180 - this.squashVel * 12) * dt
    this.squash += this.squashVel * dt
    const s = Math.max(-0.35, Math.min(0.35, this.squash))
    this.rig.scale.set(1 + s * 0.6, 1 - s, 1 + s * 0.6)
    // dihanje, ko stojiš pri miru
    if (onGround && speed < 0.5) this.rig.scale.y *= 1 + Math.sin(performance.now() / 400) * 0.015
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
