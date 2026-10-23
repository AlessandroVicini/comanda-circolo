// Operazioni di dominio: ordini, reparti, cassa, magazzino.
import { db, get, set, update, newKey, transaction, inc, remove } from './db.js';
import { S, serataVista } from './store.js';
import { oggi, r2, toast, perAsporto, pezziDi, tsRitiro, codice } from './util.js';
import { token } from './seed.js';

const operatore = () => db.user?.email || 'staff';

export const riepilogo = righe => (righe || []).map(r => `${r.qta}× ${r.nome}${r.note ? ` (${r.note})` : ''}`).join(', ');
export const totaleRighe = righe => r2((righe || []).reduce((s, r) => s + (Number(r.prezzo) || 0) * (Number(r.qta) || 0), 0));
const repartiDi = righe => {
  const o = {};
  for (const r of righe || []) if (r.reparto) o[r.reparto] = 'attesa';
  return o;
};

/* ---------- serata ---------- */
export async function apriSerata(data = oggi(), fondo = 0) {
  await update('', {
    'pubblico/info/serata': data,
    [`serate/${data}/aperta`]: true,
    [`serate/${data}/apertaIl`]: Date.now(),
    [`serate/${data}/fondoCassa`]: Number(fondo) || 0,
  });
}
export async function chiudiSerata() {
  const s = S.info.serata; if (!s) return;
  await update('', { 'pubblico/info/serata': null, [`serate/${s}/aperta`]: false, [`serate/${s}/chiusaIl`]: Date.now(), avvisi: null, 'stato/chiamata': null });
}
async function assicuraSerata() {
  if (S.info.serata) return S.info.serata;
  const d = oggi(); await apriSerata(d, 0);
  toast(`Serata del ${d.split('-').reverse().join('/')} aperta automaticamente`);
  return d;
}
async function prossimoNumero(serata) {
  const r = await transaction(`serate/${serata}/contatore`, c => (Number(c) || 0) + 1);
  return r.value;
}

/* ---------- avvisi ai clienti ---------- */
function avvisoPatch(id, o, stato) {
  if (!o.avviso) return {};
  return {
    [`avvisi/${o.avviso}/ordini/${id}`]: {
      stato, num: o.num || null, tavolo: o.tavolo, serata: o.serata,
      riepilogo: riepilogo(o.righe), ts: Date.now(), ritiro: o.ritiro || null,
    },
  };
}

/* ---------- asporto: pizze prenotate per fascia ---------- */
function patchFascia(o, segno) {
  if (o.tavolo !== 'asporto' || !o.ritiro) return {};
  const n = pezziDi(o.righe);
  return n ? { [`pubblico/asporto/${o.serata}/${o.ritiro}`]: inc(segno * n) } : {};
}

/* ---------- magazzino ---------- */
function deltaMagazzino(righe, segno) {
  const d = {};
  for (const r of righe || []) {
    const p = S.menu.prodotti?.[r.pid];
    for (const [ing, q] of Object.entries(p?.ricetta || {})) d[ing] = (d[ing] || 0) + segno * (Number(q) || 0) * (Number(r.qta) || 0);
  }
  return d;
}
function patchMagazzino(delta) {
  const out = {};
  for (const [ing, q] of Object.entries(delta)) if (S.ingr[ing] && q) out[`magazzino/ingredienti/${ing}/giacenza`] = inc(r2(q * 1000) / 1000);
  return out;
}
export async function aggiornaEsauriti() {
  const patch = {};
  for (const [pid, p] of Object.entries(S.menu.prodotti || {})) {
    let manca = false;
    for (const [ing, q] of Object.entries(p.ricetta || {})) {
      if (S.ingr[ing] && (Number(S.ingr[ing].giacenza) || 0) < (Number(q) || 0) - 1e-9) { manca = true; break; }
    }
    if (!!p.esauritoAuto !== manca) patch[`pubblico/menu/prodotti/${pid}/esauritoAuto`] = manca;
  }
  if (Object.keys(patch).length) await update('', patch);
}
export async function caricoMagazzino(ing, qta, costo, nota = '') {
  const patch = { [`magazzino/ingredienti/${ing}/giacenza`]: inc(Number(qta) || 0) };
  if (costo > 0) patch[`magazzino/ingredienti/${ing}/costo`] = Number(costo);
  patch[`magazzino/movimenti/${newKey('magazzino/movimenti')}`] = { ts: Date.now(), ing, qta: Number(qta), tipo: 'carico', costo: Number(costo) || null, nota, operatore: operatore() };
  await update('', patch);
  await aggiornaEsauriti();
}
export async function rettificaMagazzino(ing, contata, nota = '') {
  const prima = Number(S.ingr[ing]?.giacenza) || 0;
  await update('', {
    [`magazzino/ingredienti/${ing}/giacenza`]: Number(contata),
    [`magazzino/movimenti/${newKey('magazzino/movimenti')}`]: { ts: Date.now(), ing, qta: r2((Number(contata) - prima) * 1000) / 1000, tipo: 'rettifica', nota, operatore: operatore() },
  });
  await aggiornaEsauriti();
}

/* ---------- ordini ---------- */
// righe: [{pid, nome, prezzo, qta, reparto, note}]
export async function creaOrdineStaff({ tavolo, righe, nota = '', socio = '', origine = 'cameriere', pagato = false, cliente = null, ritiro = null }) {
  const serata = await assicuraSerata();
  const asporto = tavolo === 'asporto';
  if (asporto) righe = righe.filter(r => perAsporto(S.menu.prodotti?.[r.pid]));
  const id = newKey('ordini');
  const reparti = repartiDi(righe);
  const daPreparare = Object.keys(reparti).length > 0;
  const num = await prossimoNumero(serata);
  const avviso = tavolo === 'banco' ? (daPreparare ? token() : null) : asporto ? codice() : (S.qr[tavolo] || null);
  const stato = daPreparare ? 'inviato' : (tavolo === 'banco' ? 'servito' : 'pronto');
  const o = {
    tavolo: String(tavolo), righe, nota, socio, origine, serata, num, stato, reparti,
    totale: totaleRighe(righe), pagato, creato: Date.now(), operatore: operatore(),
    scaricato: true, avviso,
  };
  if (asporto) { o.cliente = cliente || {}; o.ritiro = ritiro; o.ritiroTs = tsRitiro(serata, ritiro); o.fasciaContata = true; }
  if (stato === 'pronto') o.prontoTs = Date.now();
  await update('', {
    [`ordini/${id}`]: o,
    ...patchFascia(o, +1),
    ...avvisoPatch(id, o, stato === 'servito' ? 'ritirato' : stato),
    ...patchMagazzino(deltaMagazzino(righe, -1)),
  });
  aggiornaEsauriti();
  return { id, ...o };
}

export async function confermaOrdine(id) {
  const o = S.ordini[id]; if (!o || o.stato !== 'da_confermare') return;
  // ricalcola i prezzi dal menù (il cliente non può modificarli)
  const righe = (o.righe || []).filter(r => o.tavolo !== 'asporto' || perAsporto(S.menu.prodotti?.[r.pid])).map(r => {
    const p = S.menu.prodotti?.[r.pid];
    return { ...r, nome: p?.nome || r.nome, prezzo: p ? Number(p.prezzo) : Number(r.prezzo) || 0, reparto: p ? (p.reparto || '') : (r.reparto || '') };
  });
  const reparti = repartiDi(righe);
  const num = o.num || await prossimoNumero(o.serata || serataVista());
  const stato = Object.keys(reparti).length ? 'inviato' : 'pronto';
  const n = { ...o, righe, reparti, num, stato, totale: totaleRighe(righe), confermato: Date.now(), operatore: operatore(), scaricato: true };
  if (stato === 'pronto') n.prontoTs = Date.now();
  await update('', {
    [`ordini/${id}/righe`]: righe, [`ordini/${id}/reparti`]: reparti, [`ordini/${id}/num`]: num,
    [`ordini/${id}/stato`]: stato, [`ordini/${id}/totale`]: n.totale, [`ordini/${id}/confermato`]: n.confermato,
    [`ordini/${id}/operatore`]: n.operatore, [`ordini/${id}/scaricato`]: true,
    ...(n.prontoTs ? { [`ordini/${id}/prontoTs`]: n.prontoTs } : {}),
    ...(o.tavolo === 'asporto' ? { [`ordini/${id}/ritiroTs`]: tsRitiro(o.serata, o.ritiro), [`ordini/${id}/fasciaContata`]: true, ...patchFascia(n, +1) } : {}),
    ...avvisoPatch(id, n, stato),
    ...patchMagazzino(deltaMagazzino(righe, -1)),
  });
  aggiornaEsauriti();
}

export async function annullaOrdine(id, motivo = '') {
  const o = S.ordini[id]; if (!o) return;
  await update('', {
    [`ordini/${id}/stato`]: 'annullato', [`ordini/${id}/annullato`]: Date.now(), [`ordini/${id}/motivo`]: motivo,
    [`ordini/${id}/scaricato`]: false,
    ...avvisoPatch(id, o, 'annullato'),
    ...(o.scaricato ? patchMagazzino(deltaMagazzino(o.righe, +1)) : {}),
    ...(o.fasciaContata ? { [`ordini/${id}/fasciaContata`]: false, ...patchFascia(o, -1) } : {}),
  });
  aggiornaEsauriti();
}

export async function segnaProntoReparto(id, rep, pronto = true) {
  let nuovoStato = null;
  const r = await transaction(`ordini/${id}`, o => {
    if (!o) return o;
    o.reparti = o.reparti || {};
    o.reparti[rep] = pronto ? 'pronto' : 'attesa';
    const tutti = Object.values(o.reparti).every(v => v === 'pronto');
    if (pronto && tutti && o.stato === 'inviato') { o.stato = 'pronto'; o.prontoTs = Date.now(); }
    if (!pronto && o.stato === 'pronto') { o.stato = 'inviato'; delete o.prontoTs; }
    nuovoStato = o.stato;
    return o;
  });
  if (r.committed && r.value) await update('', avvisoPatch(id, r.value, nuovoStato));
  return nuovoStato;
}

export async function segnaServito(id) {
  const o = S.ordini[id]; if (!o) return;
  await update('', { [`ordini/${id}/stato`]: 'servito', [`ordini/${id}/servitoTs`]: Date.now(), ...avvisoPatch(id, o, 'ritirato') });
}
export async function richiama(id) { // rimette un ordine "servito" tra i pronti
  const o = S.ordini[id]; if (!o) return;
  await update('', { [`ordini/${id}/stato`]: 'pronto', [`ordini/${id}/prontoTs`]: Date.now(), ...avvisoPatch(id, o, 'pronto') });
}

/* ---------- cassa ---------- */
export async function incassa({ ordini = [], socio = '', metodo = 'contanti', descr, importo, tavolo = '' }) {
  const serata = await assicuraSerata();
  const mid = newKey('movimenti/' + serata);
  const righe = ordini.flatMap(id => S.ordini[id]?.righe || []);
  const patch = {
    [`movimenti/${serata}/${mid}`]: {
      ts: Date.now(), tipo: 'entrata', socio, metodo, tavolo,
      descr: descr || riepilogoAggregato(righe), importo: r2(importo ?? totaleRighe(righe)),
      ordini: Object.fromEntries(ordini.map(i => [i, true])), operatore: operatore(),
    },
  };
  for (const id of ordini) { patch[`ordini/${id}/pagato`] = true; patch[`ordini/${id}/movimento`] = mid; if (socio) patch[`ordini/${id}/socio`] = socio; }
  await update('', patch);
  return mid;
}
export async function registraUscita({ descr, importo, metodo = 'contanti' }) {
  const serata = await assicuraSerata();
  await set(`movimenti/${serata}/${newKey('movimenti/' + serata)}`, { ts: Date.now(), tipo: 'uscita', descr, importo: r2(importo), metodo, operatore: operatore() });
}
export async function stornaMovimento(serata, mid) {
  const m = (await get(`movimenti/${serata}/${mid}`)) || {};
  const patch = { [`movimenti/${serata}/${mid}`]: null };
  for (const id of Object.keys(m.ordini || {})) { patch[`ordini/${id}/pagato`] = false; patch[`ordini/${id}/movimento`] = null; }
  await update('', patch);
}
export function riepilogoAggregato(righe) {
  const m = new Map();
  for (const r of righe || []) {
    const k = r.nome + (r.prezzo != null ? '|' + r.prezzo : '');
    const x = m.get(k) || { nome: r.nome, qta: 0, prezzo: Number(r.prezzo) || 0 };
    x.qta += Number(r.qta) || 0; m.set(k, x);
  }
  return [...m.values()].map(x => `${x.qta}× ${x.nome}`).join(', ');
}
export function righeAggregate(righe) {
  const m = new Map();
  for (const r of righe || []) {
    const k = r.pid + '|' + r.prezzo;
    const x = m.get(k) || { nome: r.nome, qta: 0, prezzo: Number(r.prezzo) || 0 };
    x.qta += Number(r.qta) || 0; m.set(k, x);
  }
  return [...m.values()];
}

/* ---------- display ---------- */
export async function chiamaNumero(testo) { await set('stato/chiamata', testo ? { testo: String(testo), ts: Date.now() } : null); }

export { remove };
