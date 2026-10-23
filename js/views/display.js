import { S, onStore, ordiniLista } from '../store.js';
import { segnaServito } from '../logic.js';
import { esc, suono, sbloccaAudio, $ } from '../util.js';

export function mount(main) {
  document.body.classList.add('display-mode');
  let visti = null, ultimaChiamata = 0, audioOk = false, ultimoHtml = '';
  main.innerHTML = `<div class="display">
    <div class="alto"><h1 id="d-tit">Ordini pronti</h1><div class="ora" id="d-ora"></div></div>
    <div id="d-chiamata"></div>
    <div id="d-num" style="flex:1;display:flex;flex-direction:column"></div>
    <div class="piede no-stampa"><span>Tocca un numero quando l'ordine è stato ritirato</span>
      <span class="riga"><button class="btn piccolo" id="d-audio">🔈 Attiva suono</button><button class="btn piccolo" id="d-full">⛶ Schermo intero</button><a class="btn piccolo" href="#/" style="color:inherit;border-color:#2f4a43">← Postazioni</a></span></div>
  </div>`;
  const orologio = () => { $('#d-ora', main).textContent = new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }); };

  const render = () => {
    $('#d-tit', main).textContent = (S.info.nome ? S.info.nome + ' · ' : '') + 'Ordini pronti';
    const pronti = ordiniLista(o => o.stato === 'pronto');
    const gruppi = new Map(); // etichetta -> {ids, ts}
    for (const o of pronti) {
      const asp = o.tavolo === 'asporto';
      const k = o.tavolo === 'banco' ? 'b' + o.num : asp ? 'a' + o.id : 't' + o.tavolo;
      const g = gruppi.get(k) || { ids: [], ts: 0, numero: o.tavolo === 'banco' || asp ? o.num : (S.tavoli[o.tavolo]?.nome || o.tavolo),
        tipo: o.tavolo === 'banco' ? 'Numero' : asp ? '🥡 ' + String(o.cliente?.nome || 'Asporto').slice(0, 14) : 'Tavolo' };
      g.ids.push(o.id); g.ts = Math.max(g.ts, o.prontoTs || 0); gruppi.set(k, g);
    }
    const lista = [...gruppi.values()].sort((a, b) => b.ts - a.ts);
    const chiavi = new Set(lista.map(g => g.tipo + g.numero + g.ts));
    if (visti && [...chiavi].some(k => !visti.has(k))) suono('pronto');
    visti = chiavi;
    const html = lista.length ? `<div class="numeri">${lista.map(g =>
      `<button class="numero ${Date.now() - g.ts < 25000 ? 'nuovo' : ''}" data-ids="${g.ids.join(',')}"><span>${g.tipo}</span><b>${esc(g.numero)}</b></button>`).join('')}</div>`
      : `<div class="vuoto-d">Quando un ordine è pronto,<br>qui compare il numero del tavolo.</div>`;
    if (html !== ultimoHtml) { ultimoHtml = html; $('#d-num', main).innerHTML = html; }
    const ch = S.stato?.chiamata;
    if (ch && ch.ts > ultimaChiamata && Date.now() - ch.ts < 60000) { ultimaChiamata = ch.ts; suono('pronto'); }
    $('#d-chiamata', main).innerHTML = ch && Date.now() - ch.ts < 60000 ? `<div class="chiamata">📣 ${esc(ch.testo)}</div>` : '';
  };
  main.addEventListener('click', async e => {
    const n = e.target.closest('[data-ids]');
    if (n) { n.style.opacity = .3; for (const id of n.dataset.ids.split(',')) await segnaServito(id); }
    if (e.target.id === 'd-full') { try { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen(); } catch {} }
    if (e.target.id === 'd-audio') { sbloccaAudio(); suono('ding'); audioOk = true; e.target.textContent = '🔊 Suono attivo'; }
  });
  orologio(); render();
  const t1 = setInterval(orologio, 10000), t2 = setInterval(render, 5000);
  const off = onStore(render);
  return () => { off(); clearInterval(t1); clearInterval(t2); document.body.classList.remove('display-mode'); };
}
