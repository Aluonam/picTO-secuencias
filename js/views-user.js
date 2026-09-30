// Pantallas del modo usuario: inicio, categorías, actividades, ejecución y rutinas.
import {
  state, save, uid, prefs, currentPerson, category, activity, routine, visibleActivities, visibleRoutines,
  session, newActivity,
} from './store.js';
import { UI_PICTOS } from './seed.js';
import {
  h, icon, btn, iconBtn, go, page, tile, visual, choose, toast, sayStep, stopSound, helpSelect, logDialog, editFrom,
} from './ui.js';

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
/** Tarjeta «añadir», visible solo con el modo configuración activo. */
const addTile = (label, onclick) => session.unlocked && h('button', { type: 'button', class: 'tile add', onclick }, icon('plus'), h('span', { class: 'tile-title' }, label));

// ───────── Inicio ─────────
export function viewHome() {
  const p = currentPerson();
  return page({
    title: '¿Qué vamos a hacer?', cls: 'home',
    right: btn('Configuración', { icon: session.unlocked ? 'sliders' : 'lock', kind: 'ghost', onclick: () => go('#/t') }),
  },
    p && h('p', { class: 'hello say' }, `Hola, ${p.name}`),
    h('div', { class: 'tiles two' },
      tile({ item: { picto: UI_PICTOS.activities }, title: 'Actividades', onclick: () => go('#/categorias') }),
      tile({ item: { picto: UI_PICTOS.routines }, title: 'Rutinas', onclick: () => go('#/rutinas') })));
}

// ───────── Categorías y actividades ─────────
export function viewCategories() {
  // En modo configuración se muestran también las categorías vacías, para poder rellenarlas.
  const cats = state.categories.filter(c => session.unlocked || visibleActivities(c.id).length || visibleRoutines(c.id).length);
  return page({ title: 'Actividades', back: '#/' },
    h('div', { class: 'tiles' },
      cats.map(c => tile({ item: c, title: c.name, onclick: () => go(`#/categoria/${c.id}`), onedit: () => editFrom('#/t/categorias') })),
      addTile('Nueva categoría', () => editFrom('#/t/categorias'))));
}

export function viewCategory(id) {
  const cat = category(id);
  if (!cat) return viewCategories();
  const acts = visibleActivities(id), routines = visibleRoutines(id);
  return page({ title: cat.name, back: '#/categorias' },
    h('div', { class: 'tiles' },
      routines.map(r => tile({ item: r, title: r.name, badge: 'Rutina', meta: plural(r.items.length, 'actividad', 'actividades'), onclick: () => go(`#/rutina/${r.id}`), onedit: () => editFrom(`#/t/rutina/${r.id}`) })),
      acts.map(a => tile({ item: a, title: a.title, meta: plural(a.steps.length, 'paso', 'pasos'), onclick: () => go(`#/actividad/${a.id}`), onedit: () => editFrom(`#/t/actividad/${a.id}`) })),
      addTile('Nueva actividad', () => editFrom(`#/t/actividad/${newActivity(id).id}`))),
    !acts.length && !routines.length && !session.unlocked && h('p', { class: 'empty' }, 'Todavía no hay actividades en esta categoría.'));
}

export function viewPreview(id) {
  const act = activity(id);
  if (!act) return viewCategories();
  const steps = h('ol', { class: 'step-list preview', hidden: true }, act.steps.map((s, i) => h('li', { class: 'row' },
    h('span', { class: 'state' }, String(i + 1)),
    visual(s, { cls: 'small', label: '' }),
    h('span', { class: 'row-text say' }, s.text))));
  return page({ title: '¿Qué vamos a hacer?', back: `#/categoria/${act.categoryId}`, cls: 'preview-page' },
    h('div', { class: 'intro' },
      visual(act, { cls: 'hero' }),
      h('h2', { class: 'say' }, act.title),
      act.steps.length
        ? btn('Comenzar', { kind: 'primary', big: true, iconEnd: 'next', onclick: () => { run = null; go(`#/hacer/${act.id}`); } })
        : h('p', { class: 'empty' }, 'Esta actividad todavía no tiene pasos.'),
      act.steps.length > 0 && btn(`Ver los ${act.steps.length} pasos`, { icon: 'list', kind: 'ghost', onclick: e => {
        steps.hidden = !steps.hidden;
        e.currentTarget.setAttribute('aria-expanded', String(!steps.hidden));
      } }),
      session.unlocked && btn('Editar esta actividad', { icon: 'edit', onclick: () => editFrom(`#/t/actividad/${act.id}`) })),
    steps);
}

// ───────── Ejecución de una actividad ─────────
let run = null;   // sesión en curso
let wake = null;  // bloqueo de pantalla encendida
async function keepAwake() { try { wake = await navigator.wakeLock?.request('screen'); } catch { /* no disponible */ } }
document.addEventListener('visibilitychange', () => { if (run && document.visibilityState === 'visible') keepAwake(); });

const STEP_DELAY = { fast: 350, normal: 1100, slow: 2400 };

function progress(done, total, noun) {
  return h('div', { class: 'progress' },
    h('p', { class: 'progress-text', 'aria-live': 'polite' }, h('b', null, String(done.filter(Boolean).length)), ` de ${total} ${noun}`),
    total <= 16
      ? h('ol', { class: 'dots', 'aria-hidden': 'true' }, done.map(d => h('li', { class: d ? 'done' : '' }, d ? icon('check') : null)))
      : h('div', { class: 'meter', 'aria-hidden': 'true' }, h('span', { style: `width:${Math.round(100 * done.filter(Boolean).length / total)}%` })));
}

export function viewRun(id, query) {
  const act = activity(id);
  if (!act || !act.steps.length) { go('#/categorias'); return h('div'); }
  if (!run || run.act !== act) {
    run = {
      act, idx: 0, mode: prefs().runMode, startedAt: Date.now(), log: null, finished: false,
      ctx: query.r ? { routineId: query.r, index: Number(query.i) } : null,
      st: act.steps.map(() => ({ done: false, help: null, repeats: 0 })),
    };
  }
  const p = prefs(), n = act.steps.length;
  const root = h('div');
  let timer;
  keepAwake();

  const count = () => run.st.filter(s => s.done).length;
  const allDone = () => count() === n;
  const announce = () => { if (p.autoSpeak && run.mode === 'seq' && !run.finished) sayStep(act.steps[run.idx]); };

  function writeLog() {
    const now = Date.now();
    const data = {
      personId: state.settings.currentPersonId, activityId: act.id, baseId: act.baseId, title: act.title,
      routineId: run.ctx?.routineId || null, startedAt: run.startedAt, endedAt: now,
      durationSec: Math.round((now - run.startedAt) / 1000), total: n, completed: count(),
      steps: act.steps.map((s, i) => ({ id: s.id, text: s.text, ...run.st[i] })),
    };
    if (run.log) Object.assign(run.log, data);
    else { run.log = { id: uid(), notes: '', ...data }; state.logs.push(run.log); }
    return save('logs');
  }

  function finish() {
    run.finished = true;
    stopSound();
    writeLog();
    draw();
  }

  /** Tras completar un paso salta al siguiente pendiente; con «Siguiente» avanza de uno en uno. */
  function advance(auto) {
    if (allDone() && (auto || run.idx === n - 1)) return finish();
    if (auto) {
      const after = run.st.findIndex((s, i) => i > run.idx && !s.done);
      run.idx = after >= 0 ? after : run.st.findIndex(s => !s.done);
    } else {
      run.idx = run.idx < n - 1 ? run.idx + 1 : run.st.findIndex(s => !s.done);
    }
    draw();
    announce();
  }

  function markDone(i) {
    run.st[i].done = true;
    draw(); // el ✓ verde, el contador y la barra se actualizan al instante
    if (allDone() ? (p.autoAdvance || run.mode === 'list') : (p.autoAdvance && run.mode === 'seq')) {
      timer = setTimeout(() => (allDone() ? finish() : advance(true)), STEP_DELAY[p.stepDelay]);
    }
  }

  async function stepOptions(i) {
    clearTimeout(timer);
    const choice = await choose({
      title: `Paso ${i + 1} completado`, text: act.steps[i].text,
      options: [
        { label: 'Mantener completado', value: 'keep', kind: 'primary', icon: 'check' },
        { label: 'Volver a realizarlo', value: 'redo', icon: 'redo' },
        { label: 'Desmarcar', value: 'unmark', icon: 'x' },
      ],
    });
    if (choice === 'redo' || choice === 'unmark') {
      run.st[i].done = false;
      if (choice === 'redo') { run.st[i].repeats++; run.idx = i; }
      run.finished = false;
    }
    draw();
    if (choice === 'redo') announce();
  }

  async function exit() {
    clearTimeout(timer);
    const choice = await choose({
      title: '¿Salir de la actividad?',
      text: `${count()} de ${n} pasos completados.`,
      options: [
        { label: 'Seguir con la actividad', value: 'stay', kind: 'primary' },
        count() > 0 && { label: 'Guardar lo hecho y salir', value: 'save', icon: 'check' },
        { label: 'Salir sin guardar', value: 'leave', icon: 'x' },
      ].filter(Boolean),
    });
    if (choice === 'save') { await writeLog(); toast('Sesión guardada en Seguimiento.'); }
    if (choice === 'save' || choice === 'leave') leave(false);
  }

  function leave(completed) {
    const ctx = run.ctx;
    run = null;
    if (ctx && routine(ctx.routineId)) {
      if (completed) routineMark(routine(ctx.routineId), ctx.index);
      go(`#/rutina/${ctx.routineId}`);
    } else go(completed ? '#/' : `#/categoria/${act.categoryId}`);
  }

  const top = () => h('header', { class: 'run-top' },
    btn('Salir', { icon: 'x', kind: 'ghost', onclick: exit, 'aria-label': 'Salir de la actividad' }),
    progress(run.st.map(s => s.done), n, 'pasos completados'),
    run.mode === 'seq'
      ? btn('Lista', { icon: 'list', kind: 'ghost', onclick: () => { run.mode = 'list'; draw(); }, title: 'Ver toda la secuencia', 'aria-label': 'Ver toda la secuencia en lista' })
      : btn('Paso a paso', { icon: 'card', kind: 'ghost', onclick: () => {
        run.mode = 'seq';
        const pending = run.st.findIndex(s => !s.done);
        if (pending >= 0) run.idx = pending;
        draw();
      }, title: 'Ver un solo paso', 'aria-label': 'Ver un solo paso cada vez' }));

  const doneState = i => btn('Completado', { icon: 'check', kind: 'done-state', onclick: () => stepOptions(i), title: 'Paso completado. Pulsa para corregir.' });

  function seqView() {
    const i = run.idx, step = act.steps[i], s = run.st[i];
    return [
      h('main', { class: `step-card${s.done ? ' done' : ''}`, 'aria-label': `Paso ${i + 1} de ${n}` },
        h('span', { class: 'step-num' }, String(i + 1)),
        s.done && h('span', { class: 'step-check' }, icon('check')),
        visual(step, { label: String(i + 1) }),
        h('div', { class: 'step-info' },
          h('p', { class: 'step-text say' }, step.text),
          p.viewMode === 'text' && step.tip && h('p', { class: 'step-tip' }, step.tip),
          h('div', { class: 'step-tools' },
            btn('Escuchar', { icon: 'speaker', kind: 'listen', onclick: () => sayStep(step) }),
            s.done && doneState(i)))),
      p.helpBar && h('label', { class: 'help-bar' }, 'Ayuda en este paso',
        helpSelect(s.help, v => { s.help = v; })),
      h('footer', { class: 'run-actions' },
        btn('Anterior', { icon: 'back', big: true, disabled: i === 0, onclick: () => { run.idx--; draw(); announce(); } }),
        s.done
          ? btn(allDone() && i === n - 1 ? 'Terminar' : 'Siguiente', { iconEnd: 'next', big: true, kind: 'primary', onclick: () => advance(false) })
          : btn('Hecho', { icon: 'check', big: true, kind: 'done', onclick: () => markDone(i) })),
    ];
  }

  function listView() {
    const current = run.st.findIndex(s => !s.done);
    return [
      h('main', { class: 'list-wrap' },
        h('h1', { class: 'list-title say' }, act.title),
        h('ol', { class: 'step-list' }, act.steps.map((step, i) => {
          const s = run.st[i];
          return h('li', { class: `row${s.done ? ' done' : ''}${i === current ? ' current' : ''}` },
            h('span', { class: `state${s.done ? ' done' : ''}` }, s.done ? icon('check') : String(i + 1)),
            visual(step, { cls: 'small', label: '' }),
            h('span', { class: 'row-text say' }, step.text),
            iconBtn('speaker', `Escuchar el paso ${i + 1}`, { onclick: () => sayStep(step) }),
            s.done ? doneState(i) : btn('Hecho', { icon: 'check', kind: 'done', onclick: () => markDone(i) }));
        })),
        allDone() && btn('Terminar', { iconEnd: 'next', big: true, kind: 'primary', onclick: finish })),
    ];
  }

  function finishView() {
    const complete = allDone();
    return [h('main', { class: 'finish' },
      h('div', { class: 'finish-mark' }, icon('check')),
      h('p', { class: 'kicker' }, 'Todos los pasos completados'),
      h('h1', { class: 'say' }, '¡Has terminado!'),
      h('p', { class: 'well say' }, '¡Muy bien!'),
      h('div', { class: 'finish-act' }, visual(act, { cls: 'small' }), h('span', { class: 'say' }, act.title)),
      h('ol', { class: 'finish-steps', 'aria-hidden': 'true' }, run.st.map((s, i) => h('li', { class: s.done ? 'done' : '' },
        h('span', null, String(i + 1)), s.done && icon('check')))),
      h('p', { class: 'finish-count' }, `${count()} / ${n} pasos completados`),
      btn('Terminar actividad', { big: true, kind: 'primary', onclick: () => leave(complete) }),
      h('div', { class: 'finish-extra' },
        btn('Registro del terapeuta', { icon: 'note', kind: 'ghost', onclick: async () => {
          if (await logDialog(run.log)) {
            run.log.steps.forEach((s, i) => { run.st[i].help = s.help; });
            toast('Registro guardado.');
          }
        } }),
        btn('Volver a los pasos', { icon: 'back', kind: 'ghost', onclick: () => { run.finished = false; run.idx = n - 1; draw(); } })))];
  }

  function draw() {
    clearTimeout(timer);
    root.className = `run ${run.finished ? 'is-finished' : run.mode}`;
    root.replaceChildren(...(run.finished ? finishView() : [top(), ...(run.mode === 'list' ? listView() : seqView())]).filter(Boolean));
  }

  draw();
  setTimeout(announce, 400);
  return { el: root, cleanup() { clearTimeout(timer); stopSound(); wake?.release?.().catch(() => {}); wake = null; } };
}

// ───────── Rutinas ─────────
const today = () => new Date().toLocaleDateString('sv');
const rtKey = id => `rt:${id}:${today()}`;
function routineState(r) {
  try {
    const s = JSON.parse(localStorage.getItem(rtKey(r.id)));
    if (s && s.done.length === r.items.length) return s;
  } catch { /* sin almacenamiento */ }
  return { idx: 0, done: r.items.map(() => false) };
}
function routineSave(r, s) { try { localStorage.setItem(rtKey(r.id), JSON.stringify(s)); } catch { /* sin almacenamiento */ } }
function routineMark(r, index) {
  const s = routineState(r);
  s.done[index] = true;
  const next = s.done.findIndex((d, i) => i > index && !d);
  s.idx = next >= 0 ? next : Math.max(0, s.done.findIndex(d => !d));
  routineSave(r, s);
}

export function viewRoutines() {
  const list = visibleRoutines();
  return page({ title: 'Rutinas', back: '#/' },
    h('div', { class: 'tiles' },
      list.map(r => tile({
        item: r, title: r.name, meta: plural(r.items.length, 'actividad', 'actividades'), onclick: () => go(`#/rutina/${r.id}`),
        onedit: () => editFrom(`#/t/rutina/${r.id}`),
      })),
      addTile('Nueva rutina', () => editFrom('#/t/rutinas'))),
    !list.length && !session.unlocked && h('p', { class: 'empty' }, 'Todavía no hay rutinas. El terapeuta puede crearlas en el modo terapeuta.'));
}

export function viewRoutine(id) {
  const r = routine(id);
  if (!r || !r.items.length) { go('#/rutinas'); return h('div'); }
  const root = h('div');
  const s = routineState(r);
  const n = r.items.length;
  const allDone = () => s.done.every(Boolean);

  function draw() {
    routineSave(r, s);
    if (allDone()) {
      root.className = 'run is-finished';
      root.replaceChildren(h('main', { class: 'finish' },
        h('div', { class: 'finish-mark' }, icon('check')),
        h('p', { class: 'kicker' }, 'Rutina completada'),
        h('h1', { class: 'say' }, '¡Has terminado!'),
        h('div', { class: 'finish-act' }, visual(r, { cls: 'small' }), h('span', { class: 'say' }, r.name)),
        h('ol', { class: 'routine-done' }, r.items.map(it => h('li', null,
          h('span', { class: 'state done' }, icon('check')), h('span', { class: 'say' }, it.label)))),
        h('p', { class: 'finish-count' }, `${n} / ${n} actividades completadas`),
        btn('Terminar', { big: true, kind: 'primary', onclick: () => {
          try { localStorage.removeItem(rtKey(r.id)); } catch { /* sin almacenamiento */ }
          go('#/');
        } })));
      return;
    }
    const it = r.items[s.idx], act = activity(it.activityId), done = s.done[s.idx];
    const move = d => { s.idx = Math.min(n - 1, Math.max(0, s.idx + d)); draw(); };
    root.className = 'run seq routine';
    root.replaceChildren(...[
      h('header', { class: 'run-top' },
        btn('Salir', { icon: 'x', kind: 'ghost', onclick: () => go('#/rutinas'), 'aria-label': 'Salir de la rutina' }),
        progress(s.done, n, 'actividades completadas'),
        h('span', { class: 'routine-name say' }, r.name)),
      h('main', { class: `step-card${done ? ' done' : ''}` },
        h('span', { class: 'step-num' }, String(s.idx + 1)),
        done && h('span', { class: 'step-check' }, icon('check')),
        visual({ picto: it.picto || act?.picto, photo: act?.photo }, { label: String(s.idx + 1) }),
        h('div', { class: 'step-info' },
          it.time && h('p', { class: 'routine-time' }, icon('clock'), it.time),
          h('p', { class: 'step-text say' }, it.label),
          done && h('div', { class: 'step-tools' }, btn('Completado', { icon: 'check', kind: 'done-state', onclick: () => { s.done[s.idx] = false; draw(); }, title: 'Pulsa para desmarcar' })))),
      h('footer', { class: 'run-actions' },
        btn('Anterior', { icon: 'back', big: true, disabled: s.idx === 0, onclick: () => move(-1) }),
        done
          ? btn('Siguiente', { iconEnd: 'next', big: true, kind: 'primary', onclick: () => { s.idx = (s.idx + 1) % n; if (s.done[s.idx]) s.idx = s.done.findIndex(d => !d); draw(); } })
          : act && act.steps.length
            ? btn('Empezar', { iconEnd: 'next', big: true, kind: 'primary', onclick: () => { run = null; go(`#/hacer/${act.id}?r=${r.id}&i=${s.idx}`); } })
            : btn('Hecho', { icon: 'check', big: true, kind: 'done', onclick: () => { routineMark(r, s.idx); Object.assign(s, routineState(r)); draw(); } })),
      !done && h('div', { class: 'skip' }, btn('Saltar esta actividad', { kind: 'ghost', small: true, onclick: () => move(1), disabled: s.idx === n - 1 })),
    ].filter(Boolean));
  }
  draw();
  return root;
}
