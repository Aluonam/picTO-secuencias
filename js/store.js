// Almacenamiento local (IndexedDB). Ningún dato sale del dispositivo.
//
// Estructura:
//   Persona → Rutinas → Actividades → Pasos → Recursos multimedia
//           → Registros de ejecución → Nivel de ayuda por paso → Observaciones
import { seedData } from './seed.js';

const DB_NAME = 'avd-pasos';
const KEYS = ['settings', 'persons', 'categories', 'activities', 'routines', 'logs'];

export const HELP_LEVELS = [
  'Independiente',
  'Supervisión',
  'Pista verbal',
  'Pista visual',
  'Demostración',
  'Ayuda física parcial',
  'Ayuda física total',
];

export const LEVELS = { basico: 'Básico', medio: 'Intermedio', avanzado: 'Avanzado' };

export const state = { settings: null, persons: [], categories: [], activities: [], routines: [], logs: [] };

/** Modo configuración desbloqueado con el PIN (solo mientras la aplicación está abierta). */
export const session = { unlocked: false, returnTo: null };

export const uid = () =>
  (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2)).slice(0, 13);

export const defaultPrefs = () => ({
  viewMode: 'picto',      // picto | photo | text
  pictoStyle: 'color',    // color | bn
  fontScale: 1,           // 1 | 2 | 3
  contrast: 'normal',     // normal | high
  uppercase: true,
  runMode: 'seq',         // seq | list
  autoAdvance: true,
  stepDelay: 'normal',    // fast | normal | slow
  autoSpeak: false,
  voiceURI: '',
  rate: 'normal',         // slow | normal | fast
  helpBar: false,
});

// ───────── IndexedDB ─────────
let dbp;
function db() {
  return dbp ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore('kv');
      req.result.createObjectStore('media');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function tx(store, mode, fn) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction(store, mode);
    const req = fn(t.objectStore(store));
    t.oncomplete = () => resolve(req?.result);
    t.onerror = t.onabort = () => reject(t.error);
  });
}

export async function load() {
  for (const k of KEYS) {
    const v = await tx('kv', 'readonly', s => s.get(k));
    if (v !== undefined) state[k] = v;
  }
  if (!state.settings) {
    Object.assign(state, seedData(), {
      persons: [], logs: [],
      settings: { pin: null, currentPersonId: null, prefs: defaultPrefs(), offlinePictos: true },
    });
    await save(...KEYS);
  }
  navigator.storage?.persist?.().catch(() => {});
}

export const save = (...keys) => Promise.all(keys.map(k => tx('kv', 'readwrite', s => s.put(state[k], k))));

// ───────── Multimedia (fotografías y audio) ─────────
const urls = new Map();
export async function putMedia(blob) {
  const id = uid();
  await tx('media', 'readwrite', s => s.put(blob, id));
  return id;
}
export const getMedia = id => tx('media', 'readonly', s => s.get(id));
export async function mediaUrl(id) {
  if (!urls.has(id)) {
    const blob = await getMedia(id);
    if (!blob) return null;
    urls.set(id, URL.createObjectURL(blob));
  }
  return urls.get(id);
}
export async function delMedia(...ids) {
  for (const id of ids.filter(Boolean)) {
    if (urls.has(id)) { URL.revokeObjectURL(urls.get(id)); urls.delete(id); }
    await tx('media', 'readwrite', s => s.delete(id));
  }
}
const copyMedia = async id => (id ? putMedia(await getMedia(id)) : null);

// ───────── Consultas ─────────
export const person = id => state.persons.find(p => p.id === id) || null;
export const currentPerson = () => person(state.settings.currentPersonId);
export const prefs = () => currentPerson()?.prefs || state.settings.prefs;
export const category = id => state.categories.find(c => c.id === id) || null;
export const activity = id => state.activities.find(a => a.id === id) || null;
export const routine = id => state.routines.find(r => r.id === id) || null;
export const personName = id => person(id)?.name || 'Uso general';

/** Actividades que ve la persona activa: las generales y sus versiones propias.
 *  Una versión personal sustituye a la actividad de la que deriva. */
export function visibleActivities(categoryId) {
  const pid = state.settings.currentPersonId;
  const mine = state.activities.filter(a => !a.personId || a.personId === pid);
  const replaced = new Set(mine.filter(a => a.personId && a.baseId).map(a => a.baseId));
  return mine.filter(a => !replaced.has(a.id) && (!categoryId || a.categoryId === categoryId));
}
export function visibleRoutines(categoryId) {
  const pid = state.settings.currentPersonId;
  return state.routines.filter(r => (!r.personId || r.personId === pid) && (!categoryId || r.categoryId === categoryId));
}

/** Identificadores de todos los pictogramas en uso (para guardarlos sin conexión). */
export function usedPictos() {
  const ids = new Set();
  state.categories.forEach(c => ids.add(c.picto));
  state.activities.forEach(a => { ids.add(a.picto); a.steps.forEach(s => ids.add(s.picto)); });
  state.routines.forEach(r => { ids.add(r.picto); r.items.forEach(i => ids.add(i.picto)); });
  ids.delete(null); ids.delete(undefined);
  return [...ids];
}

// ───────── Actividades ─────────
const activityMedia = a => [a.photo, ...a.steps.flatMap(s => [s.photo, s.audio])];

export function touch(a) { a.updatedAt = Date.now(); return save('activities'); }

export function newActivity(categoryId) {
  const a = {
    id: uid(), categoryId, title: 'Nueva actividad', picto: null, photo: null, level: 'medio',
    personId: null, baseId: null, steps: [], createdAt: Date.now(), updatedAt: Date.now(),
  };
  state.activities.push(a);
  save('activities');
  return a;
}
export const newStep = () => ({ id: uid(), text: '', tip: '', picto: null, photo: null, audio: null });

/** Duplica una actividad. Con `personId` crea una versión personal de la original. */
export async function duplicateActivity(id, { personId = null, asVersion = false } = {}) {
  const src = activity(id);
  const copy = structuredClone(src);
  copy.id = uid();
  copy.createdAt = copy.updatedAt = Date.now();
  copy.photo = await copyMedia(src.photo);
  for (const s of copy.steps) {
    s.id = uid();
    s.photo = await copyMedia(s.photo);
    s.audio = await copyMedia(s.audio);
  }
  if (asVersion) {
    copy.baseId = src.baseId || src.id;
    copy.personId = personId;
    copy.title = personId ? `${src.title} – ${personName(personId)}` : `${src.title} (versión)`;
  } else {
    copy.title = `${src.title} (copia)`;
  }
  state.activities.push(copy);
  await save('activities');
  return copy;
}

export async function deleteActivity(id) {
  const a = activity(id);
  if (!a) return;
  await delMedia(...activityMedia(a));
  state.activities = state.activities.filter(x => x.id !== id);
  state.activities.forEach(x => { if (x.baseId === id) x.baseId = null; });
  state.routines.forEach(r => r.items.forEach(i => { if (i.activityId === id) i.activityId = null; }));
  await save('activities', 'routines');
}

// ───────── Personas ─────────
export function newPerson(name) {
  const p = { id: uid(), name, prefs: { ...state.settings.prefs }, createdAt: Date.now() };
  state.persons.push(p);
  save('persons');
  return p;
}

/** Elimina por completo los datos de una persona: ficha, versiones propias de
 *  actividades (con sus fotografías y audios), rutinas y registros. */
export async function deletePerson(id) {
  for (const a of state.activities.filter(a => a.personId === id)) await delMedia(...activityMedia(a));
  state.activities = state.activities.filter(a => a.personId !== id);
  state.routines = state.routines.filter(r => r.personId !== id);
  state.logs = state.logs.filter(l => l.personId !== id);
  state.persons = state.persons.filter(p => p.id !== id);
  if (state.settings.currentPersonId === id) state.settings.currentPersonId = null;
  await save(...KEYS);
}

// ───────── Registros ─────────
/** Nivel máximo de ayuda registrado en una sesión (null si no se registró ninguno). */
export function maxHelp(log) {
  const v = log.steps.map(s => s.help).filter(h => h != null);
  return v.length ? Math.max(...v) : null;
}
export const helpedSteps = log => log.steps.filter(s => s.help != null && s.help > 0).length;
/** Las versiones de una actividad se siguen juntas. */
export const logKey = log => log.baseId || log.activityId;

// ───────── Copia de seguridad ─────────
const blobToDataUrl = blob => new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(blob); });

export async function exportAll() {
  const media = {};
  const d = await db();
  await new Promise((resolve, reject) => {
    const pending = [];
    const cur = d.transaction('media').objectStore('media').openCursor();
    cur.onsuccess = () => {
      const c = cur.result;
      if (!c) return Promise.all(pending).then(resolve);
      pending.push(blobToDataUrl(c.value).then(u => { media[c.key] = u; }));
      c.continue();
    };
    cur.onerror = () => reject(cur.error);
  });
  const data = Object.fromEntries(KEYS.map(k => [k, state[k]]));
  return { app: 'avd-pasos', version: 1, exportedAt: new Date().toISOString(), data, media };
}

export async function importAll(backup) {
  if (backup?.app !== 'avd-pasos' || !backup.data?.settings) throw new Error('Archivo no válido');
  await tx('media', 'readwrite', s => s.clear());
  urls.forEach(u => URL.revokeObjectURL(u)); urls.clear();
  for (const [id, dataUrl] of Object.entries(backup.media || {})) {
    const blob = await (await fetch(dataUrl)).blob();
    await tx('media', 'readwrite', s => s.put(blob, id));
  }
  for (const k of KEYS) state[k] = backup.data[k] ?? state[k];
  await save(...KEYS);
}

export async function wipeAll() {
  (await db()).close();
  dbp = null;
  await new Promise(res => { const r = indexedDB.deleteDatabase(DB_NAME); r.onsuccess = r.onerror = r.onblocked = res; });
  try { Object.keys(localStorage).filter(k => k.startsWith('rt:')).forEach(k => localStorage.removeItem(k)); } catch {}
}
