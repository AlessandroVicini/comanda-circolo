import qrcode from 'https://cdn.jsdelivr.net/npm/qrcode-generator@2.0.4/dist/qrcode.mjs';

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const euro = n => (Number(n) || 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
export const num = n => (Number(n) || 0).toLocaleString('it-IT', { maximumFractionDigits: 3 });
export const r2 = n => Math.round((Number(n) || 0) * 100) / 100;
export const parseNum = s => { const v = parseFloat(String(s ?? '').replace(/\s/g, '').replace(',', '.')); return isNaN(v) ? 0 : v; };

export function oggi(d = new Date()) {
  // la "serata" dura fino alle 6 del mattino successivo
  const x = new Date(d.getTime() - 6 * 3600 * 1000);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}
export const dataLunga = s => s ? new Date(s + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '';
export const ora = ts => ts ? new Date(ts).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : '';
export function trascorso(ts) {
  const m = Math.floor((Date.now() - ts) / 60000);
  return m < 1 ? 'ora' : m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/* ---------- toast ---------- */
export function toast(msg, tipo = '') {
  let box = $('#toasts');
  if (!box) { box = document.createElement('div'); box.id = 'toasts'; document.body.appendChild(box); }
  const t = document.createElement('div');
  t.className = 'toast ' + tipo; t.textContent = msg;
  box.appendChild(t);
  setTimeout(() => t.classList.add('out'), 2600);
  setTimeout(() => t.remove(), 3000);
}

/* ---------- modale ---------- */
export function modal({ titolo = '', html = '', azioni = [{ id: 'ok', label: 'OK', cls: 'primario' }], larga = false, onOpen } = {}) {
  return new Promise(resolve => {
    const wrap = document.createElement('div');
    wrap.className = 'modale-sfondo';
    wrap.innerHTML = `<div class="modale ${larga ? 'larga' : ''}" role="dialog" aria-modal="true">
      ${titolo ? `<div class="modale-testa"><h2>${esc(titolo)}</h2><button class="icona chiudi" data-az="__x" aria-label="Chiudi">✕</button></div>` : ''}
      <div class="modale-corpo">${html}</div>
      ${azioni.length ? `<div class="modale-azioni">${azioni.map(a => `<button class="btn ${a.cls || ''}" data-az="${a.id}">${esc(a.label)}</button>`).join('')}</div>` : ''}
    </div>`;
    document.body.appendChild(wrap);
    const close = v => { wrap.remove(); document.removeEventListener('keydown', onKey); resolve(v); };
    const onKey = e => { if (e.key === 'Escape') close(null); };
    document.addEventListener('keydown', onKey);
    wrap.addEventListener('click', e => {
      if (e.target === wrap) return close(null);
      const b = e.target.closest('[data-az]');
      if (!b) return;
      const id = b.dataset.az;
      if (id === '__x') return close(null);
      const form = {};
      $$('[name]', wrap).forEach(i => { form[i.name] = i.type === 'checkbox' ? i.checked : i.value; });
      close({ azione: id, form, el: wrap });
    });
    onOpen && onOpen(wrap, close);
    const f = $('input:not([type=hidden]),select,textarea', wrap); f && setTimeout(() => f.focus(), 50);
  });
}
export async function conferma(testo, label = 'Conferma', cls = 'primario') {
  const r = await modal({ titolo: 'Sei sicuro?', html: `<p>${esc(testo)}</p>`, azioni: [{ id: 'no', label: 'Annulla' }, { id: 'si', label, cls }] });
  return r && r.azione === 'si';
}

/* ---------- suoni ---------- */
let actx = null;
export function sbloccaAudio() {
  try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); } catch {}
}
export function suono(tipo = 'ding') {
  try {
    sbloccaAudio(); if (!actx) return;
    const seq = tipo === 'pronto' ? [[880, 0], [1175, .18], [1568, .36], [1175, .7], [1568, .88]] : tipo === 'nuovo' ? [[660, 0], [990, .15]] : [[988, 0], [1319, .16]];
    for (const [f, t] of seq) {
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, actx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.35, actx.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + t + 0.32);
      o.connect(g).connect(actx.destination); o.start(actx.currentTime + t); o.stop(actx.currentTime + t + 0.35);
    }
  } catch {}
}

/* ---------- QR ---------- */
export function qrSvg(text, px = 220) {
  const q = qrcode(0, 'M'); q.addData(text); q.make();
  const n = q.getModuleCount(), m = 2, size = n + m * 2;
  let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c + m},${r + m}h1v1h-1z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${px}" height="${px}" shape-rendering="crispEdges" role="img" aria-label="Codice QR"><rect width="${size}" height="${size}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}

export const baseUrl = () => location.origin + location.pathname.replace(/index\.html$/, '');

/* ---------- download ---------- */
export function scarica(nome, contenuto, tipo = 'text/csv;charset=utf-8') {
  const blob = new Blob([tipo.startsWith('text/csv') ? '﻿' + contenuto : contenuto], { type: tipo });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nome;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
export const csvCell = v => { const s = String(v ?? ''); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export const csvNum = n => (Number(n) || 0).toFixed(2).replace('.', ',');

export const byOrdine = (a, b) => (a[1].ordine ?? 999) - (b[1].ordine ?? 999) || String(a[1].nome).localeCompare(String(b[1].nome));

/* ---------- asporto ---------- */
export const ASPORTO_DEFAULT = { attivo: true, online: true, inizio: '19:00', fine: '22:00', passo: 15, maxPerFascia: 6, anticipo: 20 };
export const cfgAsporto = info => ({ ...ASPORTO_DEFAULT, ...((info && info.asporto) || {}) });
// un prodotto è da asporto se lo dice il menù; se non è indicato, valgono le pizze
export const perAsporto = p => !!p && p.attivo !== false && (p.asporto === true || (p.asporto === undefined && p.cat === 'pizze'));
const minuti = hhmm => { const [h, m] = String(hhmm || '0:0').split(':').map(Number); return (h || 0) * 60 + (m || 0); };
const hhmm = min => `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
export function fasceAsporto(cfg) {
  const a = minuti(cfg.inizio); let b = minuti(cfg.fine); if (b <= a) b += 24 * 60;
  const passo = Math.max(5, Number(cfg.passo) || 15), out = [];
  for (let t = a; t <= b; t += passo) out.push(hhmm(t));
  return out;
}
// timestamp del ritiro: la serata è la data, l'orario può passare la mezzanotte
export function tsRitiro(serata, fascia) {
  const [y, mo, d] = String(serata).split('-').map(Number);
  const m = minuti(fascia);
  const dt = new Date(y, (mo || 1) - 1, d || 1, Math.floor(m / 60), m % 60);
  if (m < 6 * 60) dt.setDate(dt.getDate() + 1);
  return dt.getTime();
}
export const pezziDi = righe => (righe || []).reduce((s, r) => s + (Number(r.qta) || 0), 0);
export function codice(n = 16) {
  const a = new Uint8Array(n); crypto.getRandomValues(a);
  return Array.from(a, b => 'abcdefghijkmnpqrstuvwxyz23456789'[b % 32]).join('');
}
export const telLink = t => String(t || '').replace(/[^\d+]/g, '');
export function waLink(tel, testo) {
  let n = telLink(tel).replace(/^\+/, '');
  if (n && !n.startsWith('39') && n.length <= 10) n = '39' + n;
  return `https://wa.me/${n}?text=${encodeURIComponent(testo)}`;
}
