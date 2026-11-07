import { MODELS } from './ModelLibrary.js';

export const COLORS = [
  { title: 'Исходный', value: null, swatch: 'linear-gradient(135deg,#fff 0 45%,#c33 45% 55%,#fff 55%)' },
  { title: 'Белый', value: '#f2f2f2' },
  { title: 'Красный', value: '#d33a2c' },
  { title: 'Синий', value: '#2f6fe0' },
  { title: 'Зелёный', value: '#2fa35a' },
  { title: 'Золотой', value: '#d4a63a' },
];

export const HDRIS = [
  { title: 'Студия', url: 'hdri/ferndale_studio_04_1k.hdr' },
  { title: 'Закат', url: 'hdri/venice_sunset_1k.hdr' },
];

/**
 * HTML-интерфейс. Сам ничего не меняет в сцене – только сообщает
 * о действиях пользователя через колбэки, которые подключает ARApp.
 */
export class UIPanel {
  constructor(root, handlers) {
    this.root = root;
    this.h = handlers;
    this.build();
  }

  build() {
    const r = this.root;
    r.querySelector('#model-select').innerHTML = Object.entries(MODELS)
      .map(([key, m]) => `<option value="${key}">${m.title}</option>`).join('');
    r.querySelector('#hdri-select').innerHTML = HDRIS
      .map((e, i) => `<option value="${i}">${e.title}</option>`).join('');

    const swatches = r.querySelector('#swatches');
    COLORS.forEach((c, i) => {
      const b = document.createElement('button');
      b.className = 'swatch' + (i === 0 ? ' active' : '');
      b.title = c.title;
      b.style.background = c.swatch || c.value;
      b.addEventListener('click', () => {
        swatches.querySelectorAll('.swatch').forEach((s) => s.classList.remove('active'));
        b.classList.add('active');
        this.h.onColor(c.value);
      });
      swatches.appendChild(b);
    });

    r.querySelector('#model-select').addEventListener('change', (e) => this.h.onModel(e.target.value));
    r.querySelector('#hdri-select').addEventListener('change', (e) => this.h.onHdri(HDRIS[+e.target.value].url));
    r.querySelector('#rot-left').addEventListener('click', () => this.h.onRotate(-Math.PI / 12));
    r.querySelector('#rot-right').addEventListener('click', () => this.h.onRotate(Math.PI / 12));
    r.querySelector('#auto-rotate').addEventListener('change', (e) => this.h.onAutoRotate(e.target.checked));
    r.querySelector('#roughness').addEventListener('input', (e) => this.h.onRoughness(+e.target.value));
    r.querySelector('#metalness').addEventListener('input', (e) => this.h.onMetalness(+e.target.value));
    r.querySelector('#collapse').addEventListener('click', () => r.classList.toggle('collapsed'));

    // Касания по панели в AR не должны превращаться в XR-событие select
    // (иначе каждое нажатие кнопки ставило бы новый объект).
    r.querySelector('.panel').addEventListener('beforexrselect', (e) => e.preventDefault());
  }

  /** Показывает в панели настройки выбранного объекта. */
  sync({ modelKey, color, roughness, metalness }) {
    const r = this.root;
    r.querySelector('#model-select').value = modelKey;
    r.querySelector('#roughness').value = roughness;
    r.querySelector('#metalness').value = metalness;
    const idx = Math.max(0, COLORS.findIndex((c) => c.value === color));
    r.querySelectorAll('.swatch').forEach((s, i) => s.classList.toggle('active', i === idx));
  }

  get modelKey() {
    return this.root.querySelector('#model-select').value;
  }

  setArButton(text, enabled, onClick) {
    const btn = this.root.querySelector('#ar-btn');
    btn.textContent = text;
    btn.disabled = !enabled;
    if (onClick) btn.onclick = onClick;
  }

  setArMode(active) {
    this.root.classList.toggle('in-ar', active);
    if (!active) this.setOverlayFallback(false);
  }

  setOverlayFallback(on) {
    this.root.classList.toggle('no-dom-overlay', on);
  }
}
