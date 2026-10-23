import { S, onStore, foodCost, repartiLista, nomeReparto } from '../store.js';
import { set, update, newKey } from '../db.js';
import { aggiornaEsauriti } from '../logic.js';
import { esc, euro, parseNum, toast, conferma, modal, byOrdine, $ } from '../util.js';

export function mount(main) {
  let filtro = '';
  main.innerHTML = `<div id="mn"></div>`;
  const render = () => {
    const cats = Object.entries(S.menu.categorie || {}).sort(byOrdine);
    const prod = Object.entries(S.menu.prodotti || {}).sort(byOrdine);
    $('#mn', main).innerHTML = `
      <div class="riga sp" style="margin-bottom:10px"><div class="schede" style="margin:0">
        <button data-filtro="" class="${!filtro ? 'attivo' : ''}">Tutti</button>${cats.map(([k, c]) => `<button data-filtro="${k}" class="${filtro === k ? 'attivo' : ''}">${esc(c.nome)}</button>`).join('')}</div>
        <div class="riga"><button class="btn" data-cats>Categorie</button><button class="btn primario" data-nuovo>+ Prodotto</button></div></div>
      <div class="card scorri"><table class="tab"><thead><tr><th>Prodotto</th><th>Reparto</th><th class="n">Prezzo</th><th class="n">Food cost</th><th class="n">Margine</th><th>Stato</th><th></th></tr></thead><tbody>
      ${prod.filter(([, p]) => !filtro || p.cat === filtro).map(([k, p]) => {
        const fc = foodCost(p), m = p.prezzo ? (1 - fc / p.prezzo) * 100 : 0;
        return `<tr><td><b>${esc(p.nome)}</b><br><small class="tenue">${esc(S.menu.categorie?.[p.cat]?.nome || '—')}</small></td><td>${esc(nomeReparto(p.reparto))}</td>
          <td class="n">${euro(p.prezzo)}</td><td class="n">${Object.keys(p.ricetta || {}).length ? euro(fc) : '<span class="tenue">—</span>'}</td>
          <td class="n">${Object.keys(p.ricetta || {}).length ? `<span class="tag ${m >= 65 ? 'verde' : m >= 45 ? 'oro' : 'rosso'}">${Math.round(m)}%</span>` : ''}</td>
          <td>${p.attivo === false ? '<span class="tag">Nascosto</span>' : p.esaurito ? '<span class="tag rosso">Esaurito</span>' : p.esauritoAuto ? '<span class="tag rosso">Manca ingrediente</span>' : '<span class="tag verde">In vendita</span>'}</td>
          <td class="n" style="white-space:nowrap"><button class="btn piccolo" data-esaurito="${k}">${p.esaurito ? 'Rimetti' : 'Esaurito'}</button> <button class="btn piccolo piatto" data-mod="${k}" aria-label="Modifica">✎</button></td></tr>`;
      }).join('') || '<tr><td colspan="7" class="tenue">Nessun prodotto.</td></tr>'}
      </tbody></table></div>
      <p class="tenue" style="font-size:.85rem;margin-top:10px">Il food cost viene dalla ricetta × il costo degli articoli di magazzino. Margine: verde ≥ 65%, giallo ≥ 45%. "Esaurito" toglie subito il prodotto dal QR dei clienti.</p>`;
  };

  function rigaRicetta(ing = '', q = '') {
    const opts = Object.entries(S.ingr).sort((a, b) => a[1].nome.localeCompare(b[1].nome))
      .map(([k, i]) => `<option value="${k}" ${k === ing ? 'selected' : ''}>${esc(i.nome)} (${esc(i.unita)})</option>`).join('');
    return `<div class="riga ric" style="margin-bottom:6px"><select class="cresci ric-ing"><option value="">— articolo —</option>${opts}</select>
      <input class="ric-q" inputmode="decimal" style="width:90px" placeholder="q.tà" value="${String(q).replace('.', ',')}"><button class="icona" data-togli-ric aria-label="Togli">✕</button></div>`;
  }

  async function editProdotto(k) {
    const p = k ? S.menu.prodotti[k] : { nome: '', prezzo: 0, cat: filtro || Object.keys(S.menu.categorie || {})[0] || '', reparto: repartiLista()[0]?.[0] || '', descr: '', allergeni: '', attivo: true, ricetta: {} };
    const cats = Object.entries(S.menu.categorie || {}).sort(byOrdine);
    const r = await modal({ titolo: k ? 'Modifica prodotto' : 'Nuovo prodotto', larga: true, html: `
      <div class="griglia g2"><div>
        <label class="campo">Nome<input name="nome" value="${esc(p.nome)}"></label>
        <div class="riga"><label class="campo cresci">Prezzo €<input name="prezzo" inputmode="decimal" value="${String(p.prezzo).replace('.', ',')}"></label>
        <label class="campo cresci">Categoria<select name="cat">${cats.map(([ck, c]) => `<option value="${ck}" ${ck === p.cat ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}</select></label></div>
        <label class="campo">Reparto che lo prepara<select name="reparto">${repartiLista().map(([rk, x]) => `<option value="${rk}" ${rk === p.reparto ? 'selected' : ''}>${esc(x.nome)}</option>`).join('')}
          <option value="" ${!p.reparto ? 'selected' : ''}>Nessuno (si serve subito, es. lattine)</option></select></label>
        <label class="campo">Descrizione<input name="descr" value="${esc(p.descr || '')}"></label>
        <label class="campo">Allergeni<input name="allergeni" value="${esc(p.allergeni || '')}" placeholder="es. glutine, latte"></label>
        <label class="check"><input type="checkbox" name="attivo" ${p.attivo !== false ? 'checked' : ''}> Visibile nel menù</label>
      </div><div>
        <h3>Ricetta (scarico magazzino per 1 porzione)</h3>
        <div id="ricetta">${Object.entries(p.ricetta || {}).map(([i, q]) => rigaRicetta(i, q)).join('')}</div>
        <button class="btn piccolo" data-add-ric>+ Ingrediente</button>
        <div class="kpi" style="margin-top:10px"><span>Food cost stimato</span><b id="fc">—</b></div>
      </div></div>`,
      azioni: [...(k ? [{ id: 'del', label: 'Elimina', cls: 'rosso' }] : []), { id: 'no', label: 'Annulla' }, { id: 'ok', label: 'Salva', cls: 'primario' }],
      onOpen: w => {
        const calc = () => {
          let c = 0;
          w.querySelectorAll('.ric').forEach(x => { const i = x.querySelector('.ric-ing').value; c += (Number(S.ingr[i]?.costo) || 0) * parseNum(x.querySelector('.ric-q').value); });
          const prezzo = parseNum(w.querySelector('[name=prezzo]').value);
          w.querySelector('#fc').textContent = `${euro(c)}${prezzo ? ` · margine ${Math.round((1 - c / prezzo) * 100)}%` : ''}`;
        };
        w.addEventListener('click', e => {
          if (e.target.closest('[data-add-ric]')) { w.querySelector('#ricetta').insertAdjacentHTML('beforeend', rigaRicetta()); }
          if (e.target.closest('[data-togli-ric]')) { e.target.closest('.ric').remove(); calc(); }
        });
        w.addEventListener('input', calc); w.addEventListener('change', calc); calc();
        w._ricetta = () => { const o = {}; w.querySelectorAll('.ric').forEach(x => { const i = x.querySelector('.ric-ing').value, q = parseNum(x.querySelector('.ric-q').value); if (i && q) o[i] = (o[i] || 0) + q; }); return o; };
      } });
    if (!r || r.azione === 'no') return;
    if (r.azione === 'del') { if (await conferma(`Eliminare "${p.nome}" dal menù?`, 'Elimina', 'rosso')) { await set(`pubblico/menu/prodotti/${k}`, null); toast('Eliminato'); } return; }
    const nome = r.form.nome.trim(); if (!nome) return toast('Serve un nome', 'err');
    const dati = { ...p, nome, prezzo: parseNum(r.form.prezzo), cat: r.form.cat, reparto: r.form.reparto, descr: r.form.descr.trim(), allergeni: r.form.allergeni.trim(), attivo: r.form.attivo, ricetta: r.el._ricetta() };
    if (!k) dati.ordine = Object.keys(S.menu.prodotti || {}).length + 1;
    await set(`pubblico/menu/prodotti/${k || newKey('pubblico/menu/prodotti')}`, dati);
    toast('Salvato', 'ok'); aggiornaEsauriti();
  }

  async function editCategorie() {
    const cats = Object.entries(S.menu.categorie || {}).sort(byOrdine);
    const r = await modal({ titolo: 'Categorie del menù', html: `<p class="tenue">Rinomina, riordina (numero) o aggiungi. Svuota il nome per eliminare una categoria vuota.</p>
      <div id="cl">${cats.map(([k, c]) => `<div class="riga" style="margin-bottom:6px" data-k="${k}"><input class="cresci c-nome" value="${esc(c.nome)}"><input class="c-ord" style="width:70px" inputmode="numeric" value="${c.ordine ?? ''}"></div>`).join('')}</div>
      <button class="btn piccolo" data-add-cat>+ Categoria</button>`,
      azioni: [{ id: 'no', label: 'Annulla' }, { id: 'ok', label: 'Salva', cls: 'primario' }],
      onOpen: w => w.addEventListener('click', e => { if (e.target.closest('[data-add-cat]')) w.querySelector('#cl').insertAdjacentHTML('beforeend', `<div class="riga" style="margin-bottom:6px" data-k=""><input class="cresci c-nome" placeholder="Nuova categoria"><input class="c-ord" style="width:70px" inputmode="numeric" value="${cats.length + 1}"></div>`); }) });
    if (r?.azione !== 'ok') return;
    const patch = {};
    r.el.querySelectorAll('#cl > .riga').forEach(x => {
      const k = x.dataset.k || newKey('pubblico/menu/categorie'), nome = x.querySelector('.c-nome').value.trim(), ordine = parseInt(x.querySelector('.c-ord').value) || 99;
      if (!nome) { if (x.dataset.k && !Object.values(S.menu.prodotti || {}).some(p => p.cat === k)) patch[`pubblico/menu/categorie/${k}`] = null; else if (x.dataset.k) toast('Non elimino categorie con prodotti', 'err'); }
      else patch[`pubblico/menu/categorie/${k}`] = { nome, ordine };
    });
    await update('', patch); toast('Categorie salvate', 'ok');
  }

  main.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    const d = b.dataset;
    if (d.filtro !== undefined) { filtro = d.filtro; render(); }
    else if ('nuovo' in d) editProdotto(null);
    else if ('cats' in d) editCategorie();
    else if (d.mod) editProdotto(d.mod);
    else if (d.esaurito) { const p = S.menu.prodotti[d.esaurito]; await update(`pubblico/menu/prodotti/${d.esaurito}`, { esaurito: !p.esaurito }); }
  });
  render();
  return onStore(render);
}
