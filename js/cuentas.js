/* ==========================================================
   Panel de clientes · página Cuentas (cuentas.html)
   Datos en localStorage, clave "dashboard.cuentas.v1":
   {
     categorias: [{ id, nombre }],
     cuentas:    [{ id, categoriaId, nombre, creado }]
   }
   ========================================================== */
(() => {
  'use strict';

  const STORAGE_KEY = 'dashboard.cuentas.v1';
  const DOT_COLORS = ['#7c5cff', '#ff7a45', '#22d391', '#ffb020', '#4cc3ff', '#ff5d9e'];

  /* ---------- Utilidades ---------- */
  const $ = (id) => document.getElementById(id);
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const plural = (n, one, many) => (n === 1 ? one : many);
  const sameText = (a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }) === 0;
  const initials = (name) => name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
  const colorFor = (text) => {
    let h = 0;
    for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return DOT_COLORS[h % DOT_COLORS.length];
  };
  const shortDate = new Intl.DateTimeFormat('es-BO', { day: 'numeric', month: 'short' });

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
        if (d && Array.isArray(d.categorias) && Array.isArray(d.cuentas)) return d;
      }
    } catch (e) { /* datos dañados: se empieza de cero */ }
    return { categorias: [], cuentas: [] };
  }

  let data = load();

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      toast('No se pudo guardar en este navegador', true);
      return false;
    }
  }

  const categoriaById = (id) => data.categorias.find((c) => c.id === id);
  const cuentasDe = (catId) => data.cuentas.filter((c) => c.categoriaId === catId);

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

  // Texto con el nombre resaltado, sin usar innerHTML
  const msg = (before, name, after) => [
    document.createTextNode(before),
    el('strong', null, `«${name}»`),
    document.createTextNode(after),
  ];

  /* ---------- Render: lista de cuentas ---------- */
  function renderList() {
    const ul = $('lista-cuentas');
    ul.replaceChildren();

    const n = data.cuentas.length;
    $('count-cuentas').textContent = `${n} ${plural(n, 'cuenta', 'cuentas')}`;

    if (n === 0) {
      ul.appendChild(el('li', 'empty', data.categorias.length === 0
        ? 'Empieza creando una categoría y después tu primera cuenta.'
        : 'Aún no hay cuentas. Usa «Crear cuenta» para añadir la primera.'));
      return;
    }

    [...data.cuentas].sort((a, b) => b.creado - a.creado).forEach((cuenta) => {
      const cat = categoriaById(cuenta.categoriaId);
      const catName = cat ? cat.nombre : 'Sin categoría';
      const color = colorFor(catName);

      const li = el('li', 'item');
      const dot = el('span', 'dot', initials(cuenta.nombre));
      dot.style.setProperty('--dot', color);

      const info = el('div');
      const tag = el('span', 'cat-tag', catName);
      tag.style.setProperty('--dot', color);
      const sub = el('p', 'item-sub');
      sub.appendChild(tag);
      info.append(el('p', 'item-title', cuenta.nombre), sub);

      const actions = el('div', 'item-actions');
      const del = el('button', 'icon-btn is-danger');
      del.type = 'button';
      del.setAttribute('aria-label', `Eliminar cuenta ${cuenta.nombre}`);
      del.title = 'Eliminar';
      del.appendChild(icon('trash'));
      del.addEventListener('click', () => deleteAccount(cuenta.id));
      actions.append(el('span', 'item-date', shortDate.format(new Date(cuenta.creado))), del);

      li.append(dot, info, actions);
      ul.appendChild(li);
    });
  }

  /* ---------- Render: administrar categorías ---------- */
  function renderManage() {
    const ul = $('lista-categorias');
    ul.replaceChildren();

    if (data.categorias.length === 0) {
      ul.appendChild(el('li', 'empty', 'Todavía no has creado categorías.'));
      return;
    }

    data.categorias.forEach((cat) => {
      const count = cuentasDe(cat.id).length;
      const color = colorFor(cat.nombre);

      const li = el('li', 'item');
      const dot = el('span', 'dot', initials(cat.nombre));
      dot.style.setProperty('--dot', color);

      const info = el('div');
      info.append(
        el('p', 'item-title', cat.nombre),
        el('p', 'item-sub', `${count} ${plural(count, 'cuenta', 'cuentas')}`),
      );

      const del = el('button', 'icon-btn is-danger');
      del.type = 'button';
      del.setAttribute('aria-label', `Eliminar categoría ${cat.nombre}`);
      del.title = 'Eliminar';
      del.appendChild(icon('trash'));
      del.addEventListener('click', () => deleteCategory(cat.id));

      li.append(dot, info, del);
      ul.appendChild(li);
    });
  }

  /* ---------- Clientes que usan cuentas ---------- */
  const CLIENTES_KEY = 'dashboard.clientes.v1';

  function readClientes() {
    try {
      const d = JSON.parse(localStorage.getItem(CLIENTES_KEY)) || {};
      return { ...d, clientes: Array.isArray(d.clientes) ? d.clientes : [] };
    } catch (e) {
      return { clientes: [] };
    }
  }

  // Cuántos clientes tienen asignada alguna de estas cuentas
  function clientesUsando(ids) {
    const set = new Set(ids);
    return readClientes().clientes.filter((c) => Array.isArray(c.cuentaIds) && c.cuentaIds.some((i) => set.has(i))).length;
  }

  // Quita las cuentas borradas de los clientes que las tenían
  function quitarDeClientes(ids) {
    const set = new Set(ids);
    const d = readClientes();
    let changed = false;
    d.clientes.forEach((c) => {
      if (Array.isArray(c.cuentaIds) && c.cuentaIds.some((i) => set.has(i))) {
        c.cuentaIds = c.cuentaIds.filter((i) => !set.has(i));
        changed = true;
      }
    });
    if (changed) {
      try { localStorage.setItem(CLIENTES_KEY, JSON.stringify(d)); } catch (e) { /* sin almacenamiento */ }
    }
  }

  const usoText = (n) => (n > 0
    ? ` ${n === 1 ? 'La tiene asignada 1 cliente' : `La tienen asignada ${n} clientes`}; se quitará de ${n === 1 ? 'su ficha' : 'sus fichas'}.`
    : '');

  /* ---------- Acciones: eliminar ---------- */
  async function deleteAccount(id) {
    const cuenta = data.cuentas.find((c) => c.id === id);
    if (!cuenta) return;
    const cat = categoriaById(cuenta.categoriaId);
    const ok = await confirmAction({
      title: '¿Eliminar cuenta?',
      message: msg('Se eliminará la cuenta ', cuenta.nombre,
        `${cat ? ` de la categoría «${cat.nombre}»` : ''}.${usoText(clientesUsando([id]))} Esta acción no se puede deshacer.`),
    });
    if (!ok) return;
    data.cuentas = data.cuentas.filter((c) => c.id !== id);
    quitarDeClientes([id]);
    if (save()) toast('Cuenta eliminada');
    renderList();
  }

  async function deleteCategory(id) {
    const cat = categoriaById(id);
    if (!cat) return;
    const count = cuentasDe(id).length;
    const ids = cuentasDe(id).map((c) => c.id);
    const ok = await confirmAction({
      title: '¿Eliminar categoría?',
      message: msg('Se eliminará la categoría ', cat.nombre,
        count > 0
          ? ` junto con sus ${count} ${plural(count, 'cuenta', 'cuentas')}.${usoText(clientesUsando(ids))} Esta acción no se puede deshacer.`
          : '. Esta acción no se puede deshacer.'),
    });
    if (!ok) return;
    quitarDeClientes(ids);
    data.categorias = data.categorias.filter((c) => c.id !== id);
    data.cuentas = data.cuentas.filter((c) => c.categoriaId !== id);
    if (save()) toast('Categoría eliminada');
    renderManage();
    renderList();
  }

  /* ---------- Formulario: agregar categoría ---------- */
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
    if (data.categorias.some((c) => sameText(c.nombre, nombre))) {
      error.textContent = 'Ya existe una categoría con ese nombre.';
      $('cat-nombre').focus();
      return;
    }

    data.categorias.push({ id: uid(), nombre });
    if (!save()) return;
    $('dlg-cat').close();
    toast('Categoría creada');
    renderList();
  });

  /* ---------- Formulario: crear cuenta ---------- */
  function openAccountDialog() {
    const hasCats = data.categorias.length > 0;
    const select = $('acc-categoria');

    $('form-account').reset();
    $('acc-error').textContent = '';
    select.replaceChildren(...data.categorias.map((c) => {
      const o = el('option', null, c.nombre);
      o.value = c.id;
      return o;
    }));

    $('acc-empty').hidden = hasCats;
    $('acc-fields').hidden = !hasCats;
    $('acc-submit').disabled = !hasCats;

    $('dlg-account').showModal();
    if (hasCats) $('acc-nombre').focus();
  }

  $('form-account').addEventListener('submit', (e) => {
    e.preventDefault();
    const categoriaId = $('acc-categoria').value;
    const nombre = $('acc-nombre').value.trim();
    const error = $('acc-error');

    if (!categoriaById(categoriaId)) { error.textContent = 'Elige una categoría.'; return; }
    if (!nombre) { error.textContent = 'Escribe el nombre de la cuenta.'; $('acc-nombre').focus(); return; }
    if (cuentasDe(categoriaId).some((c) => sameText(c.nombre, nombre))) {
      error.textContent = 'Ya existe una cuenta con ese nombre en esta categoría.';
      $('acc-nombre').focus();
      return;
    }

    data.cuentas.push({ id: uid(), categoriaId, nombre, creado: Date.now() });
    if (!save()) return;
    $('dlg-account').close();
    toast('Cuenta creada');
    renderList();
  });

  /* ---------- Eventos generales ---------- */
  $('btn-add-cat').addEventListener('click', openCategoryDialog);
  $('btn-add-account').addEventListener('click', openAccountDialog);
  $('btn-manage-cat').addEventListener('click', () => { renderManage(); $('dlg-manage').showModal(); });

  $('acc-go-cat').addEventListener('click', () => { $('dlg-account').close(); openCategoryDialog(); });

  // Botones "Cerrar" / "Cancelar"
  document.querySelectorAll('[data-close]').forEach((btn) => {
    btn.addEventListener('click', () => btn.closest('dialog').close());
  });

  // Clic fuera de la ventana para cerrarla
  document.querySelectorAll('dialog.modal').forEach((dlg) => {
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  });

  // Si los datos cambian desde otra pestaña
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) { data = load(); renderList(); if ($('dlg-manage').open) renderManage(); }
  });

  renderList();
})();