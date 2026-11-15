// Keyboard state with per-frame "pressed" edges, plus a virtual stick/buttons for touch screens.
const down = new Set();
const pressed = new Set();
const stick = { x: 0, y: 0 };

const BLOCK = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab']);

window.addEventListener('keydown', (e) => {
  if (BLOCK.has(e.code)) e.preventDefault();
  if (!down.has(e.code)) pressed.add(e.code);
  down.add(e.code);
});
window.addEventListener('keyup', (e) => down.delete(e.code));
window.addEventListener('blur', () => { down.clear(); stick.x = stick.y = 0; });

export const Input = {
  isDown: (code) => down.has(code),
  wasPressed: (code) => pressed.has(code),
  anyPressed: (...codes) => codes.some((c) => pressed.has(c)),
  endFrame: () => pressed.clear(),
  clear: () => { down.clear(); pressed.clear(); stick.x = stick.y = 0; },
  // touch buttons act like a single key tap
  press: (code) => pressed.add(code),
  // analog stick, each axis in [-1, 1]
  setStick(x, y) { stick.x = x; stick.y = y; },
  moveVector() {
    if (stick.x || stick.y) return { x: stick.x, y: stick.y };
    let x = 0, y = 0;
    if (down.has('KeyA') || down.has('ArrowLeft')) x -= 1;
    if (down.has('KeyD') || down.has('ArrowRight')) x += 1;
    if (down.has('KeyW') || down.has('ArrowUp')) y -= 1;
    if (down.has('KeyS') || down.has('ArrowDown')) y += 1;
    if (x && y) { x *= Math.SQRT1_2; y *= Math.SQRT1_2; }
    return { x, y };
  },
};
