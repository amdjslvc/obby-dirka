// ============================================================
//  KONTROLE ZA TELEFON
//  Levi palec: joystick (pojavi se tam, kjer se dotakneš)
//  Desni palec: vlečenje obrača kamero, gumb ⤒ je skok
// ============================================================

const RADIUS = 55 // kako daleč se lahko premakne gumb joysticka (v pikslih)
const DEADZONE = 0.15 // majhni premiki se ne štejejo
const LOOK_SPEED = 1.8 // občutljivost obračanja kamere

// actions: { jump, menu, restart, emote(i) }, emotes: seznam besedil
export function setupTouch(input, actions, emotes) {
  const root = document.getElementById('touch')
  root.innerHTML = `
    <div class="zone left"></div>
    <div class="zone right"></div>
    <div class="stick" hidden><div class="knob"></div></div>
    <button class="tbtn jump">⤒</button>
    <div class="topbtns">
      <button class="tbtn small" data-a="emote">😀</button>
      <button class="tbtn small" data-a="restart">↺</button>
      <button class="tbtn small" data-a="menu">☰</button>
    </div>
    <div class="emotes" hidden>${emotes.map((e, i) => `<button class="tbtn small" data-e="${i}">${e}</button>`).join('')}</div>
  `
  const q = (s) => root.querySelector(s)
  const stick = q('.stick'), knob = q('.knob'), emoteBox = q('.emotes')

  // --- joystick (leva polovica) ---
  let stickId = null, cx = 0, cy = 0
  q('.zone.left').addEventListener('pointerdown', (e) => {
    if (stickId !== null) return
    stickId = e.pointerId
    cx = e.clientX
    cy = e.clientY
    stick.style.left = cx + 'px'
    stick.style.top = cy + 'px'
    stick.hidden = false
    knob.style.transform = ''
    e.currentTarget.setPointerCapture(e.pointerId)
  })
  q('.zone.left').addEventListener('pointermove', (e) => {
    if (e.pointerId !== stickId) return
    let dx = e.clientX - cx, dy = e.clientY - cy
    const len = Math.hypot(dx, dy)
    if (len > RADIUS) { dx *= RADIUS / len; dy *= RADIUS / len }
    knob.style.transform = `translate(${dx}px, ${dy}px)`
    const strength = Math.min(len / RADIUS, 1)
    if (strength < DEADZONE) {
      input.touchMove = { forward: 0, right: 0 }
    } else {
      input.touchMove = { forward: -dy / RADIUS, right: dx / RADIUS }
    }
  })
  const endStick = (e) => {
    if (e.pointerId !== stickId) return
    stickId = null
    stick.hidden = true
    input.touchMove = { forward: 0, right: 0 }
  }
  q('.zone.left').addEventListener('pointerup', endStick)
  q('.zone.left').addEventListener('pointercancel', endStick)

  // --- kamera (desna polovica) ---
  const last = new Map() // pointerId -> [x, y]
  const right = q('.zone.right')
  right.addEventListener('pointerdown', (e) => {
    last.set(e.pointerId, [e.clientX, e.clientY])
    right.setPointerCapture(e.pointerId)
  })
  right.addEventListener('pointermove', (e) => {
    const p = last.get(e.pointerId)
    if (!p) return
    input.lookX += (e.clientX - p[0]) * LOOK_SPEED
    input.lookY += (e.clientY - p[1]) * LOOK_SPEED
    last.set(e.pointerId, [e.clientX, e.clientY])
  })
  const endLook = (e) => last.delete(e.pointerId)
  right.addEventListener('pointerup', endLook)
  right.addEventListener('pointercancel', endLook)

  // --- gumbi ---
  q('.jump').addEventListener('pointerdown', (e) => {
    e.preventDefault()
    actions.jump()
  })
  root.querySelectorAll('[data-a]').forEach((b) =>
    b.addEventListener('click', () => {
      const a = b.dataset.a
      if (a === 'emote') emoteBox.hidden = !emoteBox.hidden
      else actions[a]()
    })
  )
  root.querySelectorAll('[data-e]').forEach((b) =>
    b.addEventListener('click', () => {
      actions.emote(+b.dataset.e)
      emoteBox.hidden = true
    })
  )
}
