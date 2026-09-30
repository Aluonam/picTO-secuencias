// Arranque y enrutado por hash.
import { load } from './store.js';
import { applyPrefs, stopSound, h } from './ui.js';
import { syncPictos } from './pictos.js';
import { viewHome, viewCategories, viewCategory, viewPreview, viewRun, viewRoutines, viewRoutine } from './views-user.js';
import {
  isUnlocked, viewGate, viewPanel, viewActivities, viewActivityEditor, viewStepEditor,
  viewRoutinesAdmin, viewRoutineEditor, viewCategoriesAdmin,
} from './views-therapist.js';
import { viewPersons, viewPerson, viewTracking, viewSettings } from './views-admin.js';

const routes = [
  [/^#\/categorias$/, viewCategories],
  [/^#\/categoria\/([^/]+)$/, viewCategory],
  [/^#\/actividad\/([^/]+)$/, viewPreview],
  [/^#\/hacer\/([^/]+)$/, viewRun],
  [/^#\/rutinas$/, viewRoutines],
  [/^#\/rutina\/([^/]+)$/, viewRoutine],
  // Modo terapeuta (protegido con PIN)
  [/^#\/t$/, viewPanel],
  [/^#\/t\/actividades$/, viewActivities],
  [/^#\/t\/actividad\/([^/]+)$/, viewActivityEditor],
  [/^#\/t\/actividad\/([^/]+)\/paso\/([^/]+)$/, viewStepEditor],
  [/^#\/t\/rutinas$/, viewRoutinesAdmin],
  [/^#\/t\/rutina\/([^/]+)$/, viewRoutineEditor],
  [/^#\/t\/categorias$/, viewCategoriesAdmin],
  [/^#\/t\/personas$/, viewPersons],
  [/^#\/t\/persona\/([^/]+)$/, viewPerson],
  [/^#\/t\/seguimiento$/, viewTracking],
  [/^#\/t\/ajustes$/, viewSettings],
];

const app = document.getElementById('app');
let cleanup = null, lastPath = null;

function render() {
  const [path, qs] = (location.hash || '#/').split('?');
  const query = Object.fromEntries(new URLSearchParams(qs || ''));
  cleanup?.();
  cleanup = null;
  stopSound();
  document.querySelectorAll('dialog[open]').forEach(d => d.dispatchEvent(new Event('cancel')));

  let out;
  if (/^#\/t(\/|$)/.test(path) && !isUnlocked()) out = viewGate();
  else {
    const hit = routes.map(([re, view]) => [path.match(re), view]).find(([m]) => m);
    out = hit ? hit[1](...hit[0].slice(1).map(decodeURIComponent), query) : viewHome();
  }
  if (out instanceof Node) out = { el: out };
  cleanup = out.cleanup || null;
  applyPrefs();
  app.replaceChildren(out.el);
  if (path !== lastPath) { scrollTo(0, 0); lastPath = path; }
}

window.addEventListener('hashchange', render);
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); window.deferredInstall = e; });
window.addEventListener('appinstalled', () => { window.deferredInstall = null; });

load().then(() => {
  render();
  syncPictos();
}).catch(err => {
  console.error(err);
  app.replaceChildren(h('div', { class: 'page' }, h('p', { class: 'empty' },
    'No se ha podido abrir el almacenamiento local. Comprueba que el navegador no está en modo privado y vuelve a cargar la página.')));
});

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
