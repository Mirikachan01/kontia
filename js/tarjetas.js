/* ==========================================================
   Panel de clientes · página Tarjetas (tarjetas.html)
   Datos en localStorage, clave "dashboard.tarjetas.v1":
   {
     bancos:   [{ id, nombre }],
     tarjetas: [{ id, bancoId, titular, serial, telefono, color, creado }]
   }
   ========================================================== */
(() => {
  'use strict';

  const STORAGE_KEY = 'dashboard.tarjetas.v1';
  const DEFAULT_COLOR = '#2b59ff';
  const PRESETS = ['#2b59ff', '#7c5cff', '#e5484d', '#18a874', '#f59e0b', '#111827'];
  const HEX = /^#[0-9a-f]{6}$/i;

  /* ---------- Utilidades ---------- */
  const $ = (id) => document.getElementById(id);
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const plural = (n, one, many) => (n === 1 ? one : many);
  const norm = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const digits = (s) => String(s).replace(/\D/g, '');
  const sameText = (a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }) === 0;

  // true si el color es claro (el texto de la tarjeta pasa a ser oscuro)
  function isLight(hex) {
    const n = parseInt(hex.slice(1), 16);
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62;
  }

  // Agrupa de 4 en 4 si parece un número de tarjeta; si no, lo muestra tal cual
  function formatSerial(raw) {
    const clean = String(raw).replace(/[\s-]/g, '');
    return /^\d{12,19}$/.test(clean) ? clean.replace(/(.{4})/g, '$1 ').trim() : String(raw).trim();
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
        if (d && Array.isArray(d.bancos) && Array.isArray(d.tarjetas)) return d;
      }
    } catch (e) { /* datos dañados: se empieza de cero */ }
    return { bancos: [], tarjetas: [] };
  }

  let data = load();
  const state = { q: '', banco: 'todos' };
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

  const bancoById = (id) => data.bancos.find((b) => b.id === id);

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

  /* ---------- Diseño de la tarjeta ---------- */
  function buildFace({ banco, titular, serial, telefono, color }) {
    const c = HEX.test(color) ? color : DEFAULT_COLOR;
    const face = el('div', 'face' + (isLight(c) ? ' is-light' : ''));
    face.style.setProperty('--card', c);

    const top = el('div', 'face-top');
    top.append(el('span', 'face-bank', banco || 'Banco'), icon('contactless'));

    const serialText = serial ? formatSerial(serial) : '0000 0000 0000 0000';
    const bottom = el('div', 'face-bottom');
    const left = el('div');
    left.append(el('span', 'face-label', 'Titular'), el('span', 'face-name', titular || 'Nombre del titular'));
    const right = el('div');
    right.append(el('span', 'face-label', 'WhatsApp'), el('span', 'face-phone', telefono || '–'));
    bottom.append(left, right);

    face.append(top, el('span', 'face-chip'), el('p', 'face-serial', serialText), bottom);
    return face;
  }

  /* ---------- WhatsApp ---------- */
  function waLink(t, bancoNombre) {
    const d = window.AppConfig.waNumber(t.telefono);
    const first = t.titular.split(' ')[0];
    const text = `Hola ${first}, te escribo por la tarjeta de ${bancoNombre}.`;
    return `https://wa.me/${d}?text=${encodeURIComponent(text)}`;
  }

  /* ---------- Render ---------- */
  function renderBankFilter() {
    const select = $('filtro-banco');
    if (state.banco !== 'todos' && !bancoById(state.banco)) state.banco = 'todos';
    const options = [el('option', null, 'Todos los bancos')];
    options[0].value = 'todos';
    data.bancos.forEach((b) => {
      const o = el('option', null, b.nombre);
      o.value = b.id;
      options.push(o);
    });
    select.replaceChildren(...options);
    select.value = state.banco;
  }

  function actionButton(iconName, label, cls, onClick) {
    const b = el('button', `tbtn ${cls}`.trim());
    b.type = 'button';
    b.append(icon(iconName), el('span', null, label));
    b.addEventListener('click', onClick);
    return b;
  }

  function renderCard(t) {
    const banco = bancoById(t.bancoId);
    const bancoNombre = banco ? banco.nombre : 'Sin banco';

    const li = el('li', 'tcard');
    li.appendChild(buildFace({ ...t, banco: bancoNombre }));

    const actions = el('div', 'tcard-actions');
    const contact = el('a', 'tbtn is-contact');
    contact.href = waLink(t, bancoNombre);
    contact.target = '_blank';
    contact.rel = 'noopener noreferrer';
    contact.setAttribute('aria-label', `Contactar a ${t.titular} por WhatsApp`);
    contact.append(icon('chat'), el('span', null, 'Contactar'));

    const edit = actionButton('pencil', 'Editar', '', () => openCardForm(t.id));
    edit.setAttribute('aria-label', `Editar tarjeta de ${t.titular}`);
    const del = actionButton('trash', 'Borrar', 'is-danger', () => deleteCard(t.id));
    del.setAttribute('aria-label', `Borrar tarjeta de ${t.titular}`);

    actions.append(edit, contact, del);
    li.appendChild(actions);
    return li;
  }

  function render() {
    renderBankFilter();

    const q = norm(state.q);
    const visibles = data.tarjetas
      .filter((t) => (state.banco === 'todos' || t.bancoId === state.banco) && (!q || norm(t.titular).includes(q)))
      .sort((a, b) => b.creado - a.creado);

    const total = data.tarjetas.length;
    const filtering = state.banco !== 'todos' || q !== '';
    $('count-tarjetas').textContent = filtering
      ? `${visibles.length} de ${total}`
      : `${total} ${plural(total, 'tarjeta', 'tarjetas')}`;

    const ul = $('lista-tarjetas');
    ul.replaceChildren();

    if (total === 0) {
      ul.appendChild(el('li', 'empty', data.bancos.length === 0
        ? 'Empieza añadiendo un banco y después tu primera tarjeta.'
        : 'Aún no hay tarjetas. Pulsa «Añadir tarjeta» para registrar la primera.'));
      return;
    }
    if (visibles.length === 0) {
      ul.appendChild(el('li', 'empty', 'Ninguna tarjeta coincide con la búsqueda o el filtro.'));
      return;
    }
    visibles.forEach((t) => ul.appendChild(renderCard(t)));
  }

  /* ---------- Borrar ---------- */
  async function deleteCard(id) {
    const t = data.tarjetas.find((x) => x.id === id);
    if (!t) return;
    const banco = bancoById(t.bancoId);
    const ok = await confirmAction({
      title: '¿Borrar tarjeta?',
      message: [
        document.createTextNode('Se borrará la tarjeta de '),
        el('strong', null, `«${t.titular}»`),
        document.createTextNode(`${banco ? ` (${banco.nombre})` : ''}. Esta acción no se puede deshacer.`),
      ],
    });
    if (!ok) return;
    data.tarjetas = data.tarjetas.filter((x) => x.id !== id);
    if (save()) toast('Tarjeta borrada');
    render();
  }

  /* ---------- Formulario: añadir banco ---------- */
  function openBankDialog() {
    $('form-bank').reset();
    $('bank-error').textContent = '';
    $('dlg-bank').showModal();
    $('b-nombre').focus();
  }

  $('form-bank').addEventListener('submit', (e) => {
    e.preventDefault();
    const nombre = $('b-nombre').value.trim();
    const error = $('bank-error');
    if (!nombre) { error.textContent = 'Escribe el nombre del banco.'; $('b-nombre').focus(); return; }
    if (data.bancos.some((b) => sameText(b.nombre, nombre))) {
      error.textContent = 'Ya existe un banco con ese nombre.';
      $('b-nombre').focus();
      return;
    }
    data.bancos.push({ id: uid(), nombre });
    if (!save()) return;
    $('dlg-bank').close();
    toast('Banco añadido');
    render();
  });

  /* ---------- Formulario: añadir / editar tarjeta ---------- */
  const C = {
    banco: $('c-banco'), titular: $('c-titular'), serial: $('c-serial'),
    telefono: $('c-telefono'), color: $('c-color'),
  };

  function updatePreview() {
    const banco = bancoById(C.banco.value);
    $('c-preview').replaceChildren(buildFace({
      banco: banco ? banco.nombre : '',
      titular: C.titular.value.trim(),
      serial: C.serial.value.trim(),
      telefono: C.telefono.value.trim(),
      color: C.color.value,
    }));
    $('c-swatches').querySelectorAll('.swatch').forEach((s) => {
      s.setAttribute('aria-pressed', String(s.dataset.color.toLowerCase() === C.color.value.toLowerCase()));
    });
  }

  function buildSwatches() {
    const box = $('c-swatches');
    PRESETS.forEach((hex) => {
      const b = el('button', 'swatch');
      b.type = 'button';
      b.dataset.color = hex;
      b.style.setProperty('--sw', hex);
      b.setAttribute('aria-label', `Color ${hex}`);
      b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', () => { C.color.value = hex; updatePreview(); });
      box.appendChild(b);
    });
  }

  function openCardForm(id = null) {
    editingId = id;
    const t = id != null ? data.tarjetas.find((x) => x.id === id) : null;
    const hasBanks = data.bancos.length > 0;

    $('form-card').reset();
    $('card-error').textContent = '';
    $('dlg-card-title').textContent = t ? 'Editar tarjeta' : 'Añadir tarjeta';
    $('card-submit').textContent = t ? 'Guardar cambios' : 'Guardar tarjeta';

    C.banco.replaceChildren(...data.bancos.map((b) => {
      const o = el('option', null, b.nombre);
      o.value = b.id;
      return o;
    }));

    $('c-empty').hidden = hasBanks;
    $('c-fields').hidden = !hasBanks;
    $('card-submit').disabled = !hasBanks;

    C.color.value = t ? t.color : DEFAULT_COLOR;
    if (t) {
      C.banco.value = t.bancoId;
      C.titular.value = t.titular;
      C.serial.value = t.serial;
      C.telefono.value = t.telefono;
    } else if (state.banco !== 'todos' && bancoById(state.banco)) {
      C.banco.value = state.banco; // preselecciona el banco que se está filtrando
    }

    if (hasBanks) updatePreview();
    $('dlg-card').showModal();
    if (hasBanks) C.titular.focus();
  }

  $('form-card').addEventListener('submit', (e) => {
    e.preventDefault();
    const error = $('card-error');
    const fail = (msg, field) => { error.textContent = msg; field.focus(); };

    const bancoId = C.banco.value;
    const titular = C.titular.value.trim();
    const serial = C.serial.value.trim();
    const telefono = C.telefono.value.trim();
    const color = C.color.value;

    if (!bancoById(bancoId)) return fail('Elige un banco.', C.banco);
    if (!titular) return fail('Escribe el nombre del titular.', C.titular);
    if (!serial) return fail('Escribe el serial de la tarjeta.', C.serial);
    if (digits(telefono).length < 8) return fail('Escribe un número válido (mínimo 8 dígitos).', C.telefono);
    if (!HEX.test(color)) return fail('Elige un color válido.', C.color);

    if (editingId != null) {
      const t = data.tarjetas.find((x) => x.id === editingId);
      if (!t) return;
      Object.assign(t, { bancoId, titular, serial, telefono, color });
      if (!save()) return;
      toast('Cambios guardados');
    } else {
      data.tarjetas.push({ id: uid(), bancoId, titular, serial, telefono, color, creado: Date.now() });
      if (!save()) return;
      toast('Tarjeta añadida');
    }

    $('dlg-card').close();
    render();
  });

  /* ---------- Eventos ---------- */
  buildSwatches();
  $('btn-add-bank').addEventListener('click', openBankDialog);
  $('btn-add-card').addEventListener('click', () => openCardForm());
  $('c-go-bank').addEventListener('click', () => { $('dlg-card').close(); openBankDialog(); });

  [C.banco, C.titular, C.serial, C.telefono, C.color].forEach((i) => {
    i.addEventListener('input', updatePreview);
    i.addEventListener('change', updatePreview);
  });

  $('buscar').addEventListener('input', (e) => { state.q = e.target.value; render(); });
  $('filtro-banco').addEventListener('change', (e) => { state.banco = e.target.value; render(); });

  document.querySelectorAll('[data-close]').forEach((btn) => {
    btn.addEventListener('click', () => btn.closest('dialog').close());
  });
  document.querySelectorAll('dialog.modal').forEach((dlg) => {
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  });

  // Si los datos cambian desde otra pestaña
  window.addEventListener('storage', (e) => { if (e.key === STORAGE_KEY) { data = load(); render(); } });

  render();
})();