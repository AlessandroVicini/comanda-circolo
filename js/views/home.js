import { S, onStore, repartiLista, ordiniLista, sottoScorta } from '../store.js';
import { db } from '../db.js';
import { esc, baseUrl } from '../util.js';

export function mount(main) {
  const render = () => {
    const daConf = ordiniLista(o => o.stato === 'da_confermare').length;
    const pronti = ordiniLista(o => o.stato === 'pronto').length;
    const scorte = sottoScorta().length;
    const r = (href, em, tit, sub, badge = 0) =>
      `<a class="ruolo" href="${href}"><span class="em">${em}</span><b>${esc(tit)} ${badge ? `<span class="badge">${badge}</span>` : ''}</b><span>${esc(sub)}</span></a>`;
    const tav1 = Object.keys(S.tavoli)[0];
    main.innerHTML = `
      ${db.mode === 'demo' ? `<div class="avviso"><b>Modalità demo.</b> I dati restano in questo browser: apri più schede (cameriere, cucina, display, cassa) per vederle parlare tra loro.
        ${tav1 && S.qr[tav1] ? `Per provare come cliente apri <a href="#/t/${tav1}/${S.qr[tav1]}">il QR del tavolo ${tav1}</a> (in un'altra scheda, così vedi cliente e staff insieme).` : ''}
        Per andare online segui il README.</div>` : ''}
      ${!S.serata ? `<div class="avviso rosso">La serata è chiusa: i clienti non possono ordinare dal QR. Aprila da <a href="#/regia">Regia</a>.</div>` : ''}
      <h1>Che postazione sei?</h1>
      <p class="tenue">Ogni telefono o tablet sceglie il suo ruolo. Tutto si aggiorna in tempo reale.</p>
      <div class="ruoli">
        ${r('#/cameriere', '🧾', 'Cameriere', 'Prende gli ordini ai tavoli e conferma quelli dal QR', daConf)}
        ${repartiLista().map(([k, x]) => r(`#/reparto/${k}`, k === 'bar' ? '🍺' : k === 'pizzeria' ? '🍕' : '🍳', x.nome, 'Coda delle preparazioni')).join('')}
        ${r('#/display', '📺', 'Display ritiro', 'Numeri dei tavoli pronti, su TV o tablet', pronti)}
        ${r('#/cassa', '💶', 'Cassa', 'Conti dei tavoli, vendita al banco, uscite')}
        ${r('#/regia', '🎛️', 'Regia', 'Tutta la serata sotto controllo')}
        ${r('#/magazzino', '📦', 'Magazzino', 'Giacenze, carichi e inventario', scorte)}
        ${r('#/menu', '📋', 'Menù e ricette', 'Prezzi, reparti, ricette e food cost')}
        ${r('#/primanota', '📒', 'Prima nota', 'Registro della serata, stampa ed export')}
        ${r('#/qr', '🔳', 'Tavoli e QR', 'Cartellini da stampare per i tavoli')}
        ${r('#/impostazioni', '⚙️', 'Impostazioni', 'Nome, reparti, staff, backup')}
      </div>`;
  };
  render();
  return onStore(render);
}
