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
