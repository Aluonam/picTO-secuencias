// Componentes reutilizables de interfaz.
import { prefs, defaultPrefs, mediaUrl, putMedia, save, usedPictos, HELP_LEVELS, session } from './store.js';
import { pictoUrl, thumbUrl, searchPictos, cachePictos, ATTRIBUTION } from './pictos.js';

// ───────── DOM ─────────
export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k in el && k !== 'list' && k !== 'type') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  el.append(...children.flat(Infinity).filter(c => c != null && c !== false));
  return el;
}

const ICONS = {
  back: 'M19 12H5M12 19l-7-7 7-7',
  next: 'M5 12h14M12 5l7 7-7 7',
  check: 'M20 6L9 17l-5-5',
  x: 'M18 6L6 18M6 6l12 12',
  speaker: 'M11 5L6 9H2v6h4l5 4V5zM15.5 8.5a5 5 0 010 7M19 5a10 10 0 010 14',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  card: 'M5 3h14a1 1 0 011 1v16a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1z',
  lock: 'M5 11h14v10H5zM8 11V7a4 4 0 018 0v4',
  plus: 'M12 5v14M5 12h14',
  up: 'M18 15l-6-6-6 6',
  down: 'M6 9l6 6 6-6',
  trash: 'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6',
  edit: 'M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4L16.5 3.5z',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  user: 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z',
  users: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.9M16 3.1a4 4 0 010 7.8',
  chart: 'M3 3v18h18M7 14l4-4 3 3 5-6',
  clock: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3 2',
  sliders: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6',
  play: 'M6 4l14 8-14 8V4z',
  mic: 'M12 2a3 3 0 00-3 3v6a3 3 0 006 0V5a3 3 0 00-3-3zM19 11a7 7 0 01-14 0M12 18v4',
  stop: 'M6 6h12v12H6z',
  image: 'M3 5h18v14H3zM3 16l5-5 4 4 3-3 6 6',
  search: 'M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.3-4.3',
  download: 'M12 3v12M7 10l5 5 5-5M4 21h16',
  upload: 'M12 15V3M7 8l5-5 5 5M4 21h16',
  grid: 'M3 3h8v8H3zM13 3h8v8h-8zM3 13h8v8H3zM13 13h8v8h-8z',
  redo: 'M21 3v6h-6M21 9a9 9 0 10.5 6',
  folder: 'M3 6a1 1 0 011-1h5l2 2h9a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V6z',
  note: 'M5 3h10l4 4v14H5zM9 12h6M9 16h6',
};
export function icon(name) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('class', 'ico');
  s.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', ICONS[name]);
  s.append(p);
  return s;
}

/** Botón. kind: primary | done | ghost | danger (por defecto, secundario). */
export function btn(label, { icon: ic, iconEnd, kind = '', big, small, ...rest } = {}) {
  return h('button', { type: 'button', class: `btn ${kind}${big ? ' big' : ''}${small ? ' small' : ''}`, ...rest },
    ic && icon(ic), label && h('span', null, label), iconEnd && icon(iconEnd));
}
export const iconBtn = (name, label, props = {}) =>
  h('button', { type: 'button', class: `icon-btn ${props.kind || ''}`, 'aria-label': label, title: label, ...props, kind: null }, icon(name));

export const go = hash => { location.hash = hash; };
export const refresh = () => window.dispatchEvent(new Event('hashchange'));
/** Abre un editor del modo configuración recordando la pantalla desde la que se entró. */
export const editFrom = target => { session.returnTo = location.hash || '#/'; go(target); };

// ───────── Imágenes ─────────
function placeholder(label) {
  return h('span', { class: 'ph', role: 'img', 'aria-label': 'Sin imagen' }, label ?? '');
}
/** Pictograma ARASAAC (se sirve desde la caché del dispositivo si ya está guardado). */
export function pictoImg(id, alt = '', fallbackLabel) {
  if (!id) return placeholder(fallbackLabel);
  const img = h('img', { class: 'picto', alt, crossOrigin: 'anonymous', draggable: false, decoding: 'async' });
  img.onerror = () => img.replaceWith(placeholder(fallbackLabel));
  img.src = pictoUrl(id);
  return img;
}
export function photoImg(mediaId, alt = '') {
  const img = h('img', { class: 'photo', alt, draggable: false });
  mediaUrl(mediaId).then(u => { if (u) img.src = u; });
  return img;
}
/** Imagen de una actividad o paso según el modo de visualización de la persona. */
export function visual(item, { alt = '', label, cls = '' } = {}) {
  const mode = prefs().viewMode;
  const usePhoto = item.photo && (mode === 'photo' || !item.picto);
  return h('div', { class: `visual ${cls}` }, usePhoto ? photoImg(item.photo, alt) : pictoImg(item.picto, alt, label));
}

// ───────── Estructura de página ─────────
export function page({ title, back, right, cls = '', attribution = true }, ...body) {
  // Con el modo configuración activo, las pantallas de uso muestran los controles de edición.
  const editing = session.unlocked && !cls.includes('therapist');
  return h('div', { class: `page ${cls}` },
    editing && h('div', { class: 'edit-bar' },
      icon('edit'), h('span', null, 'Modo configuración activo. Pulsa el lápiz de una tarjeta para editarla.'),
      btn('Panel', { small: true, onclick: () => go('#/t') }),
      btn('Salir del modo', { small: true, icon: 'lock', onclick: () => { session.unlocked = false; session.returnTo = null; refresh(); } })),
    h('header', { class: 'bar' },
      back ? btn('Atrás', { icon: 'back', kind: 'ghost', onclick: () => go(back) }) : h('span'),
      h('h1', { class: 'say' }, title),
      right || h('span')),
    h('main', { class: 'content' }, body),
    attribution && h('footer', { class: 'credit' }, ATTRIBUTION));
}

/** Tarjeta grande con imagen y texto (categorías, actividades, rutinas). */
export function tile({ item, title, meta, badge, onclick, onedit }) {
  const card = tileCard({ item, title, meta, badge, onclick });
  if (!onedit || !session.unlocked) return card;
  return h('div', { class: 'tile-wrap' }, card,
    h('button', { type: 'button', class: 'tile-edit', 'aria-label': `Editar ${title}`, title: `Editar ${title}`, onclick: onedit }, icon('edit')));
}
function tileCard({ item, title, meta, badge, onclick }) {
  return h('button', { type: 'button', class: 'tile', onclick },
    visual(item, { label: '' }),
    h('span', { class: 'tile-title say' }, title),
    meta && h('span', { class: 'tile-meta' }, meta),
    badge && h('span', { class: 'badge' }, badge));
}

// ───────── Diálogos ─────────
/** Abre un diálogo modal. `build(close)` devuelve el contenido; la promesa se resuelve con el valor pasado a close. */
export function dialog(build, { wide } = {}) {
  return new Promise(resolve => {
    const dlg = h('dialog', { class: `dlg${wide ? ' wide' : ''}` });
    const close = v => { dlg.close(); dlg.remove(); resolve(v); };
    dlg.addEventListener('cancel', e => { e.preventDefault(); close(undefined); });
    dlg.append(build(close));
    document.body.append(dlg);
    dlg.showModal();
  });
}
export const choose = ({ title, text, options }) => dialog(close => h('div', { class: 'dlg-body' },
  h('h2', null, title),
  text && h('p', null, text),
  h('div', { class: 'dlg-actions stack' },
    options.map(o => btn(o.label, { kind: o.kind || '', icon: o.icon, big: true, onclick: () => close(o.value) })))));

export const confirmDanger = (title, text, label = 'Eliminar') => choose({
  title, text, options: [{ label, value: true, kind: 'danger', icon: 'trash' }, { label: 'Cancelar', value: false }],
});

export function toast(msg) {
  document.querySelector('.toast')?.remove();
  const t = h('div', { class: 'toast', role: 'status' }, msg);
  document.body.append(t);
  setTimeout(() => t.remove(), 3200);
}

// ───────── Formularios ─────────
export const field = (label, control, hint) => h('label', { class: 'field' },
  h('span', { class: 'field-label' }, label), control, hint && h('span', { class: 'hint' }, hint));

export function select(options, value, onchange, props = {}) {
  const s = h('select', { ...props, onchange: e => onchange(e.target.value) },
    options.map(([v, label]) => h('option', { value: v }, label)));
  s.value = value ?? '';
  return s;
}
/** Grupo de opciones excluyentes con aspecto de botones. */
export function segmented(label, options, value, onchange) {
  const name = 'seg' + Math.random().toString(36).slice(2);
  return h('fieldset', { class: 'seg' },
    h('legend', null, label),
    h('div', { class: 'seg-row' }, options.map(([v, text]) => h('label', null,
      h('input', { type: 'radio', name, value: String(v), checked: v === value, onchange: () => onchange(v) }),
      h('span', null, text)))));
}
export const toggle = (label, value, onchange, hint) => h('label', { class: 'toggle' },
  h('input', { type: 'checkbox', checked: !!value, onchange: e => onchange(e.target.checked) }),
  h('span', null, h('b', null, label), hint && h('small', null, hint)));

export function pickFile(accept, capture) {
  return new Promise(resolve => {
    const input = h('input', { type: 'file', accept, capture, onchange: () => resolve(input.files[0] || null) });
    input.click();
  });
}
/** Reduce la fotografía antes de guardarla en el dispositivo. */
export async function savePhoto(file, max = 1280) {
  let blob = file;
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const canvas = h('canvas', { width: Math.round(bmp.width * k), height: Math.round(bmp.height * k) });
    canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
    blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.85));
  } catch { /* formato no compatible: se guarda tal cual */ }
  return putMedia(blob);
}

// ───────── Voz y audio ─────────
const RATES = { slow: 0.7, normal: 0.9, fast: 1.1 };
let player;
export function stopSound() {
  window.speechSynthesis?.cancel();
  player?.pause();
  player = null;
}
export const spanishVoices = () => (window.speechSynthesis?.getVoices() || []).filter(v => v.lang.toLowerCase().startsWith('es'));
export function speak(text, p = prefs()) {
  if (!('speechSynthesis' in window) || !text) return;
  stopSound();
  const u = new SpeechSynthesisUtterance(text);
  const voices = spanishVoices();
  const voice = voices.find(v => v.voiceURI === p.voiceURI) || voices.find(v => v.lang === 'es-ES') || voices[0];
  if (voice) u.voice = voice;
  u.lang = voice?.lang || 'es-ES';
  u.rate = RATES[p.rate] || 0.9;
  speechSynthesis.speak(u);
}
/** Reproduce el audio grabado del paso o, si no lo tiene, lee el texto en voz alta. */
export async function sayStep(step) {
  stopSound();
  const url = step.audio && await mediaUrl(step.audio);
  if (url) { player = new Audio(url); player.play().catch(() => {}); } else speak(step.text);
}

// ───────── Preferencias visuales ─────────
export function applyPrefs() {
  // El modo terapeuta usa siempre la presentación estándar.
  const p = /^#\/t(\/|$)/.test(location.hash) ? defaultPrefs() : prefs(), root = document.documentElement;
  root.dataset.contrast = p.contrast;
  root.dataset.scale = p.fontScale;
  root.dataset.upper = p.uppercase ? '1' : '0';
  root.dataset.view = p.viewMode;
}

// ───────── Formato ─────────
export const fmtDate = t => new Date(t).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
export const fmtTime = t => new Date(t).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
export function fmtDuration(sec) {
  if (sec < 60) return `${sec} s`;
  const m = Math.floor(sec / 60), s = sec % 60;
  return s ? `${m} min ${s} s` : `${m} min`;
}
export const helpLabel = v => (v == null ? 'Sin registrar' : HELP_LEVELS[v]);
const helpOptions = () => [['', 'Sin registrar'], ...HELP_LEVELS.map((l, i) => [String(i), l])];
export const helpSelect = (value, onchange, props) =>
  select(helpOptions(), value == null ? '' : String(value), v => onchange(v === '' ? null : Number(v)), props);

// ───────── Registro del terapeuta (nivel de ayuda por paso y observaciones) ─────────
export function logDialog(log) {
  return dialog(close => {
    const draft = structuredClone(log);
    const rows = h('ol', { class: 'log-steps' });
    const draw = () => rows.replaceChildren(...draft.steps.map((s, i) => h('li', { class: s.done ? 'is-done' : '' },
      h('span', { class: `state ${s.done ? 'done' : ''}` }, s.done ? icon('check') : String(i + 1)),
      h('span', { class: 'log-text' }, s.text, s.repeats ? h('small', null, ` · repetido ${s.repeats} ${s.repeats === 1 ? 'vez' : 'veces'}`) : null),
      helpSelect(s.help, v => { s.help = v; }, { 'aria-label': `Nivel de ayuda en el paso ${i + 1}` }))));
    draw();
    const notes = h('textarea', { rows: 3, value: draft.notes || '', placeholder: 'Observaciones de la sesión' });
    return h('div', { class: 'dlg-body' },
      h('h2', null, 'Registro del terapeuta'),
      h('p', { class: 'muted' }, `${draft.title} · ${fmtDate(draft.startedAt)} · ${draft.completed} de ${draft.total} pasos · ${fmtDuration(draft.durationSec)}`),
      field('Aplicar el mismo nivel a todos los pasos',
        helpSelect(null, v => { draft.steps.forEach(s => { s.help = v; }); draw(); })),
      h('h3', null, 'Nivel de ayuda en cada paso'),
      rows,
      field('Observaciones', notes),
      h('div', { class: 'dlg-actions' },
        btn('Cancelar', { onclick: () => close(false) }),
        btn('Guardar registro', { kind: 'primary', icon: 'check', onclick: async () => {
          Object.assign(log, draft, { notes: notes.value.trim() });
          await save('logs');
          close(true);
        } })));
  }, { wide: true });
}

// ───────── Selector de pictogramas ARASAAC ─────────
/** Devuelve el identificador elegido, `null` para quitar el pictograma o `undefined` si se cancela. */
export function pickPicto(current, suggestion = '') {
  return dialog(close => {
    const results = h('div', { class: 'picto-grid', 'aria-live': 'polite' });
    const status = h('p', { class: 'muted' });
    const pick = id => { cachePictos([id]).catch(() => {}); close(id); };
    const cell = (id, label, src) => h('button', { type: 'button', class: `picto-cell${id === current ? ' current' : ''}`, onclick: () => pick(id), title: label || `Pictograma ${id}` },
      h('img', { crossOrigin: src.includes('_500') ? 'anonymous' : null, alt: label || `Pictograma ${id}`, loading: 'lazy', src }),
      label && h('span', null, label));
    const showUsed = () => {
      status.textContent = 'Pictogramas que ya usas en tus actividades:';
      results.replaceChildren(...usedPictos().slice(0, 120).map(id => cell(id, '', pictoUrl(id))));
    };
    const input = h('input', { type: 'search', value: suggestion, placeholder: 'Por ejemplo: cepillo, grifo, camisa…', 'aria-label': 'Buscar pictograma' });
    const search = async () => {
      const q = input.value.trim();
      if (!q) return showUsed();
      if (!navigator.onLine) { status.textContent = 'Sin conexión. La búsqueda en ARASAAC necesita Internet; puedes elegir entre los pictogramas ya guardados.'; return; }
      status.textContent = 'Buscando…';
      results.replaceChildren();
      try {
        const list = await searchPictos(q);
        status.textContent = list.length ? `${list.length} resultados para «${q}»` : `Sin resultados para «${q}». Prueba con otra palabra (por ejemplo, el verbo en infinitivo).`;
        results.replaceChildren(...list.map(p => cell(p.id, p.label, thumbUrl(p.id))));
      } catch {
        status.textContent = 'No se ha podido conectar con ARASAAC. Inténtalo más tarde.';
      }
    };
    showUsed();
    return h('div', { class: 'dlg-body' },
      h('h2', null, 'Elegir pictograma'),
      h('form', { class: 'search-row', onsubmit: e => { e.preventDefault(); search(); } },
        input, btn('Buscar', { icon: 'search', kind: 'primary', type: 'submit' })),
      h('p', { class: 'hint' }, 'La búsqueda envía a ARASAAC solo la palabra escrita. No escribas nombres ni datos personales.'),
      status, results,
      h('p', { class: 'credit' }, `${ATTRIBUTION}. Autor: Sergio Palao. Licencia CC BY-NC-SA.`),
      h('div', { class: 'dlg-actions' },
        current ? btn('Quitar pictograma', { icon: 'trash', onclick: () => close(null) }) : null,
        btn('Cancelar', { onclick: () => close(undefined) })));
  }, { wide: true });
}

/** Control de formulario para ver y cambiar un pictograma. */
export function pictoField(item, suggestion, onchange) {
  const box = h('div', { class: 'picto-field' });
  const draw = () => box.replaceChildren(
    h('div', { class: 'visual small' }, pictoImg(item.picto, 'Pictograma actual')),
    btn(item.picto ? 'Cambiar pictograma' : 'Elegir pictograma', { icon: 'search', onclick: async () => {
      const id = await pickPicto(item.picto, suggestion());
      if (id === undefined) return;
      item.picto = id;
      await onchange();
      draw();
    } }));
  draw();
  return box;
}
