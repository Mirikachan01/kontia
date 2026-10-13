/* ==========================================================
   Panel de clientes · configuración compartida (js/config.js)
   Se carga en el <head> de TODAS las páginas, sin "defer", para que
   el tema se aplique antes de pintar y no haya parpadeo.

   Guarda en localStorage, clave "dashboard.ajustes.v1":
   {
     tema: { bg, warm, cool, accent },   // colores en formato #rrggbb
     diasPorVencer: 7,                    // 1 a 90
     moneda: 'Bs',
     codigoPais: '591',
     mensajes: { vencido, porvencer, activo }
   }
   Expone window.AppConfig para que las demás páginas lean estos ajustes.
   ========================================================== */
(() => {
  'use strict';

  const KEY = 'dashboard.ajustes.v1';
  const HEX = /^#[0-9a-f]{6}$/i;

  const DEFAULTS = {
    tema: { bg: '#07080d', warm: '#ff7a45', cool: '#7c5cff', accent: '#22d391' },
    diasPorVencer: 7,
    moneda: 'Bs',
    codigoPais: '591',
    mensajes: {
      vencido: 'Hola {nombre}, tu servicio venció el {fecha}. ¿Deseas renovarlo?',
      porvencer: 'Hola {nombre}, tu servicio vence {dias} ({fecha}). ¿Deseas renovarlo?',
      activo: 'Hola {nombre}, ¿cómo estás? Te escribo por tu servicio.',
    },
  };

  /* ---------- Lectura y escritura ---------- */
  const clampInt = (v, min, max, fallback) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) && n >= min && n <= max ? n : fallback;
  };

  function get() {
    let s = {};
    try { s = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { s = {}; }
    if (typeof s !== 'object' || Array.isArray(s)) s = {};

    const tema = {};
    Object.keys(DEFAULTS.tema).forEach((k) => {
      tema[k] = s.tema && HEX.test(s.tema[k]) ? s.tema[k].toLowerCase() : DEFAULTS.tema[k];
    });

    const mensajes = {};
    Object.keys(DEFAULTS.mensajes).forEach((k) => {
      const m = s.mensajes && typeof s.mensajes[k] === 'string' ? s.mensajes[k].trim() : '';
      mensajes[k] = m || DEFAULTS.mensajes[k];
    });

    const moneda = typeof s.moneda === 'string' && s.moneda.trim() ? s.moneda.trim().slice(0, 6) : DEFAULTS.moneda;
    const pais = typeof s.codigoPais === 'string' ? s.codigoPais.replace(/\D/g, '').slice(0, 4) : '';

    return {
      tema,
      diasPorVencer: clampInt(s.diasPorVencer, 1, 90, DEFAULTS.diasPorVencer),
      moneda,
      codigoPais: pais || DEFAULTS.codigoPais,
      mensajes,
    };
  }

  function save(cfg) {
    try {
      localStorage.setItem(KEY, JSON.stringify(cfg));
      return true;
    } catch (e) {
      return false;
    }
  }

  /* ---------- Colores ---------- */
  function luminance(hex) {
    const n = parseInt(hex.slice(1), 16);
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  }
  const isLight = (hex) => luminance(hex) > 0.62;

  // Luminancia relativa (WCAG) para elegir el texto con más contraste sobre el acento
  function relLuminance(hex) {
    const n = parseInt(hex.slice(1), 16);
    const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  }
  const onAccent = (hex) => (relLuminance(hex) > 0.179 ? '#06130d' : '#ffffff');

  function applyTheme(t) {
    const style = document.documentElement.style;
    style.setProperty('--bg', t.bg);
    style.setProperty('--warm', t.warm);
    style.setProperty('--cool', t.cool);
    style.setProperty('--accent', t.accent);
    // Texto de los botones principales: el que más contraste tenga con el acento
    style.setProperty('--on-accent', onAccent(t.accent));
  }

  /* ---------- Formato, WhatsApp y mensajes ---------- */
  const nf = new Intl.NumberFormat('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const money = (n) => `${get().moneda} ${nf.format(n)}`;

  function waNumber(raw) {
    let d = String(raw).replace(/\D/g, '');
    if (d.startsWith('00')) d = d.slice(2);
    if (d.length === 8) d = get().codigoPais + d; // número local: se agrega el código de país
    return d;
  }

  function diasTexto(d) {
    if (d < 0) return `hace ${-d} ${-d === 1 ? 'día' : 'días'}`;
    if (d === 0) return 'hoy';
    if (d === 1) return 'mañana';
    return `en ${d} días`;
  }

  // Reemplaza {nombre} (primer nombre), {fecha} y {dias}
  function fill(template, { nombre = '', fecha = '', dias = 0 } = {}) {
    const first = String(nombre).trim().split(/\s+/)[0] || '';
    return template.replace(/\{(nombre|fecha|dias)\}/g, (_, k) => (
      k === 'nombre' ? first : k === 'fecha' ? fecha : diasTexto(dias)
    ));
  }

  const mensaje = (estado, vars) => fill(get().mensajes[estado] || DEFAULTS.mensajes[estado] || '', vars);

  /* ---------- Inicio ---------- */
  window.AppConfig = {
    KEY, DEFAULTS, get, save, applyTheme, luminance, isLight, money, waNumber, diasTexto, fill, mensaje,
  };

  applyTheme(get().tema);

  // Cualquier elemento con data-moneda muestra el símbolo configurado
  document.addEventListener('DOMContentLoaded', () => {
    const m = get().moneda;
    document.querySelectorAll('[data-moneda]').forEach((e) => { e.textContent = m; });
  });
})();