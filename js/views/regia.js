import { S, onStore, ordiniLista, etichettaOrdine, sottoScorta, aperto, repartiLista, nomeReparto } from '../store.js';
import { apriSerata, chiudiSerata, confermaOrdine, annullaOrdine, segnaServito, richiama, chiamaNumero, totaleRighe, righeAggregate } from '../logic.js';
import { update } from '../db.js';
import { esc, euro, ora, oggi, r2, parseNum, toast, conferma, modal, trascorso, dataLunga, $ } from '../util.js';

const STATI = { da_confermare: ['Da confermare', 'rosso'], inviato: ['In preparazione', 'oro'], pronto: ['Pronto', 'verde'], servito: ['Servito', ''], annullato: ['Annullato', 'rosso'] };

export function mount(main) {
  let filtro = 'attivi';
  main.innerHTML = `<div id="rg"></div>`;
  const render = () => {
    const ms = Object.values(S.movimenti || {});
    const ent = f => r2(ms.filter(m => m.tipo === 'entrata' && f(m)).reduce((s, m) => s + (Number(m.importo) || 0), 0));
    const tutti = ordiniLista();
    const n = st => tutti.filter(o => o.stato === st).length;
    const contiAperti = r2(tutti.filter(o => aperto(o) && !o.pagato).reduce((s, o) => s + totaleRighe(o.righe), 0));
    const bassi = sottoScorta();
    const vista = tutti.filter(o => filtro === 'tutti' ? true : filtro === 'attivi' ? ['da_confermare', 'inviato', 'pronto'].includes(o.stato) : filtro === 'nonpagati' ? aperto(o) && !o.pagato : o.stato === filtro).reverse();
    const top = righeAggregate(tutti.filter(aperto).flatMap(o => o.righe || [])).sort((a, b) => b.qta - a.qta).slice(0, 8);
    const coda = repartiLista().map(([k, r]) => [r.nome, tutti.filter(o => o.stato === 'inviato' && o.reparti?.[k] === 'attesa').length]);
    $('#rg', main).innerHTML = `
      <div class="griglia g2" style="margin-bottom:12px">
        <div class="card">${S.serata ? `
          <div class="riga sp"><div><span class="tag verde">Serata aperta</span><h2 style="margin:.4rem 0 0">${dataLunga(S.serata)}</h2></div>
          <button class="btn rosso" data-chiudi>Chiudi serata</button></div>` : `
          <div class="riga sp"><div><span class="tag rosso">Serata chiusa</span><h2 style="margin:.4rem 0 0">Nessuna serata in corso</h2></div>
          <button class="btn primario" data-apri>Apri serata</button></div>`}
          <hr><label class="check" style="margin:0"><input type="checkbox" id="rg-qr" ${S.info.qrAttivo ? 'checked' : ''}> Ordinazione dal QR dei tavoli attiva</label>
        </div>
        <div class="card"><h3>📣 Chiama sul display</h3>
          <div class="riga"><input id="rg-ch" class="cresci" placeholder="es. Tavolo 7, Numero 12, Signor Rossi"><button class="btn oro" data-chiama>Chiama</button></div>
          ${S.stato?.chiamata && Date.now() - S.stato.chiamata.ts < 60000 ? `<p class="tenue" style="margin:.5rem 0 0">Sul display ora: <b>${esc(S.stato.chiamata.testo)}</b> <button class="btn piccolo piatto" data-togli-ch>Togli</button></p>` : ''}
        </div>
      </div>
      <div class="kpis">
        <div class="kpi"><span>Incassato</span><b>${euro(ent(() => true))}</b></div>
        <div class="kpi"><span>di cui POS</span><b>${euro(ent(m => m.metodo === 'pos'))}</b></div>
        <div class="kpi"><span>Conti aperti</span><b>${euro(contiAperti)}</b></div>
        <div class="kpi"><span>Da confermare</span><b style="color:${n('da_confermare') ? 'var(--rosso)' : 'inherit'}">${n('da_confermare')}</b></div>
        <div class="kpi"><span>In preparazione</span><b>${n('inviato')}</b></div>
        <div class="kpi"><span>Pronti da ritirare</span><b>${n('pronto')}</b></div>
      </div>
      ${bassi.length ? `<div class="avviso rosso">📦 Sotto scorta: ${bassi.map(([, i]) => esc(i.nome)).join(', ')}. <a href="#/magazzino">Vai al magazzino</a></div>` : ''}
      <div class="griglia" style="grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));align-items:start">
        <div class="card">
          <div class="riga sp"><h2 style="margin:0">Ordini</h2><div class="schede" style="margin:0">${[['attivi', 'In corso'], ['nonpagati', 'Da pagare'], ['servito', 'Serviti'], ['annullato', 'Annullati'], ['tutti', 'Tutti']]
            .map(([k, t]) => `<button data-filtro="${k}" class="${filtro === k ? 'attivo' : ''}">${t}</button>`).join('')}</div></div>
          <div class="scorri"><table class="tab"><tbody>${vista.map(o => `<tr>
            <td><b>${esc(etichettaOrdine(o))}</b><br><small class="tenue">n. ${o.num || '—'} · ${ora(o.creato)} · ${o.origine === 'qr' ? 'QR' : o.origine === 'banco' ? 'banco' : 'cameriere'}</small></td>
            <td><span class="tag ${STATI[o.stato]?.[1] || ''}">${STATI[o.stato]?.[0] || o.stato}</span>${o.pagato ? ' <span class="tag blu">Pagato</span>' : ''}
              ${o.stato === 'inviato' ? `<br><small class="tenue">${Object.entries(o.reparti || {}).map(([k, v]) => `${esc(nomeReparto(k))} ${v === 'pronto' ? '✓' : '…'}`).join(' · ')} · ${trascorso(o.confermato || o.creato)}</small>` : ''}
              <br><small>${esc((o.righe || []).map(r => r.qta + '× ' + r.nome).join(', '))}</small></td>
            <td class="n">${euro(totaleRighe(o.righe))}<br>
              ${o.stato === 'da_confermare' ? `<button class="btn piccolo primario" data-conferma="${o.id}">Conferma</button>` : ''}
              ${o.stato === 'pronto' ? `<button class="btn piccolo" data-servito="${o.id}">Servito</button>` : ''}
              ${o.stato === 'servito' ? `<button class="btn piccolo" data-richiama="${o.id}" title="Rimetti sul display">Richiama</button>` : ''}
              ${!['annullato', 'servito'].includes(o.stato) && !o.pagato ? `<button class="btn piccolo piatto" data-annulla="${o.id}">Annulla</button>` : ''}</td></tr>`).join('') || '<tr><td class="tenue">Nessun ordine.</td></tr>'}
          </tbody></table></div>
        </div>
        <div>
          <div class="card"><h3>Code dei reparti</h3>${coda.map(([nm, q]) => `<div class="riga sp"><span>${esc(nm)}</span><span class="tag ${q > 4 ? 'rosso' : q ? 'oro' : 'verde'}">${q} in coda</span></div>`).join('')}</div>
          <div class="card"><h3>Più venduti stasera</h3>${top.length ? `<table class="tab"><tbody>${top.map(t => `<tr><td>${esc(t.nome)}</td><td class="n">${t.qta}</td></tr>`).join('')}</tbody></table>` : '<p class="tenue">Ancora niente.</p>'}</div>
          <div class="card"><h3>Apri le postazioni</h3><div class="riga">
            <a class="btn piccolo" href="#/display" target="_blank" rel="noopener">📺 Display</a>
            ${repartiLista().map(([k, r]) => `<a class="btn piccolo" href="#/reparto/${k}" target="_blank" rel="noopener">🍳 ${esc(r.nome)}</a>`).join('')}
            <a class="btn piccolo" href="#/cassa" target="_blank" rel="noopener">💶 Cassa</a><a class="btn piccolo" href="#/cameriere" target="_blank" rel="noopener">🧾 Cameriere</a></div></div>
        </div>
      </div>`;
  };

  main.addEventListener('change', async e => { if (e.target.id === 'rg-qr') { await update('pubblico/info', { qrAttivo: e.target.checked }); toast(e.target.checked ? 'QR attivo' : 'QR disattivato'); } });
  main.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    const d = b.dataset;
    if (d.filtro) { filtro = d.filtro; render(); }
    else if ('apri' in d) {
      const r = await modal({ titolo: 'Apri serata', html: `<label class="campo">Data<input name="data" type="date" value="${oggi()}"></label>
        <label class="campo">Fondo cassa iniziale €<input name="fondo" inputmode="decimal" placeholder="es. 50"></label>
        <label class="check"><input type="checkbox" name="qr" checked> Attiva l'ordinazione dal QR</label>`, azioni: [{ id: 'no', label: 'Annulla' }, { id: 'ok', label: 'Apri', cls: 'primario' }] });
      if (r?.azione === 'ok') { await apriSerata(r.form.data || oggi(), parseNum(r.form.fondo)); await update('pubblico/info', { qrAttivo: r.form.qr }); toast('Serata aperta', 'ok'); }
    }
    else if ('chiudi' in d) {
      const aperti = ordiniLista(o => aperto(o) && !o.pagato).length;
      if (await conferma(`${aperti ? `Ci sono ancora ${aperti} ordini non pagati. ` : ''}Chiudendo la serata i QR smettono di accettare ordini e i telefoni dei clienti si azzerano. La prima nota resta consultabile.`, 'Chiudi serata', 'rosso')) {
        await chiudiSerata(); toast('Serata chiusa');
      }
    }
    else if ('chiama' in d) { const t = $('#rg-ch', main).value.trim(); if (t) { await chiamaNumero(t); $('#rg-ch', main).value = ''; toast('Chiamato sul display', 'ok'); } }
    else if ('togliCh' in d) await chiamaNumero(null);
    else if (d.conferma) await confermaOrdine(d.conferma);
    else if (d.servito) await segnaServito(d.servito);
    else if (d.richiama) { await richiama(d.richiama); toast('Rimesso sul display e cliente riavvisato'); }
    else if (d.annulla) { if (await conferma('Annullare l\'ordine? Gli ingredienti tornano in magazzino.', 'Annulla ordine', 'rosso')) await annullaOrdine(d.annulla, 'annullato dalla regia'); }
  });
  render();
  const t = setInterval(render, 30000);
  const off = onStore(() => { if (document.activeElement?.id === 'rg-ch') return; render(); });
  return () => { off(); clearInterval(t); };
}
