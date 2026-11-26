// Application des retraites — Église copte orthodoxe Sainte Marie et Saint Jean
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  sendEmailVerification, sendPasswordResetEmail, signOut, reload } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection, onSnapshot,
  runTransaction, writeBatch, increment, deleteField, Timestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { firebaseConfig } from "./config.js";

const fb = initializeApp(firebaseConfig);
const auth = getAuth(fb); auth.languageCode = 'fr';
const db = getFirestore(fb);

/* ---------- outils ---------- */
const $ = s => document.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const low = s => String(s || '').trim().toLowerCase();
const fmt = (d, o) => d ? new Date(d + 'T12:00').toLocaleDateString('fr-FR', o || {day:'numeric', month:'long', year:'numeric'}) : '—';
const eur = n => (+n || 0).toLocaleString('fr-FR', {style:'currency', currency:'EUR', maximumFractionDigits:0});
const today = () => new Date().toISOString().slice(0, 10);
const age = d => { if (!d) return null; const b = new Date(d + 'T12:00'), n = new Date(); let a = n.getFullYear() - b.getFullYear(); if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a--; return a };
const byName = (a, b) => (a.nom || '').localeCompare(b.nom || '', 'fr', {numeric:true});
const name = i => `${i.prenom || ''} ${i.nom || ''}`.trim();
const SEXE = {H:'Homme', F:'Femme'}, TYPE = {H:'Hommes', F:'Femmes'};
const STATUTS = ['Confirmée', 'En attente', "Liste d'attente", 'Annulée'];
const TYPES = {'Office / prière':'#6b4fa0','Messe':'#c48a2c','Enseignement':'#2f6b8f','Temps de silence':'#8a8396','Partage':'#2f7a5a','Accompagnement':'#a0566b','Repas':'#b0703a','Temps libre':'#5f8f3f'};
const ICO = {
  accueil:'<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 9.8V20h13V9.8"/><path d="M10 20v-5.5h4V20"/>',
  programme:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M7.5 14h3M13.5 14h3M7.5 17.5h3"/>',
  chambres:'<path d="M3 19V6M3 15h18v4M21 15v-2.5A3.5 3.5 0 0 0 17.5 9H11v6"/><circle cx="7" cy="11.5" r="2"/>',
  infos:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><circle cx="12" cy="7.6" r=".6" fill="currentColor"/>',
  inscriptions:'<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 4.8a3 3 0 0 1 0 6M18 14.5c1.8.8 3 2.7 3 5.5"/>',
  retraites:'<path d="M9 6h12M9 12h12M9 18h12"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
  equipe:'<path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6z"/><path d="M9 12l2 2 4-4"/>'};
const V_ADMIN = {inscriptions:'Inscriptions', programme:'Programme', chambres:'Chambres', infos:'Infos pratiques', retraites:'Retraites', equipe:'Organisateurs'};
const V_PART = {accueil:'Accueil', programme:'Programme', chambres:'Chambres', infos:'Infos pratiques'};
const SEAL = '<img class="seal" src="logo.png" alt=""><div class="eb"><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#copte"/></svg>ÉGLISE COPTE ORTHODOXE<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#copte"/></svg></div>';

function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('on'), 3200) }
function authErr(e) {
  const c = e && e.code || '';
  return ({
    'auth/invalid-credential':'Adresse e-mail ou mot de passe incorrect.',
    'auth/wrong-password':'Adresse e-mail ou mot de passe incorrect.',
    'auth/user-not-found':'Aucun compte avec cette adresse. Utilisez « Première connexion ».',
    'auth/email-already-in-use':'Un compte existe déjà avec cette adresse : connectez-vous, ou utilisez « Mot de passe oublié ».',
    'auth/weak-password':'Le mot de passe doit contenir au moins 8 caractères.',
    'auth/invalid-email':'Cette adresse e-mail n’est pas valide.',
    'auth/too-many-requests':'Trop d’essais. Patientez quelques minutes puis réessayez.',
    'auth/network-request-failed':'Pas de connexion Internet. Vérifiez votre réseau.',
    'auth/missing-password':'Indiquez votre mot de passe.'
  })[c] || 'Une erreur est survenue. Réessayez dans un instant.';
}
function dbErr(e) {
  const c = e && e.code || '';
  if (c === 'permission-denied') return 'Action refusée : vous n’avez pas les droits nécessaires.';
  if (c === 'unavailable') return 'Pas de connexion Internet : réessayez.';
  return e && e.message && !c ? e.message : 'Enregistrement impossible, réessayez.';
}

/* ---------- état ---------- */
const S = {user:null, admin:false, rets:[], rid:null, ret:null, prog:[], rooms:[], ins:[], orgs:[], me:null, myRets:[], q:'', fStat:'', toolsKey:'', editing:null};
let unsubs = [], retUnsub = null, orgUnsub = null;
const stopAll = () => { unsubs.forEach(u => u()); unsubs = []; retUnsub && retUnsub(); retUnsub = null; orgUnsub && orgUnsub(); orgUnsub = null };
const ADM = () => S.admin && !S.preview;          // vue organisateur (hors aperçu)
const V = () => ADM() ? V_ADMIN : V_PART;
// Personne affichée côté retraitant : soi-même, ou en aperçu un inscrit / un exemple.
function ME() {
  if (!S.preview) return S.me;
  const i = S.ins.find(x => x.id === S.pv);
  if (i) return {...i, sexe: i.sexe || 'H'};
  const f = S.pv === 'demoF';
  return {id: 'exemple', email: 'exemple@paroisse.fr', prenom: f ? 'Marie' : 'Jean', nom: 'Exemple', sexe: f ? 'F' : 'H', naissance: '1990-06-15', statut: 'Confirmée', montant: 0, chambreId: ''};
}
const view = () => { const h = location.hash.slice(1); return V()[h] ? h : Object.keys(V())[0] };

/* ---------- écrans d'accueil ---------- */
function gate(html) { $('#app').hidden = true; $('#gate').hidden = false; $('#gatecard').innerHTML = SEAL + html }
function showApp() { $('#gate').hidden = true; $('#app').hidden = false }

function loginScreen(mode = 'login', note = '') {
  const create = mode === 'create';
  gate(`<h1>Retraites spirituelles</h1><p class="sub">${create ? 'Première connexion : créez votre mot de passe avec l’adresse e-mail donnée lors de votre inscription.' : 'Connectez-vous avec l’adresse e-mail donnée lors de votre inscription.'}</p>
  <div class="seg" role="group"><button type="button" data-mode="login" aria-pressed="${!create}">Se connecter</button><button type="button" data-mode="create" aria-pressed="${create}">Première connexion</button></div>
  ${note}<p class="msg err" id="gerr" hidden></p>
  <form id="gform" novalidate>
   <label><span>Adresse e-mail</span><input name="email" type="email" autocomplete="email" inputmode="email" required></label>
   <label><span>${create ? 'Choisissez un mot de passe (8 caractères minimum)' : 'Mot de passe'}</span><input name="pw" type="password" autocomplete="${create ? 'new-password' : 'current-password'}" required></label>
   ${create ? '<label><span>Confirmez le mot de passe</span><input name="pw2" type="password" autocomplete="new-password" required></label>' : ''}
   <button class="pri">${create ? 'Créer mon accès' : 'Se connecter'}</button>
  </form>
  <div class="alt">${create ? '' : '<button type="button" class="link" id="forgot">Mot de passe oublié ?</button>'}<button type="button" class="link" id="howto">Installer l’application</button></div>`);
  const err = t => { const e = $('#gerr'); e.textContent = t; e.hidden = !t };
  $('#gatecard').querySelectorAll('[data-mode]').forEach(b => b.onclick = () => loginScreen(b.dataset.mode));
  $('#howto').onclick = howTo;
  if (!create) $('#forgot').onclick = async () => {
    const email = low($('#gform').email.value);
    if (!email) return err('Tapez d’abord votre adresse e-mail ci-dessus, puis touchez « Mot de passe oublié ».');
    try { await sendPasswordResetEmail(auth, email); loginScreen('login', `<p class="msg okm">Si un compte existe pour ${esc(email)}, un e-mail pour choisir un nouveau mot de passe vient d’être envoyé. Pensez à regarder dans les courriers indésirables.</p>`) }
    catch (e) { err(authErr(e)) }
  };
  $('#gform').onsubmit = async e => {
    e.preventDefault(); const f = e.target, email = low(f.email.value), pw = f.pw.value;
    if (!email || !pw) return err('Remplissez votre adresse e-mail et votre mot de passe.');
    const b = f.querySelector('button'); b.disabled = true;
    try {
      if (create) {
        if (pw.length < 8) { b.disabled = false; return err('Le mot de passe doit contenir au moins 8 caractères.') }
        if (pw !== f.pw2.value) { b.disabled = false; return err('Les deux mots de passe ne sont pas identiques.') }
        const cred = await createUserWithEmailAndPassword(auth, email, pw);
        await sendEmailVerification(cred.user, {url: location.href.split('#')[0]});
      } else await signInWithEmailAndPassword(auth, email, pw);
    } catch (x) { b.disabled = false; err(authErr(x)) }
  };
}
function verifyScreen(u) {
  gate(`<h1>Confirmez votre adresse</h1><p class="sub">Un e-mail a été envoyé à <b>${esc(u.email)}</b>. Ouvrez-le et touchez le lien de confirmation, puis revenez ici.</p>
  <p class="warn-box">Vous ne le trouvez pas ? Regardez dans les courriers indésirables (spam). L’e-mail vient de « noreply@ste-marie-et-st-jean-app.firebaseapp.com ».</p>
  <p class="msg err" id="gerr" hidden></p>
  <button class="pri" id="done">J’ai confirmé mon adresse</button>
  <div class="alt"><button type="button" class="link" id="resend">Renvoyer l’e-mail</button><button type="button" class="link" id="out">Changer d’adresse</button></div>`);
  $('#done').onclick = async () => { await reload(u); if (auth.currentUser.emailVerified) { await auth.currentUser.getIdToken(true); start(auth.currentUser) } else { const e = $('#gerr'); e.textContent = 'L’adresse n’est pas encore confirmée. Touchez le lien reçu par e-mail, puis réessayez.'; e.hidden = false } };
  $('#resend').onclick = async () => { try { await sendEmailVerification(u, {url: location.href.split('#')[0]}); toast('E-mail renvoyé.') } catch (e) { toast(authErr(e)) } };
  $('#out').onclick = () => signOut(auth);
}
function deniedScreen(email, why) {
  gate(`<h1>Accès non disponible</h1><p class="sub">${why}</p><p class="warn-box">Adresse utilisée : <b>${esc(email)}</b>. Si vous pensez qu’il s’agit d’une erreur, contactez les organisateurs de la retraite.</p><button class="pri" id="out">Se déconnecter</button>`);
  $('#out').onclick = () => signOut(auth);
}
function profileScreen() {
  const me = S.me;
  gate(`<h1>Bienvenue, ${esc(name(me))}</h1><p class="sub">Avant de commencer, complétez votre fiche. Elle sert notamment au choix des chambres.</p>
  <p class="msg err" id="gerr" hidden></p>
  <form id="gform" novalidate>
   <p style="font-weight:600;font-size:14px;margin:0 0 6px">Vous êtes</p>
   <div class="radios"><label><input type="radio" name="sexe" value="H"> Un homme</label><label><input type="radio" name="sexe" value="F"> Une femme</label></div>
   <label><span>Date de naissance</span><input name="naissance" type="date" max="${today()}" required></label>
   <p class="warn-box">Ces informations ne pourront plus être modifiées par vous. En cas d’erreur, demandez aux organisateurs. Elles ne sont visibles que par vous et les organisateurs.</p>
   <button class="pri">Valider ma fiche</button>
  </form>`);
  $('#gform').onsubmit = async e => {
    e.preventDefault(); const f = e.target, sexe = f.sexe.value, nai = f.naissance.value, err = $('#gerr');
    if (!sexe || !/^\d{4}-\d{2}-\d{2}$/.test(nai) || nai > today()) { err.textContent = 'Indiquez si vous êtes un homme ou une femme, et votre date de naissance.'; err.hidden = false; return }
    f.querySelector('button').disabled = true;
    try { await updateDoc(doc(db, 'retraites', S.rid, 'inscrits', low(S.user.email)), {sexe, naissance: nai, profilLe: today()}) }
    catch (x) { f.querySelector('button').disabled = false; err.textContent = dbErr(x); err.hidden = false }
  };
}
function howTo() {
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  openDlg(`<h2>Installer l’application</h2>
  ${ios ? '<p><b>Sur iPhone (Safari)</b> : touchez le bouton <b>Partager</b> (carré avec une flèche vers le haut), puis <b>« Sur l’écran d’accueil »</b>, puis <b>Ajouter</b>.</p>'
       : '<p><b>Sur Android (Chrome)</b> : touchez le menu <b>⋮</b> en haut à droite, puis <b>« Installer l’application »</b> ou <b>« Ajouter à l’écran d’accueil »</b>.</p><p><b>Sur iPhone (Safari)</b> : bouton <b>Partager</b>, puis <b>« Sur l’écran d’accueil »</b>.</p>'}
  <p class="dim">L’icône de la paroisse apparaît alors sur votre écran, et l’application s’ouvre comme les autres.</p>
  ${S.installEvt ? '<div class="acts"><button type="button" class="pri" id="doinstall">Installer maintenant</button></div>' : ''}
  <div class="acts"><span class="sp"></span><button type="button" data-close>Fermer</button></div>`, {col:'info'});
  const b = $('#doinstall'); if (b) b.onclick = async () => { S.installEvt.prompt(); S.installEvt = null; closeDlg() };
}
addEventListener('beforeinstallprompt', e => { e.preventDefault(); S.installEvt = e });

/* ---------- démarrage selon l'utilisateur ---------- */
onAuthStateChanged(auth, u => { stopAll(); Object.assign(S, {user: u, admin: false, resp: false, preview: false, pv: 'demoH', rid: null, ret: null, me: null, rets: [], myRets: [], ins: [], rooms: [], prog: [], orgs: [], toolsKey: ''}); if (!u) return loginScreen(); start(u) });

async function start(u) {
  if (!u.emailVerified) return verifyScreen(u);
  gate('<p class="spin">Ouverture de votre espace…</p>');
  const email = low(u.email);
  try {
    const org = await getDoc(doc(db, 'organisateurs', email));
    if (org.exists()) { S.admin = true; S.resp = org.data().role === 'responsable'; return startAdmin() }
  } catch (e) { /* pas organisateur */ }
  S.admin = false;
  let rids = [];
  try { const a = await getDoc(doc(db, 'acces', email)); rids = a.exists() ? Object.keys(a.data().r || {}) : [] } catch (e) { rids = [] }
  const ok = [];
  for (const rid of rids) {
    try { const r = await getDoc(doc(db, 'retraites', rid)); if (r.exists()) ok.push({id: rid, ...r.data()}) } catch (e) { /* inscription non confirmée ou accès terminé */ }
  }
  if (!ok.length) return deniedScreen(email, rids.length
    ? 'Votre accès n’est pas ouvert : votre inscription n’est pas encore confirmée, ou la retraite est terminée depuis plus d’une semaine.'
    : 'Cette adresse ne correspond à aucune inscription confirmée.');
  ok.sort((a, b) => (a.debut || '').localeCompare(b.debut || ''));
  S.myRets = ok;
  let saved = null; try { saved = localStorage.getItem('retraite') } catch (e) {}
  S.rid = (ok.find(r => r.id === saved) || ok.find(r => (r.fin || '') >= today()) || ok[ok.length - 1]).id;
  startParticipant();
}

function subRetreat(onFirst) {
  // abonnements aux données de la retraite choisie
  unsubs.forEach(u => u()); unsubs = [];
  S.prog = []; S.rooms = []; S.ins = []; S.toolsKey = '';
  const rid = S.rid, base = ['retraites', rid];
  const fail = e => { $('#msg').innerHTML = `<p class="note">${esc(dbErr(e))}</p>` };
  unsubs.push(onSnapshot(doc(db, ...base), s => { S.ret = s.exists() ? {id: s.id, ...s.data()} : null; render() }, fail));
  unsubs.push(onSnapshot(collection(db, ...base, 'programme'), s => { S.prog = s.docs.map(d => ({id: d.id, ...d.data()})); render() }, fail));
  unsubs.push(onSnapshot(collection(db, ...base, 'chambres'), s => { S.rooms = s.docs.map(d => ({id: d.id, ...d.data()})); render() }, fail));
  if (S.admin) unsubs.push(onSnapshot(collection(db, ...base, 'inscrits'), s => { S.ins = s.docs.map(d => ({id: d.id, ...d.data()})); render() }, fail));
  else unsubs.push(onSnapshot(doc(db, ...base, 'inscrits', low(S.user.email)), s => {
    S.me = s.exists() ? {id: s.id, ...s.data()} : null;
    if (!S.me || S.me.statut !== 'Confirmée') return deniedScreen(low(S.user.email), 'Votre inscription n’est plus confirmée. Contactez les organisateurs.');
    if (!S.me.sexe) return profileScreen();
    showApp(); render(); onFirst && onFirst(); onFirst = null;
  }, e => deniedScreen(low(S.user.email), 'Votre accès à cette retraite est terminé.')));
}
function startParticipant() { subRetreat(); }
function startAdmin() {
  showApp();
  retUnsub = onSnapshot(collection(db, 'retraites'), s => {
    S.rets = s.docs.map(d => ({id: d.id, ...d.data()}));
    if (!S.rets.find(r => r.id === S.rid)) {
      let saved = null; try { saved = localStorage.getItem('retraite') } catch (e) {}
      const L = [...S.rets].sort((a, b) => (a.debut || '').localeCompare(b.debut || ''));
      const r = L.find(x => x.id === saved) || L.find(x => (x.fin || '') >= today()) || L[L.length - 1];
      S.rid = r ? r.id : null; S.ret = r || null;
      if (S.rid) subRetreat(); else { unsubs.forEach(u => u()); unsubs = [] }
    }
    render();
  }, e => toast(dbErr(e)));
  orgUnsub = onSnapshot(collection(db, 'organisateurs'), s => { S.orgs = s.docs.map(d => ({id: d.id, ...d.data()})); render() });
}
function setRetreat(id) { S.rid = id; S.ret = (S.admin ? S.rets : S.myRets).find(r => r.id === id) || null; try { localStorage.setItem('retraite', id) } catch (e) {} subRetreat(); render() }

/* ---------- rendu principal ---------- */
function render() {
  if ($('#app').hidden) return;
  const r = S.ret, v = view();
  const list = S.admin ? S.rets : S.myRets;
  const pick = $('#pick');
  pick.hidden = !(S.admin ? list.length : list.length > 1);
  pick.innerHTML = [...list].sort((a, b) => (a.debut || '').localeCompare(b.debut || '')).map(x => `<option value="${esc(x.id)}"${x.id === S.rid ? ' selected' : ''}>${esc(x.titre)} — ${fmt(x.debut, {day:'numeric', month:'short', year:'numeric'})}</option>`).join('');
  $('#whoami').textContent = S.admin ? (S.resp ? 'Responsable' : 'Organisateur') : (S.me ? name(S.me) : '');
  const pb = $('#pvbtn'); pb.hidden = !S.admin; pb.textContent = S.preview ? 'Quitter l’aperçu' : 'Aperçu retraitant'; pb.classList.toggle('on', S.preview);
  const bar = $('#pvbar'); bar.hidden = !S.preview;
  if (S.preview) {
    const C = S.ins.filter(i => i.statut === 'Confirmée').sort(byName);
    bar.innerHTML = `<div class="wrap pvin"><b>Mode aperçu</b><span>L’application telle que la voit</span><select id="pvsel" aria-label="Voir l’application comme"><option value="demoH"${S.pv === 'demoH' ? ' selected' : ''}>un retraitant (exemple homme)</option><option value="demoF"${S.pv === 'demoF' ? ' selected' : ''}>une retraitante (exemple femme)</option>${C.length ? `<optgroup label="Inscrits confirmés">${C.map(i => `<option value="${esc(i.id)}"${S.pv === i.id ? ' selected' : ''}>${esc(name(i))}${i.sexe ? '' : ' (fiche non remplie)'}</option>`).join('')}</optgroup>` : ''}</select><span class="dim2">Lecture seule : aucune action n’est enregistrée.</span></div>`;
  }
  $('#hero').innerHTML = hero(r);
  const unread = !ADM() && r && v !== 'infos' && hasUnread(r);
  $('#tabs').innerHTML = Object.entries(V()).map(([k, l]) => `<a href="#${k}" aria-label="${l}${k === 'infos' && unread ? ' — nouvelle annonce' : ''}" title="${l}"${k === v ? ' aria-current="page"' : ''}${k === 'infos' && unread ? ' class="dotted"' : ''}><svg viewBox="0 0 24 24" aria-hidden="true">${ICO[k]}</svg></a>`).join('');
  if (!r && !['retraites', 'equipe'].includes(v)) {
    S.toolsKey = ''; $('#tools').innerHTML = '';
    $('#list').innerHTML = ADM() ? '<div class="empty"><h3>Aucune retraite</h3><p>Commencez par créer la première retraite.</p><button class="pri" data-new="retraites">Créer une retraite</button></div>' : '';
    return;
  }
  ({accueil: vHome, inscriptions: vInscr, programme: vProg, chambres: ADM() ? vRoomsAdmin : vRoomsPart, infos: vInfos, retraites: vRet, equipe: vTeam})[v](r);
}
function tools(key, html) { key = (S.preview ? 'pv' + S.pv : '') + key; if (S.toolsKey !== key) { S.toolsKey = key; $('#tools').innerHTML = html } }

function hero(r) {
  if (!r) return `<h1>${ADM() ? 'Espace organisateurs' : 'Bienvenue'}</h1>`;
  const nuits = Math.max(0, Math.round((new Date(r.fin) - new Date(r.debut)) / 864e5));
  const head = `${!S.admin && S.me ? `<p class="welcome">Bienvenue, <b>${esc(name(S.me))}</b></p>` : `<p class="kick">${S.admin ? 'ESPACE ORGANISATEURS' : 'RETRAITE SPIRITUELLE'}</p>`}<h1>${esc(r.titre)}</h1><p class="meta">${r.theme ? `<span>${esc(r.theme)}</span>` : ''}<span>${fmt(r.debut, {day:'numeric', month:'long'})} → ${fmt(r.fin)}${nuits ? ` · ${nuits} nuit${nuits > 1 ? 's' : ''}` : ''}</span>${r.lieu ? `<span>${esc(r.lieu)}</span>` : ''}${r.animateur ? `<span>Prêchée par ${esc(r.animateur)}</span>` : ''}</p>`;
  if (!ADM()) return `<div class="hello"><p class="hello-k">Bienvenue</p><p class="hello-n">${esc(ME() ? name(ME()) : '')}</p><div class="hello-r"><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#copte"/></svg><span>${esc(r.titre)}</span><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#copte"/></svg></div></div>`;
  const A = S.ins.filter(i => i.statut === 'Confirmée'), cap = +r.capacite || 0, att = S.ins.filter(i => i.statut === "Liste d'attente").length;
  const due = A.length * (+r.prix || 0), paid = S.ins.filter(i => i.statut !== 'Annulée').reduce((s, i) => s + (+i.montant || 0), 0), loges = A.filter(i => i.chambreId).length;
  return head + `<div class="stats">
   <div class="stat"><b>${A.length}${cap ? ` / ${cap}` : ''}</b><small>inscrits confirmés${att ? ` · ${att} en attente de place` : ''}</small>${cap ? `<div class="meter"><i style="width:${Math.min(100, A.length / cap * 100)}%"></i></div>` : ''}</div>
   <div class="stat"><b>${A.filter(i => i.sexe).length} / ${A.length}</b><small>fiches complétées</small></div>
   <div class="stat"><b>${eur(paid)}</b><small>encaissés sur ${eur(due)} attendus</small>${due ? `<div class="meter"><i style="width:${Math.min(100, paid / due * 100)}%"></i></div>` : ''}</div>
   <div class="stat"><b>${loges} / ${A.length}</b><small>ont une chambre</small></div></div>`;
}
function open_() { const r = S.ret; return !!r && (!r.limiteChambresTs || r.limiteChambresTs.toMillis() > Date.now()) }

/* ---------- formulaires ---------- */
const F = {
  retraites: {t:'retraite', f:[['titre','Titre','text',1],['theme','Thème'],['debut','Arrivée','date',1],['fin','Départ','date',1],['lieu','Lieu'],['animateur','Prédicateur / animateur'],['capacite','Capacité (personnes)','number'],['prix','Prix par personne (€)','number'],['accueil','Horaires d’accueil et de départ'],['dateLimiteChambres','Date limite du choix des chambres','date'],['description','Présentation courte','textarea']]},
  inscrits: {t:'inscription', f:[['prenom','Prénom','text',1],['nom','Nom','text',1],['email','E-mail (sert à la connexion)','email',1],['tel','Téléphone','tel'],['ville','Ville'],['statut','Statut',STATUTS],['sexe','Sexe',[['','— Non renseigné —'],['H','Homme'],['F','Femme']]],['naissance','Date de naissance','date'],['montant','Montant réglé (€)','number'],['chambreId','Chambre','chambre'],['regime','Régime / allergies'],['notes','Notes (accompagnement, santé, transport…)','textarea']]},
  chambres: {t:'chambre', f:[['nom','Nom de la chambre','text',1],['type','Réservée aux',[['H','Hommes'],['F','Femmes']]],['lits','Nombre de places','number',1],['batiment','Bâtiment / étage'],['pmr','Accessible PMR',['Non','Oui']]]},
  programme: {t:'activité', f:[['date','Jour','date',1],['heure','Début','time',1],['fin','Fin','time'],['titre','Activité','text',1],['type','Type',Object.keys(TYPES)],['lieu','Lieu'],['intervenant','Intervenant']]},
  rubrique: {t:'rubrique', f:[['titre','Titre de la rubrique','text',1],['texte','Contenu','textarea'],['lien','Adresse pour le lien itinéraire (facultatif)']]},
  equipe: {t:'organisateur', f:[['email','Adresse e-mail','email',1],['nom','Nom'],['role','Rôle',[['organisateur','Organisateur'],['responsable','Responsable']]]]}
};
const PAIR = ['debut','fin','capacite','prix','prenom','nom','tel','ville','statut','montant','sexe','naissance','heure','lits','type','pmr','date','lieu'];
function openDlg(html, editing) { S.editing = editing; $('#dlg').innerHTML = html; $('#ov').classList.add('open'); const f = $('#dlg').querySelector('input:not([readonly]),select,textarea,button.pri'); f && f.focus() }
function closeDlg() { $('#ov').classList.remove('open'); S.editing = null }
function form(col, obj, preset) {
  if (!S.admin) return;
  const o = obj || {...preset};
  const input = ([k, l, t = 'text', req]) => {
    const v = o[k] ?? ''; let h;
    const ro = (col === 'inscrits' || col === 'equipe') && k === 'email' && obj;
    if (Array.isArray(t)) h = `<select name="${k}">${t.map(x => { const [val, lab] = Array.isArray(x) ? x : [x, x]; return `<option value="${esc(val)}"${val === v ? ' selected' : ''}>${esc(lab)}</option>` }).join('')}</select>`;
    else if (t === 'chambre') h = `<select name="${k}"><option value="">— Aucune —</option>${[...S.rooms].sort(byName).map(c => `<option value="${esc(c.id)}"${c.id === v ? ' selected' : ''}>${esc(c.nom)} · ${TYPE[c.type] || ''} · ${c.occupes || 0}/${c.lits}</option>`).join('')}</select>`;
    else if (t === 'textarea') h = `<textarea name="${k}" rows="${k === 'texte' ? 8 : 3}"${k === 'texte' ? ' placeholder="Ex. : Abouna Antoine : 06 12 34 56 78"' : ''}>${esc(v)}</textarea>${k === 'texte' ? '<small class="dim">Les numéros de téléphone écrits ici deviennent cliquables.</small>' : ''}`;
    else h = `<input name="${k}" type="${t}" value="${esc(v)}"${t === 'number' ? ' min="0" inputmode="numeric"' : ''}${ro ? ' readonly' : ''}>${ro ? '<small class="dim">L’adresse ne peut pas être changée. Pour la corriger, supprimez puis recréez la fiche.</small>' : ''}`;
    return [PAIR.includes(k) && col !== 'rubrique', `<label><span>${esc(l)}${req ? ' *' : ''}</span>${h}</label>`];
  };
  let out = '', buf = [];
  F[col].f.map(input).forEach(([p, h]) => { if (p) buf.push(h); else { if (buf.length) { out += `<div class="grid2">${buf.join('')}</div>`; buf = [] } out += h } });
  if (buf.length) out += `<div class="grid2">${buf.join('')}</div>`;
  openDlg(`<h2>${obj ? 'Modifier' : 'Ajouter'} : ${F[col].t}</h2>${out}<p class="bad" id="err" role="alert"></p>
   <div class="acts">${obj ? '<button type="button" class="danger" id="del">Supprimer</button>' : ''}<span class="sp"></span><button type="button" data-close>Annuler</button><button class="pri">Enregistrer</button></div>`,
   {col, id: obj && obj.id, obj, confirm: false});
}

$('#dlg').addEventListener('submit', async e => {
  e.preventDefault(); const ed = S.editing; if (!ed || ['info', 'tel', 'pick', 'import'].includes(ed.col)) return;
  const {col, id, obj} = ed, fd = new FormData(e.target), o = {}, err = t => { $('#err').textContent = t };
  for (const [k, , t, req] of F[col].f) { let v = (fd.get(k) ?? '').toString().trim(); if (t === 'number') v = v === '' ? '' : Number(v); if (req && v === '') return err('Merci de remplir les champs marqués *.'); o[k] = v }
  const btn = e.target.querySelector('button.pri'); btn.disabled = true;
  try {
    if (col === 'retraites') await saveRetreat(o, id);
    else if (col === 'inscrits') await saveIns(o, obj);
    else if (col === 'chambres') await saveRoom(o, obj);
    else if (col === 'programme') { const ref = id ? doc(db, 'retraites', S.rid, 'programme', id) : doc(collection(db, 'retraites', S.rid, 'programme')); await setDoc(ref, o) }
    else if (col === 'rubrique') await saveRub(o, id);
    else if (col === 'equipe') { const em = low(o.email); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) throw {userMsg: 'Adresse e-mail invalide.'}; if (!S.resp) throw {userMsg: 'Seul le responsable peut gérer les organisateurs.'}; if (em === low(S.user.email)) throw {userMsg: 'Vous ne pouvez pas modifier votre propre accès.'}; await setDoc(doc(db, 'organisateurs', em), {nom: o.nom, role: o.role || 'organisateur', ajouteLe: (ed.obj && ed.obj.ajouteLe) || today()}) }
    closeDlg(); toast('Enregistré.');
  } catch (x) { btn.disabled = false; err(x.userMsg || dbErr(x)) }
});
$('#dlg').addEventListener('click', async e => {
  if (e.target.closest('[data-close]')) return closeDlg();
  if (e.target.closest('#tgo')) return setTimeout(closeDlg, 300);
  if (e.target.id === 'tcopy') { try { await navigator.clipboard.writeText(e.target.dataset.n); toast('Numéro copié.') } catch (x) { toast('Copie impossible : notez le numéro affiché.') } return }
  if (e.target.id === 'pickgo') return chooseRoom(e.target.dataset.cid, e.target);
  if (e.target.id === 'impan') return showImport();
  if (e.target.id === 'impgo') return runImport(e.target);
  if (e.target.id !== 'del') return;
  const b = e.target, ed = S.editing;
  if (!ed.confirm) { ed.confirm = true; b.textContent = ed.col === 'retraites' ? 'Confirmer : tout supprimer (inscrits, chambres, programme)' : 'Confirmer la suppression'; return }
  b.disabled = true;
  try {
    if (ed.col === 'retraites') await deleteRetreat(ed.id);
    else if (ed.col === 'inscrits') await deleteIns(ed.obj);
    else if (ed.col === 'chambres') { if ((ed.obj.occupes || 0) > 0 || S.ins.some(i => i.chambreId === ed.id)) throw {userMsg: 'Cette chambre a des occupants : retirez-les d’abord.'}; await deleteDoc(doc(db, 'retraites', S.rid, 'chambres', ed.id)) }
    else if (ed.col === 'programme') await deleteDoc(doc(db, 'retraites', S.rid, 'programme', ed.id));
    else if (ed.col === 'rubrique') await updateDoc(doc(db, 'retraites', S.rid), {rubriques: rubOf(S.ret).filter(x => x.id !== ed.id)});
    else if (ed.col === 'equipe') { if (!S.resp) throw {userMsg: 'Seul le responsable peut retirer un organisateur.'}; if (ed.id === low(S.user.email)) throw {userMsg: 'Vous ne pouvez pas vous retirer vous-même.'}; await deleteDoc(doc(db, 'organisateurs', ed.id)) }
    closeDlg(); toast('Supprimé.');
  } catch (x) { b.disabled = false; $('#err').textContent = x.userMsg || dbErr(x) }
});
$('#ov').addEventListener('click', e => { if (e.target.id === 'ov') closeDlg() });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && S.editing) closeDlg() });

/* ---------- enregistrements organisateurs ---------- */
const endOfDay = (d, plusDays = 0) => { const x = new Date(d + 'T23:59:59'); x.setDate(x.getDate() + plusDays); return Timestamp.fromDate(x) };
async function saveRetreat(o, id) {
  if (o.fin < o.debut) throw {userMsg: 'Le départ doit suivre l’arrivée.'};
  const data = {...o, finAcces: endOfDay(o.fin, 7), limiteChambresTs: o.dateLimiteChambres ? endOfDay(o.dateLimiteChambres) : null};
  if (id) await updateDoc(doc(db, 'retraites', id), data);
  else { const ref = doc(collection(db, 'retraites')); await setDoc(ref, {...data, rubriques: []}); setRetreat(ref.id) }
}
async function saveIns(o, old) {
  const rid = S.rid, email = old ? old.id : low(o.email);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw {userMsg: 'Adresse e-mail invalide.'};
  const ref = doc(db, 'retraites', rid, 'inscrits', email);
  if (!old && (await getDoc(ref)).exists()) throw {userMsg: 'Cette adresse est déjà inscrite à cette retraite. Chaque personne doit avoir sa propre adresse e-mail.'};
  o.email = email;
  if (o.statut !== 'Confirmée') o.chambreId = '';
  const prev = old ? (old.chambreId || '') : '', next = o.chambreId || '';
  if (next && next !== prev) {
    const room = S.rooms.find(c => c.id === next);
    if (room && (room.occupes || 0) >= room.lits) throw {userMsg: `La chambre « ${room.nom} » est complète.`};
    if (room && o.sexe && room.type !== o.sexe) throw {userMsg: `La chambre « ${room.nom} » est réservée aux ${TYPE[room.type].toLowerCase()}.`};
  }
  const b = writeBatch(db);
  b.set(ref, {...(old ? stripId(old) : {inscritLe: today()}), ...o});
  if (prev !== next) {
    if (prev && S.rooms.some(c => c.id === prev)) b.update(doc(db, 'retraites', rid, 'chambres', prev), {occupes: increment(-1)});
    if (next) b.update(doc(db, 'retraites', rid, 'chambres', next), {occupes: increment(1)});
  }
  b.set(doc(db, 'acces', email), {r: {[rid]: o.statut === 'Confirmée' ? true : deleteField()}}, {merge: true});
  await b.commit();
}
const stripId = x => { const {id, ...y} = x; return y };
async function deleteIns(i) {
  const b = writeBatch(db);
  b.delete(doc(db, 'retraites', S.rid, 'inscrits', i.id));
  if (i.chambreId && S.rooms.some(c => c.id === i.chambreId)) b.update(doc(db, 'retraites', S.rid, 'chambres', i.chambreId), {occupes: increment(-1)});
  b.set(doc(db, 'acces', i.id), {r: {[S.rid]: deleteField()}}, {merge: true});
  await b.commit();
}
async function saveRoom(o, old) {
  const data = {...o, lits: +o.lits || 0, occupes: old ? (old.occupes || 0) : 0};
  if (old && S.ins.some(i => i.chambreId === old.id && i.sexe && i.sexe !== o.type)) throw {userMsg: 'Des occupants de l’autre sexe sont dans cette chambre : retirez-les avant de changer son type.'};
  if (old && data.lits < data.occupes) throw {userMsg: `${data.occupes} personnes occupent déjà cette chambre : le nombre de places ne peut pas être inférieur.`};
  if (old) { const {occupes, ...fields} = data; await updateDoc(doc(db, 'retraites', S.rid, 'chambres', old.id), fields) }
  else await setDoc(doc(collection(db, 'retraites', S.rid, 'chambres')), data);
}
async function assign(insId, cid) {
  const i = S.ins.find(x => x.id === insId); if (!i) return;
  try { await saveIns({...stripId(i), chambreId: cid}, i); toast(cid ? 'Chambre attribuée.' : 'Retiré de la chambre.') } catch (x) { toast(x.userMsg || dbErr(x)) }
}
async function recount() {
  const b = writeBatch(db);
  S.rooms.forEach(c => b.update(doc(db, 'retraites', S.rid, 'chambres', c.id), {occupes: S.ins.filter(i => i.statut === 'Confirmée' && i.chambreId === c.id).length}));
  await b.commit(); toast('Compteurs des chambres recalculés.');
}
async function copyRooms(fromId) {
  const src = await getDocs(collection(db, 'retraites', fromId, 'chambres'));
  const b = writeBatch(db); let n = 0;
  src.forEach(d => { const x = d.data(); b.set(doc(collection(db, 'retraites', S.rid, 'chambres')), {nom: x.nom, type: x.type, lits: x.lits, batiment: x.batiment || '', pmr: x.pmr || 'Non', occupes: 0}); n++ });
  if (!n) return toast('Cette retraite n’a pas de chambres.');
  await b.commit(); toast(`${n} chambre${n > 1 ? 's' : ''} copiée${n > 1 ? 's' : ''}.`);
}
async function deleteRetreat(id) {
  const ops = [];
  for (const sub of ['programme', 'chambres', 'inscrits']) {
    const s = await getDocs(collection(db, 'retraites', id, sub));
    s.forEach(d => { ops.push(['del', d.ref]); if (sub === 'inscrits') ops.push(['acces', d.id]) });
  }
  ops.push(['del', doc(db, 'retraites', id)]);
  for (let k = 0; k < ops.length; k += 400) {
    const b = writeBatch(db);
    ops.slice(k, k + 400).forEach(([t, x]) => t === 'del' ? b.delete(x) : b.set(doc(db, 'acces', x), {r: {[id]: deleteField()}}, {merge: true}));
    await b.commit();
  }
  S.rid = null; S.ret = null;
}

/* ---------- rubriques d'infos ---------- */
function rubOf(r) { return Array.isArray(r && r.rubriques) ? r.rubriques : [] }
async function saveRub(o, id) {
  const L = rubOf(S.ret).map(x => ({...x})), it = {id: id || 'r' + Date.now().toString(36), titre: o.titre, texte: o.texte, lien: o.lien};
  const k = L.findIndex(x => x.id === id); if (k >= 0) L[k] = it; else L.push(it);
  await updateDoc(doc(db, 'retraites', S.rid), {rubriques: L});
}
const PHONE = /(?:\+|00)?\d[\d .\-]{7,}\d/g;
const TELICO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.6 3.5h3l1.5 4-2 1.3a11 11 0 0 0 6.1 6.1l1.3-2 4 1.5v3a2 2 0 0 1-2.2 2A17 17 0 0 1 4.6 5.7a2 2 0 0 1 2-2.2z"/></svg>';
function withTel(t) {
  let out = '', last = 0; t = String(t || '');
  for (const m of t.matchAll(PHONE)) {
    const d = m[0].replace(/[^\d+]/g, ''), n = d.replace(/\D/g, '').length; if (n < 9 || n > 15) continue;
    out += esc(t.slice(last, m.index)) + `<button type="button" class="tel" data-tel="${esc(d)}" data-show="${esc(m[0].trim())}">${TELICO}${esc(m[0].trim())}</button>`; last = m.index + m[0].length;
  }
  return out + esc(t.slice(last));
}

/* ---------- import des réponses Google Forms / tableur ---------- */
function parseTable(txt) {
  txt = String(txt || '').replace(/\r\n?/g, '\n').replace(/^﻿/, '');
  const first = txt.split('\n')[0] || '';
  const sep = first.includes('\t') ? '\t' : (first.split(';').length > first.split(',').length ? ';' : ',');
  const rows = []; let row = [], cell = '', q = false;
  for (let k = 0; k < txt.length; k++) {
    const c = txt[k];
    if (q) { if (c === '"') { if (txt[k + 1] === '"') { cell += '"'; k++ } else q = false } else cell += c }
    else if (c === '"' && cell === '') q = true;
    else if (c === sep) { row.push(cell); cell = '' }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = '' }
    else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row) }
  return rows.map(r => r.map(x => x.trim())).filter(r => r.some(x => x));
}
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
function mapHeaders(head) {
  const m = {};
  head.forEach((h0, i) => { const h = norm(h0);
    if (m.email === undefined && /(e-?mail|courriel|adresse e)/.test(h)) m.email = i;
    else if (/prenom/.test(h) && /\bnom\b/.test(h.replace(/prenom/g, ''))) m.full = i;
    else if (m.prenom === undefined && /(prenom|first ?name)/.test(h)) m.prenom = i;
    else if (m.nom === undefined && /(^nom\b|nom de famille|last ?name|^name$|^nom$)/.test(h)) m.nom = i;
    else if (m.tel === undefined && /(tel|phone|portable|mobile)/.test(h)) m.tel = i;
    else if (m.ville === undefined && /(ville|city|commune)/.test(h)) m.ville = i;
    else if (m.regime === undefined && /(regime|allerg|aliment)/.test(h)) m.regime = i;
    else if (m.sexe === undefined && /(sexe|genre)/.test(h)) m.sexe = i;
    else if (m.naissance === undefined && /(naissance|birth)/.test(h)) m.naissance = i;
    else if (m.notes === undefined && /(remarque|commentaire|note|message|precision)/.test(h)) m.notes = i;
  });
  return m;
}
function toISO(d) {
  d = String(d || '').trim(); let x;
  if ((x = d.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return `${x[1]}-${x[2].padStart(2, '0')}-${x[3].padStart(2, '0')}`;
  if ((x = d.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})/))) return `${x[3]}-${x[2].padStart(2, '0')}-${x[1].padStart(2, '0')}`;
  return '';
}
function analyseImport(txt) {
  const rows = parseTable(txt); if (!rows.length) return {err: 'Rien à importer : collez les lignes copiées depuis Google Sheets.'};
  let m = mapHeaders(rows[0]), data = rows.slice(1);
  if (m.email === undefined) { // pas de ligne de titres : on cherche la colonne qui contient des adresses
    const col = rows[0].findIndex(c => EMAIL_RE.test(c)); if (col < 0) return {err: 'Impossible de trouver la colonne « Adresse e-mail ». Copiez aussi la ligne des titres.'};
    m = {email: col}; data = rows;
  }
  const known = new Set(S.ins.map(i => i.id)), seen = new Set(), out = [];
  for (const r of data) {
    const g = k => m[k] !== undefined ? (r[m[k]] || '').trim() : '';
    const email = low(g('email'));
    let prenom = g('prenom'), nom = g('nom');
    if (!prenom && !nom && m.full !== undefined) { const p = g('full').split(/\s+/); prenom = p.shift() || ''; nom = p.join(' ') }
    const sx = norm(g('sexe')), sexe = /^(h|m)/.test(sx) ? 'H' : /^f/.test(sx) ? 'F' : '', naissance = toISO(g('naissance'));
    const p = {email, prenom, nom, tel: g('tel'), ville: g('ville'), regime: g('regime'), notes: g('notes')};
    if (sexe && naissance && naissance < today()) Object.assign(p, {sexe, naissance, profilLe: today()});
    p.etat = !EMAIL_RE.test(email) ? 'invalide' : known.has(email) ? 'deja' : seen.has(email) ? 'double' : 'nouveau';
    if (EMAIL_RE.test(email)) seen.add(email);
    out.push(p);
  }
  return {rows: out, cols: Object.keys(m)};
}
function importDlg() {
  openDlg(`<h2>Importer des inscrits</h2>
   <p class="dim" style="margin-top:0">Dans le tableau Google Sheets des réponses, sélectionnez les lignes <b>avec la ligne des titres</b>, copiez, puis collez ici. Les colonnes Prénom, Nom, Adresse e-mail, Téléphone, Ville, Régime… sont reconnues automatiquement.</p>
   <label><span>Lignes copiées</span><textarea id="imptxt" rows="6" placeholder="Horodateur	Adresse e-mail	Prénom	Nom	Téléphone…"></textarea></label>
   <label><span>Statut donné aux personnes importées</span><select id="impstat">${STATUTS.map(s => `<option${s === 'Confirmée' ? ' selected' : ''}>${esc(s)}</option>`).join('')}</select></label>
   <div id="impprev"></div><p class="bad" id="err" role="alert"></p>
   <div class="acts"><span class="sp"></span><button type="button" data-close>Annuler</button><button type="button" id="impan">Vérifier</button><button type="button" class="pri" id="impgo" disabled>Importer</button></div>`, {col: 'import'});
}
let IMP = null;
function showImport() {
  const res = analyseImport($('#imptxt').value); $('#err').textContent = ''; $('#impprev').innerHTML = '';
  IMP = null; const go = $('#impgo'); go.disabled = true; go.textContent = 'Importer';
  if (res.err) { $('#err').textContent = res.err; return }
  const R = res.rows, n = R.filter(x => x.etat === 'nouveau'), lab = {nouveau: ['ok', 'Nouveau'], deja: ['mu', 'Déjà inscrit'], double: ['mu', 'En double'], invalide: ['bad', 'E-mail invalide']};
  $('#impprev').innerHTML = `<p class="note"><b>${n.length}</b> nouvelle${n.length > 1 ? 's' : ''} personne${n.length > 1 ? 's' : ''} à ajouter${R.length - n.length ? ` · ${R.length - n.length} ligne${R.length - n.length > 1 ? 's' : ''} ignorée${R.length - n.length > 1 ? 's' : ''}` : ''}.</p>
   <div class="scroll" style="max-height:260px;overflow:auto"><table><thead><tr><th>Personne</th><th>E-mail</th><th></th></tr></thead><tbody>${R.map(x => `<tr><td>${esc(name(x)) || '<span class="dim">—</span>'}</td><td>${esc(x.email) || '<span class="dim">—</span>'}</td><td><span class="tag ${lab[x.etat][0]}">${lab[x.etat][1]}</span></td></tr>`).join('')}</tbody></table></div>
   ${n.some(x => !x.prenom && !x.nom) ? '<p class="warn" style="font-size:14px">Certaines personnes n’ont ni prénom ni nom : vous pourrez les compléter ensuite avec « Modifier ».</p>' : ''}`;
  if (n.length) { IMP = n; go.disabled = false; go.textContent = `Importer ${n.length} personne${n.length > 1 ? 's' : ''}` }
}
async function runImport(btn) {
  if (!IMP || !IMP.length) return;
  const statut = $('#impstat').value, rid = S.rid, list = IMP; btn.disabled = true; btn.textContent = 'Import en cours…';
  try {
    for (let k = 0; k < list.length; k += 200) {
      const b = writeBatch(db);
      list.slice(k, k + 200).forEach(({etat, ...p}) => {
        b.set(doc(db, 'retraites', rid, 'inscrits', p.email), {...p, statut, montant: '', chambreId: '', inscritLe: today(), source: 'import'});
        if (statut === 'Confirmée') b.set(doc(db, 'acces', p.email), {r: {[rid]: true}}, {merge: true});
      });
      await b.commit();
    }
    closeDlg(); toast(`${list.length} personne${list.length > 1 ? 's' : ''} importée${list.length > 1 ? 's' : ''}.`); IMP = null;
  } catch (x) { btn.disabled = false; btn.textContent = 'Réessayer'; $('#err').textContent = dbErr(x) }
}

/* ---------- vues ---------- */
function vInscr(r) {
  tools('ins' + r.id, `<div class="tools"><h2>Registre des inscrits</h2><input id="q" type="search" placeholder="Rechercher un nom, une adresse…" value="${esc(S.q)}" aria-label="Rechercher"><select id="fs" aria-label="Filtrer par statut"><option value="">Tous les statuts</option>${STATUTS.map(s => `<option${s === S.fStat ? ' selected' : ''}>${esc(s)}</option>`).join('')}</select><button id="copy">Copier la liste</button><button id="importbtn">Importer</button><button class="pri" data-new="inscrits">Inscrire</button></div>`);
  let L = [...S.ins]; const all = L.length, qq = S.q.toLowerCase();
  if (qq) L = L.filter(i => [i.prenom, i.nom, i.email, i.ville, i.tel].join(' ').toLowerCase().includes(qq));
  if (S.fStat) L = L.filter(i => i.statut === S.fStat);
  L.sort(byName);
  if (!all) { $('#list').innerHTML = '<div class="empty"><h3>Personne n’est encore inscrit</h3><p>Ajoutez chaque retraitant avec sa propre adresse e-mail. Au statut « Confirmée », il peut se connecter à l’application.</p><button class="pri" data-new="inscrits">Inscrire un retraitant</button></div>'; return }
  if (!L.length) { $('#list').innerHTML = '<div class="empty">Aucun inscrit ne correspond à cette recherche.</div>'; return }
  const st = s => ({'Confirmée':'ok', 'En attente':'warn', "Liste d'attente":'mu', 'Annulée':'bad'})[s] || 'mu';
  const pay = i => { const p = +i.montant || 0, px = +r.prix || 0; if (i.statut === 'Annulée') return ['mu', '—']; if (px > 0 && p >= px) return ['ok', 'Réglé']; if (p > 0) return ['warn', 'Acompte']; return ['bad', 'À régler'] };
  $('#list').innerHTML = `<table class="stack"><thead><tr><th>Retraitant</th><th>Statut</th><th>Fiche</th><th>Paiement</th><th>Chambre</th><th>Régime / notes</th><th></th></tr></thead><tbody>${L.map(i => {
    const [pc, pl] = pay(i), ch = S.rooms.find(c => c.id === i.chambreId), a = age(i.naissance);
    return `<tr><td class="who"><b>${esc(name(i))}</b><small>${[i.email, i.tel, i.ville].filter(Boolean).map(esc).join(' · ')}</small></td>
    <td><span class="tag ${st(i.statut)}">${esc(i.statut || '—')}</span></td>
    <td>${i.sexe ? `<span class="badge-${i.sexe.toLowerCase()}">${SEXE[i.sexe]}</span><br><span class="dim">${fmt(i.naissance, {day:'2-digit', month:'2-digit', year:'numeric'})}${a !== null ? ` · ${a} ans` : ''}</span>` : '<span class="dim">Non remplie</span>'}</td>
    <td><span class="tag ${pc}">${pl}</span><br><span class="dim">${eur(i.montant)} / ${eur(r.prix)}</span></td>
    <td>${ch ? esc(ch.nom) : '<span class="dim">—</span>'}</td>
    <td class="dim">${esc([i.regime, i.notes].filter(Boolean).join(' — '))}</td>
    <td><button class="sm" data-edit="inscrits:${esc(i.id)}">Modifier</button></td></tr>` }).join('')}</tbody></table><p class="dim">${L.length} sur ${all} inscription${all > 1 ? 's' : ''}.</p>`;
}

function vProg(r) {
  const ed = ADM();
  tools('prog' + r.id + ed, `<div class="tools"><h2>Programme de la retraite</h2>${ed ? '<button class="pri" data-new="programme">Ajouter une activité</button>' : ''}</div>`);
  const P = [...S.prog].sort((a, b) => ((a.date || '') + (a.heure || '')).localeCompare((b.date || '') + (b.heure || '')));
  if (!P.length) { $('#list').innerHTML = ed ? '<div class="empty"><h3>Le programme est vide</h3><p>Offices, enseignements, temps de silence et repas, jour après jour.</p><button class="pri" data-new="programme">Ajouter une activité</button></div>' : '<div class="empty"><h3>Programme à venir</h3><p>Le programme détaillé sera publié ici prochainement.</p></div>'; return }
  const days = [...new Set(P.map(p => p.date))];
  $('#list').innerHTML = days.map(d => { const n = Math.round((new Date(d) - new Date(r.debut)) / 864e5) + 1;
    return `<section class="day"><h3>${fmt(d, {weekday:'long', day:'numeric', month:'long'})}${n > 0 ? `<small>Jour ${n}</small>` : ''}</h3>${P.filter(p => p.date === d).map(p => `<div class="slot${ed ? '' : ' ro'}"><time>${esc(p.heure)}${p.fin ? `<small>→ ${esc(p.fin)}</small>` : ''}</time><div><b>${esc(p.titre)}</b><br><span class="dim"><span class="dot" style="background:${TYPES[p.type] || '#888'}"></span>${esc(p.type || '')}${p.lieu ? ' · ' + esc(p.lieu) : ''}${p.intervenant ? ' · ' + esc(p.intervenant) : ''}</span></div>${ed ? `<div><button class="sm" data-edit="programme:${esc(p.id)}">Modifier</button></div>` : ''}</div>`).join('')}${ed ? `<p><button class="sm" data-new="programme" data-day="${esc(d)}">+ Activité ce jour</button></p>` : ''}</section>` }).join('');
}

const daysBetween = (a, b) => Math.round((new Date(b + 'T12:00') - new Date(a + 'T12:00')) / 864e5);
function vHome(r) {
  tools('home' + r.id, '');
  const me = ME(), t = today(), ch = S.rooms.find(c => c.id === me.chambreId), lim = r.dateLimiteChambres, isOpen = open_();
  const nuits = Math.max(0, daysBetween(r.debut, r.fin));
  const when = t < r.debut ? (d => d === 1 ? 'Demain !' : `Dans ${d} jours`)(daysBetween(t, r.debut)) : t <= r.fin ? `En cours · jour ${daysBetween(r.debut, t) + 1}` : 'Retraite terminée';
  const now = new Date(), nowKey = t + ' ' + now.toTimeString().slice(0, 5);
  const P = [...S.prog].sort((a, b) => ((a.date || '') + (a.heure || '')).localeCompare((b.date || '') + (b.heure || '')));
  const next = P.find(p => `${p.date} ${p.heure}` >= nowKey);
  const px = +r.prix || 0, paid = +me.montant || 0;
  const contact = rubOf(r).find(x => /contact/i.test(x.titre || '') && x.texte);
  const card = (title, body, link) => `<section class="hcard"><h3>${title}</h3>${body}${link ? `<a class="hlink" href="#${link[0]}">${link[1]} →</a>` : ''}</section>`;
  const la = annOf(r)[0];
  $('#list').innerHTML = `<div class="hcount"><span class="tag ok">${when}</span></div>${la ? `<a class="annhome" href="#infos"><b>Annonce</b><span>${esc(la.texte.length > 140 ? la.texte.slice(0, 140) + '…' : la.texte)}</span></a>` : ''}<div class="home">
  ${card('La retraite', `<p class="big">${esc(r.titre)}</p>${r.theme ? `<p class="it">${esc(r.theme)}</p>` : ''}
    <dl><dt>Dates</dt><dd>Du ${fmt(r.debut, {weekday:'long', day:'numeric', month:'long'})}<br>au ${fmt(r.fin, {weekday:'long', day:'numeric', month:'long', year:'numeric'})}${nuits ? ` · ${nuits} nuit${nuits > 1 ? 's' : ''}` : ''}</dd>
    ${r.accueil ? `<dt>Horaires</dt><dd>${esc(r.accueil)}</dd>` : ''}${r.lieu ? `<dt>Lieu</dt><dd>${esc(r.lieu)}</dd>` : ''}${r.animateur ? `<dt>Prédicateur</dt><dd>${esc(r.animateur)}</dd>` : ''}</dl>
    ${r.description ? `<p>${esc(r.description)}</p>` : ''}`, ['infos', 'Toutes les infos pratiques'])}
  ${card('Ma chambre', ch ? `<p class="big">${esc(ch.nom)}</p><p class="dim">${[TYPE[ch.type] && 'Chambre ' + TYPE[ch.type].toLowerCase(), ch.batiment, ch.pmr === 'Oui' && 'accessible PMR'].filter(Boolean).map(esc).join(' · ')}</p><div class="frac"><b>${ch.occupes || 0}/${ch.lits}</b> <span class="dim">places occupées</span></div>${isOpen && lim ? `<p class="dim">Vous pouvez encore changer jusqu’au ${fmt(lim, {day:'numeric', month:'long'})}.</p>` : ''}`
     : isOpen ? `<p class="big">À choisir</p><p>Choisissez votre chambre${lim ? ` avant le <b>${fmt(lim, {weekday:'long', day:'numeric', month:'long'})}</b>` : ''}.</p>` : '<p class="big">—</p><p>Le choix est terminé : les organisateurs vous attribueront une chambre.</p>',
     ['chambres', ch ? 'Voir les chambres' : 'Choisir ma chambre'])}
  ${card('Prochaine activité', next ? `<p class="big">${esc(next.titre)}</p><p>${fmt(next.date, {weekday:'long', day:'numeric', month:'long'})} à <b>${esc(next.heure)}</b>${next.fin ? ` → ${esc(next.fin)}` : ''}</p><p class="dim"><span class="dot" style="background:${TYPES[next.type] || '#888'}"></span>${esc(next.type || '')}${next.lieu ? ' · ' + esc(next.lieu) : ''}${next.intervenant ? ' · ' + esc(next.intervenant) : ''}</p>` : `<p>${P.length ? 'Le programme de la retraite est terminé.' : 'Le programme sera publié prochainement.'}</p>`, ['programme', 'Tout le programme'])}
  ${card('Ma fiche', `<dl><dt>Nom</dt><dd>${esc(name(me))}</dd><dt>Adresse</dt><dd>${esc(me.email || me.id)}</dd>${me.tel ? `<dt>Téléphone</dt><dd>${esc(me.tel)}</dd>` : ''}<dt>Sexe</dt><dd>${SEXE[me.sexe] || '—'}</dd><dt>Naissance</dt><dd>${fmt(me.naissance, {day:'numeric', month:'long', year:'numeric'})}${age(me.naissance) !== null ? ` · ${age(me.naissance)} ans` : ''}</dd>${me.regime ? `<dt>Régime</dt><dd>${esc(me.regime)}</dd>` : ''}${px ? `<dt>Participation</dt><dd>${paid >= px ? `<span class="ok">Réglée (${eur(px)})</span>` : paid > 0 ? `${eur(paid)} réglés sur ${eur(px)} · <b>reste ${eur(px - paid)}</b>` : `${eur(px)} · <b>à régler</b>`}</dd>` : ''}</dl><p class="dim">Une erreur ? Signalez-la aux organisateurs.</p>`)}
  ${contact ? card(esc(contact.titre), `<p class="pre">${withTel(contact.texte)}</p>`) : ''}
  </div>`;
}

const beds = (o, n) => `<div class="beds" aria-hidden="true">${Array.from({length: Math.max(n, o)}, (_, k) => `<i class="${k < o ? (k >= n ? 'x' : 'f') : ''}"></i>`).join('')}</div>`;
function vRoomsPart(r) {
  const me = ME(), isOpen = open_();
  tools('chp' + r.id, '<div class="tools"><h2>Les chambres</h2></div>');
  const L = S.rooms.filter(c => c.type === me.sexe).sort(byName);
  const banner = isOpen
    ? `<p class="note">Choisissez votre chambre parmi les chambres ${TYPE[me.sexe].toLowerCase()}${r.dateLimiteChambres ? `, jusqu’au <b>${fmt(r.dateLimiteChambres, {weekday:'long', day:'numeric', month:'long'})}</b>` : ''}. Vous pouvez en changer tant qu’il reste de la place.</p>`
    : `<p class="note">Le choix des chambres est terminé${r.dateLimiteChambres ? ` depuis le ${fmt(r.dateLimiteChambres, {day:'numeric', month:'long'})}` : ''}. ${me.chambreId ? '' : 'Les organisateurs vous attribueront une chambre.'}</p>`;
  if (!L.length) { $('#list').innerHTML = banner + '<div class="empty"><h3>Chambres à venir</h3><p>Les organisateurs n’ont pas encore ajouté les chambres.</p></div>'; return }
  $('#list').innerHTML = banner + `<div class="rooms">${L.map(c => { const n = +c.lits || 0, o = c.occupes || 0, f = Math.max(0, n - o), mine = me.chambreId === c.id;
    return `<article class="room${mine ? ' mine' : ''}"><header><div><h3>${esc(c.nom)}</h3><span class="dim">${[c.batiment, c.pmr === 'Oui' && 'accessible PMR'].filter(Boolean).map(esc).join(' · ')}</span></div><span class="tag ${mine ? 'ok' : f ? 'ok' : 'mu'}">${mine ? 'Votre chambre' : f ? `${f} libre${f > 1 ? 's' : ''}` : 'Complète'}</span></header>
    ${beds(o, n)}<div class="frac"><b>${o}/${n}</b> <span class="dim">places occupées</span></div>
    ${isOpen && !mine && f ? `<button class="pri pick" data-pick="${esc(c.id)}">${me.chambreId ? 'Changer pour cette chambre' : 'Choisir cette chambre'}</button>` : ''}</article>` }).join('')}</div>`;
}
async function chooseRoom(cid, btn) {
  const rid = S.rid, email = low(S.user.email);
  btn && (btn.disabled = true);
  try {
    await runTransaction(db, async tx => {
      const insRef = doc(db, 'retraites', rid, 'inscrits', email), newRef = doc(db, 'retraites', rid, 'chambres', cid);
      const ins = await tx.get(insRef), nr = await tx.get(newRef);
      const cur = ins.data().chambreId || '';
      let oldRef = null, old = null;
      if (cur && cur !== cid) { oldRef = doc(db, 'retraites', rid, 'chambres', cur); old = await tx.get(oldRef) }
      if (!nr.exists()) throw {userMsg: 'Cette chambre n’existe plus.'};
      const n = nr.data(); if ((n.occupes || 0) >= n.lits) throw {userMsg: 'Désolé, cette chambre vient d’être complétée. Choisissez-en une autre.'};
      tx.update(newRef, {occupes: (n.occupes || 0) + 1});
      if (old && old.exists()) tx.update(oldRef, {occupes: (old.data().occupes || 0) - 1});
      tx.update(insRef, {chambreId: cid});
    });
    closeDlg(); toast('C’est noté : votre chambre est réservée.');
  } catch (x) { btn && (btn.disabled = false); closeDlg(); toast(x.userMsg || (x.code === 'permission-denied' ? 'Choix impossible : la date limite est peut-être passée.' : dbErr(x))) }
}

function vRoomsAdmin(r) {
  const others = S.rets.filter(x => x.id !== r.id);
  tools('cha' + r.id, `<div class="tools"><h2>Chambres</h2><button id="recount">Recompter</button>${others.length ? `<select id="copyfrom" aria-label="Copier les chambres d’une autre retraite"><option value="">Copier les chambres de…</option>${others.map(x => `<option value="${esc(x.id)}">${esc(x.titre)}</option>`).join('')}</select>` : ''}<button class="pri" data-new="chambres">Ajouter une chambre</button></div>
   <div class="note deadline"><span>Date limite du choix par les retraitants :</span><input type="date" id="deadline" value="${esc(r.dateLimiteChambres || '')}" aria-label="Date limite du choix des chambres"><span class="dim">Après cette date, seuls les organisateurs peuvent attribuer les chambres.</span></div>`);
  const dl = $('#deadline'); if (dl && dl.value !== (r.dateLimiteChambres || '') && document.activeElement !== dl) dl.value = r.dateLimiteChambres || '';
  const A = S.ins.filter(i => i.statut === 'Confirmée');
  if (!S.rooms.length) { $('#list').innerHTML = '<div class="empty"><h3>Aucune chambre</h3><p>Ajoutez toutes les chambres du lieu avec leur nombre de places, en précisant si elles sont réservées aux hommes ou aux femmes. Les retraitants choisiront ensuite eux-mêmes.</p><button class="pri" data-new="chambres">Ajouter une chambre</button></div>'; return }
  const sec = t => { const R = S.rooms.filter(c => c.type === t).sort(byName); if (!R.length) return '';
    const sans = A.filter(i => i.sexe === t && !i.chambreId).sort(byName), tot = R.reduce((s, c) => s + (+c.lits || 0), 0), occ = R.reduce((s, c) => s + (c.occupes || 0), 0);
    return `<h3 style="font-size:22px;margin:26px 0 10px">Chambres ${TYPE[t].toLowerCase()} <small class="dim" style="font:15px 'Source Sans 3',sans-serif">${occ}/${tot} places occupées</small></h3>
    ${sans.length ? `<p class="dim">Sans chambre : ${sans.map(i => esc(name(i))).join(', ')}</p>` : ''}
    <div class="rooms">${R.map(c => { const occs = A.filter(i => i.chambreId === c.id).sort(byName), n = +c.lits || 0, o = c.occupes || 0;
      return `<article class="room"><header><div><h3>${esc(c.nom)}</h3><span class="dim">${[c.batiment, c.pmr === 'Oui' && 'accessible PMR'].filter(Boolean).map(esc).join(' · ')}</span></div><button class="sm" data-edit="chambres:${esc(c.id)}">Modifier</button></header>
      ${beds(o, n)}<div class="frac"><b>${o}/${n}</b> <span class="dim">places occupées</span>${o !== occs.length ? ' <span class="warn">· compteur à recalculer</span>' : ''}</div>
      ${occs.map(i => `<div class="occ"><span>${esc(name(i))}</span><button aria-label="Retirer ${esc(name(i))}" data-unassign="${esc(i.id)}">Retirer</button></div>`).join('')}
      ${o < n && sans.length ? `<select data-assign="${esc(c.id)}" aria-label="Attribuer ${esc(c.nom)}"><option value="">Attribuer une place…</option>${sans.map(i => `<option value="${esc(i.id)}">${esc(name(i))}</option>`).join('')}</select>` : ''}</article>` }).join('')}</div>` };
  const nofiche = A.filter(i => !i.sexe);
  $('#list').innerHTML = (nofiche.length ? `<p class="note">${nofiche.length} confirmé${nofiche.length > 1 ? 's n’ont' : ' n’a'} pas encore rempli sa fiche (sexe, date de naissance) : ${nofiche.map(i => esc(name(i))).join(', ')}.</p>` : '') + sec('H') + sec('F');
}

function vInfos(r) {
  const ed = ADM(), L = rubOf(r), shown = ed ? L : L.filter(x => x.texte || x.lien);
  tools('inf' + r.id + ed, `<div class="tools"><h2>Infos pratiques</h2>${ed ? '<button class="pri" data-new="rubrique">Ajouter une rubrique</button>' : ''}</div>${ed ? `<section class="annadm"><h3>Nouvelle annonce</h3><p class="dim">L’annonce la plus récente s’affiche en haut des Infos pratiques et de l’accueil de chaque retraitant.</p>
    <textarea id="anntext" rows="3" placeholder="Ex. : Rendez-vous à 16 h 30 devant l’église pour le covoiturage."></textarea>
    <div class="acts" style="margin-top:8px"><span class="sp"></span><button class="pri" id="annpub">Publier l’annonce</button></div></section>` : ''}`);
  const ann = annBlock(r, ed);
  if (!ed && (r.annonces || []).length) markSeen(r);
  if (!shown.length) { $('#list').innerHTML = ann + (ed ? '<div class="empty"><h3>Aucune rubrique</h3><p>Ajoutez les informations utiles : lieu, horaires, affaires à apporter, contacts…</p><button class="pri" data-new="rubrique">Ajouter une rubrique</button></div>' : '<div class="empty"><h3>Infos à venir</h3><p>Les informations pratiques seront publiées ici prochainement.</p></div>'); return }
  const map = a => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(String(a).replace(/\n/g, ' '))}`;
  $('#list').innerHTML = ann + `${ed ? '<p class="note">Ces rubriques sont visibles par les retraitants confirmés, dans cet ordre. Une rubrique vide ne leur est pas montrée.</p>' : ''}<div class="infos">${shown.map((x, k) => `<section class="info"><div class="ih"><h3>${esc(x.titre)}</h3>${ed ? `<div class="ib"><button class="sm" data-rmove="${k}:-1" aria-label="Monter"${k ? '' : ' disabled'}>↑</button><button class="sm" data-rmove="${k}:1" aria-label="Descendre"${k < shown.length - 1 ? '' : ' disabled'}>↓</button><button class="sm" data-redit="${esc(x.id)}">Modifier</button></div>` : ''}</div>${x.texte ? `<p>${withTel(x.texte)}</p>` : '<p class="dim">Vide — non montrée aux retraitants.</p>'}${x.lien ? `<a href="${esc(map(x.lien))}" target="_blank" rel="noopener">Ouvrir l’itinéraire</a>` : ''}</section>`).join('')}</div>`;
}

/* ---------- annonces ---------- */
const APP_URL = location.origin + location.pathname.replace(/index\.html$/, '');
const WAICO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5a9.5 9.5 0 0 0-8.2 14.3L2.5 21.5l4.8-1.3A9.5 9.5 0 1 0 12 2.5zm0 1.8a7.7 7.7 0 1 1-3.9 14.3l-.3-.2-2.8.8.8-2.7-.2-.3A7.7 7.7 0 0 1 12 4.3zm-3 3.6c-.2 0-.5 0-.7.3-.3.3-1 1-1 2.3s1 2.7 1.1 2.9c.2.2 2 3.1 4.9 4.2 2.4.9 2.9.8 3.4.7.5 0 1.7-.7 1.9-1.4.2-.7.2-1.3.2-1.4-.1-.1-.3-.2-.6-.3l-2-1c-.3-.1-.5-.1-.7.1l-.9 1.1c-.2.2-.3.2-.6.1-.3-.1-1.2-.5-2.3-1.4-.8-.8-1.4-1.7-1.6-2-.2-.3 0-.4.1-.6l.4-.5.3-.5c.1-.2 0-.4 0-.5l-.9-2.2c-.2-.5-.4-.5-.6-.5H9z"/></svg>';
const waLink = (r, a) => 'https://wa.me/?text=' + encodeURIComponent(`📢 *Annonce — ${r.titre}*\n\n${a.texte}\n\nOuvrir l’application : ${APP_URL}`);
const annOf = r => [...((r && r.annonces) || [])].sort((a, b) => (b.le || '').localeCompare(a.le || ''));
const annDate = s => s ? new Date(s).toLocaleString('fr-FR', {weekday:'long', day:'numeric', month:'long', hour:'2-digit', minute:'2-digit'}) : '';
function seenKey(r) { return 'annonce-vue-' + r.id }
function markSeen(r) { const a = annOf(r)[0]; if (a) try { localStorage.setItem(seenKey(r), a.le) } catch (e) {} }
function hasUnread(r) { const a = annOf(r)[0]; if (!a) return false; let s = ''; try { s = localStorage.getItem(seenKey(r)) || '' } catch (e) {} return a.le > s }
function annBlock(r, ed) {
  const A = annOf(r);
  if (ed) return A.length ? `<section class="annadm"><h3 style="font-size:17px">Annonces publiées</h3><ul class="annlist">${A.map(a => `<li><div><span class="dim">${esc(annDate(a.le))}</span><p>${withTel(a.texte)}</p></div><div class="annbtns"><a class="btn wa" href="${esc(waLink(r, a))}" target="_blank" rel="noopener">${WAICO}WhatsApp</a><button class="sm danger" data-anndel="${esc(a.id)}">Supprimer</button></div></li>`).join('')}</ul></section>` : '';
  if (!A.length) return '';
  const [a, ...old] = A;
  return `<section class="annonce" role="status"><h3>Annonce</h3><p class="annmsg">${withTel(a.texte)}</p><p class="anndate">${esc(annDate(a.le))}</p>
    ${old.length ? `<details><summary>Annonces précédentes (${old.length})</summary>${old.map(o => `<div class="annold"><span class="dim">${esc(annDate(o.le))}</span><p>${withTel(o.texte)}</p></div>`).join('')}</details>` : ''}</section>`;
}
async function publishAnn() {
  const t = $('#anntext'), txt = (t.value || '').trim(); if (!txt) return toast('Écrivez le message de l’annonce.');
  const b = $('#annpub'); b.disabled = true;
  try { const L = [...((S.ret && S.ret.annonces) || []), {id: 'a' + Date.now().toString(36), texte: txt, le: new Date().toISOString()}]; await updateDoc(doc(db, 'retraites', S.rid), {annonces: L}); t.value = ''; toast('Annonce publiée. Touchez « WhatsApp » pour la partager au groupe.') }
  catch (x) { toast(dbErr(x)) } b.disabled = false;
}

function vRet() {
  tools('ret', '<div class="tools"><h2>Toutes les retraites</h2><button class="pri" data-new="retraites">Nouvelle retraite</button></div>');
  const L = [...S.rets].sort((a, b) => (b.debut || '').localeCompare(a.debut || ''));
  if (!L.length) { $('#list').innerHTML = '<div class="empty"><h3>Aucune retraite</h3><p>Créez votre première retraite.</p><button class="pri" data-new="retraites">Nouvelle retraite</button></div>'; return }
  const t = today();
  $('#list').innerHTML = `<div class="cards">${L.map(x => { const when = x.fin < t ? ['mu', 'Terminée'] : x.debut <= t ? ['ok', 'En cours'] : ['warn', 'À venir'];
    return `<article class="card${x.id === S.rid ? ' on' : ''}"><span class="tag ${when[0]}" style="align-self:flex-start">${when[1]}</span><h3>${esc(x.titre)}</h3><span class="dim">${fmt(x.debut, {day:'numeric', month:'short'})} → ${fmt(x.fin, {day:'numeric', month:'short', year:'numeric'})}${x.lieu ? ' · ' + esc(x.lieu) : ''}</span>${x.description ? `<span>${esc(x.description)}</span>` : ''}
    <span class="dim">Accès des retraitants jusqu’au ${x.finAcces ? x.finAcces.toDate().toLocaleDateString('fr-FR', {day:'numeric', month:'long'}) : '—'}</span>
    <div class="row"><button class="sm pri" data-open="${esc(x.id)}">Ouvrir</button><button class="sm" data-edit="retraites:${esc(x.id)}">Modifier</button></div></article>` }).join('')}</div>`;
}

function vTeam() {
  const me = low(S.user.email), R = {responsable: 'Responsable', organisateur: 'Organisateur'};
  tools('team' + S.resp, `<div class="tools"><h2>Organisateurs</h2>${S.resp ? '<button class="pri" data-new="equipe">Ajouter un organisateur</button>' : ''}</div>`);
  const L = [...S.orgs].sort((a, b) => ((a.role === 'responsable' ? 0 : 1) - (b.role === 'responsable' ? 0 : 1)) || a.id.localeCompare(b.id));
  $('#list').innerHTML = `<p class="note">${S.resp
    ? 'En tant que <b>responsable</b>, vous seul pouvez ajouter, modifier ou retirer des organisateurs. Chaque organisateur se connecte avec sa propre adresse (bouton « Première connexion »).'
    : 'Seul le <b>responsable</b> peut ajouter ou retirer des organisateurs. Adressez-vous à lui pour toute modification de l’équipe.'}</p>
  <table class="stack"><thead><tr><th>Adresse e-mail</th><th>Nom</th><th>Rôle</th><th></th></tr></thead><tbody>${L.map(o => `<tr><td><b>${esc(o.id)}</b>${o.id === me ? ' <span class="dim">(vous)</span>' : ''}</td><td>${esc(o.nom || '')}</td><td><span class="tag ${o.role === 'responsable' ? 'warn' : 'mu'}">${R[o.role] || 'Organisateur'}</span></td><td>${S.resp && o.id !== me ? `<button class="sm" data-edit="equipe:${esc(o.id)}">Modifier</button>` : ''}</td></tr>`).join('')}</tbody></table>`;
}

/* ---------- événements ---------- */
document.addEventListener('click', async e => {
  const b = e.target.closest('button'); if (!b || b.closest('#dlg') || b.closest('#gate')) return;
  if (b.id === 'logout') { stopAll(); return signOut(auth) }
  if (b.classList.contains('tel')) return openDlg(`<h2>Appeler ce numéro ?</h2><p class="bignum">${esc(b.dataset.show)}</p><p class="dim">Votre téléphone va lancer l’appel.</p><div class="acts"><button type="button" id="tcopy" data-n="${esc(b.dataset.show)}">Copier</button><span class="sp"></span><button type="button" data-close>Annuler</button><a class="btn pri" id="tgo" href="tel:${esc(b.dataset.tel)}">${TELICO}Appeler</a></div>`, {col:'tel'});
  if (b.dataset.pick && S.preview) return toast('Aperçu : le choix de chambre n’est pas enregistré.');
  if (b.dataset.pick) { const c = S.rooms.find(x => x.id === b.dataset.pick); if (!c) return;
    return openDlg(`<h2>${S.me.chambreId ? 'Changer de chambre ?' : 'Choisir cette chambre ?'}</h2><p class="bignum" style="white-space:normal">${esc(c.nom)}</p><p class="dim">${(c.occupes || 0)}/${c.lits} places occupées.${S.me.chambreId ? ' Votre place actuelle sera libérée.' : ''} Vous pourrez encore changer tant qu’il reste de la place, jusqu’à la date limite.</p><div class="acts"><span class="sp"></span><button type="button" data-close>Annuler</button><button type="button" class="pri" id="pickgo" data-cid="${esc(c.id)}">Confirmer</button></div>`, {col:'pick'}) }
  if (b.id === 'pvbtn') { S.preview = !S.preview; S.toolsKey = ''; history.replaceState(null, '', location.pathname + location.search); render(); scrollTo({top: 0}); return }
  if (!ADM()) return;
  if (b.dataset.new === 'rubrique') return form('rubrique', null, {});
  if (b.id === 'annpub') return publishAnn();
  if (b.id === 'importbtn') return importDlg();
  if (b.dataset.anndel) { if (!b.dataset.ok) { b.dataset.ok = 1; b.textContent = 'Confirmer'; return } b.disabled = true; try { await updateDoc(doc(db, 'retraites', S.rid), {annonces: ((S.ret && S.ret.annonces) || []).filter(a => a.id !== b.dataset.anndel)}); toast('Annonce supprimée.') } catch (x) { toast(dbErr(x)) } return }
  if (b.dataset.new === 'equipe') return S.resp ? form('equipe', null, {role: 'organisateur'}) : toast('Seul le responsable peut ajouter des organisateurs.');
  if (b.dataset.new) { const pre = b.dataset.new === 'inscrits' ? {statut:'Confirmée'} : b.dataset.new === 'programme' ? {date: b.dataset.day || S.ret.debut, type:'Office / prière'} : b.dataset.new === 'chambres' ? {lits: 1, type:'H', pmr:'Non'} : {}; return form(b.dataset.new, null, pre) }
  if (b.dataset.edit) { const [c, id] = b.dataset.edit.split(':'); const src = c === 'retraites' ? S.rets : c === 'equipe' ? S.orgs.map(o => ({...o, email: o.id})) : S[{inscrits:'ins', chambres:'rooms', programme:'prog'}[c]]; const o = src.find(x => x.id === id); return o && form(c, o) }
  if (b.dataset.redit) { const x = rubOf(S.ret).find(y => y.id === b.dataset.redit); return x && form('rubrique', x) }
  if (b.dataset.rmove) { const [k, d] = b.dataset.rmove.split(':').map(Number), L = rubOf(S.ret).map(x => ({...x})), t = k + d; if (t < 0 || t >= L.length) return; [L[k], L[t]] = [L[t], L[k]]; b.disabled = true; try { await updateDoc(doc(db, 'retraites', S.rid), {rubriques: L}) } catch (x) { toast(dbErr(x)) } return }
  if (b.dataset.open) { setRetreat(b.dataset.open); location.hash = 'inscriptions'; return }
  if (b.dataset.unassign) { b.disabled = true; return assign(b.dataset.unassign, '') }
  if (b.id === 'recount') { b.disabled = true; try { await recount() } catch (x) { toast(dbErr(x)) } b.disabled = false; return }
  if (b.id === 'copy') {
    const rows = [['Nom','Prénom','E-mail','Statut','Sexe','Naissance','Âge','Téléphone','Ville','Réglé (€)','Chambre','Régime','Notes'], ...[...S.ins].sort(byName).map(i => [i.nom, i.prenom, i.email, i.statut, SEXE[i.sexe] || '', i.naissance || '', age(i.naissance) ?? '', i.tel, i.ville, i.montant, (S.rooms.find(c => c.id === i.chambreId) || {}).nom, i.regime, i.notes])];
    try { await navigator.clipboard.writeText(rows.map(r => r.map(v => String(v ?? '').replace(/[\t\n]/g, ' ')).join('\t')).join('\n')); toast('Liste copiée : collez-la dans un tableur.') } catch (x) { toast('Copie refusée par le navigateur.') }
  }
});
document.addEventListener('change', async e => {
  const t = e.target;
  if (t.id === 'pick') return setRetreat(t.value);
  if (t.id === 'pvsel') { S.pv = t.value; S.toolsKey = ''; return render() }
  if (t.id === 'fs') { S.fStat = t.value; return render() }
  if (t.id === 'copyfrom' && t.value) { t.disabled = true; try { await copyRooms(t.value) } catch (x) { toast(dbErr(x)) } t.value = ''; t.disabled = false; return }
  if (t.id === 'deadline') { try { await updateDoc(doc(db, 'retraites', S.rid), {dateLimiteChambres: t.value, limiteChambresTs: t.value ? endOfDay(t.value) : null}); toast(t.value ? 'Date limite enregistrée.' : 'Date limite retirée.') } catch (x) { toast(dbErr(x)) } return }
  if (t.dataset.assign && t.value) { t.disabled = true; return assign(t.value, t.dataset.assign) }
});
document.addEventListener('input', e => { if (e.target.id === 'q') { S.q = e.target.value; render() } if (e.target.id === 'imptxt') { IMP = null; const g = $('#impgo'); if (g) { g.disabled = true; g.textContent = 'Importer' } } });
addEventListener('hashchange', () => { S.toolsKey = ''; render(); scrollTo({top: 0}) });
