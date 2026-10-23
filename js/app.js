import { db, initDb, demoIsEmpty, demoReset, signInStaff, signUpStaff, signOutAll, reloadStaff } from './db.js';
import { S, startStore, onStore } from './store.js';
import { esc, $, toast, oggi } from './util.js';
import { seedTree } from './seed.js';
import { apriSerata } from './logic.js';

const VISTE = {
  '':            { tit: 'Postazioni',         em: '🏠', file: 'home' },
  cameriere:     { tit: 'Cameriere',          em: '🧾', file: 'cameriere', gruppo: 'Servizio' },
  reparto:       { tit: 'Reparto',            em: '🍳', file: 'reparto',   gruppo: 'Servizio' },
  display:       { tit: 'Display ritiro',     em: '📺', file: 'display',   gruppo: 'Servizio', pieno: true },
  cassa:         { tit: 'Cassa',              em: '💶', file: 'cassa',     gruppo: 'Servizio' },
  regia:         { tit: 'Regia',              em: '🎛️', file: 'regia',     gruppo: 'Gestione' },
  magazzino:     { tit: 'Magazzino',          em: '📦', file: 'magazzino', gruppo: 'Gestione' },
  menu:          { tit: 'Menù e ricette',     em: '📋', file: 'menu',      gruppo: 'Gestione' },
  primanota:     { tit: 'Prima nota',         em: '📒', file: 'primanota', gruppo: 'Gestione' },
  qr:            { tit: 'Tavoli e QR',        em: '🔳', file: 'qr',        gruppo: 'Gestione' },
  impostazioni:  { tit: 'Impostazioni',       em: '⚙️', file: 'impostazioni', gruppo: 'Gestione' },
  t:             { tit: 'Ordina',             file: 'cliente', pubblica: true },
  s:             { tit: 'Il tuo ordine',      file: 'segui',   pubblica: true },
};
export { VISTE };

let cleanup = null, routeToken = 0;
const app = () => $('#app');

function parseHash() {
  const p = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
  return { nome: p[0] || '', params: p.slice(1) };
}

async function route() {
  const my = ++routeToken;
  cleanup && cleanup(); cleanup = null;
  document.body.className = '';
  const { nome, params } = parseHash();
  const v = VISTE[nome] || VISTE[''];
  if (!v.pubblica && !db.staff) return renderLogin();
  if (!v.pubblica) startStore();
  const mod = await import(`./views/${v.file}.js`);
  if (my !== routeToken) return;
  let main;
  if (v.pubblica || v.pieno) {
    app().innerHTML = `<main class="pieno" id="vista"></main>`;
    main = $('#vista');
  } else {
    app().innerHTML = shell(nome, v, params);
    main = $('#vista');
    wireShell();
  }
  document.title = (v.tit || 'Comanda') + ' · Comanda Circolo';
  try { cleanup = await mod.mount(main, params) || null; }
  catch (e) { console.error(e); main.innerHTML = `<div class="avviso rosso">Errore: ${esc(e.message)}</div>`; }
}

function shell(nome, v, params) {
  const titolo = nome === 'reparto' && params[0] ? (S.info.reparti?.[params[0]]?.nome || params[0]) : v.tit;
  const gruppi = {};
  for (const [k, x] of Object.entries(VISTE)) if (x.gruppo) (gruppi[x.gruppo] ||= []).push([k, x]);
  const reparti = Object.entries(S.info.reparti || {}).sort((a, b) => (a[1].ordine ?? 9) - (b[1].ordine ?? 9));
  const link = (href, em, t, att) => `<a href="${href}" class="${att ? 'attivo' : ''}"><span class="em">${em}</span>${esc(t)}</a>`;
  let nav = link('#/', '🏠', 'Postazioni', nome === '');
  for (const [g, items] of Object.entries(gruppi)) {
    nav += `<h3>${g}</h3>`;
    for (const [k, x] of items) {
      if (k === 'reparto') { for (const [rk, r] of reparti) nav += link(`#/reparto/${rk}`, '🍳', r.nome, nome === 'reparto' && params[0] === rk); continue; }
      nav += link(`#/${k}`, x.em, x.tit, nome === k);
    }
  }
  nav += `<h3>Account</h3>`;
  if (db.mode === 'firebase') nav += `<a href="#" data-esci><span class="em">🚪</span>Esci (${esc(db.user?.email || '')})</a>`;
  else nav += `<a href="#/impostazioni"><span class="em">🧪</span>Modalità demo</a>`;
  return `
  <header class="barra no-stampa">
    <a href="#/" class="logo" style="color:#fff;text-decoration:none" aria-label="Postazioni">${esc((S.info.nome || 'C').trim()[0] || 'C')}</a>
    <div class="tit"><b>${esc(titolo)}</b><span>${esc(S.info.nome || 'Comanda Circolo')}</span></div>
    ${db.mode === 'demo' ? '<span class="pill-demo">DEMO</span>' : ''}
    <span class="pill-serata ${S.serata ? '' : 'chiusa'}" id="pill-serata">${S.serata ? 'Serata ' + S.serata.split('-').reverse().slice(0, 2).join('/') : 'Serata chiusa'}</span>
    <button class="icona" id="apri-menu" aria-label="Menù">☰</button>
  </header>
  <div class="cassetto" id="cassetto"><nav aria-label="Postazioni">${nav}</nav></div>
  <main id="vista"></main>`;
}
function wireShell() {
  const c = $('#cassetto');
  $('#apri-menu').onclick = () => c.classList.add('aperto');
  c.onclick = e => { if (e.target === c || e.target.closest('a')) c.classList.remove('aperto'); };
  const esci = c.querySelector('[data-esci]');
  if (esci) esci.onclick = async e => { e.preventDefault(); await signOutAll(); db.staff = null; location.hash = '#/'; route(); };
}
// aggiorna la pillola della serata senza ridisegnare tutto
onStore(() => {
  const sub = document.querySelector('.barra .tit span'); if (sub && S.info.nome) sub.textContent = S.info.nome;
  const lg = document.querySelector('.barra .logo'); if (lg && S.info.nome) lg.textContent = S.info.nome.trim()[0];
  const p = $('#pill-serata'); if (!p) return;
  p.className = 'pill-serata ' + (S.serata ? '' : 'chiusa');
  p.textContent = S.serata ? 'Serata ' + S.serata.split('-').reverse().slice(0, 2).join('/') : 'Serata chiusa';
});

/* ---------- accesso staff (solo online) ---------- */
function renderLogin(msg = '') {
  const inAttesa = db.user && !db.user.anonimo && !db.staff;
  app().innerHTML = `<main><div class="login card">
    <h1>Accesso staff</h1>
    ${inAttesa ? `<div class="avviso">Sei entrato come <b>${esc(db.user.email)}</b> ma l'account non è ancora abilitato.
       Chiedi all'amministratore di abilitarlo da <i>Impostazioni → Staff</i>.<br><button class="btn piccolo" id="ricarica" style="margin-top:.5rem">Ho fatto, riprova</button>
       <button class="btn piccolo piatto" id="esci">Esci</button></div>` : ''}
    <p class="tenue">Cassa, cameriere, cucina e regia richiedono un account. I clienti invece ordinano dal QR del tavolo, senza registrarsi.</p>
    ${msg ? `<div class="avviso rosso">${esc(msg)}</div>` : ''}
    <form id="f-login">
      <label class="campo">Email<input name="email" type="email" autocomplete="username" required></label>
      <label class="campo">Password<input name="pw" type="password" autocomplete="current-password" minlength="6" required></label>
      <button class="btn primario pieno grande" type="submit">Entra</button>
    </form>
    <hr>
    <details><summary class="tenue">Primo accesso o nuovo volontario?</summary>
      <p class="tenue" style="margin-top:.6rem">Crea un account con email e password. Il <b>primo account in assoluto</b> diventa amministratore; gli altri restano in attesa finché un amministratore non li abilita.</p>
      <button class="btn pieno" id="crea">Crea account con questi dati</button>
    </details>
  </div></main>`;
  const f = $('#f-login');
  const dati = () => ({ email: f.email.value.trim(), pw: f.pw.value });
  f.onsubmit = async e => {
    e.preventDefault();
    try { await signInStaff(dati().email, dati().pw); route(); }
    catch (err) { renderLogin(traduci(err)); }
  };
  $('#crea').onclick = async () => {
    const d = dati();
    if (!d.email || d.pw.length < 6) return toast('Inserisci email e una password di almeno 6 caratteri', 'err');
    try { await signUpStaff(d.email, d.pw); route(); }
    catch (err) { renderLogin(traduci(err)); }
  };
  $('#ricarica')?.addEventListener('click', async () => { await reloadStaff(); route(); });
  $('#esci')?.addEventListener('click', async () => { await signOutAll(); renderLogin(); });
}
function traduci(err) {
  const c = err?.code || '';
  if (c.includes('invalid-credential') || c.includes('wrong-password') || c.includes('user-not-found')) return 'Email o password non corrette.';
  if (c.includes('email-already-in-use')) return 'Esiste già un account con questa email: usa "Entra".';
  if (c.includes('weak-password')) return 'Password troppo debole (almeno 6 caratteri).';
  if (c.includes('operation-not-allowed')) return 'Su Firebase non è attivo l\'accesso con email/password (vedi README, passo 2).';
  if (c.includes('network')) return 'Connessione assente.';
  return err?.message || 'Errore di accesso.';
}

/* ---------- avvio ---------- */
(async function avvio() {
  try { await initDb(); }
  catch (e) {
    app().innerHTML = `<main><div class="avviso rosso"><b>Impossibile collegarsi a Firebase.</b><br>${esc(e.message)}<br>Controlla js/config.js.</div></main>`;
    return;
  }
  if (db.mode === 'demo' && demoIsEmpty()) {
    demoReset(seedTree());
    await apriSerata(oggi(), 50);
  }
  window.addEventListener('hashchange', route);
  route();
})();
