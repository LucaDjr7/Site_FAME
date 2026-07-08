// Injecte un faux curseur (rond doré FAME) qui suit les positions de souris
// pilotées par capture.ts, avec une impulsion au clic.
export const CURSOR_INIT_SCRIPT = `
(() => {
  if (window.__fameCursor) return
  const el = document.createElement('div')
  el.style.cssText = 'position:fixed;z-index:2147483647;width:18px;height:18px;border-radius:50%;' +
    'background:rgba(232,177,73,0.9);border:2px solid #15203f;pointer-events:none;' +
    'transform:translate(-50%,-50%);transition:left .05s linear,top .05s linear;left:-50px;top:-50px'
  const attach = () => document.body && document.body.appendChild(el)
  document.readyState === 'loading' ? addEventListener('DOMContentLoaded', attach) : attach()
  window.__fameCursor = {
    move(x, y) { el.style.left = x + 'px'; el.style.top = y + 'px' },
    pulse() {
      el.animate([{ transform: 'translate(-50%,-50%) scale(1)' }, { transform: 'translate(-50%,-50%) scale(1.8)' }, { transform: 'translate(-50%,-50%) scale(1)' }], { duration: 300 })
    },
  }
})()`
