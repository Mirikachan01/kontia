/* ==========================================================
   Panel de clientes · conexión con Google Sheets (js/sheets.js)
   Habla con el script de Apps Script (google-apps-script/Code.gs).
   Se carga en TODAS las páginas (con defer) para que el guardado
   automático funcione sin importar dónde edites los datos.

   Guarda la conexión en localStorage, clave "dashboard.sheets.v1":
   { url, token, auto, ultimaSubida, ultimaBajada, pendiente }
   Esta clave NO se incluye en los respaldos (contiene la clave secreta).
   Expone window.AppSheets.
   ========================================================== */
(() => {
  'use strict';

  const KEY = 'dashboard.sheets.v1';
  const LOCAL = {
    clientes: 'dashboard.clientes.v1',
    cuentas: 'dashboard.cuentas.v1',
    tarjetas: 'dashboard.tarjetas.v1',
    accesos: 'dashboard.accesos.v1',
  };
  const AUTO_KEYS = new Set(Object.values(LOCAL));
  const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
  const HEX = /^#[0-9a-f]{6}$/i;
  const TIMEOUT_MS = 45000;
  const AUTO_DELAY_MS = 2500; // espera tras el último cambio antes de guardar

  /* ---------- Conexión guardada ---------- */
  function getCfg() {
    let s = {};
    try { s = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { s = {}; }
    return {
      url: String(s.url || ''),
      token: String(s.token || ''),
      auto: s.auto !== false, // guardado automático: activo salvo que lo apagues
      ultimaSubida: s.ultimaSubida || null,
      ultimaBajada: s.ultimaBajada || null,
      pendiente: s.pendiente === true,
    };
  }

  function setCfg(patch) {
    const cfg = { ...getCfg(), ...patch };
    localStorage.setItem(KEY, JSON.stringify(cfg));
    return cfg;
  }

  // Solo se acepta la dirección de Apps Script, para no enviar la clave a otro sitio
  function validUrl(u) {
    try {
      const x = new URL(u);
      return x.protocol === 'https:' && x.hostname === 'script.google.com';
    } catch (e) {
      return false;
    }
  }

  /* ---------- Llamadas ---------- */
  async function call(action, extra = {}) {
    const { url, token } = getCfg();
    if (!url || !token) throw new Error('Primero guarda la URL y la clave de tu hoja.');
    if (!validUrl(url)) throw new Error('La URL guardada no es una dirección de Apps Script.');

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    let res;
    try {
      // Cuerpo en texto plano: así el navegador no hace la consulta previa (CORS) que Apps Script no responde
      res = await fetch(url, { method: 'POST', body: JSON.stringify({ action, token, ...extra }), signal: ctrl.signal });
    } catch (e) {
      throw new Error(e && e.name === 'AbortError'
        ? 'La hoja tardó demasiado en responder. Inténtalo de nuevo.'
        : 'No se pudo conectar. Revisa tu internet y la URL del script.');
    } finally {
      clearTimeout(timer);
    }

    let json;
    try {
      json = JSON.parse(await res.text());
    } catch (e) {
      throw new Error('La respuesta no es válida. Revisa que la implementación esté publicada con acceso para «Cualquier usuario».');
    }
    if (!json || json.ok !== true) throw new Error((json && json.error) || 'La hoja devolvió un error.');
    return json;
  }

  /* ---------- Datos locales ---------- */
  const readJSON = (key) => {
    try { return JSON.parse(localStorage.getItem(key)) || {}; } catch (e) { return {}; }
  };
  const list = (v) => (Array.isArray(v) ? v : []);

  function collect() {
    const c = readJSON(LOCAL.clientes);
    const q = readJSON(LOCAL.cuentas);
    const t = readJSON(LOCAL.tarjetas);
    const a = readJSON(LOCAL.accesos);

    // Para que la hoja sea legible, cada cliente lleva también los nombres de sus cuentas
    const catName = new Map(list(q.categorias).map((x) => [x.id, x.nombre]));
    const cuentaTxt = new Map(list(q.cuentas).map((x) => [x.id, `${catName.get(x.categoriaId) || 'Sin categoría'} - ${x.nombre}`]));
    const clientes = list(c.clientes).map((cl) => {
      const ids = list(cl.cuentaIds);
      return { ...cl, cuentaIds: ids.join('|'), cuentas: ids.map((i) => cuentaTxt.get(i)).filter(Boolean).join(' | ') };
    });

    return {
      clientes,
      categorias: list(q.categorias),
      cuentas: list(q.cuentas),
      bancos: list(t.bancos),
      tarjetas: list(t.tarjetas),
      accesosCategorias: list(a.categorias),
      accesos: list(a.accesos),
    };
  }

  const localCounts = () => {
    const d = collect();
    return Object.fromEntries(Object.keys(d).map((k) => [k, d[k].length]));
  };

  /* ---------- Conversión hoja -> formato del panel ---------- */
  // La hoja devuelve todo como texto; aquí se vuelve a números y se descartan filas dañadas
  const str = (v) => String(v == null ? '' : v).trim();
  const num = (v) => { const n = Number(str(v).replace(',', '.')); return Number.isFinite(n) ? n : 0; };
  const rows = (v, fn) => (Array.isArray(v) ? v : []).map(fn).filter(Boolean);

  function toLocalShape(remote = {}) {
    const clientes = rows(remote.clientes, (r) => {
      const id = Math.round(num(r.id));
      if (!id || !str(r.nombre) || !ISO_DATE.test(str(r.inicio)) || !ISO_DATE.test(str(r.vence))) return null;
      return {
        id,
        nombre: str(r.nombre),
        usuario: str(r.usuario),
        password: String(r.password == null ? '' : r.password),
        whatsapp: str(r.whatsapp),
        dispositivos: num(r.dispositivos) || 1,
        meses: num(r.meses) || 1,
        compra: num(r.compra),
        venta: num(r.venta),
        inicio: str(r.inicio),
        vence: str(r.vence),
        cuentaIds: str(r.cuentaIds).split('|').map((s) => s.trim()).filter(Boolean),
      };
    });

    const idNombre = (r) => (str(r.id) && str(r.nombre) ? { id: str(r.id), nombre: str(r.nombre) } : null);
    const categorias = rows(remote.categorias, idNombre);
    const bancos = rows(remote.bancos, idNombre);
    const accesosCategorias = rows(remote.accesosCategorias, idNombre);

    const cuentas = rows(remote.cuentas, (r) => (
      str(r.id) && str(r.nombre)
        ? { id: str(r.id), categoriaId: str(r.categoriaId), nombre: str(r.nombre), creado: num(r.creado) || Date.now() }
        : null
    ));

    const tarjetas = rows(remote.tarjetas, (r) => (
      str(r.id) && str(r.titular)
        ? {
          id: str(r.id),
          bancoId: str(r.bancoId),
          titular: str(r.titular),
          serial: str(r.serial),
          telefono: str(r.telefono),
          color: HEX.test(str(r.color)) ? str(r.color) : '#2b59ff',
          creado: num(r.creado) || Date.now(),
        }
        : null
    ));

    // Solo se aceptan enlaces http(s)
    const accesos = rows(remote.accesos, (r) => (
      str(r.id) && str(r.nombre) && /^https?:\/\//i.test(str(r.url))
        ? { id: str(r.id), categoriaId: str(r.categoriaId), nombre: str(r.nombre), url: str(r.url), creado: num(r.creado) || Date.now() }
        : null
    ));

    return {
      [LOCAL.clientes]: { nextId: clientes.reduce((m, c) => Math.max(m, c.id), 0) + 1, clientes },
      [LOCAL.cuentas]: { categorias, cuentas },
      [LOCAL.tarjetas]: { bancos, tarjetas },
      [LOCAL.accesos]: { categorias: accesosCategorias, accesos },
    };
  }

  /* ---------- Acciones manuales ---------- */
  // Mientras se escribe en el dispositivo por una descarga o un borrado ya reflejado en la hoja,
  // el guardado automático no debe volver a subir nada
  let suppress = 0;
  const quiet = (fn) => {
    suppress += 1;
    try { return fn(); } finally { suppress -= 1; }
  };

  const ping = () => call('ping');
  const resumen = () => call('resumen');

  async function push() {
    const res = await call('push', { datos: collect() });
    setCfg({ ultimaSubida: new Date().toISOString(), pendiente: false });
    return res;
  }

  async function pull() {
    const res = await call('pull');
    const shape = toLocalShape(res.datos);
    quiet(() => Object.keys(shape).forEach((k) => localStorage.setItem(k, JSON.stringify(shape[k]))));
    setCfg({ ultimaBajada: new Date().toISOString(), pendiente: false });
    return {
      clientes: shape[LOCAL.clientes].clientes.length,
      cuentas: shape[LOCAL.cuentas].cuentas.length,
      tarjetas: shape[LOCAL.tarjetas].tarjetas.length,
      accesos: shape[LOCAL.accesos].accesos.length,
    };
  }

  const deleteMonths = (meses) => call('borrarMeses', { meses });

  // Borra de este dispositivo los clientes cuyo mes de inicio esté en la lista
  function deleteLocalMonths(meses) {
    const set = new Set(meses);
    const data = readJSON(LOCAL.clientes);
    const all = list(data.clientes);
    const quedan = all.filter((c) => !set.has(String(c.inicio).slice(0, 7)));
    if (quedan.length !== all.length) {
      quiet(() => localStorage.setItem(LOCAL.clientes, JSON.stringify({ ...data, clientes: quedan })));
    }
    return all.length - quedan.length;
  }

  // Todos los meses desde el primero con clientes hasta el actual (también los vacíos)
  function monthsRange(meses, hoy) {
    const keys = Object.keys(meses).sort();
    if (keys.length === 0) return [];
    const current = /^\d{4}-\d{2}/.test(hoy || '') ? hoy.slice(0, 7) : keys[keys.length - 1];
    const last = current > keys[keys.length - 1] ? current : keys[keys.length - 1];
    const out = [];
    let [y, m] = keys[0].split('-').map(Number);
    while (`${y}-${String(m).padStart(2, '0')}` <= last && out.length < 240) {
      out.push(`${y}-${String(m).padStart(2, '0')}`);
      m += 1;
      if (m > 12) { m = 1; y += 1; }
    }
    return out;
  }

  /* ==========================================================
     Guardado automático
     Cada vez que cualquier página guarda clientes, cuentas, tarjetas o accesos,
     se espera un momento y se suben todos los datos a la hoja.
     Solo se activa si la conexión está guardada y ya hubo una primera subida
     o descarga en este dispositivo (así un equipo vacío no pisa la hoja).
     ========================================================== */
  let timer = null;
  let running = false;
  let again = false;
  let failed = false;
  let hideTimer = null;

  const autoReady = () => {
    const c = getCfg();
    return Boolean(c.url && c.token && c.auto && (c.ultimaSubida || c.ultimaBajada) && validUrl(c.url));
  };

  function badge(text, kind, withRetry = false) {
    if (!document.body) return;
    let box = document.getElementById('sync-badge');
    if (!box) {
      box = document.createElement('div');
      box.id = 'sync-badge';
      box.setAttribute('role', 'status');
      box.setAttribute('aria-live', 'polite');
      document.body.appendChild(box);
    }
    box.className = `sync-badge is-${kind}`;
    box.hidden = false;
    box.replaceChildren(Object.assign(document.createElement('span'), { textContent: text }));
    if (withRetry) {
      const b = Object.assign(document.createElement('button'), { type: 'button', textContent: 'Reintentar' });
      b.addEventListener('click', () => flush());
      box.appendChild(b);
    }
    clearTimeout(hideTimer);
    if (kind === 'ok') hideTimer = setTimeout(() => { box.hidden = true; }, 2600);
  }

  async function flush() {
    if (!autoReady()) return;
    if (running) { again = true; return; }
    running = true;
    again = false;
    badge('Guardando en Google Sheets…', 'busy');
    let ok = false;
    try {
      await call('push', { datos: collect(), auto: true });
      failed = false;
      ok = true;
      setCfg({ ultimaSubida: new Date().toISOString(), pendiente: again });
      badge('Guardado en Google Sheets', 'ok');
    } catch (e) {
      failed = true;
      setCfg({ pendiente: true });
      badge(`No se pudo guardar en Google Sheets: ${e.message}`, 'bad', true);
    } finally {
      running = false;
    }
    if (ok && again) flush();
  }

  function schedule() {
    if (!autoReady()) return;
    try { setCfg({ pendiente: true }); } catch (e) { /* sin almacenamiento */ }
    clearTimeout(timer);
    timer = setTimeout(() => { timer = null; flush(); }, AUTO_DELAY_MS);
  }

  function installAutoSync() {
    if (window.__syncPatched) return;
    window.__syncPatched = true;
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function patchedSetItem(k, v) {
      original.call(this, k, v);
      try {
        if (this === window.localStorage && !suppress && AUTO_KEYS.has(String(k))) schedule();
      } catch (e) { /* el guardado automático nunca debe romper la página */ }
    };

    // Al ocultar la pestaña o recuperar internet se intenta guardar enseguida
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && timer) { clearTimeout(timer); timer = null; flush(); }
    });
    window.addEventListener('online', () => { if (failed) flush(); });

    // Si quedó algo sin subir en una visita anterior, se reintenta al abrir
    if (autoReady() && getCfg().pendiente) setTimeout(flush, 1200);
  }

  installAutoSync();

  window.AppSheets = {
    KEY, getCfg, setCfg, validUrl, call, ping, resumen, push, pull, flush,
    collect, localCounts, toLocalShape, deleteMonths, deleteLocalMonths, monthsRange, autoReady,
  };
})();