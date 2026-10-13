/* ==========================================================
   Panel de clientes · página Ajustes (ajustes.html)
   Lee y guarda la configuración con window.AppConfig (js/config.js).
   ========================================================== */
(() => {
  'use strict';

  const C = window.AppConfig;

  // Todas las claves de datos del panel (para respaldo y borrado)
  const DATA_KEYS = [
    'dashboard.v1',
    'dashboard.cuentas.v1',
    'dashboard.clientes.v1',
    'dashboard.tarjetas.v1',
    'dashboard.accesos.v1',
    C.KEY,
  ];

  const PRESETS = [
    { id: 'medianoche', nombre: 'Medianoche', bg: '#07080d', warm: '#ff7a45', cool: '#7c5cff', accent: '#22d391' },
    { id: 'oceano',     nombre: 'Océano',     bg: '#060b14', warm: '#1fb6ff', cool: '#5b6bff', accent: '#2dd4bf' },
    { id: 'bosque',     nombre: 'Bosque',     bg: '#06100c', warm: '#34d399', cool: '#0ea5a4', accent: '#a3e635' },
    { id: 'atardecer',  nombre: 'Atardecer',  bg: '#0d0610', warm: '#ff4d8d', cool: '#8b5cf6', accent: '#ff8a5b' },
    { id: 'grafito',    nombre: 'Grafito',    bg: '#0b0b0d', warm: '#9aa3b2', cool: '#5d6675', accent: '#e5e7eb' },
  ];

  const DIAS_SUGERIDOS = [3, 5, 7, 10, 15, 30];

  /* ---------- Utilidades ---------- */
  const $ = (id) => document.getElementById(id);
  const plural = (n, one, many) => (n === 1 ? one : many);
  const fullDate = new Intl.DateTimeFormat('es-BO', { day: 'numeric', month: 'short', year: 'numeric' });
  const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };

  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };

  function toast(message, isError = false) {
    const t = el('div', 'toast' + (isError ? ' is-error' : ''), message);
    $('toasts').appendChild(t);
    setTimeout(() => t.remove(), 2800);
  }

  function confirmAction({ title, message, okText = 'Confirmar', danger = true }) {
    return new Promise((resolve) => {
      const dlg = $('dlg-confirm');
      $('confirm-title').textContent = title;
      $('confirm-msg').textContent = message;
      const ok = $('confirm-ok');
      ok.textContent = okText;
      ok.className = `btn ${danger ? 'btn-danger' : 'btn-primary'}`;
      dlg.returnValue = '';
      dlg.addEventListener('close', () => resolve(dlg.returnValue === 'ok'), { once: true });
      dlg.showModal();
    });
  }

  // Guarda toda la configuración; avisa si el navegador no deja escribir
  function persist(cfg, okMessage) {
    if (C.save(cfg)) { toast(okMessage); return true; }
    toast('No se pudo guardar en este navegador', true);
    return false;
  }

  let cfg = C.get(); // configuración guardada

  /* ==========================================================
     1. Tema
     ========================================================== */
  const T = { bg: $('t-bg'), warm: $('t-warm'), cool: $('t-cool'), accent: $('t-accent') };
  let draft = { ...cfg.tema };

  const sameTheme = (a, b) => Object.keys(T).every((k) => a[k].toLowerCase() === b[k].toLowerCase());

  function renderTheme() {
    Object.keys(T).forEach((k) => {
      T[k].value = draft[k];
      $(`v-${k}`).textContent = draft[k];
    });
    C.applyTheme(draft); // vista previa en vivo

    document.querySelectorAll('.preset').forEach((b) => {
      const p = PRESETS.find((x) => x.id === b.dataset.id);
      b.setAttribute('aria-pressed', String(sameTheme(p, draft)));
    });

    $('tema-warn').textContent = C.luminance(draft.bg) > 0.35
      ? 'Este fondo es claro: el texto del panel es blanco y puede costar leerlo. Se recomiendan fondos oscuros.'
      : '';
  }

  function buildPresets() {
    const box = $('presets');
    PRESETS.forEach((p) => {
      const b = el('button', 'preset');
      b.type = 'button';
      b.dataset.id = p.id;
      b.setAttribute('aria-pressed', 'false');
      const pv = el('span', 'pv');
      pv.style.setProperty('--p-bg', p.bg);
      pv.style.setProperty('--p-warm', p.warm);
      pv.style.setProperty('--p-cool', p.cool);
      pv.style.setProperty('--p-accent', p.accent);
      b.append(pv, el('span', null, p.nombre));
      b.addEventListener('click', () => {
        draft = { bg: p.bg, warm: p.warm, cool: p.cool, accent: p.accent };
        renderTheme();
      });
      box.appendChild(b);
    });
  }

  Object.keys(T).forEach((k) => {
    T[k].addEventListener('input', () => { draft[k] = T[k].value.toLowerCase(); renderTheme(); });
  });

  $('tema-save').addEventListener('click', () => {
    cfg = { ...cfg, tema: { ...draft } };
    persist(cfg, 'Tema guardado');
  });

  $('tema-reset').addEventListener('click', () => {
    draft = { ...C.DEFAULTS.tema };
    cfg = { ...cfg, tema: { ...draft } };
    renderTheme();
    persist(cfg, 'Colores restablecidos');
  });

  /* ==========================================================
     2. Vencimientos
     ========================================================== */
  const daysInput = $('d-dias');

  function readDays() {
    const n = Number(daysInput.value);
    return Number.isInteger(n) && n >= 1 && n <= 90 ? n : null;
  }

  function renderDays() {
    const n = readDays();
    const help = $('d-help');
    help.replaceChildren();
    if (n == null) {
      help.textContent = 'Escribe un número entero entre 1 y 90.';
    } else {
      help.append(
        'Un cliente al que le quedan ',
        el('strong', null, `${n} ${plural(n, 'día', 'días')} o menos`),
        ' se marca como «Por vencer». Con más tiempo es «Activo» y, pasada la fecha de fin, «Vencido».',
      );
    }
    document.querySelectorAll('.pill').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.dias) === n)));
  }

  function buildDaysPills() {
    DIAS_SUGERIDOS.forEach((d) => {
      const b = el('button', 'pill', `${d} ${plural(d, 'día', 'días')}`);
      b.type = 'button';
      b.dataset.dias = d;
      b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', () => { daysInput.value = d; $('dias-error').textContent = ''; renderDays(); });
      $('dias-pills').appendChild(b);
    });
  }

  daysInput.addEventListener('input', () => { $('dias-error').textContent = ''; renderDays(); });

  $('dias-save').addEventListener('click', () => {
    const n = readDays();
    if (n == null) { $('dias-error').textContent = 'Escribe un número entero entre 1 y 90.'; daysInput.focus(); return; }
    cfg = { ...cfg, diasPorVencer: n };
    persist(cfg, 'Días de vencimiento guardados');
  });

  /* ==========================================================
     3a. Moneda y contacto
     ========================================================== */
  $('general-save').addEventListener('click', () => {
    const moneda = $('g-moneda').value.trim();
    const pais = $('g-pais').value.replace(/\D/g, '');
    const error = $('general-error');
    if (!moneda) { error.textContent = 'Escribe el símbolo de la moneda.'; $('g-moneda').focus(); return; }
    if (pais.length < 1 || pais.length > 4) { error.textContent = 'Escribe el código de país (de 1 a 4 dígitos).'; $('g-pais').focus(); return; }
    error.textContent = '';
    cfg = { ...cfg, moneda, codigoPais: pais };
    persist(cfg, 'Ajustes guardados');
  });

  /* ==========================================================
     3b. Mensajes de WhatsApp
     ========================================================== */
  const ESTADOS = ['porvencer', 'vencido', 'activo'];
  const EJEMPLO_DIAS = { porvencer: 3, vencido: -4, activo: 20 };

  function renderPreviews() {
    ESTADOS.forEach((e) => {
      const dias = EJEMPLO_DIAS[e];
      const text = C.fill($(`m-${e}`).value, {
        nombre: 'Carlos Rojas',
        fecha: fullDate.format(addDays(new Date(), dias)),
        dias,
      });
      document.querySelector(`[data-preview="${e}"]`).textContent = text || 'Escribe un mensaje…';
    });
  }

  function fillMessages(source) {
    ESTADOS.forEach((e) => { $(`m-${e}`).value = source[e]; });
    renderPreviews();
  }

  document.querySelectorAll('.msg-block').forEach((block) => {
    const ta = block.querySelector('textarea');
    ta.addEventListener('input', renderPreviews);
    block.querySelectorAll('.token').forEach((tok) => {
      tok.addEventListener('click', () => {
        const pos = ta.selectionStart;
        const prev = pos > 0 ? ta.value[pos - 1] : '';
        const lead = prev && !/[\s(¿¡]/.test(prev) ? ' ' : ''; // evita pegar la etiqueta a la palabra anterior
        ta.setRangeText(lead + tok.dataset.token, pos, ta.selectionEnd, 'end');
        ta.focus();
        renderPreviews();
      });
    });
  });

  $('msg-save').addEventListener('click', () => {
    const mensajes = {};
    for (const e of ESTADOS) {
      const v = $(`m-${e}`).value.trim();
      if (!v) { $('msg-error').textContent = 'Ningún mensaje puede quedar vacío.'; $(`m-${e}`).focus(); return; }
      mensajes[e] = v;
    }
    $('msg-error').textContent = '';
    cfg = { ...cfg, mensajes };
    persist(cfg, 'Mensajes guardados');
  });

  $('msg-reset').addEventListener('click', () => {
    $('msg-error').textContent = '';
    fillMessages(C.DEFAULTS.mensajes);
    cfg = { ...cfg, mensajes: { ...C.DEFAULTS.mensajes } };
    persist(cfg, 'Mensajes restablecidos');
  });

  /* ==========================================================
     3c. Respaldo y datos
     ========================================================== */
  // Descarga un archivo de respaldo con la misma estructura que acepta "Importar"
  function downloadBackup(datos, prefijo = 'respaldo-panel') {
    const payload = { app: 'panel-clientes', version: 1, exportado: new Date().toISOString(), datos };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = el('a');
    a.href = url;
    a.download = `${prefijo}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  $('data-export').addEventListener('click', () => {
    const datos = {};
    DATA_KEYS.forEach((k) => {
      const raw = localStorage.getItem(k);
      if (!raw) return;
      try { datos[k] = JSON.parse(raw); } catch (e) { /* se omite lo dañado */ }
    });
    downloadBackup(datos);
    toast('Respaldo exportado');
  });

  $('data-import').addEventListener('click', () => $('data-file').click());

  $('data-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;

    let payload;
    try {
      payload = JSON.parse(await file.text());
    } catch (err) {
      toast('El archivo no es un respaldo válido', true);
      return;
    }
    const datos = payload && payload.app === 'panel-clientes' && payload.datos && typeof payload.datos === 'object'
      ? payload.datos : null;
    const keys = datos ? DATA_KEYS.filter((k) => datos[k] && typeof datos[k] === 'object') : [];
    if (keys.length === 0) { toast('El archivo no es un respaldo válido', true); return; }

    const ok = await confirmAction({
      title: '¿Importar respaldo?',
      message: 'Se reemplazarán los datos actuales por los del archivo. Esta acción no se puede deshacer.',
      okText: 'Importar',
    });
    if (!ok) return;

    try {
      keys.forEach((k) => localStorage.setItem(k, JSON.stringify(datos[k])));
    } catch (err) {
      toast('No se pudo guardar en este navegador', true);
      return;
    }
    toast('Respaldo importado');
    setTimeout(() => location.reload(), 900); // recarga para aplicar tema y ajustes importados
  });

  $('data-wipe').addEventListener('click', async () => {
    const ok = await confirmAction({
      title: '¿Borrar datos del negocio?',
      message: `Se eliminarán todos los clientes, cuentas, tarjetas y accesos directos. Tus ajustes se conservan. Esta acción no se puede deshacer.${window.AppSheets.autoReady() ? ' Como el guardado automático en Google Sheets está activo, la hoja se actualizará con el siguiente dato que guardes y también perderá lo borrado. Exporta un respaldo antes si lo necesitas.' : ''}`,
      okText: 'Borrar todo',
    });
    if (!ok) return;
    try {
      DATA_KEYS.filter((k) => k !== C.KEY).forEach((k) => localStorage.removeItem(k));
      toast('Datos borrados');
    } catch (err) {
      toast('No se pudieron borrar los datos', true);
    }
  });

  /* ==========================================================
     Google Sheets
     ========================================================== */
  const S = window.AppSheets;
  const MESES_STATE = { meses: {}, hoy: '', selected: new Set() };

  const monthName = (key) => {
    const [y, m] = key.split('-').map(Number);
    return new Intl.DateTimeFormat('es-BO', { month: 'long', year: 'numeric' }).format(new Date(y, m - 1, 1));
  };
  const whenText = (iso) => (iso
    ? new Intl.DateTimeFormat('es-BO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))
    : 'nunca');
  const countText = (n, one, many) => `${n} ${plural(n, one, many)}`;

  function setStatus(kind, text) {
    const chip = $('sh-status');
    chip.textContent = text;
    chip.classList.toggle('is-ok', kind === 'ok');
    chip.classList.toggle('is-bad', kind === 'bad');
  }

  function renderLast() {
    const c = S.getCfg();
    $('sh-last').textContent = `Última subida: ${whenText(c.ultimaSubida)}. Última descarga: ${whenText(c.ultimaBajada)}.`;
    renderAutoState();
  }

  // Ejecuta una acción larga con el botón bloqueado; los errores salen como aviso
  async function run(btn, fn) {
    btn.disabled = true;
    btn.classList.add('is-busy');
    try {
      return await fn();
    } catch (err) {
      toast(err && err.message ? err.message : 'Ocurrió un error', true);
      return undefined;
    } finally {
      btn.classList.remove('is-busy');
      btn.disabled = false;
      updateMonthsUI();
    }
  }

  /* ---- Conexión ---- */
  $('sh-test').addEventListener('click', () => run($('sh-test'), async () => {
    const url = $('sh-url').value.trim();
    const token = $('sh-token').value.trim();
    const error = $('sh-error');

    if (!S.validUrl(url)) {
      error.textContent = 'La URL debe ser la de tu aplicación web de Apps Script (empieza con https://script.google.com/…).';
      $('sh-url').focus();
      return;
    }
    if (token.length < 6) {
      error.textContent = 'La clave debe tener al menos 6 caracteres.';
      $('sh-token').focus();
      return;
    }
    error.textContent = '';
    S.setCfg({ url, token });

    try {
      const r = await S.ping();
      setStatus('ok', 'Conectado');
      toast(r.hoja ? `Conectado a «${r.hoja}»` : 'Conexión correcta');
    } catch (err) {
      setStatus('bad', 'Error de conexión');
      error.textContent = err.message;
      return;
    }

    try {
      await firstSync();
    } catch (err) {
      error.textContent = `Conectado, pero falló el primer envío: ${err.message}`;
    }
  }));

  // Primer envío: con una hoja vacía se suben los datos del dispositivo y queda activo el guardado automático
  async function firstSync() {
    const c = S.getCfg();
    if (!c.ultimaSubida && !c.ultimaBajada) {
      const remote = await S.resumen();
      const remoteTotal = Object.values(remote.conteos).reduce((s, n) => s + n, 0);
      if (remoteTotal === 0) {
        await S.push();
        toast('Hoja preparada: pestañas y columnas creadas, datos subidos');
      } else {
        toast('La hoja ya tiene datos. Elige «Subir» o «Descargar» abajo', true);
      }
    }
    renderLast();
    if (Object.keys(MESES_STATE.meses).length) await loadMonths();
  }

  $('sh-auto').addEventListener('change', () => {
    S.setCfg({ auto: $('sh-auto').checked });
    renderAutoState();
    toast($('sh-auto').checked ? 'Guardado automático activado' : 'Guardado automático desactivado');
  });

  function renderAutoState() {
    const c = S.getCfg();
    const note = $('sh-auto-state');
    if (!c.url || !c.token) {
      note.textContent = 'Conecta tu hoja para activar el guardado automático.';
    } else if (!c.ultimaSubida && !c.ultimaBajada) {
      note.textContent = 'Falta el primer envío: usa «Subir» o «Descargar» para activar el guardado automático.';
    } else {
      note.textContent = c.auto
        ? 'Guardado automático activo: cada cambio se sube a la hoja unos segundos después.'
        : 'Guardado automático desactivado: sube los datos a mano cuando quieras.';
    }
  }

  /* ---- Subir y descargar ---- */
  $('sh-push').addEventListener('click', () => run($('sh-push'), async () => {
    const remote = await S.resumen();
    const local = S.localCounts();
    // Si la hoja tiene más clientes que este dispositivo, se pide confirmar antes de reemplazar
    if (remote.conteos.clientes > local.clientes) {
      const ok = await confirmAction({
        title: '¿Reemplazar la hoja?',
        message: `La hoja tiene ${countText(remote.conteos.clientes, 'cliente', 'clientes')} y este dispositivo ${countText(local.clientes, 'cliente', 'clientes')}. Al subir, la hoja quedará igual que este dispositivo y se perderán los clientes que no estén aquí.`,
        okText: 'Subir y reemplazar',
      });
      if (!ok) return;
    }
    const r = await S.push();
    renderLast();
    toast(`Datos subidos: ${countText(r.conteos.clientes, 'cliente', 'clientes')}, ${countText(r.conteos.cuentas, 'cuenta', 'cuentas')}, ${countText(r.conteos.tarjetas, 'tarjeta', 'tarjetas')}`);
    if (Object.keys(MESES_STATE.meses).length) await loadMonths();
  }));

  $('sh-pull').addEventListener('click', () => run($('sh-pull'), async () => {
    const remote = await S.resumen();
    const c = remote.conteos;
    const ok = await confirmAction({
      title: '¿Descargar desde la hoja?',
      message: `Los datos de este dispositivo se reemplazarán por los de la hoja: ${countText(c.clientes, 'cliente', 'clientes')}, ${countText(c.cuentas, 'cuenta', 'cuentas')} y ${countText(c.tarjetas, 'tarjeta', 'tarjetas')}.`,
      okText: 'Descargar y reemplazar',
    });
    if (!ok) return;
    const n = await S.pull();
    renderLast();
    toast(`Datos descargados: ${countText(n.clientes, 'cliente', 'clientes')}, ${countText(n.cuentas, 'cuenta', 'cuentas')}, ${countText(n.tarjetas, 'tarjeta', 'tarjetas')}`);
  }));

  /* ---- Datos por mes ---- */
  function updateMonthsUI() {
    const sel = [...MESES_STATE.selected];
    const total = sel.reduce((s, k) => s + (MESES_STATE.meses[k] ? MESES_STATE.meses[k].total : 0), 0);
    $('mes-count').textContent = sel.length
      ? `${countText(sel.length, 'mes seleccionado', 'meses seleccionados')} (${countText(total, 'cliente', 'clientes')})`
      : 'Ningún mes seleccionado';
    $('mes-delete').disabled = sel.length === 0;
  }

  function renderMonths() {
    const ul = $('meses-lista');
    ul.replaceChildren();
    const keys = S.monthsRange(MESES_STATE.meses, MESES_STATE.hoy);

    if (keys.length === 0) {
      ul.appendChild(el('li', 'empty', 'La hoja todavía no tiene clientes.'));
      updateMonthsUI();
      return;
    }

    keys.forEach((key) => {
      const info = MESES_STATE.meses[key];
      const row = el('label', 'month-row' + (info ? '' : ' is-empty'));
      const box = el('input');
      box.type = 'checkbox';
      box.disabled = !info;
      box.checked = MESES_STATE.selected.has(key);
      row.classList.toggle('is-selected', box.checked);
      box.addEventListener('change', () => {
        if (box.checked) MESES_STATE.selected.add(key); else MESES_STATE.selected.delete(key);
        row.classList.toggle('is-selected', box.checked);
        updateMonthsUI();
      });

      row.append(box, el('span', 'month-name', monthName(key)));
      if (info && info.vigentes > 0) {
        row.appendChild(el('span', 'month-live', `${info.vigentes} con servicio vigente`));
      }
      row.appendChild(el('span', 'month-count', info ? countText(info.total, 'cliente', 'clientes') : 'Sin clientes'));
      ul.appendChild(row);
    });
    updateMonthsUI();
  }

  async function loadMonths() {
    const r = await S.resumen();
    MESES_STATE.meses = r.meses || {};
    MESES_STATE.hoy = r.hoy || '';
    MESES_STATE.selected = new Set([...MESES_STATE.selected].filter((k) => MESES_STATE.meses[k]));
    renderMonths();
  }

  $('mes-load').addEventListener('click', () => run($('mes-load'), loadMonths));

  $('mes-all').addEventListener('click', () => {
    Object.keys(MESES_STATE.meses).forEach((k) => MESES_STATE.selected.add(k));
    renderMonths();
  });
  $('mes-none').addEventListener('click', () => {
    MESES_STATE.selected.clear();
    renderMonths();
  });

  // Ventana de confirmación para borrar
  const dm = { dlg: $('dlg-del-months'), word: $('dm-word'), btn: $('dm-confirm') };

  $('mes-delete').addEventListener('click', () => {
    const keys = [...MESES_STATE.selected].sort();
    if (keys.length === 0) return;

    const total = keys.reduce((s, k) => s + MESES_STATE.meses[k].total, 0);
    const vigentes = keys.reduce((s, k) => s + MESES_STATE.meses[k].vigentes, 0);

    $('dm-summary').textContent = `Vas a borrar ${countText(total, 'cliente', 'clientes')} de la hoja de Google Sheets, de ${countText(keys.length, 'mes', 'meses')}. Esta acción no se puede deshacer.`;
    $('dm-list').replaceChildren(...keys.map((k) => {
      const li = el('li');
      li.append(el('span', 'm-name', monthName(k)), el('span', 'm-n', countText(MESES_STATE.meses[k].total, 'cliente', 'clientes')));
      return li;
    }));

    const warn = $('dm-warn');
    warn.hidden = vigentes === 0;
    warn.textContent = vigentes > 0
      ? `Atención: ${countText(vigentes, 'de estos clientes todavía tiene', 'de estos clientes todavía tienen')} servicio vigente.`
      : '';

    $('dm-backup').checked = true;
    $('dm-local').checked = true;
    dm.word.value = '';
    dm.btn.disabled = true;
    $('dm-error').textContent = '';
    dm.dlg.showModal();
    dm.word.focus();
  });

  dm.word.addEventListener('input', () => {
    dm.btn.disabled = dm.word.value.trim().toUpperCase() !== 'BORRAR';
  });

  dm.btn.addEventListener('click', () => run(dm.btn, async () => {
    const keys = [...MESES_STATE.selected].sort();
    const error = $('dm-error');
    error.textContent = '';

    try {
      // 1. Copia de lo que hay en la hoja (si falla, no se borra nada)
      if ($('dm-backup').checked) {
        const r = await S.call('pull');
        downloadBackup(S.toLocalShape(r.datos), 'respaldo-hoja');
      }
      // 2. Borrado en la hoja
      const res = await S.deleteMonths(keys);
      // 3. Borrado en este dispositivo
      const local = $('dm-local').checked ? S.deleteLocalMonths(keys) : 0;

      dm.dlg.close();
      MESES_STATE.selected.clear();
      toast(`Se borraron ${countText(res.borrados, 'cliente', 'clientes')} de la hoja${$('dm-local').checked ? ` y ${countText(local, 'cliente', 'clientes')} de este dispositivo` : ''}`);
      await loadMonths();
    } catch (err) {
      error.textContent = err.message;
    }
  }));

  dm.dlg.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => dm.dlg.close()));

  function initSheets() {
    const c = S.getCfg();
    $('sh-url').value = c.url;
    $('sh-token').value = c.token;
    $('sh-auto').checked = c.auto;
    setStatus('none', c.url && c.token ? 'Sin probar' : 'Sin conectar');
    renderLast();
    updateMonthsUI();
  }

  /* ==========================================================
     Inicio
     ========================================================== */
  document.querySelectorAll('dialog.modal').forEach((dlg) => {
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  });

  buildPresets();
  buildDaysPills();
  renderTheme();

  daysInput.value = cfg.diasPorVencer;
  renderDays();

  $('g-moneda').value = cfg.moneda;
  $('g-pais').value = cfg.codigoPais;

  fillMessages(cfg.mensajes);
  initSheets();
})();