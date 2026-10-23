// Livello dati: Firebase Realtime Database (online) oppure demo locale (stesso browser, più schede).
import { FIREBASE_CONFIG } from './config.js';

const INC = '__inc';
const listeners = new Set();
let fb = null;          // modulo firebase (caricato solo se configurato)
let fdb = null, fauth = null;
let demoTree = {};
const DEMO_KEY = 'comanda-circolo-demo-v1';

export const db = {
  mode: 'demo',
  user: null,          // {uid, email, anonimo}
  staff: null,         // {email, admin} se l'utente è staff
  ready: false,
};

/* ---------------- utilità percorsi ---------------- */
const parts = p => String(p || '').split('/').filter(Boolean);
function getAt(tree, p) {
  let n = tree;
  for (const k of parts(p)) { if (n == null || typeof n !== 'object') return null; n = n[k]; }
  return n === undefined ? null : n;
}
function clone(v) { return v == null ? null : JSON.parse(JSON.stringify(v)); }
function setAt(tree, p, val) {
  const ks = parts(p);
  if (!ks.length) return clone(val) || {};
  let n = tree;
  for (let i = 0; i < ks.length - 1; i++) {
    if (n[ks[i]] == null || typeof n[ks[i]] !== 'object') n[ks[i]] = {};
    n = n[ks[i]];
  }
  const last = ks[ks.length - 1];
  if (val && typeof val === 'object' && val[INC] !== undefined) {
    n[last] = (Number(n[last]) || 0) + val[INC];
  } else if (val == null) {
    delete n[last];
  } else {
    n[last] = clone(val);
  }
  prune(tree, ks.slice(0, -1));
  return tree;
}
function prune(tree, ks) { // rimuove oggetti vuoti come fa Firebase
  for (let i = ks.length; i > 0; i--) {
    const parent = getAt(tree, ks.slice(0, i - 1).join('/'));
    const node = parent && parent[ks[i - 1]];
    if (node && typeof node === 'object' && !Object.keys(node).length) delete parent[ks[i - 1]];
    else break;
  }
}
const join = (a, b) => [...parts(a), ...parts(b)].join('/');

/* ---------------- demo ---------------- */
let bc = null;
function demoLoad() {
  try { demoTree = JSON.parse(localStorage.getItem(DEMO_KEY)) || {}; } catch { demoTree = {}; }
}
function demoSave() {
  try { localStorage.setItem(DEMO_KEY, JSON.stringify(demoTree)); } catch {}
  try { bc && bc.postMessage('x'); } catch {}
  fireAll();
}
function fireAll() { for (const l of listeners) l.check(); }
export function demoReset(seedTree) { demoTree = clone(seedTree) || {}; demoSave(); }
export function demoIsEmpty() { return !demoTree.pubblico; }

/* ---------------- init ---------------- */
export async function initDb() {
  if (FIREBASE_CONFIG && FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.databaseURL) {
    db.mode = 'firebase';
    const V = 'https://www.gstatic.com/firebasejs/10.14.1/';
    const [a, au, d] = await Promise.all([import(V + 'firebase-app.js'), import(V + 'firebase-auth.js'), import(V + 'firebase-database.js')]);
    fb = { ...a, ...au, ...d };
    const app = fb.initializeApp(FIREBASE_CONFIG);
    fauth = fb.getAuth(app);
    fdb = fb.getDatabase(app);
    await new Promise(res => {
      let first = true;
      fb.onAuthStateChanged(fauth, async u => {
        db.user = u ? { uid: u.uid, email: u.email, anonimo: u.isAnonymous } : null;
        db.staff = null;
        if (u && !u.isAnonymous) {
          try {
            const s = await fb.get(fb.ref(fdb, 'staff/' + u.uid));
            db.staff = s.exists() ? s.val() : null;
          } catch { db.staff = null; }
        }
        db.ready = true;
        authCbs.forEach(cb => cb(db.user));
        if (first) { first = false; res(); }
      });
    });
  } else {
    db.mode = 'demo';
    demoLoad();
    db.user = { uid: 'demo', email: 'demo', anonimo: false };
    db.staff = { email: 'demo', admin: true };
    db.ready = true;
    try { bc = new BroadcastChannel(DEMO_KEY); bc.onmessage = () => { demoLoad(); fireAll(); }; } catch {}
    window.addEventListener('storage', e => { if (e.key === DEMO_KEY) { demoLoad(); fireAll(); } });
  }
}

const authCbs = new Set();
export function onAuth(cb) { authCbs.add(cb); return () => authCbs.delete(cb); }

/* ---------------- API ---------------- */
export const inc = n => db.mode === 'firebase' ? fb.increment(n) : { [INC]: n };

export function on(path, cb) {
  if (db.mode === 'firebase') {
    return fb.onValue(fb.ref(fdb, path), s => cb(s.val()), err => { console.warn('lettura negata', path, err.message); cb(null); });
  }
  const l = { last: undefined, check() { const v = getAt(demoTree, path); const j = JSON.stringify(v); if (j !== this.last) { this.last = j; cb(clone(v)); } } };
  listeners.add(l); l.check();
  return () => listeners.delete(l);
}

// Ascolta i figli di `path` dove figlio[key] === value
export function onWhere(path, key, value, cb) {
  if (db.mode === 'firebase') {
    const q = fb.query(fb.ref(fdb, path), fb.orderByChild(key), fb.equalTo(value));
    return fb.onValue(q, s => cb(s.val() || {}), err => { console.warn('query negata', path, err.message); cb({}); });
  }
  const l = { last: undefined, check() {
    const all = getAt(demoTree, path) || {}; const out = {};
    for (const [k, v] of Object.entries(all)) if (v && v[key] === value) out[k] = v;
    const j = JSON.stringify(out); if (j !== this.last) { this.last = j; cb(clone(out)); }
  } };
  listeners.add(l); l.check();
  return () => listeners.delete(l);
}

export async function get(path) {
  if (db.mode === 'firebase') { const s = await fb.get(fb.ref(fdb, path)); return s.val(); }
  return clone(getAt(demoTree, path));
}
export async function set(path, val) {
  if (db.mode === 'firebase') return fb.set(fb.ref(fdb, path), val);
  setAt(demoTree, path, val); demoSave();
}
// aggiornamento multi-percorso: chiavi relative a `base` (es. update('', {'a/b': 1, 'c': 2}))
export async function update(base, obj) {
  if (db.mode === 'firebase') return fb.update(fb.ref(fdb, base || '/'), obj);
  for (const [k, v] of Object.entries(obj)) setAt(demoTree, join(base, k), v === undefined ? null : v);
  demoSave();
}
export async function remove(path) {
  if (db.mode === 'firebase') return fb.remove(fb.ref(fdb, path));
  setAt(demoTree, path, null); demoSave();
}
export function newKey(path) {
  if (db.mode === 'firebase') return fb.push(fb.ref(fdb, path)).key;
  // chiave ordinabile nel tempo, come quelle di Firebase
  return Date.now().toString(36).padStart(9, '0') + Math.random().toString(36).slice(2, 8);
}
export async function push(path, val) { const k = newKey(path); await set(join(path, k), val); return k; }

export async function transaction(path, fn) {
  if (db.mode === 'firebase') {
    const r = await fb.runTransaction(fb.ref(fdb, path), fn);
    return { committed: r.committed, value: r.snapshot.val() };
  }
  const cur = clone(getAt(demoTree, path));
  const next = fn(cur);
  if (next === undefined) return { committed: false, value: cur };
  setAt(demoTree, path, next); demoSave();
  return { committed: true, value: clone(next) };
}

/* ---------------- autenticazione ---------------- */
export async function signInGuest() {
  if (db.mode !== 'firebase') return db.user;
  if (fauth.currentUser) return db.user;
  await fb.signInAnonymously(fauth);
  return { uid: fauth.currentUser.uid, anonimo: true };
}
export async function signInStaff(email, pw) {
  await fb.signInWithEmailAndPassword(fauth, email, pw);
  return reloadStaff();
}
export async function signUpStaff(email, pw) {
  const c = await fb.createUserWithEmailAndPassword(fauth, email, pw);
  const uid = c.user.uid;
  // Il primo account in assoluto diventa amministratore (le regole lo permettono solo se /staff è vuoto)
  try { await fb.set(fb.ref(fdb, 'staff/' + uid), { email, admin: true, creato: Date.now() }); }
  catch { await fb.set(fb.ref(fdb, 'richieste/' + uid), { email, ts: Date.now() }).catch(() => {}); }
  return reloadStaff();
}
export async function reloadStaff() {
  const u = fauth.currentUser;
  db.user = u ? { uid: u.uid, email: u.email, anonimo: u.isAnonymous } : null;
  db.staff = null;
  if (u && !u.isAnonymous) {
    try { const s = await fb.get(fb.ref(fdb, 'staff/' + u.uid)); db.staff = s.exists() ? s.val() : null; } catch {}
  }
  return db.staff;
}
export async function signOutAll() { if (db.mode === 'firebase') await fb.signOut(fauth); }
