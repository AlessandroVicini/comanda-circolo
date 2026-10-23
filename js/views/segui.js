// Pagina "segui il tuo ordine" per gli ordini al banco: #/s/<chiave>
import { on, signInGuest } from '../db.js';
import { esc, toast, $ } from '../util.js';
import { attivaAvvisi, controllaPronti, htmlStatoOrdine, htmlBoxAvvisi } from './avvisi.js';

export async function mount(main, [chiave]) {
  main.style.maxWidth = '560px'; main.style.margin = '0 auto';
  try { await signInGuest(); } catch {}
  let info = {}, ordini = {};
  main.innerHTML = `<div class="cliente-testa"><h1 id="s-nome">Il tuo ordine</h1></div>
    <div id="s-num" style="text-align:center;margin-bottom:12px"></div><div id="s-avv"></div><div id="s-ord"></div>`;
  const renderAvv = () => {
    $('#s-avv', main).innerHTML = htmlBoxAvvisi();
    $('#attiva-avvisi', main)?.addEventListener('click', async () => { await attivaAvvisi(); renderAvv(); toast('Avvisi attivati', 'ok'); });
  };
  const render = () => {
    $('#s-nome', main).textContent = info.nome || 'Il tuo ordine';
    const l = Object.values(ordini);
    const n = l.find(o => o.num)?.num;
    $('#s-num', main).innerHTML = n ? `<div class="tenue">Il tuo numero</div><div style="font-family:var(--font-t);font-size:4.5rem;font-weight:800;line-height:1">${esc(n)}</div>` : '';
    $('#s-ord', main).innerHTML = l.length ? l.map(o => htmlStatoOrdine(o)).join('') : '<div class="vuoto">Ordine non trovato o già concluso.</div>';
  };
  const un = [
    on('pubblico/info', v => { info = v || {}; render(); }),
    on('avvisi/' + chiave + '/ordini', v => { ordini = v || {}; render(); controllaPronti(ordini, chiave, info.msgPronto); }),
  ];
  renderAvv();
  return () => un.forEach(u => u());
}
