import { S, onStore, tavoliLista } from '../store.js';
import { update } from '../db.js';
import { token } from '../seed.js';
import { esc, qrSvg, baseUrl, toast, conferma, modal, $, cfgAsporto } from '../util.js';

export function mount(main) {
  main.innerHTML = `<div id="qr"></div>`;
  const url = k => `${baseUrl()}#/t/${encodeURIComponent(k)}/${S.qr[k]}`;
  const render = () => {
    const lista = tavoliLista();
    $('#qr', main).innerHTML = `
      <div class="no-stampa">
        <div class="riga sp" style="margin-bottom:10px"><div><h1 style="margin:0">Tavoli e QR</h1><p class="tenue" style="margin:0">Stampa i cartellini e mettine uno su ogni tavolo.</p></div>
          <div class="riga"><button class="btn" data-aggiungi>+ Tavoli</button><button class="btn" data-rigenera>Rigenera tutti i QR</button><button class="btn primario" onclick="window.print()">🖨️ Stampa cartellini</button></div></div>
        ${!S.info.qrAttivo ? '<div class="avviso">L\'ordinazione dal QR è disattivata: i cartellini servono comunque ai clienti per ricevere l\'avviso "pronto". Puoi attivarla da Regia.</div>' : ''}
      </div>
      ${(() => {
        const a = cfgAsporto(S.info), link = S.qr.asporto ? `${baseUrl()}#/a/${S.qr.asporto}` : '';
        return `<div class="card no-stampa" style="margin-bottom:14px"><div class="griglia g2" style="align-items:center">
          <div><h2>🥡 Asporto da casa</h2>
            ${link ? `<p class="tenue">Condividi questo link su WhatsApp, Facebook o sulla locandina: i clienti scelgono le pizze e l'orario di ritiro.</p>
              ${a.online && a.attivo ? '' : '<div class="avviso">Ora gli ordini da casa sono disattivati: attivali in Impostazioni → Asporto.</div>'}
              <p style="word-break:break-all"><code>${esc(link)}</code></p>
              <div class="riga"><button class="btn primario" data-copia-asp>📋 Copia link</button><a class="btn" href="https://wa.me/?text=${encodeURIComponent('Ordina le pizze da asporto: ' + link)}" target="_blank" rel="noopener">Condividi su WhatsApp</a><button class="btn piatto" data-rigenera-asp>Rigenera link</button></div>`
            : `<p class="tenue">Crea il link per far ordinare le pizze da asporto.</p><button class="btn primario" data-crea-asp>Crea link asporto</button>`}
          </div>
          ${link ? `<div class="cartellino" style="max-width:260px;justify-self:center"><div class="cn">${esc(S.info.nome || '')}</div><div class="tn" style="font-size:1.6rem">Pizze da asporto</div>${qrSvg(link, 200)}<p><b>Inquadra e ordina</b><br>poi passa a ritirare</p></div>` : ''}
        </div></div>`;
      })()}
      <div class="fogli-qr">${lista.map(([k, t]) => S.qr[k] ? `<div class="cartellino">
        <div class="cn">${esc(S.info.nome || '')}</div><div class="tn">Tavolo ${esc(t.nome || k)}</div>
        ${qrSvg(url(k), 200)}
        <p><b>Inquadra per ordinare</b><br>e ricevere l'avviso quando è pronto</p>
        <div class="riga no-stampa" style="justify-content:center;margin-top:8px"><a class="btn piccolo" href="${esc(url(k))}" target="_blank" rel="noopener">Apri</a><button class="btn piccolo" data-rinomina="${esc(k)}">Rinomina</button><button class="btn piccolo piatto" data-togli="${esc(k)}">Togli</button></div>
      </div>` : '').join('')}</div>`;
  };
  main.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    const d = b.dataset;
    if ('creaAsp' in d || 'rigeneraAsp' in d) {
      if ('rigeneraAsp' in d && !await conferma('Il link vecchio smetterà di funzionare: dovrai ricondividere quello nuovo.', 'Rigenera', 'rosso')) return;
      await update('', { 'qr/asporto': token() + token(), ...(S.info.asporto ? {} : { 'pubblico/info/asporto': cfgAsporto(S.info) }) });
      toast('Link asporto pronto', 'ok');
    } else if ('copiaAsp' in d) {
      try { await navigator.clipboard.writeText(`${baseUrl()}#/a/${S.qr.asporto}`); toast('Link copiato', 'ok'); } catch { toast('Copia non riuscita: tieni premuto sul link', 'err'); }
    } else if ('aggiungi' in d) {
      const r = await modal({ titolo: 'Aggiungi tavoli', html: `<label class="campo">Quanti tavoli aggiungere?<input name="n" type="number" min="1" value="1" inputmode="numeric"></label>`, azioni: [{ id: 'ok', label: 'Aggiungi', cls: 'primario' }] });
      if (!r) return;
      const esistenti = Object.keys(S.tavoli).map(Number).filter(Boolean);
      let next = (esistenti.length ? Math.max(...esistenti) : 0) + 1;
      const patch = {};
      for (let i = 0; i < Math.max(1, parseInt(r.form.n) || 1); i++, next++) { patch[`tavoli/${next}`] = { nome: String(next), attivo: true }; patch[`qr/${next}`] = token(); }
      await update('', patch); toast('Tavoli aggiunti', 'ok');
    } else if ('rigenera' in d) {
      if (!await conferma('I QR già stampati smetteranno di funzionare: dovrai ristamparli. Utile se qualcuno ha fotografato i codici per fare scherzi.', 'Rigenera', 'rosso')) return;
      const patch = {}; for (const k of Object.keys(S.tavoli)) patch[`qr/${k}`] = token();
      await update('', patch); toast('Nuovi QR generati: ristampali', 'ok');
    } else if (d.rinomina) {
      const r = await modal({ titolo: 'Rinomina tavolo', html: `<label class="campo">Nome visualizzato<input name="n" value="${esc(S.tavoli[d.rinomina]?.nome || d.rinomina)}"></label>`, azioni: [{ id: 'ok', label: 'Salva', cls: 'primario' }] });
      if (r?.form.n.trim()) await update(`tavoli/${d.rinomina}`, { nome: r.form.n.trim() });
    } else if (d.togli) {
      if (await conferma(`Togliere il tavolo ${S.tavoli[d.togli]?.nome}? Il suo QR smette di funzionare.`, 'Togli', 'rosso')) await update('', { [`tavoli/${d.togli}`]: null, [`qr/${d.togli}`]: null });
    }
  });
  render();
  return onStore(render);
}
