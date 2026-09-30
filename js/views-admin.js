// Modo configuración (terapeuta): personas, preferencias, seguimiento y configuración.
import {
  state, save, person, personName, newPerson, deletePerson, HELP_LEVELS, maxHelp, helpedSteps, logKey,
  activity, exportAll, importAll, wipeAll,
} from './store.js';
import {
  h, btn, iconBtn, go, choose, confirmDanger, toast, field, select, segmented, toggle, pickFile,
  speak, spanishVoices, applyPrefs, fmtDate, fmtTime, fmtDuration, helpLabel, logDialog,
} from './ui.js';
import { cacheStatus, cachePictos, ATTRIBUTION } from './pictos.js';
import { usedPictos } from './store.js';
import { refresh, tpage, hashPin, installCard } from './views-therapist.js';

// ───────── Preferencias (de una persona o generales) ─────────
function prefsForm(p, onchange) {
  const set = (k, v) => { p[k] = v; onchange(); };
  const voices = spanishVoices();
  return h('div', { class: 'form' },
    h('h3', null, 'Presentación'),
    segmented('Modo de visualización', [['picto', 'Pictogramas'], ['photo', 'Fotografías'], ['text', 'Texto + imagen']], p.viewMode, v => set('viewMode', v)),
    h('p', { class: 'hint' }, 'Pictogramas: imagen grande y frase breve. Fotografías: usa las fotografías reales de cada paso cuando existen. Texto + imagen: texto más grande e indicación adicional.'),
    segmented('Tipo de pictograma', [['color', 'Color'], ['bn', 'Blanco y negro']], p.pictoStyle, v => set('pictoStyle', v)),
    segmented('Tamaño de letra', [[1, 'Normal'], [2, 'Grande'], [3, 'Muy grande']], p.fontScale, v => set('fontScale', v)),
    segmented('Contraste', [['normal', 'Normal'], ['high', 'Alto contraste']], p.contrast, v => set('contrast', v)),
    toggle('Texto en mayúsculas', p.uppercase, v => set('uppercase', v)),
    h('h3', null, 'Secuencia de pasos'),
    segmented('Navegación', [['seq', 'Secuencial (recomendada)'], ['list', 'Lista']], p.runMode, v => set('runMode', v)),
    h('p', { class: 'hint' }, 'Secuencial: solo se ve el paso actual. Lista: se ve toda la secuencia con los pasos completados y pendientes.'),
    toggle('Avance automático', p.autoAdvance, v => set('autoAdvance', v), 'Al pulsar HECHO se pasa solo al siguiente paso.'),
    segmented('Velocidad del cambio de paso', [['fast', 'Rápida'], ['normal', 'Normal'], ['slow', 'Lenta']], p.stepDelay, v => set('stepDelay', v)),
    toggle('Registrar la ayuda durante la actividad', p.helpBar, v => set('helpBar', v), 'Muestra un selector discreto de nivel de ayuda bajo cada paso.'),
    h('h3', null, 'Voz'),
    toggle('Leer cada paso en voz alta al mostrarlo', p.autoSpeak, v => set('autoSpeak', v)),
    voices.length
      ? field('Voz', select([['', 'Voz en español por defecto'], ...voices.map(v => [v.voiceURI, `${v.name} (${v.lang})`])], p.voiceURI, v => set('voiceURI', v)))
      : h('p', { class: 'hint' }, 'Este dispositivo no ofrece voces en español para la lectura automática. Puedes grabar un audio propio en cada paso.'),
    segmented('Velocidad de la voz', [['slow', 'Lenta'], ['normal', 'Normal'], ['fast', 'Rápida']], p.rate, v => set('rate', v)),
    h('div', null, btn('Probar la voz', { icon: 'speaker', onclick: () => speak('Coge el cepillo de dientes', p) })));
}

// ───────── Personas ─────────
export function viewPersons() {
  const s = state.settings;
  const use = async id => { s.currentPersonId = id; await save('settings'); applyPrefs(); refresh(); };
  const name = h('input', { type: 'text', maxLength: 40, placeholder: 'Nombre o alias', 'aria-label': 'Nombre de la nueva persona' });
  const row = (id, title, meta) => h('li', { class: 'row' },
    h('div', { class: 'row-main' }, h('b', null, title), h('small', null, meta)),
    h('div', { class: 'row-actions' },
      s.currentPersonId === id ? h('span', { class: 'badge static' }, 'Activa') : btn('Usar en este dispositivo', { small: true, onclick: () => use(id) }),
      id && btn('Editar', { icon: 'edit', small: true, onclick: () => go(`#/t/persona/${id}`) })));
  return tpage('Personas', '#/t',
    h('form', { class: 'toolbar', onsubmit: e => {
      e.preventDefault();
      if (!name.value.trim()) return name.focus();
      go(`#/t/persona/${newPerson(name.value.trim()).id}`);
    } }, field('Añadir persona', name), btn('Añadir', { icon: 'plus', kind: 'primary', type: 'submit' })),
    h('ul', { class: 'rows' },
      row(null, 'Uso general', 'Sin persona concreta. Usa las preferencias generales.'),
      state.persons.map(p => row(p.id, p.name,
        `${state.logs.filter(l => l.personId === p.id).length} sesiones registradas · ${state.activities.filter(a => a.personId === p.id).length} actividades propias`))),
    h('p', { class: 'hint' }, 'Puedes usar un alias en lugar del nombre real. Los datos se guardan únicamente en este dispositivo.'));
}

export function viewPerson(id) {
  const p = person(id);
  if (!p) { go('#/t/personas'); return h('div'); }
  const saveP = async () => { await save('persons'); applyPrefs(); };
  const logs = state.logs.filter(l => l.personId === id).length;
  const own = state.activities.filter(a => a.personId === id).length;
  return tpage(p.name, '#/t/personas',
    h('section', { class: 'card form' },
      field('Nombre', h('input', { type: 'text', value: p.name, maxLength: 40, onchange: e => { p.name = e.target.value.trim() || p.name; saveP(); } }))),
    h('section', { class: 'card' }, h('h2', null, 'Preferencias'), prefsForm(p.prefs, saveP)),
    h('section', { class: 'card' },
      h('h2', null, 'Datos de esta persona'),
      h('p', null, `Guardados en este dispositivo: nombre, preferencias, ${own} actividades propias (con sus fotografías y audios) y ${logs} sesiones registradas.`),
      h('div', { class: 'toolbar start' },
        btn('Ver seguimiento', { icon: 'chart', onclick: () => { track.person = id; track.key = null; go('#/t/seguimiento'); } }),
        btn('Eliminar todos los datos de esta persona', { icon: 'trash', kind: 'danger', onclick: async () => {
          if (!await confirmDanger(`¿Eliminar todos los datos de ${p.name}?`, 'Se borrarán su ficha, sus actividades propias, fotografías, audios, rutinas y registros. No se puede deshacer.', 'Eliminar definitivamente')) return;
          await deletePerson(id);
          toast('Datos eliminados.');
          go('#/t/personas');
        } }))));
}

// ───────── Seguimiento ─────────
const track = { person: undefined, key: null };
const DAY = 86400000;
const dayStart = t => new Date(t).setHours(0, 0, 0, 0);

/** Gráfico: nivel máximo de ayuda de cada sesión, en orden cronológico. */
function helpChart(sessions) {
  const wrap = h('div', { class: 'chart' });
  const tip = h('div', { class: 'chart-tip', hidden: true });
  const NS = 'http://www.w3.org/2000/svg';
  const svgEl = (tag, attrs, text) => {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    if (text != null) e.textContent = text;
    return e;
  };
  function draw() {
    const W = wrap.clientWidth || 640, ROW = 30, TOP = 10, LEFT = W < 520 ? 138 : 170, RIGHT = 18;
    const H = TOP + ROW * HELP_LEVELS.length + 28;
    const svg = svgEl('svg', { width: W, height: H, role: 'img', 'aria-label': 'Nivel máximo de ayuda por sesión' });
    const y = level => TOP + ROW * level + ROW / 2; // «Independiente» arriba
    const x = i => (sessions.length === 1 ? (LEFT + W - RIGHT) / 2 : LEFT + 12 + (i * (W - RIGHT - LEFT - 24)) / (sessions.length - 1));
    HELP_LEVELS.forEach((label, l) => {
      svg.append(svgEl('line', { class: 'grid', x1: LEFT, x2: W - RIGHT, y1: y(l), y2: y(l) }));
      svg.append(svgEl('text', { class: 'axis', x: LEFT - 10, y: y(l) + 4, 'text-anchor': 'end' }, label));
    });
    if (sessions.length > 1) svg.append(svgEl('polyline', { class: 'line', points: sessions.map((s, i) => `${x(i)},${y(s.level)}`).join(' ') }));
    const base = TOP + ROW * HELP_LEVELS.length + 18;
    svg.append(svgEl('text', { class: 'axis', x: x(0), y: base, 'text-anchor': sessions.length === 1 ? 'middle' : 'start' }, fmtDate(sessions[0].log.startedAt)));
    if (sessions.length > 1) svg.append(svgEl('text', { class: 'axis', x: x(sessions.length - 1), y: base, 'text-anchor': 'end' }, fmtDate(sessions.at(-1).log.startedAt)));
    sessions.forEach((s, i) => {
      const dot = svgEl('circle', { class: 'dot', cx: x(i), cy: y(s.level), r: 6, tabindex: 0 });
      const hit = svgEl('circle', { class: 'hit', cx: x(i), cy: y(s.level), r: 16 });
      const show = () => {
        tip.replaceChildren(h('b', null, HELP_LEVELS[s.level]), h('span', null, `${fmtDate(s.log.startedAt)} · ${s.log.completed}/${s.log.total} pasos`));
        tip.hidden = false;
        tip.style.left = `${Math.min(Math.max(x(i), 90), W - 90)}px`;
        tip.style.top = `${y(s.level) - 14}px`;
      };
      const hide = () => { tip.hidden = true; };
      for (const el of [dot, hit]) {
        el.addEventListener('pointerenter', show);
        el.addEventListener('pointerleave', hide);
        el.addEventListener('click', show);
      }
      dot.addEventListener('focus', show);
      dot.addEventListener('blur', hide);
      svg.append(dot, hit);
    });
    wrap.replaceChildren(svg, tip);
  }
  new ResizeObserver(draw).observe(wrap);
  return wrap;
}

/** Evolución por semanas: nivel máximo de ayuda más habitual en las sesiones de cada semana. */
function weekly(logs) {
  const first = dayStart(logs[0].startedAt);
  const weeks = new Map();
  for (const log of logs) {
    const w = Math.floor((dayStart(log.startedAt) - first) / (7 * DAY));
    if (!weeks.has(w)) weeks.set(w, []);
    weeks.get(w).push(log);
  }
  return [...weeks].map(([w, list]) => {
    const levels = list.map(maxHelp).filter(v => v != null);
    const freq = levels.reduce((m, v) => m.set(v, (m.get(v) || 0) + 1), new Map());
    const level = levels.length ? [...freq].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0] : null;
    return { n: w + 1, from: first + w * 7 * DAY, sessions: list.length, level };
  });
}

function downloadFile(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  h('a', { href: url, download: name }).click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function exportCsv(logs) {
  const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const head = ['Persona', 'Actividad', 'Fecha', 'Hora', 'Pasos completados', 'Pasos totales', 'Duración (s)', 'Ayuda máxima', 'Pasos con ayuda', 'Detalle por paso', 'Observaciones'];
  const lines = logs.map(l => [
    personName(l.personId), l.title, new Date(l.startedAt).toLocaleDateString('es-ES'), fmtTime(l.startedAt), l.completed, l.total, l.durationSec,
    helpLabel(maxHelp(l)), helpedSteps(l),
    l.steps.map((s, i) => `${i + 1}. ${s.text}: ${s.done ? 'hecho' : 'no hecho'}, ${helpLabel(s.help)}`).join(' | '), l.notes,
  ].map(q).join(';'));
  downloadFile('seguimiento.csv', `﻿${[head.map(q).join(';'), ...lines].join('\r\n')}`, 'text/csv;charset=utf-8');
}

export function viewTracking() {
  if (track.person === undefined) track.person = state.settings.currentPersonId || '';
  const pid = track.person || null;
  const all = state.logs.filter(l => (l.personId || null) === pid).sort((a, b) => a.startedAt - b.startedAt);
  const groups = new Map();
  all.forEach(l => groups.set(logKey(l), activity(logKey(l))?.title || l.title));
  if (!groups.has(track.key)) track.key = all.length ? logKey(all.at(-1)) : null;
  const logs = all.filter(l => logKey(l) === track.key);
  const withHelp = logs.filter(l => maxHelp(l) != null).map(log => ({ log, level: maxHelp(log) }));

  const filters = h('div', { class: 'toolbar' },
    field('Persona', select([['', 'Uso general'], ...state.persons.map(p => [p.id, p.name])], track.person, v => { track.person = v; track.key = null; refresh(); })),
    groups.size > 0 && field('Actividad', select([...groups], track.key, v => { track.key = v; refresh(); })),
    all.length > 0 && btn('Exportar CSV', { icon: 'download', onclick: () => exportCsv(all) }));

  if (!logs.length) {
    return tpage('Seguimiento', '#/t', filters,
      h('p', { class: 'empty' }, 'Todavía no hay sesiones registradas para esta persona. Se guardan al terminar una actividad.'));
  }

  const weeks = weekly(logs);
  return tpage('Seguimiento', '#/t', filters,
    h('section', { class: 'card' },
      h('h2', null, groups.get(track.key)),
      h('p', { class: 'muted' }, `${logs.length} ${logs.length === 1 ? 'sesión' : 'sesiones'} · última: ${fmtDate(logs.at(-1).startedAt)}`),
      h('h3', null, 'Nivel máximo de ayuda en cada sesión'),
      withHelp.length
        ? helpChart(withHelp)
        : h('p', { class: 'empty' }, 'Aún no se ha registrado el nivel de ayuda en ninguna sesión. Abre una sesión de la tabla para registrarlo.'),
      h('h3', null, 'Evolución por semanas'),
      h('ol', { class: 'weeks' }, weeks.map(w => h('li', null,
        h('b', null, `Semana ${w.n}`),
        h('span', { class: 'muted' }, `desde el ${fmtDate(w.from)}`),
        h('span', { class: 'week-level' }, w.level == null ? 'Ayuda sin registrar' : HELP_LEVELS[w.level]),
        h('span', { class: 'muted' }, `${w.sessions} ${w.sessions === 1 ? 'sesión' : 'sesiones'}`)))),
      h('p', { class: 'hint' }, 'Cada semana muestra el nivel máximo de ayuda más habitual en sus sesiones. Son datos descriptivos para apoyar el razonamiento clínico del terapeuta: la aplicación no emite diagnósticos ni valoraciones automáticas.')),
    h('section', { class: 'card' },
      h('h2', null, 'Sesiones'),
      h('div', { class: 'table-wrap' }, h('table', null,
        h('thead', null, h('tr', null, ['Fecha', 'Pasos', 'Tiempo', 'Ayuda máxima', 'Pasos con ayuda', 'Observaciones', ''].map(t => h('th', null, t)))),
        h('tbody', null, [...logs].reverse().map(l => h('tr', null,
          h('td', null, `${fmtDate(l.startedAt)}, ${fmtTime(l.startedAt)}`),
          h('td', null, `${l.completed} / ${l.total}`),
          h('td', null, fmtDuration(l.durationSec)),
          h('td', null, helpLabel(maxHelp(l))),
          h('td', null, maxHelp(l) == null ? '—' : l.steps.filter(s => s.help > 0).map(s => l.steps.indexOf(s) + 1).join(', ') || 'Ninguno'),
          h('td', { class: 'notes' }, l.notes || '—'),
          h('td', { class: 'cell-actions' },
            btn('Abrir', { icon: 'note', small: true, onclick: async () => { if (await logDialog(l)) refresh(); } }),
            iconBtn('trash', 'Eliminar sesión', { kind: 'danger', onclick: async () => {
              if (!await confirmDanger('¿Eliminar esta sesión?', `${l.title} · ${fmtDate(l.startedAt)}`)) return;
              state.logs = state.logs.filter(x => x !== l); await save('logs'); refresh();
            } })))))))));
}

// ───────── Configuración ─────────
export function viewSettings() {
  const s = state.settings;
  const pictoInfo = h('p', { class: 'muted' }, 'Comprobando pictogramas guardados…');
  const showStatus = st => {
    pictoInfo.textContent = st.supported
      ? `${st.saved} de ${st.total} pictogramas en uso están guardados en este dispositivo para trabajar sin conexión.`
      : 'Este navegador no permite guardar pictogramas para uso sin conexión (se necesita abrir la aplicación por HTTPS).';
  };
  cacheStatus().then(showStatus);

  return tpage('Ajustes', '#/t',
    h('section', { class: 'card' },
      h('h2', null, 'Preferencias generales'),
      h('p', { class: 'muted' }, 'Se aplican cuando no hay una persona activa y sirven de punto de partida para las personas nuevas. Cada persona tiene sus propias preferencias en «Personas».'),
      prefsForm(s.prefs, async () => { await save('settings'); applyPrefs(); })),

    h('section', { class: 'card' },
      h('h2', null, 'Pictogramas ARASAAC'),
      pictoInfo,
      toggle('Guardar los pictogramas en uso para trabajar sin conexión', s.offlinePictos, async v => { s.offlinePictos = v; await save('settings'); },
        'Solo se descargan los pictogramas que utilizan tus actividades, una vez cada uno.'),
      h('div', { class: 'toolbar start' }, btn('Guardar ahora los que faltan', { icon: 'download', onclick: async e => {
        const b = e.currentTarget; b.disabled = true;
        showStatus(await cachePictos(usedPictos(), (saved, total) => showStatus({ saved, total, supported: true })));
        b.disabled = false;
      } })),
      h('p', { class: 'hint' }, `${ATTRIBUTION}. Los símbolos pictográficos utilizados son propiedad del Gobierno de Aragón y han sido creados por Sergio Palao para ARASAAC (https://arasaac.org), que los distribuye bajo licencia Creative Commons BY-NC-SA. La aplicación no incluye los pictogramas: los solicita a ARASAAC cuando se necesitan.`)),

    h('section', { class: 'card' },
      h('h2', null, 'Privacidad y datos'),
      h('ul', { class: 'plain' },
        h('li', null, 'Todo se guarda únicamente en este dispositivo: personas, preferencias, actividades, fotografías, audios y registros de sesiones.'),
        h('li', null, 'No hay servidor propio, cuentas, analítica ni publicidad.'),
        h('li', null, 'La única conexión externa es con ARASAAC, para descargar pictogramas y buscar por palabra. No se envían nombres, fotografías ni registros.'),
        h('li', null, 'El PIN evita accesos accidentales al modo configuración; no cifra los datos. Protege el dispositivo con su propio bloqueo.')),
      h('p', { class: 'muted' }, `Ahora mismo: ${state.persons.length} personas, ${state.activities.length} actividades, ${state.routines.length} rutinas y ${state.logs.length} sesiones registradas.`),
      h('div', { class: 'toolbar start' },
        btn('Exportar copia de seguridad', { icon: 'download', onclick: async () => {
          downloadFile(`avd-pasos-copia-${new Date().toLocaleDateString('sv')}.json`, JSON.stringify(await exportAll()), 'application/json');
          toast('Copia exportada. Contiene datos personales: guárdala en un lugar seguro.');
        } }),
        btn('Importar copia', { icon: 'upload', onclick: async () => {
          const file = await pickFile('application/json,.json');
          if (!file) return;
          if (!await confirmDanger('¿Importar la copia?', 'Sustituirá todos los datos actuales de este dispositivo.', 'Importar y sustituir')) return;
          try { await importAll(JSON.parse(await file.text())); applyPrefs(); toast('Copia importada.'); refresh(); } catch { toast('El archivo no es una copia válida.'); }
        } }),
        btn('Borrar todos los datos', { icon: 'trash', kind: 'danger', onclick: async () => {
          if (!await confirmDanger('¿Borrar todos los datos?', 'Se eliminarán personas, actividades, fotografías, audios y registros, y la aplicación volverá a su estado inicial. No se puede deshacer.', 'Borrar todo')) return;
          await wipeAll();
          if ('caches' in window) await caches.delete('arasaac-pictos-v1');
          location.hash = '#/';
          location.reload();
        } }))),

    h('section', { class: 'card' },
      h('h2', null, 'Seguridad'),
      h('div', { class: 'toolbar start' }, btn('Cambiar el PIN', { icon: 'lock', onclick: async () => {
        const a = prompt('Nuevo PIN de 4 cifras:');
        if (a == null) return;
        if (!/^\d{4}$/.test(a)) return toast('El PIN debe tener exactamente 4 cifras.');
        s.pin = await hashPin(a); await save('settings'); toast('PIN actualizado.');
      } }))),

    installCard(),

    h('section', { class: 'card' },
      h('h2', null, 'Acerca de'),
      h('p', null, 'Paso a paso · AVD es una herramienta de apoyo para Terapia Ocupacional. La organización de las actividades toma como marco de referencia las categorías de ocupación del Occupational Therapy Practice Framework, 4.ª edición (OTPF-4, AOTA).'),
      h('p', null, 'Las secuencias de pasos no están establecidas por AOTA: son plantillas clínicas editables que el terapeuta adapta a la persona, su contexto, hábitos, capacidades y objetivos. Esta aplicación no es un producto oficial de AOTA ni de ARASAAC, ni está avalada por ellas, y no realiza diagnósticos.')));
}
