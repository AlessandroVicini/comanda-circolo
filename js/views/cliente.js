// Pagina del cliente aperta dal QR del tavolo: #/t/<tavolo>/<token>
import { db, on, set, newKey, signInGuest } from '../db.js';
import { esc, euro, modal, toast, $ } from '../util.js';
import { Carrello, htmlMenu, collegaMenu, htmlRiepilogoCarrello } from './picker.js';
import { attivaAvvisi, controllaPronti, htmlStatoOrdine, htmlBoxAvvisi } from './avvisi.js';

export async function mount(main, [tavolo, tok]) {
  if (!tavolo || !tok) { main.innerHTML = '<div class="avviso rosso">QR non valido.</div>'; return; }
  main.style.maxWidth = '640px'; main.style.margin = '0 auto';
  try { await signInGuest(); }
  catch (e) { main.innerHTML = `<div class="avviso rosso">Non riesco a collegarmi. Controlla la connessione e riprova.<br><small>${esc(e.message)}</small></div>`; return; }

  const carrello = new Carrello();
  let info = {}, menu = { categorie: {}, prodotti: {} }, avvisi = {};
  const lsKey = 'miei-ordini-' + tok;
  const pendenti = () => { try { return JSON.parse(localStorage.getItem(lsKey)) || []; } catch { return []; } };

  main.innerHTML = `${db.mode === 'demo' ? '<p class="no-stampa" style="margin:0"><a href="#/">← Demo: torna alle postazioni dello staff</a></p>' : ''}
    <div class="cliente-testa"><div class="tav">Tavolo ${esc(tavolo)}</div><h1 id="c-nome">…</h1><p class="tenue" id="c-sotto"></p></div>
    <div id="c-avvisi"></div>
    <div id="c-miei" class="miei"></div>
    <div id="c-menu"></div>
    <div class="carrello" id="c-carr" hidden></div>`;

  const renderTesta = () => {
    $('#c-nome', main).textContent = info.nome || 'Benvenuto';
    const puo = info.serata && info.qrAttivo;
    $('#c-sotto', main).innerHTML = puo ? 'Scegli dal menù e invia l\'ordine: lo prepariamo e ti avvisiamo qui.' :
      '<span class="tag rosso">Ordinazione dal tavolo non attiva</span><br>Puoi ordinare al banco o dal cameriere: ti avvisiamo qui quando è pronto.';
  };
  const renderAvvisi = () => {
    $('#c-avvisi', main).innerHTML = htmlBoxAvvisi();
    $('#attiva-avvisi', main)?.addEventListener('click', async () => { await attivaAvvisi(); renderAvvisi(); toast('Avvisi attivati', 'ok'); });
  };
  const renderMiei = () => {
    const correnti = Object.entries(avvisi).filter(([, o]) => !info.serata || o.serata === info.serata)
      .sort((a, b) => (b[1].ts || 0) - (a[1].ts || 0));
    const noti = new Set(correnti.map(([id]) => id));
    const pend = pendenti().filter(p => !noti.has(p.id) && Date.now() - p.ts < 6 * 3600e3);
    if (!correnti.length && !pend.length) { $('#c-miei', main).innerHTML = ''; return; }
    $('#c-miei', main).innerHTML = `<h3 class="cat-tit">Ordini del tavolo</h3>` +
      pend.map(p => htmlStatoOrdine(p, true)).join('') + correnti.map(([, o]) => htmlStatoOrdine(o)).join('');
  };
  const renderMenu = () => {
    const puo = info.serata && info.qrAttivo;
    $('#c-menu', main).innerHTML = puo ? htmlMenu(menu, carrello) : '';
    renderCarrello();
  };
  const renderCarrello = () => {
    const c = $('#c-carr', main);
    const puo = info.serata && info.qrAttivo;
    if (!puo || carrello.vuoto) { c.hidden = true; return; }
    c.hidden = false;
    c.innerHTML = `<button class="btn primario pieno grande" id="c-invia">Vedi ordine · ${carrello.pezzi()} ${carrello.pezzi() === 1 ? 'prodotto' : 'prodotti'} · ${euro(carrello.totale(menu.prodotti))}</button>`;
    $('#c-invia', main).onclick = invia;
  };

  async function invia() {
    const r = await modal({
      titolo: 'Il tuo ordine',
      html: `<div id="riep">${htmlRiepilogoCarrello(carrello, menu.prodotti)}</div>
        <label class="campo">Il tuo nome (socio)<input name="socio" autocomplete="name" placeholder="facoltativo" value="${esc(localStorage.getItem('nome-socio') || '')}"></label>
        <label class="campo">Note per la cucina<textarea name="nota" rows="2" placeholder="es. allergie, senza cipolla…"></textarea></label>
        <p class="tenue" style="font-size:.85rem">Il pagamento si fa alla cassa. L'ordine viene confermato dallo staff.</p>`,
      azioni: [{ id: 'no', label: 'Continua a scegliere' }, { id: 'ok', label: 'Invia ordine', cls: 'primario' }],
      onOpen: (w, close) => w.addEventListener('click', e => {
        const t = e.target.closest('[data-tog]'); if (!t) return;
        const [pid, ...n] = t.dataset.tog.split('|'); carrello.add(pid, -1, n.join('|'));
        w.querySelector('#riep').innerHTML = htmlRiepilogoCarrello(carrello, menu.prodotti); renderMenu();
        if (carrello.vuoto) close(null);
      }),
    });
    if (r?.azione !== 'ok' || carrello.vuoto) return;
    const righe = carrello.righe(menu.prodotti);
    const id = newKey('ordini');
    const socio = r.form.socio.trim();
    if (socio) localStorage.setItem('nome-socio', socio);
    const ordine = {
      tavolo: String(tavolo), token: tok, avviso: tok, uid: db.user?.uid || 'ospite', origine: 'qr', stato: 'da_confermare',
      righe, nota: r.form.nota.trim(), socio, serata: info.serata, pagato: false, creato: Date.now(),
      totale: Math.round(righe.reduce((s, x) => s + x.prezzo * x.qta, 0) * 100) / 100,
    };
    try {
      await set('ordini/' + id, ordine);
      const p = pendenti(); p.push({ id, ts: Date.now(), riepilogo: righe.map(x => `${x.qta}× ${x.nome}`).join(', ') });
      localStorage.setItem(lsKey, JSON.stringify(p.slice(-20)));
      carrello.svuota(); renderMenu(); renderMiei();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      toast('Ordine inviato!', 'ok');
      if (localStorage.getItem('avvisi-attivi') !== '1') {
        const a = await modal({ titolo: 'Ordine inviato 🎉', html: '<p>Vuoi che il telefono suoni e vibri quando è pronto?</p>', azioni: [{ id: 'no', label: 'No grazie' }, { id: 'si', label: 'Sì, avvisami', cls: 'primario' }] });
        if (a?.azione === 'si') { await attivaAvvisi(); renderAvvisi(); }
      }
    } catch (e) {
      console.error(e);
      toast('Ordine non accettato: il QR potrebbe essere scaduto o la serata chiusa. Chiedi al banco.', 'err');
    }
  }

  collegaMenu(main, carrello, () => menu, () => renderMenu());
  const unsub = [
    on('pubblico/info', v => { info = v || {}; renderTesta(); renderMenu(); renderMiei(); }),
    on('pubblico/menu', v => { menu = v || { categorie: {}, prodotti: {} }; menu.prodotti ||= {}; renderMenu(); }),
    on('avvisi/' + tok + '/ordini', v => { avvisi = v || {}; renderMiei(); controllaPronti(avvisi, tok, info.msgPronto); }),
  ];
  renderAvvisi();
  return () => unsub.forEach(u => u());
}
