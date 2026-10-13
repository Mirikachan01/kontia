/* ==========================================================
   Panel de clientes · Dashboard (index.html)
   Todo sale de los datos reales que guardan las demás páginas:
     - dashboard.clientes.v1  (Clientes)
     - dashboard.cuentas.v1   (Cuentas y categorías)
   Y de los ajustes (js/config.js): días de "por vencer", moneda y mensajes.

   Cómo se interpretan los datos:
     - Cada cliente cuenta como una venta, en la fecha de inicio, por su precio de venta.
     - Ganancia = precio de venta - precio de compra.
     - "Producto más vendido" = categoría de las cuentas asignadas a los clientes.
   ========================================================== */
(() => {
  'use strict';

  const CLIENTES_KEY = 'dashboard.clientes.v1';
  const CUENTAS_KEY = 'dashboard.cuentas.v1';
  const LEGACY_DEMO_KEY = 'dashboard.v1'; // datos de ejemplo de versiones anteriores
  const ALERT_DAYS_BACK = 30;             // mostrar vencidos de los últimos 30 días
  const DAY_MS = 86400000;
  const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
  const DOT_COLORS = ['#7c5cff', '#ff7a45', '#22d391', '#ffb020', '#4cc3ff', '#ff5d9e'];

  /* ---------- Utilidades de fecha y formato ---------- */
  const startOfDay = (d) => { const r = new Date(d); r.setHours(0, 0, 0, 0); return r; };
  const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
  const parseISO = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const daysBetween = (a, b) => Math.round((startOfDay(a) - startOfDay(b)) / DAY_MS);
  const plural = (n, one, many) => (n === 1 ? one : many);
  const money = (n) => window.AppConfig.money(n);
  const initials = (name) => name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
  const colorFor = (text) => {
    let h = 0;
    for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return DOT_COLORS[h % DOT_COLORS.length];
  };
  const daysSoon = () => window.AppConfig.get().diasPorVencer; // se configura en Ajustes

  /* ---------- Creación de nodos (seguro: usa textContent) ---------- */
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
  const $ = (id) => document.getElementById(id);

  // Mensaje vacío con un enlace al final
  function emptyWithLink(before, linkText, href) {
    const li = el('li', 'empty');
    const a = el('a', 'link', linkText);
    a.href = href;
    li.append(before, a, '.');
    return li;
  }

  /* ---------- Datos ---------- */
  const readJSON = (key) => {
    try { return JSON.parse(localStorage.getItem(key)) || {}; } catch (e) { return {}; }
  };
  const list = (v) => (Array.isArray(v) ? v : []);

  function load() {
    const c = readJSON(CLIENTES_KEY);
    const q = readJSON(CUENTAS_KEY);
    const clientes = list(c.clientes).filter((x) => x && ISO_DATE.test(String(x.inicio)) && ISO_DATE.test(String(x.vence)));

    const catName = new Map(list(q.categorias).map((x) => [x.id, x.nombre]));
    const cuentas = new Map(list(q.cuentas).map((x) => [x.id, { nombre: x.nombre, cat: catName.get(x.categoriaId) || 'Sin categoría' }]));

    return {
      cuentas,
      clientes: clientes.map((x) => ({
        ...x,
        _cuentas: list(x.cuentaIds).map((id) => cuentas.get(id)).filter(Boolean),
      })),
    };
  }

  /* ---------- Cálculos ---------- */
  const inRange = (c, from, to) => { const f = parseISO(c.inicio); return f >= from && f < to; };

  function statsFor(clientes, from, to) {
    const list_ = clientes.filter((c) => inRange(c, from, to));
    const ingresos = list_.reduce((s, c) => s + (Number(c.venta) || 0), 0);
    const costos = list_.reduce((s, c) => s + (Number(c.compra) || 0), 0);
    return { list: list_, count: list_.length, ingresos, costos, ganancia: ingresos - costos };
  }

  function getRanges(today) {
    const tomorrow = addDays(today, 1);
    const weekStart = addDays(today, -((today.getDay() + 6) % 7)); // lunes
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    return {
      hoy: [today, tomorrow],
      semana: [weekStart, tomorrow],
      mes: [monthStart, tomorrow],
      mesAnterior: [
        new Date(today.getFullYear(), today.getMonth() - 1, 1),
        new Date(today.getFullYear(), today.getMonth() - 1, 1 + today.getDate()),
      ],
    };
  }

  const cuentasText = (c) => {
    if (c._cuentas.length === 0) return 'Sin cuenta asignada';
    const names = c._cuentas.slice(0, 2).map((x) => x.nombre).join(', ');
    return c._cuentas.length > 2 ? `${names} y ${c._cuentas.length - 2} más` : names;
  };

  /* ---------- Render ---------- */
  function renderHeader(today) {
    $('fecha-hoy').textContent = new Intl.DateTimeFormat('es-BO', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    }).format(today);
  }

  function renderHero(data, r) {
    const mes = statsFor(data.clientes, ...r.mes);
    const prev = statsFor(data.clientes, ...r.mesAnterior);

    $('hero-ganancia').textContent = money(mes.ganancia);
    $('hero-ingresos').textContent = money(mes.ingresos);
    $('hero-costos').textContent = money(mes.costos);
    $('hero-margen').textContent = mes.ingresos > 0 ? `${Math.round((mes.ganancia / mes.ingresos) * 100)} %` : '–';

    const delta = $('hero-delta');
    delta.className = 'delta';
    delta.replaceChildren();
    if (prev.ganancia > 0) {
      const pct = Math.round(((mes.ganancia - prev.ganancia) / prev.ganancia) * 100);
      if (pct > 0) { delta.append(icon('up'), `+${pct} % frente al mes anterior`); }
      else if (pct < 0) { delta.classList.add('is-down'); delta.append(icon('down'), `${pct} % frente al mes anterior`); }
      else { delta.classList.add('is-flat'); delta.append('Igual que el mes anterior'); }
    } else if (mes.ganancia > 0) {
      delta.append(icon('up'), 'Primer mes con ganancias');
    }
  }

  function renderBars(data, today) {
    const box = $('bars');
    box.replaceChildren();
    const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
    const values = days.map((d) => statsFor(data.clientes, d, addDays(d, 1)).ganancia);
    const max = Math.max(...values, 1);
    const fmt = new Intl.DateTimeFormat('es-BO', { weekday: 'short' });

    days.forEach((d, i) => {
      const bar = el('div', 'bar' + (i === 6 ? ' is-today' : ''));
      bar.title = `${fmt.format(d)}: ${money(values[i])}`;
      const track = el('div', 'bar-track');
      const fill = el('div', 'bar-fill');
      fill.style.height = `${Math.max((Math.max(values[i], 0) / max) * 100, 3)}%`;
      track.appendChild(fill);
      bar.append(track, el('span', 'bar-day', fmt.format(d).replace('.', '')));
      box.appendChild(bar);
    });
    box.setAttribute('aria-label',
      'Ganancia diaria de los últimos 7 días: ' + days.map((d, i) => `${fmt.format(d)} ${money(values[i])}`).join(', '));
  }

  function renderPeriods(data, r) {
    [['hoy', r.hoy], ['semana', r.semana], ['mes', r.mes]].forEach(([key, range]) => {
      const s = statsFor(data.clientes, ...range);
      $(`p-${key}-count`).textContent = s.count;
      $(`p-${key}-ingresos`).textContent = money(s.ingresos);
      $(`p-${key}-ganancia`).textContent = money(s.ganancia);
    });
  }

  function renderClients(data, today, r) {
    const activos = data.clientes.filter((c) => parseISO(c.vence) >= today).length;
    const nuevos = statsFor(data.clientes, ...r.mes).count;

    $('k-total').textContent = data.clientes.length;
    $('k-activos').textContent = activos;
    $('k-nuevos').textContent = nuevos;
    const inactivos = data.clientes.length - activos;
    $('k-activos-sub').textContent = data.clientes.length === 0
      ? ''
      : inactivos > 0
        ? `${inactivos} ${plural(inactivos, 'cliente sin', 'clientes sin')} servicio vigente`
        : 'Todos tienen servicio vigente';
  }

  function renderTopProduct(data, r) {
    // Cada cuenta asignada a un cliente cuenta como una venta de su categoría
    const tally = (clientes) => {
      const map = new Map();
      clientes.forEach((c) => c._cuentas.forEach((a) => map.set(a.cat, (map.get(a.cat) || 0) + 1)));
      return [...map.entries()].map(([nombre, count]) => ({ nombre, count })).sort((a, b) => b.count - a.count);
    };

    let ranking = tally(statsFor(data.clientes, ...r.mes).list);
    let periodo = 'Este mes';
    if (ranking.length === 0) { ranking = tally(data.clientes); periodo = 'Histórico'; }
    ranking = ranking.slice(0, 5);
    $('top-periodo').textContent = periodo;

    const listEl = $('ranking');
    listEl.replaceChildren();

    if (ranking.length === 0) {
      $('top-name').textContent = 'Sin datos todavía';
      $('top-sub').textContent = 'Asigna cuentas a tus clientes para ver cuál categoría se vende más.';
      return;
    }

    const top = ranking[0];
    $('top-name').textContent = top.nombre;
    $('top-sub').textContent = `${top.count} ${plural(top.count, 'venta', 'ventas')}`;

    ranking.forEach((p) => {
      const row = el('li', 'rank-row');
      row.append(el('span', null, p.nombre), el('span', 'rank-count', `${p.count} ${plural(p.count, 'venta', 'ventas')}`));
      const meter = el('div', 'rank-meter');
      const fill = el('span');
      fill.style.width = `${(p.count / top.count) * 100}%`;
      fill.style.setProperty('--dot', colorFor(p.nombre));
      meter.appendChild(fill);
      row.appendChild(meter);
      listEl.appendChild(row);
    });
  }

  function renderAlerts(data, today) {
    const alerts = data.clientes
      .map((c) => ({ c, dias: daysBetween(parseISO(c.vence), today) }))
      .filter((x) => x.dias <= daysSoon() && x.dias >= -ALERT_DAYS_BACK)
      .sort((a, b) => a.dias - b.dias || a.c.id - b.c.id);

    const listEl = $('alertas');
    const badge = $('alert-count');
    listEl.replaceChildren();

    badge.classList.toggle('is-clear', alerts.length === 0);
    badge.textContent = alerts.length === 0 ? 'Todo al día' : `${alerts.length} ${plural(alerts.length, 'pendiente', 'pendientes')}`;

    if (alerts.length === 0) {
      listEl.appendChild(el('li', 'empty', data.clientes.length === 0
        ? 'Cuando tengas clientes, aquí verás los que están por vencer o vencidos.'
        : `No hay servicios por vencer en los próximos ${daysSoon()} días.`));
      return;
    }

    alerts.slice(0, 8).forEach(({ c, dias }) => {
      const level = dias < 0 ? 'is-late' : dias <= 2 ? 'is-urgent' : 'is-soon';
      const text = dias < 0 ? `Venció hace ${-dias} ${plural(-dias, 'día', 'días')}`
        : dias === 0 ? 'Vence hoy'
        : dias === 1 ? 'Vence mañana'
        : `Vence en ${dias} días`;

      const li = el('li', `item ${level}`);
      const dot = el('span', 'dot', initials(c.nombre));
      dot.style.setProperty('--dot', colorFor(c.nombre));

      const info = el('div');
      info.append(el('p', 'item-title', c.nombre), el('p', 'item-sub', cuentasText(c)));

      const end = el('div', 'item-end');
      end.appendChild(el('p', 'status', text));

      if (c.whatsapp) {
        const mensaje = window.AppConfig.mensaje(dias < 0 ? 'vencido' : 'porvencer', {
          nombre: c.nombre,
          fecha: new Intl.DateTimeFormat('es-BO', { day: 'numeric', month: 'short', year: 'numeric' }).format(parseISO(c.vence)),
          dias,
        });
        const a = el('a', 'notify');
        a.href = `https://wa.me/${window.AppConfig.waNumber(c.whatsapp)}?text=${encodeURIComponent(mensaje)}`;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.append(icon('send'), 'Avisar');
        end.appendChild(a);
      }

      li.append(dot, info, end);
      listEl.appendChild(li);
    });
  }

  function renderRecent(data, today) {
    const listEl = $('recientes');
    listEl.replaceChildren();

    const recent = [...data.clientes]
      .sort((a, b) => b.inicio.localeCompare(a.inicio) || b.id - a.id)
      .slice(0, 5);

    if (recent.length === 0) {
      listEl.appendChild(emptyWithLink('Aún no hay ventas. ', 'Añade tu primer cliente', 'clientes.html#nuevo'));
      return;
    }

    const shortDate = new Intl.DateTimeFormat('es-BO', { day: 'numeric', month: 'short' });
    recent.forEach((c) => {
      const diff = daysBetween(today, parseISO(c.inicio));
      const when = diff === 0 ? 'Hoy' : diff === 1 ? 'Ayer' : shortDate.format(parseISO(c.inicio));

      const li = el('li', 'item');
      const dot = el('span', 'dot', initials(c.nombre));
      dot.style.setProperty('--dot', colorFor(c.nombre));

      const info = el('div');
      info.append(el('p', 'item-title', c.nombre), el('p', 'item-sub', `${when}, ${cuentasText(c)}`));

      const end = el('div', 'item-end');
      end.appendChild(el('p', 'amount', `+${money(Number(c.venta) || 0)}`));

      li.append(dot, info, end);
      listEl.appendChild(li);
    });
  }

  function render() {
    const data = load();
    const today = startOfDay(new Date());
    const ranges = getRanges(today);

    renderHeader(today);
    renderHero(data, ranges);
    renderBars(data, today);
    renderPeriods(data, ranges);
    renderClients(data, today, ranges);
    renderTopProduct(data, ranges);
    renderAlerts(data, today);
    renderRecent(data, today);
  }

  /* ---------- Inicio ---------- */
  // Se eliminan los datos de ejemplo que dejaron versiones anteriores
  try { localStorage.removeItem(LEGACY_DEMO_KEY); } catch (e) { /* nada */ }

  document.addEventListener('DOMContentLoaded', () => {
    render();

    // Si los datos cambian desde otra pestaña, o al volver a esta, se actualiza el resumen
    window.addEventListener('storage', (e) => {
      if (e.key === CLIENTES_KEY || e.key === CUENTAS_KEY || e.key === window.AppConfig.KEY) render();
    });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
  });
})();