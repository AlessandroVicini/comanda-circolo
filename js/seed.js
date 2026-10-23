// Dati di partenza (menù, ingredienti, tavoli). Prezzi e ricette sono esempi da adattare in "Menù" e "Magazzino".
export function token() {
  const a = new Uint8Array(9); crypto.getRandomValues(a);
  return Array.from(a, b => 'abcdefghijkmnpqrstuvwxyz23456789'[b % 32]).join('');
}

export function seedTree(nTavoli = 12) {
  const categorie = {
    panini:   { nome: 'Panini',    ordine: 1 },
    contorni: { nome: 'Patatine',  ordine: 2 },
    pizze:    { nome: 'Pizze',     ordine: 3 },
    bere:     { nome: 'Da bere',   ordine: 4 },
    caffe:    { nome: 'Caffè e amari', ordine: 5 },
  };
  const I = (nome, unita, giacenza, soglia, costo) => ({ nome, unita, giacenza, soglia, costo });
  const ingredienti = {
    hamburger:  I('Hamburger surgelato 100 g', 'pz', 40, 10, 0.95),
    hamb_veg:   I('Burger vegetale', 'pz', 10, 3, 1.30),
    panino:     I('Panino per hamburger', 'pz', 50, 10, 0.35),
    formaggio:  I('Formaggio a fette', 'pz', 60, 10, 0.15),
    bacon:      I('Bacon a fette', 'pz', 40, 8, 0.25),
    insalata:   I('Insalata e pomodoro (porz.)', 'pz', 50, 10, 0.20),
    salsa_picc: I('Salsa piccante (porz.)', 'pz', 30, 5, 0.10),
    patatine:   I('Patatine surgelate', 'kg', 10, 2.5, 2.40),
    impasto:    I('Panetto pizza 250 g', 'pz', 40, 8, 0.45),
    mozzarella: I('Mozzarella fior di latte', 'kg', 5, 1, 7.50),
    pomodoro:   I('Passata di pomodoro', 'kg', 5, 1, 1.60),
    cotto:      I('Prosciutto cotto', 'kg', 1.5, 0.3, 11.00),
    funghi:     I('Funghi', 'kg', 1.5, 0.3, 5.00),
    salamino:   I('Salamino piccante', 'kg', 1, 0.2, 13.00),
    acciughe:   I('Acciughe e capperi (porz.)', 'pz', 20, 4, 0.60),
    birra:      I('Birra alla spina', 'l', 30, 6, 2.20),
    vino:       I('Vino della casa', 'l', 10, 2, 3.00),
    spritz:     I('Base spritz (aperitivo + prosecco)', 'pz', 30, 6, 1.10),
    acqua:      I('Acqua 0,5 l', 'pz', 48, 12, 0.20),
    bibita:     I('Bibita in lattina', 'pz', 48, 12, 0.45),
    caffe:      I('Caffè (dose)', 'pz', 200, 30, 0.12),
    amaro:      I('Amaro (dose)', 'pz', 60, 10, 0.50),
  };
  let ord = 0;
  const P = (nome, prezzo, cat, reparto, ricetta, descr = '', allergeni = '') =>
    ({ nome, prezzo, cat, reparto, ricetta, descr, allergeni, attivo: true, esaurito: false, ordine: ++ord });
  const base = { panino: 1, hamburger: 1 };
  const prodotti = {
    compito:     P('Il Compito', 5.50, 'panini', 'cucina', { ...base }, 'Hamburger semplice', 'glutine'),
    ricreazione: P('La Ricreazione', 7.00, 'panini', 'cucina', { ...base, formaggio: 1, insalata: 1 }, 'Hamburger, formaggio, insalata e pomodoro', 'glutine, latte'),
    medicino:    P('Il Medicino', 7.00, 'panini', 'cucina', { ...base, formaggio: 1, bacon: 1 }, 'Hamburger, formaggio e bacon', 'glutine, latte'),
    santanna:    P("Il Sant'Anna", 7.50, 'panini', 'cucina', { ...base, formaggio: 1, bacon: 2, insalata: 1 }, 'Il panino della festa', 'glutine, latte'),
    discolo:     P('Il Discolo', 7.50, 'panini', 'cucina', { ...base, formaggio: 1, salsa_picc: 1 }, 'Piccante', 'glutine, latte'),
    preside:     P('Il Preside', 9.50, 'panini', 'cucina', { panino: 1, hamburger: 2, formaggio: 2, bacon: 2 }, 'Doppia carne', 'glutine, latte'),
    supplente:   P('Il Supplente', 6.50, 'panini', 'cucina', { panino: 1, hamb_veg: 1, insalata: 1 }, 'Vegetariano', 'glutine, soia'),
    intervallo:  P('Intervallo (patatine piccole)', 2.50, 'contorni', 'cucina', { patatine: 0.15 }),
    ultimaora:   P('Ultima Ora (patatine grandi)', 5.00, 'contorni', 'cucina', { patatine: 0.30 }),
    margherita:  P('Margherita', 5.00, 'pizze', 'pizzeria', { impasto: 1, mozzarella: 0.12, pomodoro: 0.08 }, '', 'glutine, latte'),
    cottofunghi: P('Cotto e funghi', 6.50, 'pizze', 'pizzeria', { impasto: 1, mozzarella: 0.12, pomodoro: 0.08, cotto: 0.06, funghi: 0.06 }, '', 'glutine, latte'),
    diavola:     P('Diavola', 6.50, 'pizze', 'pizzeria', { impasto: 1, mozzarella: 0.12, pomodoro: 0.08, salamino: 0.05 }, '', 'glutine, latte'),
    acciughe:    P('Acciughe e capperi', 6.50, 'pizze', 'pizzeria', { impasto: 1, mozzarella: 0.12, pomodoro: 0.08, acciughe: 1 }, '', 'glutine, latte, pesce'),
    birra_m:     P('Birra media', 4.00, 'bere', 'bar', { birra: 0.4 }, '', 'glutine'),
    birra_p:     P('Birra piccola', 2.50, 'bere', 'bar', { birra: 0.2 }, '', 'glutine'),
    spritz:      P('Spritz', 4.50, 'bere', 'bar', { spritz: 1 }, '', 'solfiti'),
    vino:        P('Calice di vino', 2.50, 'bere', 'bar', { vino: 0.15 }, '', 'solfiti'),
    acqua:       P('Acqua 0,5 l', 1.00, 'bere', '', { acqua: 1 }),
    bibita:      P('Bibita in lattina', 2.00, 'bere', '', { bibita: 1 }),
    caffe:       P('Caffè', 1.00, 'caffe', 'bar', { caffe: 1 }),
    amaro:       P('Amaro', 2.50, 'caffe', 'bar', { amaro: 1 }),
  };
  const tavoli = {}, qr = {};
  for (let i = 1; i <= nTavoli; i++) { tavoli[i] = { nome: String(i), attivo: true }; qr[i] = token(); }
  qr.asporto = token() + token();
  return {
    pubblico: {
      info: {
        nome: 'Circolo Ricreazione',
        qrAttivo: true,
        serata: null,
        msgPronto: 'Il tuo ordine è pronto: passa a ritirarlo al banco!',
        asporto: { attivo: true, online: true, inizio: '19:00', fine: '22:00', passo: 15, maxPerFascia: 6, anticipo: 20 },
        reparti: {
          cucina:   { nome: 'Cucina',   ordine: 1 },
          pizzeria: { nome: 'Pizzeria', ordine: 2 },
          bar:      { nome: 'Bar',      ordine: 3 },
        },
      },
      menu: { categorie, prodotti },
    },
    tavoli, qr,
    magazzino: { ingredienti },
  };
}
