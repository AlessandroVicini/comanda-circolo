import { S, onStore, repartiLista } from '../store.js';
import { db, update, get, demoReset, set } from '../db.js';
import { seedTree } from '../seed.js';
import { apriSerata, aggiornaEsauriti } from '../logic.js';
import { esc, toast, conferma, modal, scarica, oggi, $ } from '../util.js';

export function mount(main) {
  main.innerHTML = `<div id="im"></div>`;
  const render = () => {
    const staff = Object.entries(S.staff || {}), rich = Object.entries(S.richieste || {}).filter(([u]) => !S.staff?.[u]);
    $('#im', main).innerHTML = `<div class="griglia g2" style="align-items:start">
      <div class="card"><h2>Il circolo</h2>
        <label class="campo">Nome mostrato a clienti e display<input id="im-nome" value="${esc(S.info.nome || '')}"></label>
        <label class="campo">Messaggio quando l'ordine è pronto<input id="im-msg" value="${esc(S.info.msgPronto || '')}"></label>
        <button class="btn primario" data-salva>Salva</button>
      </div>
      <div class="card"><h2>Reparti</h2><p class="tenue">Ogni reparto ha la sua schermata con la coda delle preparazioni.</p>
        ${repartiLista().map(([k, r]) => `<div class="riga" style="margin-bottom:6px"><input class="cresci rep-n" data-k="${k}" value="${esc(r.nome)}"><button class="icona" data-togli-rep="${k}" aria-label="Elimina">✕</button></div>`).join('')}
        <div class="riga"><button class="btn piccolo" data-add-rep>+ Reparto</button><button class="btn piccolo primario" data-salva-rep>Salva reparti</button></div>
      </div>
      ${db.mode === 'firebase' && db.staff?.admin ? `<div class="card"><h2>Staff</h2>
        ${rich.length ? `<div class="avviso"><b>In attesa di abilitazione</b>${rich.map(([u, r]) => `<div class="riga sp" style="margin-top:.4rem"><span>${esc(r.email)}</span><span><button class="btn piccolo primario" data-abilita="${u}">Abilita</button> <button class="btn piccolo piatto" data-rifiuta="${u}">Rifiuta</button></span></div>`).join('')}</div>` : ''}
        <table class="tab"><tbody>${staff.map(([u, s]) => `<tr><td>${esc(s.email)}${u === db.user.uid ? ' <small class="tenue">(tu)</small>' : ''}</td><td>${s.admin ? '<span class="tag verde">Amministratore</span>' : '<span class="tag">Staff</span>'}</td>
          <td class="n">${u !== db.user.uid ? `<button class="btn piccolo" data-admin="${u}">${s.admin ? 'Togli admin' : 'Rendi admin'}</button> <button class="btn piccolo piatto" data-rimuovi="${u}">Rimuovi</button>` : ''}</td></tr>`).join('')}</tbody></table>
        <p class="tenue" style="font-size:.85rem">I volontari creano il loro account dalla schermata di accesso, poi li abiliti qui. Un account condiviso "banco" va benissimo per i tablet fissi.</p>
      </div>` : ''}
      <div class="card"><h2>Dati</h2>
        <p class="tenue">Modalità: <b>${db.mode === 'firebase' ? 'online (Firebase)' : 'demo (solo questo browser)'}</b></p>
        <div class="riga"><button class="btn" data-backup>⬇️ Scarica backup completo</button>
        ${db.mode === 'demo' ? '<button class="btn rosso" data-reset>Azzera demo</button>' : ''}
        ${db.mode === 'firebase' && db.staff?.admin && !Object.keys(S.menu.prodotti || {}).length ? '<button class="btn oro" data-seed>Carica menù e magazzino di esempio</button>' : ''}</div>
        ${db.mode === 'demo' ? '<p class="tenue" style="font-size:.85rem;margin-top:.6rem">Per andare online e far ordinare i clienti dal loro telefono segui il README: crei un progetto Firebase gratuito e incolli la configurazione in <code>js/config.js</code>.</p>' : ''}
      </div></div>`;
  };
  main.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    const d = b.dataset;
    if ('salva' in d) { await update('pubblico/info', { nome: $('#im-nome', main).value.trim(), msgPronto: $('#im-msg', main).value.trim() }); toast('Salvato', 'ok'); }
    else if ('addRep' in d) {
      const r = await modal({ titolo: 'Nuovo reparto', html: '<label class="campo">Nome<input name="n" placeholder="es. Griglia"></label>', azioni: [{ id: 'ok', label: 'Aggiungi', cls: 'primario' }] });
      const n = r?.form.n.trim(); if (!n) return;
      const k = n.toLowerCase().normalize('NFD').replace(/[^\w]+/g, '').slice(0, 20) || 'rep' + Date.now();
      await update('', { [`pubblico/info/reparti/${k}`]: { nome: n, ordine: repartiLista().length + 1 } }); toast('Reparto aggiunto', 'ok');
    }
    else if ('salvaRep' in d) { const p = {}; main.querySelectorAll('.rep-n').forEach(i => { if (i.value.trim()) p[`pubblico/info/reparti/${i.dataset.k}/nome`] = i.value.trim(); }); await update('', p); toast('Reparti salvati', 'ok'); }
    else if (d.togliRep) {
      const usati = Object.values(S.menu.prodotti || {}).filter(p => p.reparto === d.togliRep).length;
      if (usati) return toast(`Prima sposta i ${usati} prodotti di questo reparto (Menù)`, 'err');
      if (await conferma('Eliminare il reparto?', 'Elimina', 'rosso')) await update('', { [`pubblico/info/reparti/${d.togliRep}`]: null });
    }
    else if (d.abilita) { const r = S.richieste[d.abilita]; await update('', { [`staff/${d.abilita}`]: { email: r.email, admin: false, creato: Date.now() }, [`richieste/${d.abilita}`]: null }); toast('Abilitato', 'ok'); }
    else if (d.rifiuta) await update('', { [`richieste/${d.rifiuta}`]: null });
    else if (d.admin) await update(`staff/${d.admin}`, { admin: !S.staff[d.admin].admin });
    else if (d.rimuovi) { if (await conferma(`Rimuovere ${S.staff[d.rimuovi].email} dallo staff?`, 'Rimuovi', 'rosso')) await update('', { [`staff/${d.rimuovi}`]: null }); }
    else if ('backup' in d) {
      const out = {};
      for (const p of ['pubblico', 'tavoli', 'qr', 'magazzino', 'serate', 'movimenti', 'ordini']) out[p] = await get(p);
      scarica(`backup-comanda-${oggi()}.json`, JSON.stringify(out, null, 2), 'application/json');
    }
    else if ('reset' in d) { if (await conferma('Cancellare tutti i dati della demo e ripartire dal menù di esempio?', 'Azzera', 'rosso')) { demoReset(seedTree()); await apriSerata(oggi(), 50); toast('Demo azzerata'); } }
    else if ('seed' in d) {
      const t = seedTree();
      await update('', { 'pubblico/menu': t.pubblico.menu, 'pubblico/info/reparti': t.pubblico.info.reparti, 'magazzino/ingredienti': t.magazzino.ingredienti,
        ...(Object.keys(S.tavoli).length ? {} : { tavoli: t.tavoli, qr: t.qr }), ...(S.info.nome ? {} : { 'pubblico/info/nome': t.pubblico.info.nome, 'pubblico/info/msgPronto': t.pubblico.info.msgPronto }) });
      aggiornaEsauriti(); toast('Dati di esempio caricati', 'ok');
    }
  });
  render();
  return onStore(() => { if (main.contains(document.activeElement) && document.activeElement.tagName === 'INPUT') return; render(); });
}
