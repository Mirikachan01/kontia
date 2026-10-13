/* ==========================================================
   Panel de clientes · página Accesos directos (accesos.html)
   Datos en localStorage, clave "dashboard.accesos.v1":
   {
     categorias: [{ id, nombre }],
     accesos:    [{ id, categoriaId, nombre, url, creado }]   // categoriaId '' = sin categoría
   }
   ========================================================== */
(() => {
  'use strict';

  const STORAGE_KEY = 'dashboard.accesos.v1';
  const DOT_COLORS = ['#7c5cff', '#ff7a45', '#22d391', '#ffb020', '#4cc3ff', '#ff5d9e'];
  const SIN_CAT = 'sin'; // valor del filtro para "Sin categoría"

  /* ---------- Utilidades ---------- */
  const $ = (id) => document.getElementById(id);
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const plural = (n, one, many) => (n === 1 ? one : many);
  const norm = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const sameText = (a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }) === 0;
  const colorFor = (text) => {
    let h = 0;
    for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return DOT_COLORS[h % DOT_COLORS.length];
  };

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

  // Convierte lo que el usuario pega en una URL válida http(s); devuelve null si no sirve
  function parseUrl(raw) {
    let t = String(raw).trim();
    if (!t || /\s/.test(t)) return null;
    if (!/^https?:\/\//i.test(t)) {
      if (/^[a-z][a-z0-9+.-]*:\/\//i.test(t) || /^(javascript|data|vbscript|blob|file|mailto|tel|about):/i.test(t)) return null;
      t = `https://${t}`;
    }
    try {
      const u = new URL(t);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
      if (!u.hostname.includes('.') && u.hostname !== 'localhost') return null;
      return u;
    } catch (e) {
      return null;
    }
  }

  const hostOf = (href) => {
    try { return new URL(href).hostname.replace(/^www\./, ''); } catch (e) { return href; }
  };

  /* ---------- Datos ---------- */
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d && Array.isArray(d.categorias) && Array.isArray(d.accesos)) return d;
      }
    } catch (e) { /* datos dañados: se empieza de cero */ }
    return { categorias: [], accesos: [] };
  }

  let data = load();
  const state = { q: '', cat: 'todas' };
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

  const catById = (id) => data.categorias.find((c) => c.id === id);

  /* ---------- Avisos y confirmación ---------- */
  function toast(message, isError = false) {
    const t = el('div', 'toast' + (isError ? ' is-error' : ''), message);
    $('toasts').appendChild(t);
    setTimeout(() => t.remove(), 2800);
  }

  function confirmAction({ title, message, okText = 'Borrar' }) {
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

  const msg = (before, name, after) => [
    document.createTextNode(before),
    el('strong', null, `«${name}»`),
    document.createTextNode(after),
  ];

  /* ---------- Render ---------- */
  function renderFilter() {
    const select = $('filtro-cat');
    const valid = state.cat === 'todas' || state.cat === SIN_CAT || catById(state.cat);
    if (!valid) state.cat = 'todas';

    const opts = [['todas', 'Todas las categorías'], ...data.categorias.map((c) => [c.id, c.nombre]), [SIN_CAT, 'Sin categoría']];
    select.replaceChildren(...opts.map(([value, label]) => {
      const o = el('option', null, label);
      o.value = value;
      return o;
    }));
    select.value = state.cat;
  }

  function linkCard(a) {
    const color = colorFor(hostOf(a.url));
    const card = el('li', 'link-card');

    const tile = el('span', 'link-tile', (a.nombre.trim()[0] || '?'));
    tile.style.setProperty('--dot', color);

    const info = el('div', 'link-info');
    const name = el('p', 'link-name', a.nombre);
    name.title = a.nombre;
    const host = el('p', 'link-host', hostOf(a.url));
    host.title = a.url;
    info.append(name, host);

    const actions = el('div', 'link-actions');
    const open = el('a', 'btn-open');
    open.href = a.url;
    open.target = '_blank';
    open.rel = 'noopener noreferrer';
    open.setAttribute('aria-label', `Abrir ${a.nombre}`);
    open.append('Abrir', icon('external'));

    const edit = el('button', 'icon-btn');
    edit.type = 'button';
    edit.title = 'Editar';
    edit.setAttribute('aria-label', `Editar ${a.nombre}`);
    edit.appendChild(icon('pencil'));
    edit.addEventListener('click', () => openLinkForm(a.id));

    const del = el('button', 'icon-btn is-danger');
    del.type = 'button';
    del.title = 'Borrar';
    del.setAttribute('aria-label', `Borrar ${a.nombre}`);
    del.appendChild(icon('trash'));
    del.addEventListener('click', () => deleteLink(a.id));

    actions.append(open, edit, del);
    card.append(tile, info, actions);
    return card;
  }

  function render() {
    renderFilter();

    const q = norm(state.q);
    const visibles = data.accesos.filter((a) => {
      if (state.cat === SIN_CAT && catById(a.categoriaId)) return false;
      if (state.cat !== 'todas' && state.cat !== SIN_CAT && a.categoriaId !== state.cat) return false;
      return !q || norm(a.nombre).includes(q) || norm(a.url).includes(q);
    });

    const total = data.accesos.length;
    const filtering = state.cat !== 'todas' || q !== '';
    $('count-accesos').textContent = filtering
      ? `${visibles.length} de ${total}`
      : `${total} ${plural(total, 'acceso', 'accesos')}`;

    const box = $('grupos');
    box.replaceChildren();

    if (total === 0 && data.categorias.length === 0) {
      box.appendChild(el('p', 'empty', 'Pulsa «Añadir acceso directo» y pega la dirección de una página para empezar.'));
      return;
    }
    if (filtering && visibles.length === 0) {
      box.appendChild(el('p', 'empty', 'Ningún acceso coincide con la búsqueda o el filtro.'));
      return;
    }

    const groups = data.categorias.map((c) => ({ nombre: c.nombre, items: visibles.filter((a) => a.categoriaId === c.id) }));
    groups.push({ nombre: 'Sin categoría', items: visibles.filter((a) => !catById(a.categoriaId)) });

    groups.forEach((g, i) => {
      const isSin = i === groups.length - 1;
      // Con filtros solo se muestran grupos con resultados; sin filtros también las categorías vacías
      if (g.items.length === 0 && (filtering || isSin)) return;

      const section = el('section');
      const head = el('div', 'group-head');
      head.append(el('h3', null, g.nombre), el('span', 'group-count', String(g.items.length)));
      section.appendChild(head);

      if (g.items.length === 0) {
        section.appendChild(el('p', 'group-empty', 'Todavía no hay accesos en esta categoría.'));
      } else {
        const ul = el('ul', 'links');
        g.items.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' })).forEach((a) => ul.appendChild(linkCard(a)));
        section.appendChild(ul);
      }
      box.appendChild(section);
    });
  }

  function renderManage() {
    const ul = $('lista-categorias');
    ul.replaceChildren();

    if (data.categorias.length === 0) {
      ul.appendChild(el('li', 'empty', 'Todavía no has creado categorías.'));
      return;
    }

    data.categorias.forEach((cat) => {
      const n = data.accesos.filter((a) => a.categoriaId === cat.id).length;
      const color = colorFor(cat.nombre);

      const li = el('li', 'item');
      const dot = el('span', 'dot', cat.nombre.trim()[0].toUpperCase());
      dot.style.setProperty('--dot', color);

      const info = el('div');
      info.append(el('p', 'item-title', cat.nombre), el('p', 'item-sub', `${n} ${plural(n, 'acceso', 'accesos')}`));

      const del = el('button', 'icon-btn is-danger');
      del.type = 'button';
      del.title = 'Eliminar';
      del.setAttribute('aria-label', `Eliminar categoría ${cat.nombre}`);
      del.appendChild(icon('trash'));
      del.addEventListener('click', () => deleteCategory(cat.id));

      li.append(dot, info, del);
      ul.appendChild(li);
    });
  }

  /* ---------- Borrar ---------- */
  async function deleteLink(id) {
    const a = data.accesos.find((x) => x.id === id);
    if (!a) return;
    const ok = await confirmAction({
      title: '¿Borrar acceso directo?',
      message: msg('Se borrará el acceso ', a.nombre, '. Esta acción no se puede deshacer.'),
    });
    if (!ok) return;
    data.accesos = data.accesos.filter((x) => x.id !== id);
    if (save()) toast('Acceso borrado');
    render();
  }

  async function deleteCategory(id) {
    const cat = catById(id);
    if (!cat) return;
    const n = data.accesos.filter((a) => a.categoriaId === id).length;
    const ok = await confirmAction({
      title: '¿Eliminar categoría?',
      message: msg('Se eliminará la categoría ', cat.nombre,
        n > 0
          ? `. ${n === 1 ? 'Su acceso pasará' : `Sus ${n} accesos pasarán`} a «Sin categoría»; no se borra${n === 1 ? '' : 'n'}.`
          : '. Esta acción no se puede deshacer.'),
      okText: 'Eliminar',
    });
    if (!ok) return;
    data.accesos.forEach((a) => { if (a.categoriaId === id) a.categoriaId = ''; });
    data.categorias = data.categorias.filter((c) => c.id !== id);
    if (save()) toast('Categoría eliminada');
    renderManage();
    render();
  }

  /* ---------- Formulario: categoría ---------- */
  function openCategoryDialog() {
    $('form-cat').reset();
    $('cat-error').textContent = '';
    $('dlg-cat').showModal();
    $('cat-nombre').focus();
  }

  $('form-cat').addEventListener('submit', (e) => {
    e.preventDefault();
    const nombre = $('cat-nombre').value.trim();
    const error = $('cat-error');
    if (!nombre) { error.textContent = 'Escribe un nombre para la categoría.'; $('cat-nombre').focus(); return; }
    if (data.categorias.some((c) => sameText(c.nombre, nombre)) || sameText('Sin categoría', nombre)) {
      error.textContent = 'Ya existe una categoría con ese nombre.';
      $('cat-nombre').focus();
      return;
    }
    data.categorias.push({ id: uid(), nombre });
    if (!save()) return;
    $('dlg-cat').close();
    toast('Categoría creada');
    render();
  });

  /* ---------- Formulario: acceso directo ---------- */
  const L = { url: $('l-url'), nombre: $('l-nombre'), cat: $('l-cat') };

  function openLinkForm(id = null) {
    editingId = id;
    const a = id != null ? data.accesos.find((x) => x.id === id) : null;

    $('form-link').reset();
    $('link-error').textContent = '';
    $('dlg-link-title').textContent = a ? 'Editar acceso directo' : 'Añadir acceso directo';
    $('link-submit').textContent = a ? 'Guardar cambios' : 'Guardar acceso';

    const opts = [['', 'Sin categoría'], ...data.categorias.map((c) => [c.id, c.nombre])];
    L.cat.replaceChildren(...opts.map(([value, label]) => {
      const o = el('option', null, label);
      o.value = value;
      return o;
    }));

    if (a) {
      L.url.value = a.url;
      L.nombre.value = a.nombre;
      L.cat.value = catById(a.categoriaId) ? a.categoriaId : '';
    } else if (state.cat !== 'todas' && state.cat !== SIN_CAT && catById(state.cat)) {
      L.cat.value = state.cat; // preselecciona la categoría que se está viendo
    }

    updateNamePlaceholder();
    $('dlg-link').showModal();
    L.url.focus();
  }

  function updateNamePlaceholder() {
    const u = parseUrl(L.url.value);
    L.nombre.placeholder = u ? `Se usará «${hostOf(u.href)}»` : 'Se usa el nombre del sitio si lo dejas vacío';
  }
  L.url.addEventListener('input', updateNamePlaceholder);

  $('form-link').addEventListener('submit', (e) => {
    e.preventDefault();
    const error = $('link-error');
    const u = parseUrl(L.url.value);

    if (!u) {
      error.textContent = 'Escribe o pega una dirección válida, por ejemplo https://www.ejemplo.com';
      L.url.focus();
      return;
    }
    if (data.accesos.some((a) => a.id !== editingId && a.url.toLowerCase() === u.href.toLowerCase())) {
      error.textContent = 'Ya guardaste un acceso con esta dirección.';
      L.url.focus();
      return;
    }

    const nombre = L.nombre.value.trim() || hostOf(u.href);
    const categoriaId = catById(L.cat.value) ? L.cat.value : '';

    if (editingId != null) {
      const a = data.accesos.find((x) => x.id === editingId);
      if (!a) return;
      Object.assign(a, { nombre, url: u.href, categoriaId });
      if (!save()) return;
      toast('Cambios guardados');
    } else {
      data.accesos.push({ id: uid(), categoriaId, nombre, url: u.href, creado: Date.now() });
      if (!save()) return;
      toast('Acceso añadido');
    }
    $('dlg-link').close();
    render();
  });

  /* ---------- Eventos ---------- */
  $('btn-add-cat').addEventListener('click', openCategoryDialog);
  $('btn-add-link').addEventListener('click', () => openLinkForm());
  $('btn-manage-cat').addEventListener('click', () => { renderManage(); $('dlg-manage').showModal(); });

  $('buscar').addEventListener('input', (e) => { state.q = e.target.value; render(); });
  $('filtro-cat').addEventListener('change', (e) => { state.cat = e.target.value; render(); });

  document.querySelectorAll('[data-close]').forEach((btn) => {
    btn.addEventListener('click', () => btn.closest('dialog').close());
  });
  document.querySelectorAll('dialog.modal').forEach((dlg) => {
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  });

  // Si los datos cambian desde otra pestaña
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) { data = load(); render(); if ($('dlg-manage').open) renderManage(); }
  });

  render();
})();