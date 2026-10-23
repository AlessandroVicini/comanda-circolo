import { S, onStore, sottoScorta } from '../store.js';
import { caricoMagazzino, rettificaMagazzino, aggiornaEsauriti } from '../logic.js';
import { on, set, remove, update } from '../db.js';
import { esc, euro, num, ora, parseNum, toast, conferma, modal, scarica, csvCell, $ } from '../util.js';

export function mount(main) {
  let scheda = 'giacenze', soloBassi = false, movimenti = {};
  main.innerHTML = `<div class="schede" id="mg-schede"></div><div id="mg-corpo"></div>`;
  const unMov = on('magazzino/movimenti', v => { movimenti = v || {}; if (scheda === 'movimenti') render(); });

  const render = () => {
    const bassi = sottoScorta();
    $('#mg-schede', main).innerHTML = [['giacenze', 'Giacenze', 0], ['spesa', 'Lista della spesa', bassi.length], ['movimenti', 'Movimenti', 0]]
      .map(([k, t, n]) => `<button data-scheda="${k}" class="${scheda === k ? 'attivo' : ''}">${t}${n ? ` <span class="badge">${n}</span>` : ''}</button>`).join('');
    const c = $('#mg-corpo', main);
    const lista = Object.entries(S.ingr).sort((a, b) => a[1].nome.localeCompare(b[1].nome));
    if (scheda === 'giacenze') {
      const valore = lista.reduce((s, [, i]) => s + Math.max(0, Number(i.giacenza) || 0) * (Number(i.costo) || 0), 0);
      const vis = soloBassi ? lista.filter(([k]) => bassi.find(([b]) => b === k)) : lista;
      c.innerHTML = `<div class="kpis"><div class="kpi"><span>Articoli</span><b>${lista.length}</b></div>
          <div class="kpi"><span>Sotto scorta</span><b style="color:${bassi.length ? 'var(--rosso)' : 'inherit'}">${bassi.length}</b></div>
          <div class="kpi"><span>Valore a magazzino</span><b>${euro(valore)}</b></div></div>
        <div class="riga sp" style="margin-bottom:10px"><label class="check" style="margin:0"><input type="checkbox" id="mg-bassi" ${soloBassi ? 'checked' : ''}> Solo sotto scorta</label>
          <button class="btn primario" data-nuovo>+ Nuovo articolo</button></div>
        ${vis.length ? `<div class="card scorri"><table class="tab"><thead><tr><th>Articolo</th><th class="n">Giacenza</th><th class="n">Scorta min.</th><th class="n">Costo unit.</th><th></th></tr></thead><tbody>
        ${vis.map(([k, i]) => {
          const basso = (Number(i.giacenza) || 0) <= (Number(i.soglia) || 0);
          return `<tr class="${basso ? 'basso' : ''}"><td><b>${esc(i.nome)}</b>${basso ? ' <span class="tag rosso">da ricomprare</span>' : ''}</td>
          <td class="n"><b>${num(i.giacenza)}</b> ${esc(i.unita)}</td><td class="n">${num(i.soglia)} ${esc(i.unita)}</td><td class="n">${euro(i.costo)}/${esc(i.unita)}</td>
          <td class="n" style="white-space:nowrap"><button class="btn piccolo primario" data-carico="${k}">+ Carico</button> <button class="btn piccolo" data-inv="${k}">Conta</button> <button class="btn piccolo piatto" data-mod="${k}" aria-label="Modifica">✎</button></td></tr>`;
        }).join('')}</tbody></table></div>` : '<div class="vuoto">Nessun articolo.</div>'}
        <p class="tenue" style="font-size:.85rem;margin-top:10px">Ogni ordine inviato scala in automatico gli ingredienti secondo le ricette del menù. Se un ingrediente finisce, i prodotti che lo usano diventano "esauriti" anche sul QR dei clienti.</p>`;
    } else if (scheda === 'spesa') {
      const righe = bassi.map(([k, i]) => ({ k, i, da: Math.max(0, (Number(i.soglia) || 0) * 3 - (Number(i.giacenza) || 0)) }));
      c.innerHTML = righe.length ? `<div class="card"><h2>Da comprare</h2><p class="tenue">Quantità suggerita: per tornare a tre volte la scorta minima.</p>
        <table class="tab"><thead><tr><th>Articolo</th><th class="n">Ora</th><th class="n">Comprare circa</th><th class="n">Spesa stimata</th></tr></thead><tbody>
        ${righe.map(r => `<tr><td>${esc(r.i.nome)}</td><td class="n">${num(r.i.giacenza)} ${esc(r.i.unita)}</td><td class="n"><b>${num(Math.ceil(r.da * 10) / 10)} ${esc(r.i.unita)}</b></td><td class="n">${euro(r.da * (Number(r.i.costo) || 0))}</td></tr>`).join('')}
        </tbody><tfoot><tr><th colspan="3">Totale stimato</th><th class="n">${euro(righe.reduce((s, r) => s + r.da * (Number(r.i.costo) || 0), 0))}</th></tr></tfoot></table>
        <div class="riga" style="margin-top:10px"><button class="btn" data-copia>📋 Copia lista</button><button class="btn" onclick="window.print()">🖨️ Stampa</button></div></div>`
        : '<div class="vuoto">Tutto sopra la scorta minima. 👍</div>';
      c._lista = righe.map(r => `- ${r.i.nome}: ${num(Math.ceil(r.da * 10) / 10)} ${r.i.unita}`).join('\n');
    } else {
      const ms = Object.entries(movimenti).map(([id, m]) => ({ id, ...m })).sort((a, b) => b.ts - a.ts).slice(0, 200);
      c.innerHTML = ms.length ? `<div class="card scorri"><table class="tab"><thead><tr><th>Quando</th><th>Articolo</th><th>Tipo</th><th class="n">Quantità</th><th>Nota</th></tr></thead><tbody>
        ${ms.map(m => `<tr><td>${new Date(m.ts).toLocaleDateString('it-IT')} ${ora(m.ts)}</td><td>${esc(S.ingr[m.ing]?.nome || m.ing)}</td>
          <td><span class="tag ${m.tipo === 'carico' ? 'verde' : 'oro'}">${m.tipo}</span></td><td class="n">${m.qta > 0 ? '+' : ''}${num(m.qta)} ${esc(S.ingr[m.ing]?.unita || '')}</td><td>${esc(m.nota || '')}</td></tr>`).join('')}
        </tbody></table></div><button class="btn" style="margin-top:10px" data-csv>⬇️ Esporta CSV</button>`
        : '<div class="vuoto">Nessun carico o inventario registrato. Gli scarichi delle vendite sono automatici.</div>';
      c._ms = ms;
    }
  };

  async function editArticolo(k) {
    const i = k ? S.ingr[k] : { nome: '', unita: 'pz', giacenza: 0, soglia: 0, costo: 0 };
    const r = await modal({ titolo: k ? 'Modifica articolo' : 'Nuovo articolo', html: `
      <label class="campo">Nome<input name="nome" value="${esc(i.nome)}"></label>
      <div class="riga"><label class="campo cresci">Unità<select name="unita">${['pz', 'kg', 'l', 'g', 'conf'].map(u => `<option ${u === i.unita ? 'selected' : ''}>${u}</option>`).join('')}</select></label>
      <label class="campo cresci">Costo per unità €<input name="costo" inputmode="decimal" value="${String(i.costo ?? 0).replace('.', ',')}"></label></div>
      <div class="riga">${k ? '' : `<label class="campo cresci">Giacenza iniziale<input name="giacenza" inputmode="decimal" value="0"></label>`}
      <label class="campo cresci">Scorta minima<input name="soglia" inputmode="decimal" value="${String(i.soglia ?? 0).replace('.', ',')}"></label></div>`,
      azioni: [...(k ? [{ id: 'del', label: 'Elimina', cls: 'rosso' }] : []), { id: 'no', label: 'Annulla' }, { id: 'ok', label: 'Salva', cls: 'primario' }] });
    if (!r || r.azione === 'no') return;
    if (r.azione === 'del') {
      const usato = Object.values(S.menu.prodotti || {}).filter(p => p.ricetta?.[k]).map(p => p.nome);
      if (await conferma(usato.length ? `È usato in: ${usato.join(', ')}. Eliminarlo lo toglie anche dalle ricette.` : 'Eliminare l\'articolo?', 'Elimina', 'rosso')) {
        const patch = { [`magazzino/ingredienti/${k}`]: null };
        for (const [pid, p] of Object.entries(S.menu.prodotti || {})) if (p.ricetta?.[k]) patch[`pubblico/menu/prodotti/${pid}/ricetta/${k}`] = null;
        await update('', patch); toast('Eliminato');
      }
      return;
    }
    if (!r.form.nome.trim()) return toast('Serve un nome', 'err');
    const dati = { nome: r.form.nome.trim(), unita: r.form.unita, costo: parseNum(r.form.costo), soglia: parseNum(r.form.soglia) };
    if (k) await update(`magazzino/ingredienti/${k}`, dati);
    else {
      const id = r.form.nome.toLowerCase().normalize('NFD').replace(/[^\w]+/g, '_').replace(/^_|_$/g, '').slice(0, 30) + '_' + Date.now().toString(36).slice(-3);
      await set(`magazzino/ingredienti/${id}`, { ...dati, giacenza: parseNum(r.form.giacenza) });
    }
    toast('Salvato', 'ok'); aggiornaEsauriti();
  }

  main.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    const d = b.dataset;
    if (d.scheda) { scheda = d.scheda; render(); }
    else if ('nuovo' in d) editArticolo(null);
    else if (d.mod) editArticolo(d.mod);
    else if (d.carico) {
      const i = S.ingr[d.carico];
      const r = await modal({ titolo: `Carico: ${i.nome}`, html: `<p class="tenue">Ora: ${num(i.giacenza)} ${esc(i.unita)}</p>
        <label class="campo">Quantità arrivata (${esc(i.unita)})<input name="qta" inputmode="decimal"></label>
        <label class="campo">Nuovo costo per ${esc(i.unita)} € (lascia vuoto se invariato)<input name="costo" inputmode="decimal" placeholder="${String(i.costo).replace('.', ',')}"></label>
        <label class="campo">Nota<input name="nota" placeholder="es. METRO, fattura n."></label>`,
        azioni: [{ id: 'no', label: 'Annulla' }, { id: 'ok', label: 'Registra carico', cls: 'primario' }] });
      if (r?.azione === 'ok' && parseNum(r.form.qta)) { await caricoMagazzino(d.carico, parseNum(r.form.qta), parseNum(r.form.costo), r.form.nota); toast('Carico registrato', 'ok'); }
    }
    else if (d.inv) {
      const i = S.ingr[d.inv];
      const r = await modal({ titolo: `Inventario: ${i.nome}`, html: `<p class="tenue">Secondo il sistema: ${num(i.giacenza)} ${esc(i.unita)}</p>
        <label class="campo">Quantità contata (${esc(i.unita)})<input name="qta" inputmode="decimal"></label><label class="campo">Nota<input name="nota" placeholder="es. inventario fine serata"></label>`,
        azioni: [{ id: 'no', label: 'Annulla' }, { id: 'ok', label: 'Aggiorna giacenza', cls: 'primario' }] });
      if (r?.azione === 'ok' && r.form.qta !== '') { await rettificaMagazzino(d.inv, parseNum(r.form.qta), r.form.nota); toast('Giacenza aggiornata', 'ok'); }
    }
    else if ('copia' in d) { try { await navigator.clipboard.writeText($('#mg-corpo', main)._lista); toast('Lista copiata', 'ok'); } catch { toast('Copia non riuscita', 'err'); } }
    else if ('csv' in d) {
      const ms = $('#mg-corpo', main)._ms || [];
      scarica('movimenti-magazzino.csv', ['Data;Ora;Articolo;Tipo;Quantità;Unità;Nota', ...ms.map(m => [new Date(m.ts).toLocaleDateString('it-IT'), ora(m.ts), S.ingr[m.ing]?.nome || m.ing, m.tipo, String(m.qta).replace('.', ','), S.ingr[m.ing]?.unita || '', m.nota || ''].map(csvCell).join(';'))].join('\n'));
    }
  });
  main.addEventListener('change', e => { if (e.target.id === 'mg-bassi') { soloBassi = e.target.checked; render(); } });
  render();
  const off = onStore(render);
  return () => { off(); unMov(); };
}
