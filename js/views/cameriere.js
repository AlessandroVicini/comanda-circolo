import { S, onStore, ordiniLista, tavoliLista, etichettaOrdine, aperto } from '../store.js';
import { creaOrdineStaff, confermaOrdine, annullaOrdine, segnaServito, totaleRighe } from '../logic.js';
import { esc, euro, ora, trascorso, toast, conferma, modal, suono, $ } from '../util.js';
import { Carrello, htmlMenu, collegaMenu, htmlRiepilogoCarrello } from './picker.js';

const statoTag = o => ({
  da_confermare: '<span class="tag rosso">Da confermare</span>', inviato: '<span class="tag oro">In preparazione</span>',
  pronto: '<span class="tag verde">Pronto</span>', servito: '<span class="tag">Servito</span>', annullato: '<span class="tag rosso">Annullato</span>',
}[o.stato] || '') + (o.pagato ? ' <span class="tag blu">Pagato</span>' : '');

export function righeHtml(o, rep = null) {
  return `<ul>${(o.righe || []).filter(r => !rep || r.reparto === rep).map(r =>
    `<li><span class="q">${r.qta}×</span>${esc(r.nome)}${r.note ? `<span class="nota">${esc(r.note)}</span>` : ''}</li>`).join('')}</ul>`;
}

export function mount(main) {
  let scheda = 'tavoli', tavolo = null, quanti = -1;
  const carrello = new Carrello();
  main.innerHTML = `<div class="schede" id="cam-schede"></div><div id="cam-corpo"></div>`;

  const render = () => {
    const daConf = ordiniLista(o => o.stato === 'da_confermare');
    const pronti = ordiniLista(o => o.stato === 'pronto' && o.tavolo !== 'banco' && o.tavolo !== 'asporto');
    if (quanti >= 0 && daConf.length > quanti) { suono('nuovo'); toast('Nuovo ordine dal QR da confermare'); }
    quanti = daConf.length;
    $('#cam-schede', main).innerHTML = [['tavoli', 'Tavoli', 0], ['conferma', 'Da confermare', daConf.length], ['servire', 'Da servire', pronti.length]]
      .map(([k, t, n]) => `<button data-scheda="${k}" class="${scheda === k && !tavolo ? 'attivo' : ''}">${t}${n ? ` <span class="badge">${n}</span>` : ''}</button>`).join('');
    const c = $('#cam-corpo', main);
    if (tavolo) return renderTavolo(c);
    if (scheda === 'tavoli') renderTavoli(c);
    else if (scheda === 'conferma') c.innerHTML = daConf.length ? `<div class="tickets">${daConf.map(o => `
      <div class="ticket attesa"><div class="testa"><b>${esc(etichettaOrdine(o))}</b><span class="tenue">${trascorso(o.creato)}</span></div>
        ${o.socio ? `<div>👤 ${esc(o.socio)}</div>` : ''}${o.tavolo === 'asporto' ? `<div>🥡 Asporto da casa · ritiro <b>${esc(o.ritiro || '')}</b>${o.cliente?.tel ? ` · <a href="tel:${esc(o.cliente.tel)}">${esc(o.cliente.tel)}</a>` : ''}</div>` : ''}${righeHtml(o)}${o.nota ? `<div class="nota-ord">📝 ${esc(o.nota)}</div>` : ''}
        <div class="riga sp"><b>${euro(totaleRighe(o.righe))}</b><span class="tag">dal QR</span></div>
        <div class="riga"><button class="btn rosso" data-rifiuta="${o.id}">Rifiuta</button><button class="btn primario cresci" data-conferma="${o.id}">Conferma e invia</button></div>
      </div>`).join('')}</div>` : '<div class="vuoto">Nessun ordine dal QR in attesa.</div>';
    else c.innerHTML = pronti.length ? `<div class="tickets">${pronti.map(o => `
      <div class="ticket pronto"><div class="testa"><b>${esc(etichettaOrdine(o))}</b><span class="tenue">pronto da ${trascorso(o.prontoTs || o.creato)}</span></div>
        ${righeHtml(o)}<button class="btn primario" data-servito="${o.id}">Servito ✓</button></div>`).join('')}</div>` : '<div class="vuoto">Niente da portare ai tavoli.</div>';
  };

  function renderTavoli(c) {
    const lista = tavoliLista();
    c.innerHTML = lista.length ? `<div class="tavoli">${lista.map(([k, t]) => {
      const os = ordiniLista(o => o.tavolo === k && o.stato !== 'annullato');
      const nonPagati = os.filter(o => !o.pagato && o.stato !== 'da_confermare');
      const cls = os.some(o => o.stato === 'da_confermare') ? 'attesa' : os.some(o => o.stato === 'pronto') ? 'pronto' : nonPagati.length ? 'occupato' : '';
      const tot = nonPagati.reduce((s, o) => s + totaleRighe(o.righe), 0);
      return `<button class="tavolo ${cls}" data-tavolo="${esc(k)}"><b>${esc(t.nome || k)}</b><small>${tot ? euro(tot) : 'libero'}</small>
        ${cls === 'attesa' ? '<span class="badge">!</span>' : ''}</button>`;
    }).join('')}</div>
    <p class="tenue" style="margin-top:12px;font-size:.85rem">🟥 ordine dal QR da confermare · 🟩 qualcosa è pronto · 🟨 conto aperto</p>` :
      '<div class="vuoto">Nessun tavolo. Aggiungili da <a href="#/qr">Tavoli e QR</a>.</div>';
  }

  function renderTavolo(c) {
    const os = ordiniLista(o => o.tavolo === tavolo && o.stato !== 'annullato' && !(o.pagato && o.stato === 'servito'));
    const conto = os.filter(o => aperto(o) && !o.pagato).reduce((s, o) => s + totaleRighe(o.righe), 0);
    c.innerHTML = `
      <div class="riga sp" style="margin-bottom:8px"><button class="btn piatto" data-indietro>← Tavoli</button><h2 style="margin:0">Tavolo ${esc(S.tavoli[tavolo]?.nome || tavolo)}</h2><span class="tag oro">Conto ${euro(conto)}</span></div>
      ${os.length ? `<div class="griglia g2" style="margin-bottom:6px">${os.map(o => `<div class="card">
        <div class="riga sp"><span>${statoTag(o)}</span><small class="tenue">${ora(o.creato)}</small></div>
        <div style="font-size:.92rem;margin:.4rem 0">${(o.righe || []).map(r => `${r.qta}× ${esc(r.nome)}`).join(', ')}</div>
        <div class="riga">${o.stato === 'da_confermare' ? `<button class="btn piccolo primario" data-conferma="${o.id}">Conferma</button><button class="btn piccolo" data-rifiuta="${o.id}">Rifiuta</button>` : ''}
          ${o.stato === 'pronto' ? `<button class="btn piccolo primario" data-servito="${o.id}">Servito</button>` : ''}
          ${['inviato', 'pronto'].includes(o.stato) && !o.pagato ? `<button class="btn piccolo piatto" data-annulla="${o.id}">Annulla</button>` : ''}</div>
      </div>`).join('')}</div>` : ''}
      <div id="cam-menu">${htmlMenu(S.menu, carrello, { conNote: true })}</div>
      <div class="carrello" ${carrello.vuoto ? 'hidden' : ''}>
        <div class="riga"><button class="btn" data-vedi>Riepilogo (${carrello.pezzi()})</button>
        <button class="btn primario cresci grande" data-invia>Invia · ${euro(carrello.totale(S.menu.prodotti))}</button></div>
      </div>`;
  }

  async function invia(vedi = false) {
    if (carrello.vuoto) return;
    const r = await modal({ titolo: `Tavolo ${S.tavoli[tavolo]?.nome || tavolo}`, html: `<div id="riep">${htmlRiepilogoCarrello(carrello, S.menu.prodotti)}</div>
      <label class="campo">Nota per l'ordine<input name="nota" placeholder="facoltativa"></label>`,
      azioni: [{ id: 'no', label: 'Modifica' }, { id: 'ok', label: 'Invia ai reparti', cls: 'primario' }],
      onOpen: (w, close) => w.addEventListener('click', e => {
        const t = e.target.closest('[data-tog]'); if (!t) return;
        const [pid, ...n] = t.dataset.tog.split('|'); carrello.add(pid, -1, n.join('|'));
        w.querySelector('#riep').innerHTML = htmlRiepilogoCarrello(carrello, S.menu.prodotti); render();
        if (carrello.vuoto) close(null);
      }) });
    if (r?.azione !== 'ok' || carrello.vuoto) return;
    try {
      await creaOrdineStaff({ tavolo, righe: carrello.righe(S.menu.prodotti), nota: r.form.nota.trim(), origine: 'cameriere' });
      carrello.svuota(); toast('Ordine inviato', 'ok'); render();
    } catch (e) { console.error(e); toast('Errore: ' + e.message, 'err'); }
  }

  main.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    const d = b.dataset;
    if (d.scheda) { scheda = d.scheda; tavolo = null; render(); }
    else if (d.tavolo) { tavolo = d.tavolo; carrello.svuota(); render(); window.scrollTo(0, 0); }
    else if ('indietro' in d) { tavolo = null; scheda = 'tavoli'; render(); }
    else if (d.conferma) { await confermaOrdine(d.conferma); toast('Ordine confermato e inviato', 'ok'); }
    else if (d.rifiuta) { if (await conferma('Rifiutare questo ordine? Il cliente lo vedrà come annullato.', 'Rifiuta', 'rosso')) await annullaOrdine(d.rifiuta, 'rifiutato'); }
    else if (d.annulla) { if (await conferma('Annullare l\'ordine? Le quantità tornano in magazzino.', 'Annulla ordine', 'rosso')) await annullaOrdine(d.annulla, 'annullato dal cameriere'); }
    else if (d.servito) { await segnaServito(d.servito); }
    else if ('invia' in d || 'vedi' in d) invia();
  });
  collegaMenu(main, carrello, () => S.menu, render);
  render();
  return onStore(render);
}
