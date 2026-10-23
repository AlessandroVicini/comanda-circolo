import { S, onStore, ordiniLista, aperto, serataVista, etichettaOrdine } from '../store.js';
import { creaOrdineStaff, incassa, registraUscita, stornaMovimento, righeAggregate, totaleRighe, riepilogoAggregato } from '../logic.js';
import { esc, euro, ora, r2, parseNum, toast, conferma, modal, qrSvg, baseUrl, $ } from '../util.js';
import { Carrello, htmlMenu, collegaMenu, htmlRiepilogoCarrello } from './picker.js';

export function mount(main) {
  let scheda = 'conti', tav = null, sel = new Set(), metodo = 'contanti';
  const carrello = new Carrello();
  main.innerHTML = `<div class="schede" id="ca-schede"></div><div id="ca-corpo"></div>`;

  const conti = () => {
    const m = new Map();
    for (const o of ordiniLista(o => aperto(o) && !o.pagato && o.tavolo !== 'banco')) {
      const g = m.get(o.tavolo) || []; g.push(o); m.set(o.tavolo, g);
    }
    return [...m].sort((a, b) => (parseInt(a[0]) || 0) - (parseInt(b[0]) || 0));
  };

  const campi = ['ct-socio', 'bn-socio', 'ct-ric', 'bn-ric', 'us-descr', 'us-imp'];
  const render = () => {
    const salvati = {};
    for (const id of campi) { const el = main.querySelector('#' + id); if (el && el.value) salvati[id] = el.value; }
    disegna();
    for (const [id, v] of Object.entries(salvati)) { const el = main.querySelector('#' + id); if (el) { el.value = v; el.dispatchEvent(new Event('input')); } }
  };
  const pulisci = () => campi.forEach(id => { const el = main.querySelector('#' + id); if (el) el.value = ''; });
  const disegna = () => {
    const cs = conti();
    $('#ca-schede', main).innerHTML = [['conti', 'Conti tavoli', cs.length], ['banco', 'Vendita al banco', 0], ['uscita', 'Uscita / spesa', 0], ['movimenti', 'Movimenti', 0]]
      .map(([k, t, n]) => `<button data-scheda="${k}" class="${scheda === k ? 'attivo' : ''}">${t}${n ? ` <span class="badge">${n}</span>` : ''}</button>`).join('');
    const c = $('#ca-corpo', main);
    if (scheda === 'conti') renderConti(c, cs);
    else if (scheda === 'banco') renderBanco(c);
    else if (scheda === 'uscita') renderUscita(c);
    else renderMovimenti(c);
  };

  const pagamentoHtml = (tot, id) => `
    <div class="riga" style="margin:.6rem 0">
      <button class="btn ${metodo === 'contanti' ? 'primario' : ''} cresci" data-metodo="contanti">💶 Contanti</button>
      <button class="btn ${metodo === 'pos' ? 'primario' : ''} cresci" data-metodo="pos">💳 POS / carta</button>
    </div>
    <label class="campo">Socio (per la prima nota)<input id="${id}-socio" placeholder="Nome e cognome" autocomplete="off"></label>
    ${metodo === 'contanti' ? `<div class="riga"><label class="campo cresci">Ricevuto €<input id="${id}-ric" inputmode="decimal" placeholder="${tot.toFixed(2).replace('.', ',')}"></label>
      <div class="kpi cresci" style="margin-bottom:.75rem"><span>Resto</span><b id="${id}-resto">—</b></div></div>` : ''}`;
  const collegaResto = (id, tot) => {
    const i = $(`#${id}-ric`, main); if (!i) return;
    i.oninput = () => { const v = parseNum(i.value); $(`#${id}-resto`, main).textContent = v ? euro(r2(v - tot)) : '—'; };
  };

  function renderConti(c, cs) {
    if (tav && !cs.find(([k]) => k === tav)) tav = null;
    if (!cs.length) { c.innerHTML = '<div class="vuoto">Nessun conto aperto. 🎉</div>'; return; }
    const lista = `<div class="tavoli" style="margin-bottom:14px">${cs.map(([k, os]) =>
      `<button class="tavolo occupato ${tav === k ? 'pronto' : ''}" data-tav="${esc(k)}"><b>${esc(S.tavoli[k]?.nome || k)}</b><small>${euro(os.reduce((s, o) => s + totaleRighe(o.righe), 0))}</small></button>`).join('')}</div>`;
    if (!tav) { c.innerHTML = lista + '<p class="tenue">Scegli un tavolo per fare il conto.</p>'; return; }
    const os = cs.find(([k]) => k === tav)[1];
    if (!sel.size || [...sel].some(id => !os.find(o => o.id === id))) sel = new Set(os.map(o => o.id));
    const scelti = os.filter(o => sel.has(o.id));
    const righe = scelti.flatMap(o => o.righe || []);
    const tot = totaleRighe(righe);
    const socioPrec = scelti.find(o => o.socio)?.socio || '';
    c.innerHTML = lista + `<div class="griglia g2"><div class="card">
        <h2>Conto tavolo ${esc(S.tavoli[tav]?.nome || tav)}</h2>
        ${os.length > 1 ? `<p class="tenue" style="font-size:.85rem">Togli la spunta per far pagare solo una parte degli ordini.</p>${os.map(o =>
          `<label class="check"><input type="checkbox" data-sel="${o.id}" ${sel.has(o.id) ? 'checked' : ''}> ${ora(o.creato)} · ${euro(totaleRighe(o.righe))} <small class="tenue">${esc((o.righe || []).map(r => r.qta + '× ' + r.nome).join(', '))}</small></label>`).join('')}<hr>` : ''}
        <table class="tab"><tbody>${righeAggregate(righe).map(r => `<tr><td>${r.qta}×</td><td>${esc(r.nome)}</td><td class="n">${euro(r.prezzo)}</td><td class="n">${euro(r.prezzo * r.qta)}</td></tr>`).join('')}</tbody>
        <tfoot><tr><th colspan="3">Totale</th><th class="n" style="font-size:1.2rem">${euro(tot)}</th></tr></tfoot></table>
        <div class="riga" style="margin-top:.6rem"><button class="btn piccolo" data-dividi="${tot}">÷ Dividi alla romana</button></div>
      </div><div class="card">
        <h2>Pagamento</h2>${pagamentoHtml(tot, 'ct')}
        <button class="btn primario pieno grande" data-incassa ${tot ? '' : 'disabled'}>Incassa ${euro(tot)}</button>
      </div></div>`;
    if (socioPrec) $('#ct-socio', main).value = socioPrec;
    collegaResto('ct', tot);
  }

  function renderBanco(c) {
    const tot = carrello.totale(S.menu.prodotti);
    c.innerHTML = `<div class="griglia g2" style="align-items:start">
      <div>${htmlMenu(S.menu, carrello, { conNote: true })}</div>
      <div class="card" style="position:sticky;top:76px">
        <h2>Scontrino banco</h2><div id="bn-riep">${htmlRiepilogoCarrello(carrello, S.menu.prodotti)}</div>
        ${pagamentoHtml(tot, 'bn')}
        <button class="btn primario pieno grande" data-vendi ${carrello.vuoto ? 'disabled' : ''}>Incassa ${euro(tot)}</button>
        ${!carrello.vuoto ? '<button class="btn piatto pieno" data-svuota>Svuota</button>' : ''}
      </div></div>`;
    collegaResto('bn', tot);
  }

  function renderUscita(c) {
    c.innerHTML = `<div class="card" style="max-width:520px">
      <h2>Registra un'uscita</h2><p class="tenue">Spese pagate con i soldi della cassa (es. spesa al volo, ghiaccio, pane). Finiscono nella prima nota.</p>
      <label class="campo">Descrizione<input id="us-descr" placeholder="es. Pane per hamburger"></label>
      <label class="campo">Importo €<input id="us-imp" inputmode="decimal" placeholder="0,00"></label>
      <div class="riga" style="margin-bottom:.8rem"><button class="btn ${metodo === 'contanti' ? 'primario' : ''} cresci" data-metodo="contanti">Contanti</button><button class="btn ${metodo === 'pos' ? 'primario' : ''} cresci" data-metodo="pos">Carta / bonifico</button></div>
      <button class="btn rosso pieno grande" data-uscita>Registra uscita</button></div>`;
  }

  function renderMovimenti(c) {
    const ms = Object.entries(S.movimenti || {}).map(([id, m]) => ({ id, ...m })).sort((a, b) => b.ts - a.ts);
    const sum = (f) => r2(ms.filter(f).reduce((s, m) => s + (Number(m.importo) || 0), 0));
    const fondo = Number(S.serate?.[serataVista()]?.fondoCassa) || 0;
    const entC = sum(m => m.tipo === 'entrata' && m.metodo === 'contanti'), entP = sum(m => m.tipo === 'entrata' && m.metodo === 'pos');
    const uscC = sum(m => m.tipo === 'uscita' && m.metodo === 'contanti');
    c.innerHTML = `<div class="kpis">
        <div class="kpi"><span>Incasso contanti</span><b>${euro(entC)}</b></div>
        <div class="kpi"><span>Incasso POS</span><b>${euro(entP)}</b></div>
        <div class="kpi"><span>Uscite</span><b>${euro(sum(m => m.tipo === 'uscita'))}</b></div>
        <div class="kpi"><span>In cassa (fondo ${euro(fondo)})</span><b>${euro(fondo + entC - uscC)}</b></div>
      </div>
      ${ms.length ? `<div class="card scorri"><table class="tab"><thead><tr><th>Ora</th><th>Socio</th><th>Descrizione</th><th class="n">Importo</th><th>Metodo</th><th></th></tr></thead><tbody>
      ${ms.map(m => `<tr><td>${ora(m.ts)}</td><td>${esc(m.socio || '')}</td><td>${esc(m.descr || '')}${m.tavolo ? ` <small class="tenue">(${m.tavolo === 'banco' ? 'banco' : 'tav. ' + esc(m.tavolo)})</small>` : ''}</td>
        <td class="n" style="color:${m.tipo === 'uscita' ? 'var(--rosso)' : 'inherit'}">${m.tipo === 'uscita' ? '−' : ''}${euro(m.importo)}</td><td>${m.metodo === 'pos' ? 'POS' : 'Contanti'}</td>
        <td class="n"><button class="btn piccolo piatto" data-storna="${m.id}" title="Storna">↩</button></td></tr>`).join('')}
      </tbody></table></div>` : '<div class="vuoto">Nessun movimento in questa serata.</div>'}
      <p style="margin-top:12px"><a class="btn" href="#/primanota">📒 Apri la prima nota</a></p>`;
  }

  async function mostraNumero(o) {
    if (!o.avviso) return;
    const url = `${baseUrl()}#/s/${o.avviso}`;
    await modal({ titolo: `Numero ${o.num}`, html: `<p style="text-align:center">Il cliente inquadra il QR per essere avvisato sul telefono quando è pronto. Il numero compare anche sul display.</p>
      <div style="text-align:center;font-family:var(--font-t);font-size:4rem;font-weight:800;line-height:1">${o.num}</div>
      <div class="qr-box">${qrSvg(url, 230)}</div>`, azioni: [{ id: 'ok', label: 'Fatto', cls: 'primario' }] });
  }

  main.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    const d = b.dataset;
    if (d.scheda) { scheda = d.scheda; metodo = 'contanti'; render(); }
    else if (d.tav) { tav = d.tav; sel = new Set(); render(); }
    else if (d.metodo) { metodo = d.metodo; render(); }
    else if (d.dividi) {
      const r = await modal({ titolo: 'Dividi alla romana', html: `<label class="campo">Numero di persone<input name="n" type="number" min="2" value="2" inputmode="numeric"></label>`, azioni: [{ id: 'ok', label: 'Calcola', cls: 'primario' }] });
      if (r) { const n = Math.max(2, parseInt(r.form.n) || 2); toast(`${euro(Number(d.dividi) / n)} a testa (${n} persone)`); }
    }
    else if ('incassa' in d) {
      const os = ordiniLista(o => sel.has(o.id) && !o.pagato);
      if (!os.length) return;
      b.disabled = true;
      await incassa({ ordini: os.map(o => o.id), socio: $('#ct-socio', main).value.trim(), metodo, tavolo: tav, importo: totaleRighe(os.flatMap(o => o.righe || [])) });
      pulisci(); toast('Incassato ✓', 'ok'); tav = null; sel = new Set(); render();
    }
    else if ('vendi' in d) {
      if (carrello.vuoto) return;
      b.disabled = true;
      const socio = $('#bn-socio', main).value.trim();
      const righe = carrello.righe(S.menu.prodotti);
      try {
        const o = await creaOrdineStaff({ tavolo: 'banco', righe, socio, origine: 'banco' });
        await incassa({ ordini: [o.id], socio, metodo, tavolo: 'banco', importo: totaleRighe(righe), descr: riepilogoAggregato(righe) });
        carrello.svuota(); pulisci(); render(); toast('Incassato ✓', 'ok');
        await mostraNumero(o);
      } catch (err) { console.error(err); toast('Errore: ' + err.message, 'err'); b.disabled = false; }
    }
    else if ('svuota' in d) { carrello.svuota(); render(); }
    else if (d.tog) { const [pid, ...n] = d.tog.split('|'); carrello.add(pid, -1, n.join('|')); render(); }
    else if ('uscita' in d) {
      const descr = $('#us-descr', main).value.trim(), imp = parseNum($('#us-imp', main).value);
      if (!descr || !imp) return toast('Scrivi descrizione e importo', 'err');
      await registraUscita({ descr, importo: imp, metodo }); pulisci(); toast('Uscita registrata', 'ok'); scheda = 'movimenti'; render();
    }
    else if (d.storna) {
      if (await conferma('Stornare questo movimento? Gli ordini collegati tornano da pagare.', 'Storna', 'rosso')) { await stornaMovimento(serataVista(), d.storna); toast('Movimento stornato'); }
    }
  });
  main.addEventListener('change', e => {
    const x = e.target.closest('[data-sel]'); if (!x) return;
    x.checked ? sel.add(x.dataset.sel) : sel.delete(x.dataset.sel);
    if (!sel.size) { sel.add(x.dataset.sel); x.checked = true; }
    render();
  });
  collegaMenu(main, carrello, () => S.menu, render);
  render();
  // evita di ridisegnare mentre si sta scrivendo in un campo
  return onStore(() => { const a = document.activeElement; if (a && main.contains(a) && a.tagName === 'INPUT') return; render(); });
}
