// ─────────────────────────────────────────────────────────────────────────────
//  CONFIGURAZIONE FIREBASE
//  Finché FIREBASE_CONFIG è null l'app gira in MODALITÀ DEMO: i dati restano
//  nel browser e le schede aperte si parlano tra loro (utile per provare).
//
//  Per andare online incolla qui sotto l'oggetto che Firebase ti dà in
//  Impostazioni progetto → Le tue app → App web (vedi README.md, passo 3).
//  Questi valori non sono segreti: la protezione è data dalle regole
//  del database (file database.rules.json).
// ─────────────────────────────────────────────────────────────────────────────

export const FIREBASE_CONFIG = null;

/* Esempio di come deve diventare:
export const FIREBASE_CONFIG = {
  apiKey: "AIza...",
  authDomain: "comanda-circolo.firebaseapp.com",
  databaseURL: "https://comanda-circolo-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "comanda-circolo",
  storageBucket: "comanda-circolo.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef"
};
*/
