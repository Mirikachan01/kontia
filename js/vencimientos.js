/* ==========================================================
   Panel de clientes · página Vencimientos (vencimientos.html)
   Lee los clientes guardados por clientes.html en localStorage
   (clave "dashboard.clientes.v1"). Esta página solo muestra datos.
   Estados: vencido (ya venció), por vencer (7 días o menos), activo.
   ========================================================== */
(() => {
  'use strict';

  const STORAGE_KEY = 'dashboard.clientes.v1';
  const daysSoon = () => window.AppConfig.get().diasPorVencer; // "por vencer": se configura en Ajustes
  const DAY_MS = 86400000;
  const ESTADOS = { activo: 'Activo', porvencer: 'Por vencer', vencido: 'Vencido' };

  /* ---------- Utilidades ---------- */
  const $ = (id) => document.getElementById(id);
  const plural = (n, one, many) => (n === 1 ? one : many);
  const norm = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const digits = (s) => String(s).replace(/\D/g, '');
  const fullDate = new Intl.DateTimeFormat('es-BO', { day: 'numeric', month: 'short', year: 'numeric' });

  const startOfDay = (d) => { const r = new Date(d); r.setHours(0, 0, 0, 0); return r; };
  const parseISO = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const daysBetween = (a, b) => Math.round((startOfDay(a) - startOfDay(b)) / DAY_MS);

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
        if (d && Array.isArray(d.clientes)) return d.clientes.filter((c) => c && c.inicio && c.vence);
      }
    } catch (e) { /* datos dañados: lista vacía */ }
    return [];
  }

  let clientes = load();
  const state = { filtro: 'todos', q: '' };

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

  /* ---------- WhatsApp ---------- */
  function waLink(c, estado, dias) {
    const text = window.AppConfig.mensaje(estado, { nombre: c.nombre, fecha: fullDate.format(parseISO(c.vence)), dias });
    return `https://wa.me/${window.AppConfig.waNumber(c.whatsapp)}?text=${encodeURIComponent(text)}`;
  }

  /* ---------- Render ---------- */
  function matches(item) {
    if (state.filtro !== 'todos' && item.estado !== state.filtro) return false;
    const q = norm(state.q);
    if (!q) return true;
    const qDigits = digits(state.q);
    return norm(item.c.nombre).includes(q) || (qDigits.length > 0 && digits(item.c.whatsapp).includes(qDigits));
  }

  const cell = (cls, label, content) => {
    const td = el('td', cls);
    if (label) td.dataset.label = label;
    if (content instanceof Node) td.appendChild(content);
    else if (content != null) td.textContent = content;
    return td;
  };

  function renderRow({ c, dias, estado }) {
    const tr = el('tr', `is-${estado}`);

    const estadoBox = el('div', 'estado-cell');
    estadoBox.append(el('span', `badge is-${estado}`, ESTADOS[estado]), el('span', 'estado-days', vencText(dias)));

    const contact = el('a', 'btn-contact');
    contact.href = waLink(c, estado, dias);
    contact.target = '_blank';
    contact.rel = 'noopener noreferrer';
    contact.setAttribute('aria-label', `Contactar a ${c.nombre} por WhatsApp`);
    contact.append(icon('chat'), 'Contactar');

    tr.append(
      cell('col-id', 'ID', `#${c.id}`),
      cell('col-nombre', 'Nombre', c.nombre),
      cell('col-numero', 'Número', c.whatsapp),
      cell('col-fecha', 'Fecha de inicio', fullDate.format(parseISO(c.inicio))),
      cell('col-fecha', 'Fecha de fin', fullDate.format(parseISO(c.vence))),
      cell('col-estado', 'Estado', estadoBox),
      cell('col-accion', null, contact),
    );
    return tr;
  }

  function render() {
    const today = startOfDay(new Date());
    const items = clientes.map((c) => info(c, today));

    // Chips de filtro
    const counts = { activo: 0, porvencer: 0, vencido: 0 };
    items.forEach((i) => { counts[i.estado] += 1; });
    ['activo', 'porvencer', 'vencido'].forEach((k) => { $(`cnt-${k}`).textContent = counts[k]; });
    $('cnt-todos').textContent = items.length;
    document.querySelectorAll('.filter').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filtro === state.filtro)));

    // Filas: primero los que vencen antes (vencidos y por vencer arriba)
    const visibles = items
      .filter(matches)
      .sort((a, b) => a.dias - b.dias || a.c.id - b.c.id);

    const filtering = state.filtro !== 'todos' || norm(state.q) !== '';
    $('count-clientes').textContent = filtering
      ? `${visibles.length} de ${items.length}`
      : `${items.length} ${plural(items.length, 'cliente', 'clientes')}`;

    const tbody = $('tabla-vencimientos');
    tbody.replaceChildren(...visibles.map(renderRow));

    const empty = $('vacio');
    empty.replaceChildren();
    if (items.length === 0) {
      empty.append('Aún no hay clientes. Añade el primero en la página ');
      const a = el('a', 'link', 'Clientes');
      a.href = 'clientes.html';
      empty.append(a, '.');
    } else if (visibles.length === 0) {
      empty.textContent = 'Ningún cliente coincide con la búsqueda o el filtro.';
    }
    empty.hidden = visibles.length > 0;
    document.querySelector('.table-wrap').hidden = visibles.length === 0;
  }

  /* ---------- Eventos ---------- */
  $('buscar').addEventListener('input', (e) => { state.q = e.target.value; render(); });

  document.querySelectorAll('.filter').forEach((b) => {
    b.addEventListener('click', () => { state.filtro = b.dataset.filtro; render(); });
  });

  // Si los clientes cambian desde otra pestaña
  window.addEventListener('storage', (e) => { if (e.key === STORAGE_KEY) { clientes = load(); render(); } });

  // Al volver a la pestaña se recalculan los estados y los datos
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { clientes = load(); render(); } });

  render();
})();