// ============================================================
//  VNOS: tipkovnica in miška
// ============================================================
export class Input {
  constructor(canvas) {
    this.canvas = canvas
    this.keys = new Set() // trenutno pritisnjene tipke (e.code, npr. 'KeyW')
    this.pressedHandlers = [] // funkcije, ki se pokličejo ob pritisku tipke
    this.mouseHandlers = []
    this.wheelHandlers = []
    this.lookX = 0 // premik miške od zadnjega branja
    this.lookY = 0
    this.sensitivity = 0.0025
    // Telefon/tablica: ni miške, igramo z dotiki (glej touch.js)
    this.touch = matchMedia('(pointer: coarse)').matches
    this.touchPlaying = false
    this.touchMove = { forward: 0, right: 0 }
    this.touchUp = false // gumba ⬆ ⬇ v urejevalniku na telefonu
    this.touchDown = false

    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      if (['Space', 'ArrowUp', 'ArrowDown', 'Tab'].includes(e.code)) e.preventDefault()
      if (!e.repeat) for (const h of this.pressedHandlers) h(e)
      this.keys.add(e.code)
    })
    window.addEventListener('keyup', (e) => this.keys.delete(e.code))
    window.addEventListener('blur', () => this.keys.clear())

    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement !== this.canvas) return // samo prava ujeta miška
      this.lookX += e.movementX
      this.lookY += e.movementY
    })
    canvas.addEventListener('mousedown', (e) => {
      if (this.locked) for (const h of this.mouseHandlers) h(e)
    })
    canvas.addEventListener('contextmenu', (e) => e.preventDefault())
    canvas.addEventListener('wheel', (e) => {
      if (this.locked) for (const h of this.wheelHandlers) h(Math.sign(e.deltaY))
    }, { passive: true })
  }

  // "locked" pomeni: igra je aktivna in sprejema vnos
  get locked() {
    return document.pointerLockElement === this.canvas || (this.touch && this.touchPlaying)
  }

  lock() {
    if (this.touch) {
      this.touchPlaying = true
      // Na telefonu poskusimo celozaslonski način in ležeči zaslon
      const el = document.documentElement
      if (!document.fullscreenElement && el.requestFullscreen) {
        el.requestFullscreen().then(() => screen.orientation?.lock?.('landscape')).catch(() => {})
      }
      return
    }
    // requestPointerLock lahko vrne napako, če uporabnik prehitro klikne – ni hudega
    try {
      const p = this.canvas.requestPointerLock()
      if (p && p.catch) p.catch(() => {})
    } catch {}
  }

  unlock() {
    this.touchPlaying = false
    this.touchMove = { forward: 0, right: 0 }
    if (document.pointerLockElement === this.canvas) document.exitPointerLock()
  }

  onKey(h) { this.pressedHandlers.push(h) }
  onMouse(h) { this.mouseHandlers.push(h) }
  onWheel(h) { this.wheelHandlers.push(h) }

  down(...codes) {
    return codes.some((c) => this.keys.has(c))
  }

  // Vrne premik miške in ga ponastavi
  takeLook() {
    const r = [this.lookX * this.sensitivity, this.lookY * this.sensitivity]
    this.lookX = this.lookY = 0
    return r
  }

  get move() {
    const clamp = (v) => Math.max(-1, Math.min(1, v))
    return {
      forward: clamp((this.down('KeyW', 'ArrowUp') ? 1 : 0) - (this.down('KeyS', 'ArrowDown') ? 1 : 0) + this.touchMove.forward),
      right: clamp((this.down('KeyD', 'ArrowRight') ? 1 : 0) - (this.down('KeyA', 'ArrowLeft') ? 1 : 0) + this.touchMove.right),
    }
  }
}
