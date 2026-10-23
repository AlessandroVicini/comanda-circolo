// Avvisi "ordine pronto" sul telefono del cliente: schermata lampeggiante, suono, vibrazione, notifica.
import { esc, sbloccaAudio, suono } from '../util.js';

let wakeLock = null, swReg = null, titoloTimer = null;

export const statoAvvisi = () => ({
  notifiche: 'Notification' in window ? Notification.permission : 'non-supportate',
  attivi: localStorage.getItem('avvisi-attivi') === '1',
});

export async function attivaAvvisi() {
  sbloccaAudio(); suono('ding');
  try { navigator.vibrate && navigator.vibrate(80); } catch {}
  localStorage.setItem('avvisi-attivi', '1');
  try { if ('serviceWorker' in navigator) swReg = await navigator.serviceWorker.register('sw.js'); } catch {}
  try { if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission(); } catch {}
  await tieniAcceso();
}
async function tieniAcceso() {
  try { if ('wakeLock' in navigator && !wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); } } catch {}
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') { if (localStorage.getItem('avvisi-attivi') === '1') tieniAcceso(); fermaTitolo(); }
});
(async () => { try { if ('serviceWorker' in navigator) swReg = await navigator.serviceWorker.getRegistration(); } catch {} })();

function lampeggiaTitolo(t) {
  fermaTitolo();
  const orig = document.title; let on = false;
  titoloTimer = setInterval(() => { document.title = (on = !on) ? '🔔 ' + t : orig; }, 900);
  titoloTimer.orig = orig;
}
function fermaTitolo() { if (titoloTimer) { clearInterval(titoloTimer); document.title = titoloTimer.orig; titoloTimer = null; } }

async function notifica(titolo, corpo) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const opts = { body: corpo, tag: 'ordine-pronto', renotify: true, requireInteraction: true, vibrate: [300, 150, 300, 150, 600], icon: 'icona.svg', badge: 'icona.svg', data: { url: location.href } };
  try {
    const reg = swReg || (navigator.serviceWorker && await navigator.serviceWorker.getRegistration());
    if (reg) return reg.showNotification(titolo, opts);
  } catch {}
  try { new Notification(titolo, opts); } catch {}
}

// ordini: { id: {stato, num, tavolo, riepilogo} }  — chiave: dove ricordare quelli già notificati
export function controllaPronti(ordini, chiave, msgPronto) {
  let visti = {};
  try { visti = JSON.parse(localStorage.getItem('notificati-' + chiave)) || {}; } catch {}
  const nuovi = Object.entries(ordini || {}).filter(([id, o]) => o.stato === 'pronto' && visti[id] !== o.ts);
  if (!nuovi.length) return;
  for (const [id, o] of nuovi) visti[id] = o.ts;
  try { localStorage.setItem('notificati-' + chiave, JSON.stringify(visti)); } catch {}
  const o = nuovi[nuovi.length - 1][1];
  const etichetta = o.tavolo === 'banco' ? `Numero ${o.num}` : `Tavolo ${o.tavolo}`;
  const testo = msgPronto || 'Il tuo ordine è pronto: passa a ritirarlo al banco!';
  mostraAllarme(etichetta, testo, nuovi.map(([, x]) => x.riepilogo).join(' · '));
  suono('pronto'); setTimeout(() => suono('pronto'), 1600);
  try { navigator.vibrate && navigator.vibrate([400, 150, 400, 150, 800]); } catch {}
  notifica(`🔔 ${etichetta}: ordine pronto!`, testo);
  if (document.visibilityState !== 'visible') lampeggiaTitolo('Ordine pronto!');
}

function mostraAllarme(etichetta, testo, dettaglio) {
  document.querySelector('.allarme')?.remove();
  const d = document.createElement('div');
  d.className = 'allarme'; d.setAttribute('role', 'alertdialog'); d.setAttribute('aria-live', 'assertive');
  d.innerHTML = `<div style="font-size:3.5rem">🔔</div><div class="grosso">PRONTO!</div>
    <div style="font-family:var(--font-t);font-size:1.6rem;font-weight:800">${esc(etichetta)}</div>
    <p>${esc(testo)}</p>${dettaglio ? `<p style="font-size:1rem;opacity:.85">${esc(dettaglio)}</p>` : ''}
    <button class="btn grande">Ok, arrivo!</button>`;
  d.querySelector('button').onclick = () => { d.remove(); fermaTitolo(); try { navigator.vibrate && navigator.vibrate(0); } catch {} };
  document.body.appendChild(d);
}

export function htmlStatoOrdine(o, pendente = false) {
  const st = pendente ? 'attesa' : o.stato;
  const testi = {
    attesa: 'Inviato, in attesa di conferma', da_confermare: 'Inviato, in attesa di conferma',
    inviato: 'In preparazione', pronto: 'PRONTO: vai a ritirarlo!', ritirato: 'Ritirato', servito: 'Ritirato', annullato: 'Annullato',
  };
  return `<div class="stato-ord ${st}"><span class="pallino"></span><div class="cresci">
    <b>${esc(testi[st] || st)}</b>${o.num ? ` <span class="tag">n. ${o.num}</span>` : ''}
    <div class="tenue" style="font-size:.85rem">${esc(o.riepilogo || '')}</div></div></div>`;
}

export function htmlBoxAvvisi() {
  const s = statoAvvisi();
  if (s.attivi && s.notifiche !== 'default') {
    return `<div class="avviso verde campanella"><span style="font-size:1.4rem">🔔</span><div>Avvisi attivi. <b>Tieni aperta questa pagina</b>: quando l'ordine è pronto il telefono suona e vibra.
      ${s.notifiche === 'denied' ? '<br><small>Le notifiche sono bloccate nel browser: ti avviseremo solo con suono e schermata.</small>' : ''}</div></div>`;
  }
  return `<div class="avviso campanella"><span style="font-size:1.4rem">🔔</span><div class="cresci">Vuoi essere avvisato quando l'ordine è pronto?<br>
    <button class="btn oro piccolo" id="attiva-avvisi" style="margin-top:.4rem">Attiva avviso sul telefono</button></div></div>`;
}
