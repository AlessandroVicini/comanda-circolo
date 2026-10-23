import { S, onStore, ordiniLista, etichettaOrdine, nomeReparto } from '../store.js';
import { segnaProntoReparto } from '../logic.js';
import { esc, trascorso, suono, toast, $ } from '../util.js';
import { righeHtml } from './cameriere.js';

export function mount(main, [rep]) {
  document.body.classList.add('reparto-mode');
  let visti = null;
  main.innerHTML = `<div id="rp"></div>`;
  const render = () => {
    if (!rep || !S.info.reparti?.[rep]) {
      $('#rp', main).innerHTML = `<div class="vuoto">Reparto non trovato. Scegline uno dal menù ☰.</div>`; return;
    }
    const coda = ordiniLista(o => o.stato === 'inviato' && o.reparti?.[rep] === 'attesa');
    const fatti = ordiniLista(o => o.reparti?.[rep] === 'pronto' && o.stato !== 'annullato').reverse().slice(0, 6);
    const ids = new Set(coda.map(o => o.id));
    if (visti && [...ids].some(i => !visti.has(i))) { suono('nuovo'); }
    visti = ids;
    const tot = new Map();
    for (const o of coda) for (const r of o.righe || []) if (r.reparto === rep) tot.set(r.nome, (tot.get(r.nome) || 0) + r.qta);
    $('#rp', main).innerHTML = `
      <div class="riga sp" style="margin-bottom:10px"><h1 style="margin:0">${esc(nomeReparto(rep))} <span class="tag oro">${coda.length} in coda</span></h1></div>
      ${tot.size ? `<div class="card" style="margin-bottom:12px"><b>Da preparare in tutto:</b> ${[...tot].map(([n, q]) => `<span class="tag" style="font-size:.9rem;margin:2px">${q}× ${esc(n)}</span>`).join(' ')}</div>` : ''}
      ${coda.length ? `<div class="tickets">${coda.map(o => {
        const min = (Date.now() - (o.confermato || o.creato)) / 60000;
        const altri = Object.keys(o.reparti || {}).filter(k => k !== rep);
        return `<div class="ticket ${min > 15 ? 'vecchio' : ''}">
          <div class="testa"><b>${esc(etichettaOrdine(o))}</b><span class="${min > 15 ? '' : 'tenue'}" style="${min > 15 ? 'color:var(--rosso);font-weight:800' : ''}">${trascorso(o.confermato || o.creato)}</span></div>
          ${righeHtml(o, rep)}
          ${o.nota ? `<div class="nota-ord">📝 ${esc(o.nota)}</div>` : ''}
          ${altri.length ? `<small class="tenue">Anche: ${altri.map(k => `${esc(nomeReparto(k))} ${o.reparti[k] === 'pronto' ? '✓' : '…'}`).join(', ')}</small>` : ''}
          <button class="btn primario grande" data-pronto="${o.id}">Pronto ✓</button>
        </div>`;
      }).join('')}</div>` : '<div class="vuoto">Nessuna preparazione in coda. 👌</div>'}
      ${fatti.length ? `<h3 class="cat-tit">Appena fatti</h3><div class="riga">${fatti.map(o =>
        `<button class="btn piccolo" data-annulla="${o.id}" title="Rimetti in coda">↩ ${esc(etichettaOrdine(o))}</button>`).join('')}</div>` : ''}`;
  };
  main.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.pronto) { b.disabled = true; const st = await segnaProntoReparto(b.dataset.pronto, rep, true); if (st === 'pronto') toast('Ordine completo: il cliente è avvisato', 'ok'); }
    if (b.dataset.annulla) { await segnaProntoReparto(b.dataset.annulla, rep, false); toast('Rimesso in coda'); }
  });
  render();
  const t = setInterval(render, 30000);
  const off = onStore(render);
  return () => { off(); clearInterval(t); };
}
