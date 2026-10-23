// Componente riutilizzabile: elenco del menù con +/− e carrello.
import { esc, euro, byOrdine, modal } from '../util.js';

export class Carrello {
  constructor() { this.voci = new Map(); } // chiave pid|nota -> {pid, qta, note}
  add(pid, d = 1, note = '') {
    const k = pid + '|' + note;
    const v = this.voci.get(k) || { pid, qta: 0, note };
    v.qta += d;
    if (v.qta <= 0) this.voci.delete(k); else this.voci.set(k, v);
  }
  qtaDi(pid) { let q = 0; for (const v of this.voci.values()) if (v.pid === pid) q += v.qta; return q; }
  togliUno(pid) { // toglie prima dalle voci con nota
    const ks = [...this.voci.keys()].filter(k => k.startsWith(pid + '|')).sort().reverse();
    if (ks.length) { const v = this.voci.get(ks[0]); v.qta--; if (v.qta <= 0) this.voci.delete(ks[0]); }
  }
  get vuoto() { return this.voci.size === 0; }
  svuota() { this.voci.clear(); }
  righe(prodotti) {
    return [...this.voci.values()].filter(v => prodotti[v.pid]).map(v => {
      const p = prodotti[v.pid];
      return { pid: v.pid, nome: p.nome, prezzo: Number(p.prezzo) || 0, qta: v.qta, reparto: p.reparto || '', note: v.note || '' };
    });
  }
  totale(prodotti) { return this.righe(prodotti).reduce((s, r) => s + r.prezzo * r.qta, 0); }
  pezzi() { let n = 0; for (const v of this.voci.values()) n += v.qta; return n; }
}

export function htmlMenu(menu, carrello, { conNote = false, filtroCat = null } = {}) {
  const cats = Object.entries(menu.categorie || {}).sort(byOrdine);
  const prod = Object.entries(menu.prodotti || {}).filter(([, p]) => p.attivo !== false).sort(byOrdine);
  const senzaCat = prod.filter(([, p]) => !menu.categorie?.[p.cat]);
  const blocchi = [...cats.map(([ck, c]) => [c.nome, prod.filter(([, p]) => p.cat === ck)]), ['Altro', senzaCat]]
    .filter(([, l]) => l.length).filter(([n]) => !filtroCat || n === filtroCat);
  return blocchi.map(([nome, lista]) => `
    <h3 class="cat-tit">${esc(nome)}</h3>
    <div class="card" style="padding:4px 12px">
      ${lista.map(([pid, p]) => {
        const es = p.esaurito || p.esauritoAuto;
        const q = carrello.qtaDi(pid);
        return `<div class="prod ${es ? 'esaurito' : ''}" data-pid="${pid}">
          <div class="info"><div class="nome">${esc(p.nome)}</div>
            ${p.descr || p.allergeni ? `<div class="descr">${esc(p.descr || '')}${p.descr && p.allergeni ? ' · ' : ''}${p.allergeni ? 'Allergeni: ' + esc(p.allergeni) : ''}</div>` : ''}
            ${es ? '<span class="tag rosso">Esaurito</span>' : ''}
          </div>
          <div class="prezzo">${euro(p.prezzo)}</div>
          ${es ? '' : `<div class="passo ${q ? '' : 'zero'}">
            <button class="meno" data-meno="${pid}" aria-label="Togli ${esc(p.nome)}">−</button>
            <span class="q">${q}</span>
            <button class="piu" data-piu="${pid}" aria-label="Aggiungi ${esc(p.nome)}">+</button>
          </div>`}
          ${conNote && !es ? `<button class="icona" data-nota="${pid}" title="Aggiungi con una nota" aria-label="Nota">✎</button>` : ''}
        </div>`;
      }).join('')}
    </div>`).join('') || '<div class="vuoto">Il menù è vuoto.</div>';
}

// gestisce i click su +/−/nota dentro `root`; chiama onChange dopo ogni modifica
export function collegaMenu(root, carrello, getMenu, onChange) {
  root.addEventListener('click', async e => {
    const piu = e.target.closest('[data-piu]'), meno = e.target.closest('[data-meno]'), nota = e.target.closest('[data-nota]');
    if (piu) { carrello.add(piu.dataset.piu, 1); onChange(); }
    else if (meno) { carrello.togliUno(meno.dataset.meno); onChange(); }
    else if (nota) {
      const p = getMenu().prodotti[nota.dataset.nota];
      const r = await modal({ titolo: p.nome, html: `<label class="campo">Nota per la preparazione<input name="nota" placeholder="es. senza cipolla, ben cotta"></label>
        <label class="campo">Quantità<input name="qta" type="number" min="1" value="1" inputmode="numeric"></label>`,
        azioni: [{ id: 'no', label: 'Annulla' }, { id: 'ok', label: 'Aggiungi', cls: 'primario' }] });
      if (r?.azione === 'ok') { carrello.add(nota.dataset.nota, Math.max(1, parseInt(r.form.qta) || 1), r.form.nota.trim()); onChange(); }
    }
  });
}

export function htmlRiepilogoCarrello(carrello, prodotti, rimovibile = true) {
  const righe = carrello.righe(prodotti);
  if (!righe.length) return '<p class="tenue">Nessun prodotto.</p>';
  return `<table class="tab"><tbody>${righe.map(r => `<tr><td>${r.qta}×</td><td>${esc(r.nome)}${r.note ? `<br><small style="color:var(--rosso)">${esc(r.note)}</small>` : ''}</td><td class="n">${euro(r.prezzo * r.qta)}</td>${rimovibile ? `<td class="n"><button class="btn piccolo piatto" data-tog="${esc(r.pid + '|' + r.note)}" aria-label="Togli">✕</button></td>` : ''}</tr>`).join('')}
    </tbody><tfoot><tr><th colspan="2">Totale</th><th class="n">${euro(righe.reduce((s, r) => s + r.prezzo * r.qta, 0))}</th>${rimovibile ? '<th></th>' : ''}</tr></tfoot></table>`;
}
