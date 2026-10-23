// Pagina pubblica per ordinare le pizze da asporto: #/a/<codice>
import { db, on, set, newKey, signInGuest } from '../db.js';
import { esc, euro, modal, toast, $, cfgAsporto, perAsporto, fasceAsporto, tsRitiro, pezziDi, codice, telLink } from '../util.js';
import { Carrello, htmlMenu, collegaMenu, htmlRiepilogoCarrello } from './picker.js';
import { attivaAvvisi, controllaPronti, htmlStatoOrdine, htmlBoxAvvisi } from './avvisi.js';

export async function mount(main, [tok]) {
  main.style.maxWidth = '640px'; main.style.margin = '0 auto';
  try { await signInGuest(); }
  catch (e) { main.innerHTML = `<div class="avviso rosso">Non riesco a collegarmi. Controlla la connessione e riprova.</div>`; return; }

  const carrello = new Carrello();
  let info = {}, menu = { categorie: {}, prodotti: {} }, prenotate = {}, unFasce = null, serataSub = null;
  const avvisi = {}, unAvvisi = {};
  const lsKey = 'miei-asporti';
  const miei = () => { try { return JSON.parse(localStorage.getItem(lsKey)) || []; } catch { return []; } };

  main.innerHTML = `${db.mode === 'demo' ? '<p class="no-stampa" style="margin:0"><a href="#/">← Demo: torna alle postazioni dello staff</a></p>' : ''}
    <div class="cliente-testa"><div class="tav">🥡 Pizze da asporto</div><h1 id="a-nome">…</h1><p class="tenue" id="a-sotto"></p></div>
    <div id="a-avvisi"></div><div id="a-miei" class="miei"></div><div id="a-menu"></div>
    <div class="carrello" id="a-carr" hidden></div>`;

  const menuAsporto = () => ({ categorie: menu.categorie || {}, prodotti: Object.fromEntries(Object.entries(menu.prodotti || {}).filter(([, p]) => perAsporto(p))) });
  const aperto = () => { const c = cfgAsporto(info); return !!(info.serata && c.attivo && c.online); };
  const fasceLibere = (pezzi = 0) => {
    const c = cfgAsporto(info), ora = Date.now() + (Number(c.anticipo) || 0) * 60000;
    return fasceAsporto(c).map(f => {
      const usate = Number(prenotate[f]) || 0, max = Number(c.maxPerFascia) || 0;
      return { f, usate, max, libere: max ? max - usate : 99, passata: tsRitiro(info.serata, f) < ora };
    }).filter(x => !x.passata).map(x => ({ ...x, ok: !x.max || x.usate + pezzi <= x.max }));
  };

  const renderTesta = () => {
    $('#a-nome', main).textContent = info.nome || 'Asporto';
    const libere = aperto() ? fasceLibere(1).filter(x => x.ok) : [];
    $('#a-sotto', main).innerHTML = !aperto() ? '<span class="tag rosso">Ordini da asporto chiusi in questo momento</span>'
      : libere.length ? `Scegli le pizze, l'orario di ritiro e invia: ti confermiamo l'ordine e ti avvisiamo quando è pronto.`
      : '<span class="tag rosso">Stasera gli orari di ritiro sono tutti pieni</span>';
  };
  const renderAvvisi = () => {
    $('#a-avvisi', main).innerHTML = miei().length ? htmlBoxAvvisi() : '';
    $('#attiva-avvisi', main)?.addEventListener('click', async () => { await attivaAvvisi(); renderAvvisi(); toast('Avvisi attivati', 'ok'); });
  };
  const renderMiei = () => {
    const l = miei().filter(m => Date.now() - m.ts < 12 * 3600e3).reverse();
    if (!l.length) { $('#a-miei', main).innerHTML = ''; return; }
    $('#a-miei', main).innerHTML = `<h3 class="cat-tit">I tuoi ordini</h3>` + l.map(m => {
      const ord = Object.values(avvisi[m.k] || {})[0];
      return htmlStatoOrdine(ord ? { ...ord, riepilogo: `Ritiro alle ${ord.ritiro || m.ritiro} · ${ord.riepilogo}` } : { riepilogo: `Ritiro alle ${m.ritiro} · ${m.riepilogo}` }, !ord);
    }).join('');
  };
  const renderMenu = () => {
    $('#a-menu', main).innerHTML = aperto() ? htmlMenu(menuAsporto(), carrello) : '';
    const c = $('#a-carr', main);
    if (!aperto() || carrello.vuoto) { c.hidden = true; return; }
    c.hidden = false;
    c.innerHTML = `<button class="btn primario pieno grande" id="a-invia">Continua · ${carrello.pezzi()} ${carrello.pezzi() === 1 ? 'pizza' : 'pizze'} · ${euro(carrello.totale(menu.prodotti))}</button>`;
    $('#a-invia', main).onclick = invia;
  };
  const ascoltaMiei = () => {
    for (const m of miei()) if (!unAvvisi[m.k]) unAvvisi[m.k] = on('avvisi/' + m.k + '/ordini', v => { avvisi[m.k] = v || {}; renderMiei(); controllaPronti(v || {}, m.k, info.msgPronto); });
  };

  async function invia() {
    const pezzi = carrello.pezzi();
    const fasce = fasceLibere(pezzi);
    if (!fasce.some(x => x.ok)) return toast('Non ci sono orari con posto per ' + pezzi + ' pizze. Prova con meno pizze o chiama il circolo.', 'err');
    const r = await modal({
      titolo: 'Il tuo asporto', html: `<div id="riep">${htmlRiepilogoCarrello(carrello, menu.prodotti)}</div>
        <label class="campo">Orario di ritiro<select name="ritiro">${fasce.map(x => `<option value="${x.f}" ${x.ok ? '' : 'disabled'}>${x.f}${x.ok ? '' : ' (pieno)'}</option>`).join('')}</select></label>
        <label class="campo">Nome e cognome<input name="nome" autocomplete="name" required value="${esc(localStorage.getItem('nome-socio') || '')}"></label>
        <label class="campo">Telefono<input name="tel" type="tel" autocomplete="tel" inputmode="tel" placeholder="per eventuali comunicazioni" value="${esc(localStorage.getItem('tel-asporto') || '')}"></label>
        <label class="campo">Note<textarea name="nota" rows="2" placeholder="es. tagliata a spicchi, allergie…"></textarea></label>
        <p class="tenue" style="font-size:.85rem">Paghi al ritiro. L'ordine vale dopo la conferma del circolo, che vedi qui sotto.</p>`,
      azioni: [{ id: 'no', label: 'Modifica' }, { id: 'ok', label: 'Invia ordine', cls: 'primario' }],
      onOpen: (w, close) => w.addEventListener('click', e => {
        const t = e.target.closest('[data-tog]'); if (!t) return;
        const [pid, ...n] = t.dataset.tog.split('|'); carrello.add(pid, -1, n.join('|'));
        w.querySelector('#riep').innerHTML = htmlRiepilogoCarrello(carrello, menu.prodotti); renderMenu();
        if (carrello.vuoto) close(null);
      }),
    });
    if (r?.azione !== 'ok' || carrello.vuoto) return;
    const nome = r.form.nome.trim(), tel = telLink(r.form.tel);
    if (!nome) return toast('Scrivi il tuo nome', 'err');
    if (!fasceLibere(carrello.pezzi()).find(x => x.f === r.form.ritiro && x.ok)) return toast('Quell\'orario si è appena riempito: scegline un altro', 'err');
    localStorage.setItem('nome-socio', nome); if (tel) localStorage.setItem('tel-asporto', tel);
    const righe = carrello.righe(menu.prodotti).filter(x => perAsporto(menu.prodotti[x.pid]));
    const k = codice(), id = newKey('ordini');
    const ordine = {
      tavolo: 'asporto', token: tok, avviso: k, uid: db.user?.uid || 'ospite', origine: 'asporto_online', stato: 'da_confermare',
      righe, cliente: { nome, tel }, ritiro: r.form.ritiro, nota: r.form.nota.trim(), serata: info.serata, pagato: false, creato: Date.now(),
      totale: Math.round(righe.reduce((s, x) => s + x.prezzo * x.qta, 0) * 100) / 100,
    };
    try {
      await set('ordini/' + id, ordine);
      const l = miei(); l.push({ k, ts: Date.now(), ritiro: ordine.ritiro, riepilogo: righe.map(x => `${x.qta}× ${x.nome}`).join(', ') });
      localStorage.setItem(lsKey, JSON.stringify(l.slice(-10)));
      carrello.svuota(); ascoltaMiei(); renderMenu(); renderMiei(); renderAvvisi();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      toast('Ordine inviato: attendi la conferma', 'ok');
      if (localStorage.getItem('avvisi-attivi') !== '1') {
        const a = await modal({ titolo: 'Ordine inviato 🍕', html: `<p>Ritiro alle <b>${esc(ordine.ritiro)}</b>. Vuoi che il telefono suoni quando le pizze sono pronte? Tieni aperta questa pagina.</p>`, azioni: [{ id: 'no', label: 'No grazie' }, { id: 'si', label: 'Sì, avvisami', cls: 'primario' }] });
        if (a?.azione === 'si') { await attivaAvvisi(); renderAvvisi(); }
      }
    } catch (e) {
      console.error(e);
      toast('Ordine non accettato: l\'asporto potrebbe essere chiuso. Chiama il circolo.', 'err');
    }
  }

  collegaMenu(main, carrello, () => menuAsporto(), () => renderMenu());
  const un = [
    on('pubblico/info', v => {
      info = v || {};
      if (info.serata !== serataSub) { serataSub = info.serata; unFasce && unFasce(); unFasce = info.serata ? on(`pubblico/asporto/${info.serata}`, f => { prenotate = f || {}; renderTesta(); }) : null; }
      renderTesta(); renderMenu(); renderMiei();
    }),
    on('pubblico/menu', v => { menu = v || { categorie: {}, prodotti: {} }; menu.prodotti ||= {}; renderMenu(); }),
  ];
  ascoltaMiei(); renderAvvisi(); renderMiei();
  return () => { un.forEach(u => u()); unFasce && unFasce(); Object.values(unAvvisi).forEach(u => u()); };
}
