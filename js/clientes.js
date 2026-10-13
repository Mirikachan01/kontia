/* ==========================================================
   Panel de clientes · página Clientes (clientes.html)
   Datos en localStorage, clave "dashboard.clientes.v1":
   {
     nextId: 1,
     clientes: [{
       id, nombre, usuario, password, whatsapp,
       dispositivos, meses, compra, venta,
       inicio: 'AAAA-MM-DD', vence: 'AAAA-MM-DD'
     }]
   }
   Estados: vencido (ya venció), por vencer (7 días o menos), activo.
   ========================================================== */
(() => {
  'use strict';

  const STORAGE_KEY = 'dashboard.clientes.v1';
  const daysSoon = () => window.AppConfig.get().diasPorVencer; // "por vencer": se configura en Ajustes
  const DAY_MS = 86400000;
  const DOT_COLORS = ['#7c5cff', '#ff7a45', '#22d391', '#ffb020', '#4cc3ff', '#ff5d9e'];
  const ESTADOS = { activo: 'Activo', porvencer: 'Por vencer', vencido: 'Vencido' };

  /* ---------- Utilidades ---------- */
  const $ = (id) => document.getElementById(id);
  const plural = (n, one, many) => (n === 1 ? one : many);
  const norm = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const digits = (s) => String(s).replace(/\D/g, '');
  const initials = (name) => name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
  const colorFor = (text) => {
    let h = 0;
    for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return DOT_COLORS[h % DOT_COLORS.length];
  };

  const money = (n) => window.AppConfig.money(n); // símbolo de moneda configurable
  const fullDate = new Intl.DateTimeFormat('es-BO', { day: 'numeric', month: 'short', year: 'numeric' });

  const startOfDay = (d) => { const r = new Date(d); r.setHours(0, 0, 0, 0); return r; };
  const toISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const parseISO = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const daysBetween = (a, b) => Math.round((startOfDay(a) - startOfDay(b)) / DAY_MS);

  // Suma meses sin desbordar (31 ene + 1 mes = 28/29 feb)
  function addMonths(date, n) {
    const r = new Date(date.getFullYear(), date.getMonth() + n, 1);
    const last = new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate();
    r.setDate(Math.min(date.getDate(), last));
    return r;
  }

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };
  const icon = (id) => {
    const s = document.createElementNS(SVG_NS, 'svg');
    s.setAttribute('class', 'icon');
    s.setAttribute('aria-hidden', 'true');
    const u = document.createElementNS(SVG_NS, 'use');
    u.setAttribute('href', `#i-${id}`);
    s.appendChild(u);
    return s;
  };

  /* ---------- Datos ---------- */
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d && Array.isArray(d.clientes)) {
          const maxId = d.clientes.reduce((m, c) => Math.max(m, c.id || 0), 0);
          d.nextId = Math.max(d.nextId || 1, maxId + 1);
          return d;
        }
      }
    } catch (e) { /* datos dañados: se empieza de cero */ }
    return { nextId: 1, clientes: [] };
  }

  let data = load();
  const state = { filtro: 'todos', q: '' };
  let editingId = null;

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      toast('No se pudo guardar en este navegador', true);
      return false;
    }
  }

  /* ---------- Estado de cada cliente ---------- */
  function info(c, today) {
    const dias = daysBetween(parseISO(c.vence), today);
    const estado = dias < 0 ? 'vencido' : dias <= daysSoon() ? 'porvencer' : 'activo';
    return { c, dias, estado };
  }

  const vencText = (dias) => (
    dias < 0 ? `Venció hace ${-dias} ${plural(-dias, 'día', 'días')}`
      : dias === 0 ? 'Vence hoy'
      : dias === 1 ? 'Vence mañana'
      : `Vence en ${dias} días`
  );

  /* ---------- Avisos y confirmación ---------- */
  function toast(message, isError = false) {
    const t = el('div', 'toast' + (isError ? ' is-error' : ''), message);
    $('toasts').appendChild(t);
    setTimeout(() => t.remove(), 2800);
  }

  function confirmAction({ title, message, okText = 'Eliminar' }) {
    return new Promise((resolve) => {
      const dlg = $('dlg-confirm');
      $('confirm-title').textContent = title;
      $('confirm-msg').replaceChildren(...message);
      $('confirm-ok').textContent = okText;
      dlg.returnValue = '';
      dlg.addEventListener('close', () => resolve(dlg.returnValue === 'ok'), { once: true });
      dlg.showModal();
    });
  }

  async function copyText(text, label) {
    let ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch (e) {
      // Respaldo para cuando el portapapeles moderno no está disponible
      const ta = el('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
      document.body.appendChild(ta);
      ta.select();
      try { ok = document.execCommand('copy'); } catch (_) { ok = false; }
      ta.remove();
    }
    toast(ok ? `${label} copiado` : 'No se pudo copiar', !ok);
  }

  /* ---------- WhatsApp ---------- */
  function waLink(c, estado, dias) {
    const text = window.AppConfig.mensaje(estado, { nombre: c.nombre, fecha: fullDate.format(parseISO(c.vence)), dias });
    return `https://wa.me/${window.AppConfig.waNumber(c.whatsapp)}?text=${encodeURIComponent(text)}`;
  }

  /* ---------- Cuentas (creadas en la página Cuentas) ---------- */
  function readCuentas() {
    try {
      const d = JSON.parse(localStorage.getItem('dashboard.cuentas.v1')) || {};
      return {
        categorias: Array.isArray(d.categorias) ? d.categorias : [],
        cuentas: Array.isArray(d.cuentas) ? d.cuentas : [],
      };
    } catch (e) {
      return { categorias: [], cuentas: [] };
    }
  }

  // id de cuenta -> { nombre, cat }, para mostrar las cuentas de cada cliente
  let acctIndex = new Map();
  function buildAcctIndex() {
    const { categorias, cuentas } = readCuentas();
    const cat = new Map(categorias.map((c) => [c.id, c.nombre]));
    acctIndex = new Map(cuentas.map((c) => [c.id, { nombre: c.nombre, cat: cat.get(c.categoriaId) || 'Sin categoría' }]));
  }

  function updatePickHint() {
    const n = document.querySelectorAll('#f-cuentas input:checked').length;
    $('f-cuentas-hint').textContent = n ? `${n} ${plural(n, 'cuenta seleccionada', 'cuentas seleccionadas')}` : '';
  }

  function renderCuentasPicker(selected) {
    const box = $('f-cuentas');
    box.replaceChildren();
    const { categorias, cuentas } = readCuentas();

    if (cuentas.length === 0) {
      const empty = el('p', 'pick-empty', 'Aún no hay cuentas. Créalas en la página ');
      const a = el('a', 'link', 'Cuentas');
      a.href = 'cuentas.html';
      empty.append(a, '.');
      box.appendChild(empty);
      updatePickHint();
      return;
    }

    const chosen = new Set(selected);
    const groups = categorias.map((c) => ({ nombre: c.nombre, items: cuentas.filter((x) => x.categoriaId === c.id) }));
    const known = new Set(categorias.map((c) => c.id));
    groups.push({ nombre: 'Sin categoría', items: cuentas.filter((x) => !known.has(x.categoriaId)) });

    if (cuentas.length > 8) {
      const search = el('input', 'pick-search');
      search.type = 'search';
      search.placeholder = 'Buscar cuenta';
      search.setAttribute('aria-label', 'Buscar cuenta');
      search.addEventListener('input', () => {
        const q = norm(search.value);
        box.querySelectorAll('.pick-item').forEach((row) => { row.hidden = q !== '' && !norm(row.dataset.name).includes(q); });
        box.querySelectorAll('.pick-group').forEach((g) => { g.hidden = ![...g.querySelectorAll('.pick-item')].some((r) => !r.hidden); });
      });
      box.appendChild(search);
    }

    groups.filter((g) => g.items.length).forEach((g) => {
      const wrap = el('div', 'pick-group');
      wrap.appendChild(el('p', 'pick-cat', g.nombre));
      g.items.forEach((x) => {
        const row = el('label', 'pick-item');
        row.dataset.name = x.nombre;
        const input = el('input');
        input.type = 'checkbox';
        input.value = x.id;
        input.checked = chosen.has(x.id);
        input.addEventListener('change', updatePickHint);
        row.append(input, el('span', null, x.nombre));
        wrap.appendChild(row);
      });
      box.appendChild(wrap);
    });
    updatePickHint();
  }

  /* ---------- Render ---------- */
  function matches(item) {
    if (state.filtro !== 'todos' && item.estado !== state.filtro) return false;
    const q = norm(state.q);
    if (!q) return true;
    const qDigits = digits(state.q);
    return norm(item.c.nombre).includes(q) || (qDigits.length > 0 && digits(item.c.whatsapp).includes(qDigits));
  }

  function actionButton(iconName, label, onClick) {
    const b = el('button', 'icon-btn' + (iconName === 'trash' ? ' is-danger' : ''));
    b.type = 'button';
    b.title = label;
    b.setAttribute('aria-label', label);
    b.appendChild(icon(iconName));
    b.addEventListener('click', onClick);
    return b;
  }

  function renderClient(item) {
    const { c, dias, estado } = item;
    const li = el('li', `client is-${estado}`);

    const dot = el('span', 'dot', initials(c.nombre));
    dot.style.setProperty('--dot', colorFor(c.nombre));

    const main = el('div');
    const name = el('p', 'client-name');
    name.append(el('span', 'name-text', c.nombre), el('span', `badge is-${estado}`, ESTADOS[estado]));
    const meta = el('p', 'client-meta');
    meta.append(
      el('span', 'cid', `#${c.id}`),
      el('span', null, `Usuario: ${c.usuario}`),
      el('span', null, `${c.dispositivos} ${plural(c.dispositivos, 'dispositivo', 'dispositivos')}`),
      el('span', null, `WhatsApp: ${c.whatsapp}`),
    );
    main.append(name, meta);

    const asignadas = (Array.isArray(c.cuentaIds) ? c.cuentaIds : []).map((id) => acctIndex.get(id)).filter(Boolean);
    if (asignadas.length) {
      const chips = el('div', 'client-accounts');
      asignadas.slice(0, 3).forEach((a) => {
        const chip = el('span', 'acct-chip', a.nombre);
        chip.title = a.cat;
        chips.appendChild(chip);
      });
      if (asignadas.length > 3) chips.appendChild(el('span', 'acct-chip is-more', `+${asignadas.length - 3}`));
      main.appendChild(chips);
    }

    const ganancia = c.venta - c.compra;
    const side = el('div', 'client-side');
    const venc = el('div');
    venc.append(el('p', 'client-venc', vencText(dias)), el('p', 'client-date', fullDate.format(parseISO(c.vence))));
    const price = el('div');
    price.append(
      el('p', 'client-price', money(c.venta)),
      el('p', 'client-profit' + (ganancia < 0 ? ' is-neg' : ''), `Ganancia ${money(ganancia)}`),
    );
    side.append(venc, price);

    const actions = el('div', 'client-actions');
    const contact = el('a', 'icon-btn');
    contact.href = waLink(c, estado, dias);
    contact.target = '_blank';
    contact.rel = 'noopener noreferrer';
    contact.title = 'Contactar por WhatsApp';
    contact.setAttribute('aria-label', `Contactar a ${c.nombre} por WhatsApp`);
    contact.appendChild(icon('chat'));

    actions.append(
      actionButton('user', 'Copiar usuario', () => copyText(c.usuario, 'Usuario')),
      actionButton('lock', 'Copiar contraseña', () => copyText(c.password, 'Contraseña')),
      contact,
      actionButton('pencil', 'Editar cliente', () => openForm(c.id)),
      actionButton('trash', 'Borrar cliente', () => deleteClient(c.id)),
    );

    li.append(dot, main, side, actions);
    return li;
  }

  function render() {
    buildAcctIndex();
    const today = startOfDay(new Date());
    const items = data.clientes.map((c) => info(c, today));

    // Contadores y chips de filtro
    const counts = { activo: 0, porvencer: 0, vencido: 0 };
    items.forEach((i) => { counts[i.estado] += 1; });
    ['activo', 'porvencer', 'vencido'].forEach((k) => {
      $(`n-${k}`).textContent = counts[k];
      $(`cnt-${k}`).textContent = counts[k];
    });
    $('cnt-todos').textContent = items.length;
    const n = daysSoon();
    $('sub-activo').textContent = `Con más de ${n} ${plural(n, 'día', 'días')} de servicio`;
    $('sub-porvencer').textContent = `Vencen en ${n} ${plural(n, 'día', 'días')} o menos`;

    document.querySelectorAll('.filter').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filtro === state.filtro)));
    document.querySelectorAll('.stat').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.estado === state.filtro)));

    // Lista
    const visibles = items
      .filter(matches)
      .sort((a, b) => a.dias - b.dias || a.c.id - b.c.id); // los más urgentes primero

    const filtering = state.filtro !== 'todos' || norm(state.q) !== '';
    $('count-clientes').textContent = filtering
      ? `${visibles.length} de ${items.length}`
      : `${items.length} ${plural(items.length, 'cliente', 'clientes')}`;

    const ul = $('lista-clientes');
    ul.replaceChildren();

    if (items.length === 0) {
      ul.appendChild(el('li', 'empty', 'Aún no tienes clientes. Pulsa «Añadir cliente» para registrar el primero.'));
      return;
    }
    if (visibles.length === 0) {
      ul.appendChild(el('li', 'empty', 'Ningún cliente coincide con la búsqueda o el filtro.'));
      return;
    }
    visibles.forEach((item) => ul.appendChild(renderClient(item)));
  }

  /* ---------- Eliminar ---------- */
  async function deleteClient(id) {
    const c = data.clientes.find((x) => x.id === id);
    if (!c) return;
    const ok = await confirmAction({
      title: '¿Borrar cliente?',
      message: [
        document.createTextNode('Se borrará a '),
        el('strong', null, `«${c.nombre}»`),
        document.createTextNode(' y todos sus datos. Esta acción no se puede deshacer.'),
      ],
      okText: 'Borrar',
    });
    if (!ok) return;
    data.clientes = data.clientes.filter((x) => x.id !== id);
    if (save()) toast('Cliente borrado');
    render();
  }

  /* ---------- Formulario: añadir / editar ---------- */
  const F = {
    id: $('f-id'), nombre: $('f-nombre'), usuario: $('f-usuario'), password: $('f-password'),
    whatsapp: $('f-whatsapp'), inicio: $('f-inicio'), dispositivos: $('f-dispositivos'), duracion: $('f-duracion'),
    compra: $('f-compra'), venta: $('f-venta'),
  };

  const num = (input) => parseFloat(String(input.value).replace(',', '.'));

  function updateHints() {
    // Fecha de vencimiento según la duración elegida
    const meses = Number(F.duracion.value);
    const valid = /^\d{4}-\d{2}-\d{2}$/.test(F.inicio.value);
    const base = valid ? parseISO(F.inicio.value) : startOfDay(new Date());
    $('f-vence-hint').replaceChildren(
      document.createTextNode('Fecha de fin: '),
      el('strong', null, fullDate.format(addMonths(base, meses))),
    );

    // Ganancia
    const compra = num(F.compra);
    const venta = num(F.venta);
    const box = $('f-ganancia');
    box.replaceChildren();
    if (!Number.isNaN(compra) && !Number.isNaN(venta)) {
      const g = venta - compra;
      const strong = el('strong', g < 0 ? 'is-neg' : null, money(g));
      box.append(document.createTextNode('Ganancia por cliente: '), strong);
    }
  }

  function setPasswordVisible(visible) {
    F.password.type = visible ? 'text' : 'password';
    const btn = $('toggle-pass');
    btn.setAttribute('aria-pressed', String(visible));
    btn.setAttribute('aria-label', visible ? 'Ocultar contraseña' : 'Mostrar contraseña');
    btn.querySelector('use').setAttribute('href', visible ? '#i-eye-off' : '#i-eye');
  }

  function openForm(id = null) {
    editingId = id;
    const c = id != null ? data.clientes.find((x) => x.id === id) : null;

    $('form-client').reset();
    $('client-error').textContent = '';
    setPasswordVisible(false);

    $('dlg-client-title').textContent = c ? 'Editar cliente' : 'Añadir cliente';
    $('client-submit').textContent = c ? 'Guardar cambios' : 'Guardar cliente';
    F.id.value = c ? `#${c.id}` : `#${data.nextId} (automático)`;

    if (c) {
      F.nombre.value = c.nombre;
      F.usuario.value = c.usuario;
      F.password.value = c.password;
      F.whatsapp.value = c.whatsapp;
      F.dispositivos.value = String(c.dispositivos);
      F.duracion.value = String(c.meses);
      F.compra.value = c.compra;
      F.venta.value = c.venta;
    }

    F.inicio.value = c ? c.inicio : toISO(startOfDay(new Date())); // por defecto: hoy
    renderCuentasPicker(c && Array.isArray(c.cuentaIds) ? c.cuentaIds : []);
    updateHints();
    $('dlg-client').showModal();
    F.nombre.focus();
  }

  $('form-client').addEventListener('submit', (e) => {
    e.preventDefault();
    const error = $('client-error');
    const fail = (msg, field) => { error.textContent = msg; field.focus(); };

    const nombre = F.nombre.value.trim();
    const usuario = F.usuario.value.trim();
    const password = F.password.value;
    const whatsapp = F.whatsapp.value.trim();
    const compra = num(F.compra);
    const venta = num(F.venta);
    const inicio = F.inicio.value;
    const cuentaIds = [...document.querySelectorAll('#f-cuentas input:checked')].map((i) => i.value);

    if (!nombre) return fail('Escribe el nombre del cliente.', F.nombre);
    if (!usuario) return fail('Escribe el usuario.', F.usuario);
    if (!password) return fail('Escribe la contraseña.', F.password);
    if (digits(whatsapp).length < 8) return fail('Escribe un número de WhatsApp válido (mínimo 8 dígitos).', F.whatsapp);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(inicio) || Number.isNaN(parseISO(inicio).getTime())) return fail('Elige la fecha de inicio.', F.inicio);
    if (Number.isNaN(compra) || compra < 0) return fail('Escribe el precio de compra.', F.compra);
    if (Number.isNaN(venta) || venta < 0) return fail('Escribe el precio de venta.', F.venta);

    const dispositivos = Number(F.dispositivos.value);
    const meses = Number(F.duracion.value);

    if (editingId != null) {
      const c = data.clientes.find((x) => x.id === editingId);
      if (!c) return;
      Object.assign(c, { nombre, usuario, password, whatsapp, dispositivos, meses, compra, venta, inicio, cuentaIds });
      c.vence = toISO(addMonths(parseISO(inicio), meses)); // fecha de fin = inicio + duración
      if (!save()) return;
      toast('Cambios guardados');
    } else {
      data.clientes.push({
        id: data.nextId,
        nombre, usuario, password, whatsapp, dispositivos, meses, compra, venta, cuentaIds,
        inicio,
        vence: toISO(addMonths(parseISO(inicio), meses)),
      });
      data.nextId += 1;
      if (!save()) return;
      toast('Cliente añadido');
    }

    $('dlg-client').close();
    render();
  });

  /* ---------- Eventos ---------- */
  $('btn-add-client').addEventListener('click', () => openForm());
  $('toggle-pass').addEventListener('click', () => setPasswordVisible(F.password.type === 'password'));
  [F.inicio, F.duracion, F.compra, F.venta].forEach((i) => i.addEventListener('input', updateHints));

  $('buscar').addEventListener('input', (e) => { state.q = e.target.value; render(); });

  document.querySelectorAll('.filter').forEach((b) => {
    b.addEventListener('click', () => { state.filtro = b.dataset.filtro; render(); });
  });

  // Las tarjetas de contadores también filtran (otro clic quita el filtro)
  document.querySelectorAll('.stat').forEach((b) => {
    b.addEventListener('click', () => {
      state.filtro = state.filtro === b.dataset.estado ? 'todos' : b.dataset.estado;
      render();
    });
  });

  document.querySelectorAll('[data-close]').forEach((btn) => {
    btn.addEventListener('click', () => btn.closest('dialog').close());
  });
  document.querySelectorAll('dialog.modal').forEach((dlg) => {
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  });

  // Si los datos cambian desde otra pestaña
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) { data = load(); render(); }
    if (e.key === 'dashboard.cuentas.v1') render();
  });

  // Al volver a la pestaña, se recalculan los estados (por si cambió el día)
  document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });

  render();
  if (location.hash === '#nuevo') {
    history.replaceState(null, '', location.pathname + location.search);
    openForm();
  }
})();