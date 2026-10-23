// Stato condiviso in tempo reale per le schermate dello staff.
import { on, onWhere, db } from './db.js';
import { oggi } from './util.js';

export const S = {
  info: {}, menu: { categorie: {}, prodotti: {} }, tavoli: {}, qr: {}, ingr: {},
  ordini: {}, movimenti: {}, stato: {}, serate: {}, staff: {}, richieste: {},
  serata: null,       // serata attiva (null = chiusa)
  pronto: false,
};
const subs = new Set();
export const onStore = fn => { subs.add(fn); return () => subs.delete(fn); };
let timer = null;
function emit() { // raggruppa più aggiornamenti ravvicinati
  if (timer) return;
  timer = setTimeout(() => { timer = null; subs.forEach(f => { try { f(S); } catch (e) { console.error(e); } }); }, 0);
}

let started = false, unOrd = null, unMov = null, serataSub = undefined;
export function serataVista() { return S.info.serata || oggi(); }

export function startStore() {
  if (started) return; started = true;
  const fissi = { 'pubblico/info': 'info', 'pubblico/menu': 'menu', tavoli: 'tavoli', qr: 'qr', 'magazzino/ingredienti': 'ingr', stato: 'stato', serate: 'serate' };
  let pending = Object.keys(fissi).length;
  for (const [p, k] of Object.entries(fissi)) {
    let first = true;
    on(p, v => {
      S[k] = v || (k === 'menu' ? { categorie: {}, prodotti: {} } : {});
      if (k === 'menu') { S.menu.categorie ||= {}; S.menu.prodotti ||= {}; }
      if (k === 'info') { S.serata = S.info.serata || null; risottoscrivi(); }
      if (first) { first = false; if (--pending === 0) S.pronto = true; }
      emit();
    });
  }
  if (db.staff && db.staff.admin) {
    on('staff', v => { S.staff = v || {}; emit(); });
    if (db.mode === 'firebase') on('richieste', v => { S.richieste = v || {}; emit(); });
  }
}
function risottoscrivi() {
  const s = serataVista();
  if (s === serataSub) return;
  serataSub = s;
  unOrd && unOrd(); unMov && unMov();
  unOrd = onWhere('ordini', 'serata', s, v => { S.ordini = v || {}; emit(); });
  unMov = on('movimenti/' + s, v => { S.movimenti = v || {}; emit(); });
}

/* ---------- selettori ---------- */
export const ordiniLista = (filtro = () => true) =>
  Object.entries(S.ordini).map(([id, o]) => ({ id, ...o })).filter(filtro).sort((a, b) => (a.creato || 0) - (b.creato || 0));
export const repartiLista = () => Object.entries(S.info.reparti || {}).sort((a, b) => (a[1].ordine ?? 9) - (b[1].ordine ?? 9));
export const nomeReparto = k => (S.info.reparti?.[k]?.nome) || (k ? k : 'Nessuna preparazione');
export const tavoliLista = () => Object.entries(S.tavoli).filter(([, t]) => t.attivo !== false).sort((a, b) => (parseInt(a[0]) || 0) - (parseInt(b[0]) || 0) || a[0].localeCompare(b[0]));
export const prodottiAttivi = () => Object.entries(S.menu.prodotti || {}).filter(([, p]) => p.attivo !== false);
export const etichettaOrdine = o => o.tavolo === 'banco' ? `Banco #${o.num || '?'}`
  : o.tavolo === 'asporto' ? `Asporto ${o.ritiro || ''} · ${o.cliente?.nome || '#' + (o.num || '?')}`
  : `Tavolo ${o.tavolo}`;
export const aperto = o => o.stato !== 'annullato' && o.stato !== 'da_confermare';
export function sottoScorta() {
  return Object.entries(S.ingr).filter(([, i]) => (Number(i.giacenza) || 0) <= (Number(i.soglia) || 0));
}
export function foodCost(p) {
  let c = 0;
  for (const [k, q] of Object.entries(p.ricetta || {})) c += (Number(S.ingr[k]?.costo) || 0) * (Number(q) || 0);
  return c;
}
