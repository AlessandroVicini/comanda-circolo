import { S, onStore, serataVista } from '../store.js';
import { on, onWhere, get, update } from '../db.js';
import { esc, euro, ora, r2, dataLunga, scarica, csvCell, csvNum, parseNum, toast, modal, $ } from '../util.js';
import { righeAggregate } from '../logic.js';

export function mount(main) {
  let serata = serataVista(), movimenti = {}, ordini = {}, un = [];
  main.innerHTML = `<div id="pn"></div>`;
  const ascolta = () => {
    un.forEach(u => u());
    un = [on('movimenti/' + serata, v => { movimenti = v || {}; render(); }), onWhere('ordini', 'serata', serata, v => { ordini = v || {}; render(); })];
  };
  const render = () => {
    const serate = [...new Set([...Object.keys(S.serate || {}), serataVista()])].sort().reverse();
    const ms = Object.values(movimenti).sort((a, b) => a.ts - b.ts);
    const somma = f => r2(ms.filter(f).reduce((s, m) => s + (Number(m.importo) || 0), 0));
    const fondo = Number(S.serate?.[serata]?.fondoCassa) || 0;
    const eC = somma(m => m.tipo === 'entrata' && m.metodo !== 'pos'), eP = somma(m => m.tipo === 'entrata' && m.metodo === 'pos');
    const uC = somma(m => m.tipo === 'uscita' && m.metodo !== 'pos'), uP = somma(m => m.tipo === 'uscita' && m.metodo === 'pos');
    const venduti = righeAggregate(Object.values(ordini).filter(o => o.stato !== 'annullato' && o.stato !== 'da_confermare' && o.pagato).flatMap(o => o.righe || []))
      .sort((a, b) => b.qta - a.qta);
    $('#pn', main).innerHTML = `
      <div class="riga sp no-stampa" style="margin-bottom:12px">
        <label class="campo" style="margin:0;min-width:220px">Serata<select id="pn-serata">${serate.map(s => `<option value="${s}" ${s === serata ? 'selected' : ''}>${dataLunga(s)}</option>`).join('')}</select></label>
        <div class="riga"><button class="btn" data-fondo>Fondo cassa: ${euro(fondo)}</button><button class="btn" data-csv>⬇️ CSV serata</button><button class="btn" data-mese>⬇️ CSV mese</button><button class="btn primario" onclick="window.print()">🖨️ Stampa</button></div>
      </div>
      <div class="card primanota-foglio">
        <div class="riga sp"><div><h1 style="margin:0">Prima nota</h1><div class="tenue">${esc(S.info.nome || '')}</div></div>
          <div style="text-align:right"><div class="tenue" style="font-size:.8rem;text-transform:uppercase;letter-spacing:.06em">Giorno</div><b style="font-size:1.15rem">${dataLunga(serata)}</b></div></div>
        <div class="scorri" style="margin-top:12px"><table class="tab"><thead><tr><th>N.</th><th>Ora</th><th>Nome socio</th><th>Consumazione / descrizione</th><th class="n">Entrate</th><th class="n">Uscite</th><th>Pag.</th></tr></thead><tbody>
          ${ms.map((m, i) => `<tr><td>${i + 1}</td><td>${ora(m.ts)}</td><td>${esc(m.socio || '')}</td><td>${esc(m.descr || '')}</td>
            <td class="n">${m.tipo === 'entrata' ? euro(m.importo) : ''}</td><td class="n">${m.tipo === 'uscita' ? euro(m.importo) : ''}</td><td>${m.metodo === 'pos' ? 'POS' : 'Cont.'}</td></tr>`).join('') || '<tr><td colspan="7" class="tenue">Nessun movimento.</td></tr>'}
          </tbody><tfoot><tr><th colspan="4">Totali</th><th class="n">${euro(eC + eP)}</th><th class="n">${euro(uC + uP)}</th><th></th></tr></tfoot></table></div>
        <div class="pn-tot">
          <div><span>Fondo cassa iniziale</span><b>${euro(fondo)}</b></div>
          <div><span>Entrate in contanti</span><b>${euro(eC)}</b></div>
          <div><span>Entrate POS</span><b>${euro(eP)}</b></div>
          <div><span>Uscite (contanti)</span><b>${euro(uC)}</b></div>
          <div><span>Contanti attesi in cassa</span><b>${euro(fondo + eC - uC)}</b></div>
          <div><span>Risultato serata</span><b>${euro(eC + eP - uC - uP)}</b></div>
        </div>
        ${venduti.length ? `<h3 style="margin-top:18px">Prodotti venduti</h3><div class="scorri"><table class="tab"><thead><tr><th>Prodotto</th><th class="n">Q.tà</th><th class="n">Incasso</th></tr></thead><tbody>
          ${venduti.map(v => `<tr><td>${esc(v.nome)}</td><td class="n">${v.qta}</td><td class="n">${euro(v.qta * v.prezzo)}</td></tr>`).join('')}</tbody></table></div>` : ''}
        <div class="solo-stampa" style="margin-top:24px">Firma del responsabile ____________________________</div>
      </div>`;
  };
  const righeCsv = (s, ms) => ms.sort((a, b) => a.ts - b.ts).map(m => [s.split('-').reverse().join('/'), ora(m.ts), m.socio || '', m.descr || '', m.tipo === 'entrata' ? csvNum(m.importo) : '', m.tipo === 'uscita' ? csvNum(m.importo) : '', m.metodo === 'pos' ? 'POS' : 'Contanti'].map(csvCell).join(';'));
  const intest = 'Data;Ora;Socio;Descrizione;Entrate;Uscite;Pagamento';

  main.addEventListener('change', e => { if (e.target.id === 'pn-serata') { serata = e.target.value; ascolta(); } });
  main.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    if ('csv' in b.dataset) scarica(`prima-nota-${serata}.csv`, [intest, ...righeCsv(serata, Object.values(movimenti))].join('\n'));
    if ('mese' in b.dataset) {
      const mese = serata.slice(0, 7);
      const tutti = (await get('movimenti')) || {};
      const righe = Object.keys(tutti).filter(s => s.startsWith(mese)).sort().flatMap(s => righeCsv(s, Object.values(tutti[s] || {})));
      if (!righe.length) return toast('Nessun movimento nel mese', 'err');
      scarica(`prima-nota-${mese}.csv`, [intest, ...righe].join('\n'));
    }
    if ('fondo' in b.dataset) {
      const r = await modal({ titolo: 'Fondo cassa iniziale', html: `<label class="campo">Contanti in cassa all'apertura €<input name="f" inputmode="decimal" value="${String(S.serate?.[serata]?.fondoCassa || 0).replace('.', ',')}"></label>`, azioni: [{ id: 'ok', label: 'Salva', cls: 'primario' }] });
      if (r) await update('', { [`serate/${serata}/fondoCassa`]: parseNum(r.form.f) });
    }
  });
  ascolta();
  const off = onStore(render);
  return () => { off(); un.forEach(u => u()); };
}
