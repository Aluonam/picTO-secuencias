// Pictogramas ARASAAC.
//
// La aplicación NO incluye ni redistribuye pictogramas: cada imagen se pide al servidor
// de ARASAAC la primera vez que se necesita y se guarda en la caché del dispositivo para
// poder trabajar sin conexión. Solo se guardan los pictogramas que usan las actividades.
//
// Pictogramas: ARASAAC (https://arasaac.org), autor Sergio Palao, propiedad del
// Gobierno de Aragón (España), licencia Creative Commons BY-NC-SA 4.0.
import { state, usedPictos, prefs } from './store.js';

const STATIC = 'https://static.arasaac.org/pictograms';
const API = 'https://api.arasaac.org/v1/pictograms';
export const PICTO_CACHE = 'arasaac-pictos-v1'; // el service worker usa el mismo nombre

export const ATTRIBUTION = 'Pictogramas: ARASAAC (Gobierno de Aragón)';

export const pictoUrl = (id, style = prefs().pictoStyle) =>
  `${STATIC}/${id}/${id}${style === 'bn' ? '_nocolor' : ''}_500.png`;
export const thumbUrl = id => `${STATIC}/${id}/${id}_300.png`;

/** Busca pictogramas por palabra. Solo se envía a ARASAAC el texto buscado. */
export async function searchPictos(text) {
  const q = encodeURIComponent(text.trim().toLowerCase());
  for (const endpoint of ['bestsearch', 'search']) {
    const r = await fetch(`${API}/es/${endpoint}/${q}`);
    if (!r.ok) continue;
    const list = await r.json();
    if (Array.isArray(list) && list.length) {
      return list.slice(0, 36).map(p => ({ id: p._id, label: p.keywords?.find(k => k.keyword)?.keyword || '' }));
    }
  }
  return [];
}

/** Guarda en el dispositivo los pictogramas indicados que aún no estén guardados. */
export async function cachePictos(ids, onProgress) {
  if (!('caches' in window)) return { saved: 0, total: ids.length, supported: false };
  const cache = await caches.open(PICTO_CACHE);
  const pending = [];
  for (const id of ids) {
    const url = pictoUrl(id);
    if (!(await cache.match(url))) pending.push(url);
  }
  let done = ids.length - pending.length;
  onProgress?.(done, ids.length);
  const worker = async () => {
    for (let url; (url = pending.shift());) {
      try {
        const r = await fetch(url, { mode: 'cors' });
        if (r.ok) { await cache.put(url, r); done++; }
      } catch { /* sin conexión: se reintentará más adelante */ }
      onProgress?.(done, ids.length);
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  return { saved: done, total: ids.length, supported: true };
}

export async function cacheStatus() {
  const ids = usedPictos();
  if (!('caches' in window)) return { saved: 0, total: ids.length, supported: false };
  const cache = await caches.open(PICTO_CACHE);
  let saved = 0;
  for (const id of ids) if (await cache.match(pictoUrl(id))) saved++;
  return { saved, total: ids.length, supported: true };
}

/** Al arrancar con conexión, completa en segundo plano la caché de pictogramas en uso. */
export function syncPictos() {
  if (!state.settings.offlinePictos || !navigator.onLine) return;
  setTimeout(() => cachePictos(usedPictos()).catch(() => {}), 2500);
}
