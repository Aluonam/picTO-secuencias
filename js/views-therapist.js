// Modo configuración (terapeuta): acceso con PIN, panel y editores de actividades, pasos, rutinas y categorías.
import {
  state, save, uid, LEVELS, activity, category, routine, personName, touch, newActivity, newStep,
  duplicateActivity, deleteActivity, putMedia, delMedia, session,
} from './store.js';
import {
  h, icon, btn, iconBtn, go, page, visual, photoImg, choose, confirmDanger, toast, field, select, segmented,
  pickFile, savePhoto, sayStep, stopSound, pictoField, pickPicto, pictoImg, applyPrefs, refresh,
} from './ui.js';

export { refresh };
export const tpage = (title, back, ...body) => page({ title, back, cls: 'therapist', attribution: false }, ...body);

const personOptions = () => [['', 'Uso general (todas las personas)'], ...state.persons.map(p => [p.id, p.name])];
const categoryOptions = () => state.categories.map(c => [c.id, c.name]);

function move(list, i, d) {
  const j = i + d;
  if (j < 0 || j >= list.length) return false;
  [list[i], list[j]] = [list[j], list[i]];
  return true;
}
const orderButtons = (list, i, after) => [
  iconBtn('up', 'Subir', { disabled: i === 0, onclick: () => move(list, i, -1) && after() }),
  iconBtn('down', 'Bajar', { disabled: i === list.length - 1, onclick: () => move(list, i, 1) && after() }),
];

// ───────── Acceso protegido ─────────
export const isUnlocked = () => session.unlocked;
export const lock = () => { session.unlocked = false; session.returnTo = null; };
/** Pantalla a la que vuelve «Atrás» cuando se entró al editor desde una pantalla de uso. */
const backTo = fallback => session.returnTo || fallback;

export async function hashPin(pin) {
  const data = new TextEncoder().encode(`avd-pasos:${pin}`);
  if (crypto.subtle) {
    const d = await crypto.subtle.digest('SHA-256', data);
    return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('');
  }
  let x = 5381;
  for (const b of data) x = ((x << 5) + x + b) >>> 0;
  return `x${x.toString(16)}`;
}

/** Teclado numérico. Llama a onDone(pin) al completar las 4 cifras. */
function pinPad(title, hint, onDone) {
  let pin = '';
  const dots = h('div', { class: 'pin-dots', 'aria-live': 'polite' });
  const msg = h('p', { class: 'pin-msg', role: 'alert' });
  const draw = () => dots.replaceChildren(...[0, 1, 2, 3].map(i => h('span', { class: i < pin.length ? 'on' : '' })));
  const press = async k => {
    if (k === 'del') pin = pin.slice(0, -1);
    else if (pin.length < 4) pin += k;
    draw();
    if (pin.length === 4) {
      const entered = pin;
      pin = '';
      const error = await onDone(entered);
      if (error) { msg.textContent = error; draw(); }
    }
  };
  const onKey = e => {
    if (/^\d$/.test(e.key)) press(e.key);
    else if (e.key === 'Backspace') press('del');
  };
  document.addEventListener('keydown', onKey);
  draw();
  const el = h('div', { class: 'pin' },
    h('div', { class: 'pin-icon' }, icon('lock')),
    h('h2', null, title),
    h('p', { class: 'muted' }, hint),
    dots, msg,
    h('div', { class: 'pin-keys' },
      ['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(k => h('button', { type: 'button', onclick: () => press(k) }, k)),
      h('span'),
      h('button', { type: 'button', onclick: () => press('0') }, '0'),
      h('button', { type: 'button', class: 'del', 'aria-label': 'Borrar', onclick: () => press('del') }, icon('back'))));
  return { el, cleanup: () => document.removeEventListener('keydown', onKey) };
}

export function viewGate() {
  const s = state.settings;
  let first = null;
  const pad = s.pin
    ? pinPad('Modo configuración', 'Introduce el PIN de 4 cifras.', async pin => {
      if (await hashPin(pin) !== s.pin) return 'PIN incorrecto. Inténtalo de nuevo.';
      session.unlocked = true; refresh();
    })
    : pinPad('Crea un PIN', 'Elige un PIN de 4 cifras para proteger el modo configuración. Escríbelo dos veces.', async pin => {
      if (!first) { first = pin; return 'Repite el PIN para confirmarlo.'; }
      if (pin !== first) { first = null; return 'Los dos PIN no coinciden. Empieza de nuevo.'; }
      s.pin = await hashPin(pin);
      await save('settings');
      session.unlocked = true; refresh();
    });
  const forgot = s.pin && btn('He olvidado el PIN', { kind: 'ghost', small: true, onclick: async () => {
    const word = prompt('Para quitar el PIN escribe la palabra RESTABLECER. Los datos no se borran.');
    if (word?.trim().toUpperCase() === 'RESTABLECER') { s.pin = null; await save('settings'); refresh(); }
  } });
  return { el: page({ title: 'Configuración', back: '#/', cls: 'therapist', attribution: false }, pad.el, forgot), cleanup: pad.cleanup };
}

// ───────── Panel ─────────
const navCard = (ic, title, text, hash) => h('button', { type: 'button', class: 'nav-card', onclick: () => go(hash) },
  icon(ic), h('b', null, title), h('span', null, text));

export function viewPanel() {
  const s = state.settings;
  session.returnTo = null;
  return page({
    title: 'Modo configuración', cls: 'therapist', attribution: false,
    right: btn('Salir', { icon: 'lock', kind: 'ghost', onclick: () => { lock(); go('#/'); } }),
  },
    h('section', { class: 'card edit-intro' },
      h('h2', null, 'Editar pictogramas, secuencias y nombres'),
      h('p', null, 'Con este modo activo, cada tarjeta de categoría, actividad y rutina muestra un lápiz. Púlsalo para cambiar su nombre, su pictograma y sus pasos. También puedes usar las listas de abajo.'),
      h('div', { class: 'toolbar start' },
        btn('Editar sobre las pantallas', { icon: 'edit', kind: 'primary', onclick: () => go('#/categorias') }))),
    h('div', { class: 'panel-person' },
      field('Persona activa en este dispositivo',
        select(personOptions(), s.currentPersonId || '', async v => { s.currentPersonId = v || null; await save('settings'); applyPrefs(); toast(`Persona activa: ${personName(s.currentPersonId)}`); }),
        'La pantalla de inicio, las preferencias y los registros usarán esta persona.')),
    h('div', { class: 'nav-cards' },
      navCard('grid', 'Actividades', 'Crear, editar, duplicar y versionar secuencias', '#/t/actividades'),
      navCard('clock', 'Rutinas', 'Encadenar actividades con horario', '#/t/rutinas'),
      navCard('users', 'Personas', 'Nombres, preferencias y datos', '#/t/personas'),
      navCard('chart', 'Seguimiento', 'Sesiones, nivel de ayuda y evolución', '#/t/seguimiento'),
      navCard('folder', 'Categorías', 'Organizar y ampliar las categorías', '#/t/categorias'),
      navCard('sliders', 'Ajustes', 'Preferencias, privacidad y copias', '#/t/ajustes')));
}

// ───────── Lista de actividades ─────────
let listFilter = '';
export function viewActivities() {
  session.returnTo = null;
  const acts = state.activities.filter(a => !listFilter || a.categoryId === listFilter);
  const row = a => h('li', { class: 'row' },
    visual(a, { cls: 'small' }),
    h('div', { class: 'row-main' },
      h('b', null, a.title),
      h('small', null, [
        category(a.categoryId)?.name, `${a.steps.length} pasos`, LEVELS[a.level],
        a.personId ? `Solo ${personName(a.personId)}` : null,
        a.baseId && activity(a.baseId) ? `Versión de «${activity(a.baseId).title}»` : null,
      ].filter(Boolean).join(' · '))),
    h('div', { class: 'row-actions' },
      btn('Editar', { icon: 'edit', small: true, onclick: () => go(`#/t/actividad/${a.id}`) }),
      btn('Duplicar', { icon: 'copy', small: true, onclick: async () => { const c = await duplicateActivity(a.id); go(`#/t/actividad/${c.id}`); } }),
      btn('Versión', { icon: 'user', small: true, title: 'Crear una versión adaptada a una persona', onclick: () => newVersion(a) }),
      iconBtn('trash', `Eliminar ${a.title}`, { kind: 'danger', onclick: () => removeActivity(a, refresh) })));
  return tpage('Actividades', '#/t',
    h('div', { class: 'toolbar' },
      field('Categoría', select([['', 'Todas'], ...categoryOptions()], listFilter, v => { listFilter = v; refresh(); })),
      btn('Nueva actividad', { icon: 'plus', kind: 'primary', onclick: () => {
        const a = newActivity(listFilter || state.categories[0].id);
        go(`#/t/actividad/${a.id}`);
      } })),
    h('ul', { class: 'rows' }, acts.map(row)),
    !acts.length && h('p', { class: 'empty' }, 'No hay actividades en esta categoría.'));
}

async function newVersion(a) {
  const who = await choose({
    title: 'Nueva versión',
    text: `Se creará una copia de «${a.title}» que podrás simplificar o ampliar. Si la asignas a una persona, esa persona verá su versión en lugar de la original.`,
    options: [...state.persons.map(p => ({ label: `Para ${p.name}`, value: p.id, icon: 'user' })),
      { label: 'Versión general', value: '' }, { label: 'Cancelar', value: undefined }],
  });
  if (who === undefined) return;
  const c = await duplicateActivity(a.id, { asVersion: true, personId: who || null });
  go(`#/t/actividad/${c.id}`);
}

async function removeActivity(a, after) {
  if (await confirmDanger('¿Eliminar la actividad?', `«${a.title}» y sus ${a.steps.length} pasos se eliminarán de este dispositivo. Los registros de sesiones anteriores se conservan.`)) {
    await deleteActivity(a.id);
    after();
  }
}

/** Fotografía propia de una actividad o de un paso. */
function photoField(item, onchange) {
  const box = h('div', { class: 'picto-field' });
  const draw = () => box.replaceChildren(...[
    h('div', { class: 'visual small' }, item.photo ? photoImg(item.photo, 'Fotografía actual') : h('span', { class: 'ph' })),
    btn(item.photo ? 'Cambiar fotografía' : 'Hacer o elegir fotografía', { icon: 'image', onclick: async () => {
      const file = await pickFile('image/*');
      if (!file) return;
      await delMedia(item.photo);
      item.photo = await savePhoto(file);
      await onchange(); draw();
    } }),
    item.photo && btn('Quitar', { icon: 'trash', onclick: async () => { await delMedia(item.photo); item.photo = null; await onchange(); draw(); } }),
  ].filter(Boolean));
  draw();
  return box;
}

// ───────── Editor de actividad ─────────
export function viewActivityEditor(id) {
  const a = activity(id);
  if (!a) { go('#/t/actividades'); return h('div'); }
  const saveA = () => touch(a);
  const stepsBox = h('ol', { class: 'rows steps-edit' });
  const count = h('span');

  function drawSteps(focusId) {
    count.textContent = `Pasos (${a.steps.length})`;
    stepsBox.replaceChildren(...a.steps.map((s, i) => h('li', { class: 'row' },
      h('span', { class: 'state' }, String(i + 1)),
      h('button', { type: 'button', class: 'visual small as-button', title: 'Cambiar pictograma', 'aria-label': `Cambiar el pictograma del paso ${i + 1}`, onclick: async () => {
        const p = await pickPicto(s.picto, s.text);
        if (p !== undefined) { s.picto = p; saveA(); drawSteps(); }
      } }, pictoImg(s.picto, ''), h('span', { class: 'as-button-mark' }, icon('edit'))),
      h('input', { type: 'text', class: 'row-input', value: s.text, maxLength: 80, placeholder: 'Texto del paso', 'aria-label': `Texto del paso ${i + 1}`, 'data-step': s.id,
        onchange: e => { s.text = e.target.value.trim(); saveA(); } }),
      h('div', { class: 'row-actions' },
        orderButtons(a.steps, i, () => { saveA(); drawSteps(); }),
        btn('Más', { icon: 'edit', small: true, title: 'Fotografía, audio e indicación adicional', onclick: () => go(`#/t/actividad/${a.id}/paso/${s.id}`) }),
        iconBtn('trash', `Eliminar el paso ${i + 1}`, { kind: 'danger', onclick: async () => {
          if (!await confirmDanger('¿Eliminar el paso?', `«${s.text || `Paso ${i + 1}`}»`)) return;
          await delMedia(s.photo, s.audio);
          a.steps.splice(i, 1);
          saveA(); drawSteps();
        } })))));
    if (focusId) stepsBox.querySelector(`[data-step="${focusId}"]`)?.focus();
  }
  drawSteps();

  return tpage('Editar actividad', backTo('#/t/actividades'),
    a.baseId && activity(a.baseId) && h('p', { class: 'note' }, `Versión de «${activity(a.baseId).title}».`),
    h('section', { class: 'card form' },
      field('Nombre de la actividad', h('input', { type: 'text', value: a.title, maxLength: 80, onchange: e => { a.title = e.target.value.trim() || 'Sin nombre'; saveA(); } })),
      h('div', { class: 'form-2' },
        field('Categoría', select(categoryOptions(), a.categoryId, v => { a.categoryId = v; saveA(); })),
        field('Asignada a', select(personOptions(), a.personId || '', v => { a.personId = v || null; saveA(); }))),
      segmented('Nivel de dificultad', Object.entries(LEVELS), a.level, v => { a.level = v; saveA(); }),
      h('div', { class: 'form-2' },
        h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'Pictograma ARASAAC'), pictoField(a, () => a.title, saveA)),
        h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'Fotografía propia (opcional)'), photoField(a, saveA)))),
    h('section', { class: 'card' },
      h('div', { class: 'toolbar' }, h('h2', null, count),
        btn('Añadir paso', { icon: 'plus', kind: 'primary', onclick: () => { const s = newStep(); a.steps.push(s); saveA(); drawSteps(s.id); } })),
      stepsBox,
      h('p', { class: 'hint' }, 'Pulsa la imagen de un paso para cambiar su pictograma y escribe encima del texto para cambiarlo. Usa las flechas para cambiar el orden. Los cambios se guardan solos.')),
    h('div', { class: 'toolbar end' },
      btn('Probar actividad', { icon: 'play', onclick: () => go(`#/actividad/${a.id}`) }),
      btn('Duplicar', { icon: 'copy', onclick: async () => { const c = await duplicateActivity(a.id); go(`#/t/actividad/${c.id}`); } }),
      btn('Nueva versión', { icon: 'user', onclick: () => newVersion(a) }),
      btn('Eliminar actividad', { icon: 'trash', kind: 'danger', onclick: () => removeActivity(a, () => go(backTo('#/t/actividades'))) })));
}

// ───────── Editor de paso ─────────
export function viewStepEditor(actId, stepId) {
  const a = activity(actId);
  const i = a ? a.steps.findIndex(s => s.id === stepId) : -1;
  if (i < 0) { go('#/t/actividades'); return h('div'); }
  const s = a.steps[i];
  const saveA = () => touch(a);
  const back = `#/t/actividad/${a.id}`;

  // Audio: grabación propia o archivo; si no hay, se lee el texto con la voz del dispositivo.
  const audioBox = h('div', { class: 'audio-box' });
  let rec = null;
  const setAudio = async blob => { await delMedia(s.audio); s.audio = await putMedia(blob); await saveA(); drawAudio(); };
  async function record() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks = [];
      rec = new MediaRecorder(stream);
      rec.ondataavailable = e => chunks.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const type = rec.mimeType;
        rec = null;
        setAudio(new Blob(chunks, { type }));
      };
      rec.start();
      drawAudio();
    } catch { toast('No se ha podido usar el micrófono. Revisa los permisos del navegador.'); }
  }
  function drawAudio() {
    audioBox.replaceChildren(
      h('p', { class: 'muted' }, rec ? 'Grabando… pulsa Detener al terminar.' : s.audio ? 'Este paso tiene un audio propio.' : 'Sin audio propio: se leerá el texto con la voz del dispositivo.'),
      h('div', { class: 'toolbar start' },
        rec
          ? btn('Detener', { icon: 'stop', kind: 'danger', onclick: () => rec.stop() })
          : btn(s.audio ? 'Grabar de nuevo' : 'Grabar audio', { icon: 'mic', onclick: record, disabled: !navigator.mediaDevices || !window.MediaRecorder }),
        !rec && btn('Añadir archivo', { icon: 'upload', onclick: async () => { const f = await pickFile('audio/*'); if (f) setAudio(f); } }),
        !rec && btn('Escuchar', { icon: 'speaker', onclick: () => sayStep(s) }),
        !rec && s.audio && btn('Quitar audio', { icon: 'trash', onclick: async () => { await delMedia(s.audio); s.audio = null; await saveA(); drawAudio(); } })));
  }
  drawAudio();

  const el = tpage(`Paso ${i + 1} de ${a.steps.length}`, back,
    h('p', { class: 'note' }, a.title),
    h('section', { class: 'card form' },
      field('Texto del paso', h('input', { type: 'text', value: s.text, maxLength: 80, onchange: e => { s.text = e.target.value.trim(); saveA(); } }),
        'Una frase muy breve, por ejemplo: «Coge el cepillo».'),
      field('Indicación adicional (opcional)', h('input', { type: 'text', value: s.tip || '', maxLength: 120, onchange: e => { s.tip = e.target.value.trim(); saveA(); } }),
        'Solo se muestra en el modo «Texto + imagen».'),
      h('div', { class: 'form-2' },
        h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'Pictograma ARASAAC'), pictoField(s, () => s.text, saveA)),
        h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'Fotografía real (opcional)'), photoField(s, saveA),
          h('span', { class: 'hint' }, 'Se muestra en el modo «Fotografías». Se guarda solo en este dispositivo.'))),
      h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'Audio'), audioBox)),
    h('div', { class: 'toolbar' },
      btn('Paso anterior', { icon: 'back', disabled: i === 0, onclick: () => go(`${back}/paso/${a.steps[i - 1].id}`) }),
      btn('Volver a la actividad', { kind: 'primary', onclick: () => go(back) }),
      btn('Paso siguiente', { iconEnd: 'next', disabled: i === a.steps.length - 1, onclick: () => go(`${back}/paso/${a.steps[i + 1].id}`) })));
  return { el, cleanup() { stopSound(); if (rec) rec.stop(); } };
}

// ───────── Rutinas ─────────
export function viewRoutinesAdmin() {
  return tpage('Rutinas', '#/t',
    h('div', { class: 'toolbar end' },
      btn('Nueva rutina', { icon: 'plus', kind: 'primary', onclick: () => {
        const r = { id: uid(), categoryId: state.categories[0].id, name: 'Nueva rutina', picto: null, personId: null, items: [] };
        state.routines.push(r); save('routines');
        go(`#/t/rutina/${r.id}`);
      } })),
    h('ul', { class: 'rows' }, state.routines.map(r => h('li', { class: 'row' },
      visual(r, { cls: 'small' }),
      h('div', { class: 'row-main' }, h('b', null, r.name),
        h('small', null, [`${r.items.length} actividades`, category(r.categoryId)?.name, r.personId ? `Solo ${personName(r.personId)}` : null].filter(Boolean).join(' · '))),
      h('div', { class: 'row-actions' },
        btn('Editar', { icon: 'edit', small: true, onclick: () => go(`#/t/rutina/${r.id}`) }),
        iconBtn('trash', `Eliminar ${r.name}`, { kind: 'danger', onclick: async () => {
          if (!await confirmDanger('¿Eliminar la rutina?', `«${r.name}». Las actividades que contiene no se eliminan.`)) return;
          state.routines = state.routines.filter(x => x !== r); await save('routines'); refresh();
        } })))),
    !state.routines.length && h('p', { class: 'empty' }, 'Todavía no hay rutinas.')));
}

export function viewRoutineEditor(id) {
  const r = routine(id);
  if (!r) { go('#/t/rutinas'); return h('div'); }
  const saveR = () => save('routines');
  const box = h('ol', { class: 'rows steps-edit' });
  const actOptions = () => [['', 'Sin actividad (solo aviso)'], ...state.activities.map(a => [a.id, a.title])];

  function draw() {
    box.replaceChildren(...r.items.map((it, i) => h('li', { class: 'row routine-row' },
      h('input', { type: 'time', value: it.time || '', 'aria-label': 'Hora', onchange: e => { it.time = e.target.value; saveR(); } }),
      h('button', { type: 'button', class: 'visual small as-button', title: 'Cambiar pictograma', onclick: async () => {
        const p = await pickPicto(it.picto, it.label);
        if (p !== undefined) { it.picto = p; saveR(); draw(); }
      } }, visual(it).firstChild),
      h('div', { class: 'row-main' },
        h('input', { type: 'text', class: 'row-input', value: it.label, maxLength: 60, placeholder: 'Nombre', 'aria-label': 'Nombre', onchange: e => { it.label = e.target.value.trim(); saveR(); } }),
        select(actOptions(), it.activityId || '', v => {
          it.activityId = v || null;
          const a = activity(v);
          if (a) { it.label ||= a.title; it.picto ||= a.picto; }
          saveR(); draw();
        }, { 'aria-label': 'Actividad asociada' })),
      h('div', { class: 'row-actions' },
        orderButtons(r.items, i, () => { saveR(); draw(); }),
        iconBtn('trash', 'Quitar de la rutina', { kind: 'danger', onclick: () => { r.items.splice(i, 1); saveR(); draw(); } })))));
  }
  draw();

  return tpage('Editar rutina', backTo('#/t/rutinas'),
    h('section', { class: 'card form' },
      field('Nombre de la rutina', h('input', { type: 'text', value: r.name, maxLength: 60, onchange: e => { r.name = e.target.value.trim() || 'Rutina'; saveR(); } })),
      h('div', { class: 'form-2' },
        field('Categoría', select(categoryOptions(), r.categoryId, v => { r.categoryId = v; saveR(); })),
        field('Asignada a', select(personOptions(), r.personId || '', v => { r.personId = v || null; saveR(); }))),
      h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'Pictograma ARASAAC'), pictoField(r, () => r.name, saveR))),
    h('section', { class: 'card' },
      h('div', { class: 'toolbar' }, h('h2', null, 'Actividades de la rutina'),
        btn('Añadir', { icon: 'plus', kind: 'primary', onclick: () => { r.items.push({ id: uid(), time: '', label: '', activityId: null, picto: null }); saveR(); draw(); } })),
      box,
      h('p', { class: 'hint' }, 'Durante la rutina solo se muestra la actividad actual. La hora es orientativa.')),
    h('div', { class: 'toolbar end' }, btn('Probar rutina', { icon: 'play', onclick: () => go(`#/rutina/${r.id}`) })));
}

// ───────── Categorías ─────────
export function viewCategoriesAdmin() {
  const saveC = () => save('categories');
  const inUse = c => state.activities.some(a => a.categoryId === c.id) || state.routines.some(r => r.categoryId === c.id);
  return tpage('Categorías', backTo('#/t'),
    h('div', { class: 'toolbar end' },
      btn('Nueva categoría', { icon: 'plus', kind: 'primary', onclick: () => { state.categories.push({ id: uid(), name: 'Nueva categoría', picto: null }); saveC(); refresh(); } })),
    h('ul', { class: 'rows' }, state.categories.map((c, i) => h('li', { class: 'row' },
      h('button', { type: 'button', class: 'visual small as-button', title: 'Cambiar pictograma', onclick: async () => {
        const p = await pickPicto(c.picto, c.name);
        if (p !== undefined) { c.picto = p; saveC(); refresh(); }
      } }, visual(c).firstChild),
      h('input', { type: 'text', class: 'row-input', value: c.name, maxLength: 40, 'aria-label': 'Nombre de la categoría', onchange: e => { c.name = e.target.value.trim() || 'Categoría'; saveC(); } }),
      h('div', { class: 'row-actions' },
        orderButtons(state.categories, i, () => { saveC(); refresh(); }),
        iconBtn('trash', `Eliminar ${c.name}`, { kind: 'danger', disabled: inUse(c) || state.categories.length === 1,
          title: inUse(c) ? 'Solo se pueden eliminar categorías vacías' : `Eliminar ${c.name}`,
          onclick: () => { state.categories.splice(i, 1); saveC(); refresh(); } }))))),
    h('p', { class: 'hint' }, 'Las categorías siguen como referencia la clasificación de ocupaciones del OTPF-4 y pueden ampliarse. Solo se pueden eliminar las que están vacías.'));
}
