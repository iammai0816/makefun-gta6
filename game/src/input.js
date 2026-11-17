// Neon Bay — keyboard + mouse input. One shared state object the loop reads.
export function createInput(canvas) {
  const input = {
    up: false, down: false, left: false, right: false,
    mouseX: 0, mouseY: 0, mouseDown: false, clicked: false,
    pressed: new Set(), // keys pressed since last consume
  };
  const keyMap = {
    KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down',
    KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
  };
  window.addEventListener('keydown', (e) => {
    if (keyMap[e.code]) { input[keyMap[e.code]] = true; e.preventDefault(); }
    if (!e.repeat) input.pressed.add(e.code);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => {
    if (keyMap[e.code]) input[keyMap[e.code]] = false;
  });
  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    input.mouseX = e.clientX - r.left; input.mouseY = e.clientY - r.top;
  });
  canvas.addEventListener('mousedown', (e) => {
    input.mouseDown = true; input.clicked = true;
    const r = canvas.getBoundingClientRect();
    input.mouseX = e.clientX - r.left; input.mouseY = e.clientY - r.top;
  });
  window.addEventListener('mouseup', () => { input.mouseDown = false; });
  window.addEventListener('blur', () => {
    input.up = input.down = input.left = input.right = false; input.mouseDown = false;
  });
  // True once for a key pressed since the last frame, then cleared by the loop.
  input.wasPressed = (code) => input.pressed.has(code);
  input.endFrame = () => { input.pressed.clear(); input.clicked = false; };
  return input;
}
