# Paso a paso · AVD

PWA para Terapia Ocupacional: secuencias visuales paso a paso de actividades de la vida diaria (AVD), con pictogramas ARASAAC, fotografías propias, audio, rutinas y seguimiento del nivel de ayuda.

Sin dependencias ni compilación: HTML, CSS y JavaScript (módulos ES).

## Probar en local

```
node tools/serve.mjs
```

y abrir <http://127.0.0.1:8765>. Para instalarla en una tablet hay que publicar la carpeta tal cual en cualquier alojamiento estático con **HTTPS** (el service worker y la instalación lo exigen) y abrirla una vez con conexión.

## Estructura

| Archivo | Contenido |
|---|---|
| `js/seed.js` | Categorías, actividades y rutinas iniciales (plantillas editables) |
| `js/store.js` | Datos en IndexedDB: personas, actividades, pasos, multimedia, registros |
| `js/pictos.js` | Acceso a ARASAAC y caché de pictogramas en el dispositivo |
| `js/ui.js` | Componentes reutilizables (botones, diálogos, selector de pictogramas, voz) |
| `js/views-user.js` | Inicio, categorías, vista previa, ejecución, finalización y rutinas |
| `js/views-therapist.js` | PIN, panel y editores de actividades, pasos, rutinas y categorías |
| `js/views-admin.js` | Personas, preferencias, seguimiento y configuración |
| `sw.js` | Funcionamiento sin conexión. Al publicar cambios, subir `VERSION` |

## Pictogramas ARASAAC

La aplicación no incluye ni redistribuye pictogramas: guarda solo su identificador, pide cada imagen a ARASAAC la primera vez y la conserva en la caché del dispositivo (únicamente los que usan las actividades).

Los símbolos pictográficos son propiedad del Gobierno de Aragón, creados por Sergio Palao para [ARASAAC](https://arasaac.org) y distribuidos bajo licencia Creative Commons **BY-NC-SA**: exige atribución y **no permite uso comercial**. Conviene revisar sus condiciones de uso antes de distribuir la aplicación.

## AOTA / OTPF-4

Las categorías toman como referencia la clasificación de ocupaciones del OTPF-4. Las secuencias de pasos no proceden de AOTA: son plantillas clínicas que el terapeuta adapta. No es un producto oficial de AOTA ni de ARASAAC.

## Privacidad

Todos los datos se guardan en el dispositivo (IndexedDB). No hay servidor, cuentas ni analítica. La única conexión externa es con ARASAAC (descarga de pictogramas y búsqueda por palabra). El PIN del modo configuración es una barrera de acceso, no un cifrado.

## Modo configuración

Botón **Configuración** de la pantalla de inicio (PIN de 4 cifras). Con el modo activo, cada tarjeta de categoría, actividad y rutina muestra un lápiz para editar su nombre, su pictograma y sus pasos; el panel da acceso además a personas, seguimiento y ajustes.
