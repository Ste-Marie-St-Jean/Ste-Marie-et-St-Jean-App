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
  arrivees:'<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.7 2.7L16.5 9.5"/>',
  textes:'<path d="M12 6.5C10 5 7.5 4.5 4 4.8V18c3.5-.3 6 .2 8 1.7 2-1.5 4.5-2 8-1.7V4.8c-3.5-.3-6 .2-8 1.7z"/><path d="M12 6.5v13.2"/>',
  equipe:'<path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6z"/><path d="M9 12l2 2 4-4"/>'};
const V_ADMIN = {inscriptions:'Inscriptions', arrivees:'Arrivées', programme:'Programme', chambres:'Chambres', infos:'Infos pratiques', retraites:'Retraites', equipe:'Organisateurs'};
const V_PART = {accueil:'Accueil', programme:'Programme', chambres:'Chambres', infos:'Infos pratiques', textes:'Textes'};
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
const S = {fiches:[], textes:[], avis:[], myAvis:null, user:null, admin:false, rets:[], rid:null, ret:null, prog:[], rooms:[], ins:[], orgs:[], me:null, myRets:[], q:'', fStat:'', toolsKey:'', editing:null};
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
const HIDDEN = () => ADM() ? {textes: 1, avis: 1} : {avis: 1};
const view = () => { const h = location.hash.slice(1); return V()[h] || HIDDEN()[h] ? h : Object.keys(V())[0] };

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
  S.prog = []; S.rooms = []; S.ins = []; S.textes = []; S.avis = []; S.myAvis = null; S.toolsKey = '';
  const rid = S.rid, base = ['retraites', rid];
  const fail = e => { $('#msg').innerHTML = `<p class="note">${esc(dbErr(e))}</p>` };
  unsubs.push(onSnapshot(doc(db, ...base), s => { S.ret = s.exists() ? {id: s.id, ...s.data()} : null; render() }, fail));
  unsubs.push(onSnapshot(collection(db, ...base, 'programme'), s => { S.prog = s.docs.map(d => ({id: d.id, ...d.data()})); render() }, fail));
  unsubs.push(onSnapshot(collection(db, ...base, 'textes'), s => { S.textes = s.docs.map(d => ({id: d.id, ...d.data()})); render() }, fail));
  unsubs.push(onSnapshot(collection(db, ...base, 'chambres'), s => { S.rooms = s.docs.map(d => ({id: d.id, ...d.data()})); render() }, fail));
  if (S.admin) unsubs.push(onSnapshot(collection(db, ...base, 'inscrits'), s => { S.ins = s.docs.map(d => ({id: d.id, ...d.data()})); render() }, fail));
  if (S.admin) unsubs.push(onSnapshot(collection(db, ...base, 'avis'), s => { S.avis = s.docs.map(d => ({id: d.id, ...d.data()})); render() }, fail));
  else unsubs.push(onSnapshot(doc(db, ...base, 'avis', low(S.user.email)), s => { S.myAvis = s.exists() ? s.data() : null; render() }, () => {}));
  if (S.admin) { S.fiches = []; unsubs.push(onSnapshot(collection(db, ...base, 'fiches'), s => { S.fiches = s.docs.map(d => ({id: d.id, ...d.data()})); render() }, fail)) }
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
  ({accueil: vHome, textes: vTextes, avis: vAvis, arrivees: vArr, inscriptions: vInscr, programme: vProg, chambres: ADM() ? vRoomsAdmin : vRoomsPart, infos: vInfos, retraites: vRet, equipe: vTeam})[v](r);
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
  inscrits: {t:'inscription', f:[['prenom','Prénom','text',1],['nom','Nom','text',1],['email','E-mail (sert à la connexion)','email',1],['tel','Téléphone','tel'],['ville','Ville'],['statut','Statut',STATUTS],['sexe','Sexe',[['','— Non renseigné —'],['H','Homme'],['F','Femme']]],['naissance','Date de naissance','date'],['montant','Montant réglé (€)','number'],['chambreId','Chambre','chambre'],['regime','Régime alimentaire (visible par le retraitant)']]},
  fiche: {t:'fiche', f:[['urgenceNom','Personne à contacter en cas d’urgence (nom, lien)'],['urgenceTel','Téléphone d’urgence','tel'],['allergies','Allergies (détail)','textarea'],['sante','Santé : traitements, handicap, informations utiles','textarea'],['remarques','Remarques du retraitant','textarea'],['notesOrg','Notes des organisateurs','textarea']]},
  chambres: {t:'chambre', f:[['nom','Nom de la chambre','text',1],['type','Réservée aux',[['H','Hommes'],['F','Femmes']]],['lits','Nombre de places','number',1],['batiment','Bâtiment / étage'],['pmr','Accessible PMR',['Non','Oui']]]},
  programme: {t:'activité', f:[['date','Jour','date',1],['heure','Début','time',1],['fin','Fin','time'],['titre','Activité','text',1],['type','Type',Object.keys(TYPES)],['lieu','Lieu'],['intervenant','Intervenant']]},
  texte: {t:'texte', f:[['titre','Titre','text',1],['date','Jour (facultatif)','date'],['auteur','Auteur / intervenant'],['contenu','Texte','textarea',1]]},
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
    else if (t === 'textarea') h = `<textarea name="${k}" rows="${k === 'contenu' ? 16 : k === 'texte' ? 8 : 3}"${k === 'texte' ? ' placeholder="Ex. : Abouna Antoine : 06 12 34 56 78"' : ''}>${esc(v)}</textarea>${k === 'texte' ? '<small class="dim">Les numéros de téléphone écrits ici deviennent cliquables.</small>' : ''}`;
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
    else if (col === 'fiche') await saveFiche(o, obj);
    else if (col === 'chambres') await saveRoom(o, obj);
    else if (col === 'programme') { const ref = id ? doc(db, 'retraites', S.rid, 'programme', id) : doc(collection(db, 'retraites', S.rid, 'programme')); await setDoc(ref, o) }
    else if (col === 'rubrique') await saveRub(o, id);
    else if (col === 'texte') await setDoc(id ? doc(db, 'retraites', S.rid, 'textes', id) : doc(collection(db, 'retraites', S.rid, 'textes')), {...o, publieLe: (obj && obj.publieLe) || new Date().toISOString()});
    else if (col === 'equipe') { const em = low(o.email); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) throw {userMsg: 'Adresse e-mail invalide.'}; if (!S.resp) throw {userMsg: 'Seul le responsable peut gérer les organisateurs.'}; if (em === low(S.user.email)) throw {userMsg: 'Vous ne pouvez pas modifier votre propre accès.'}; await setDoc(doc(db, 'organisateurs', em), {nom: o.nom, role: o.role || 'organisateur', ajouteLe: (ed.obj && ed.obj.ajouteLe) || today()}) }
    closeDlg(); toast('Enregistré.');
  } catch (x) { btn.disabled = false; err(x.userMsg || dbErr(x)) }
});
$('#dlg').addEventListener('click', async e => {
  if (e.target.closest('[data-close]')) return closeDlg();
  if (e.target.closest('#tgo')) return setTimeout(closeDlg, 300);
  if (e.target.id === 'tcopy') { try { await navigator.clipboard.writeText(e.target.dataset.n); toast('Numéro copié.') } catch (x) { toast('Copie impossible : notez le numéro affiché.') } return }
  if (e.target.id === 'pickgo') return chooseRoom(e.target.dataset.cid, e.target);
  if (e.target.closest('[data-print]')) return printDoc(e.target.closest('[data-print]').dataset.print);
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
    else if (ed.col === 'texte') await deleteDoc(doc(db, 'retraites', S.rid, 'textes', ed.id));
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
  b.delete(doc(db, 'retraites', S.rid, 'fiches', i.id));
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
  for (const sub of ['programme', 'chambres', 'inscrits', 'fiches', 'textes', 'avis']) {
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

/* ---------- fiche confidentielle (organisateurs uniquement) ---------- */
const ficheOf = id => S.fiches.find(f => f.id === id) || {};
function ficheDlg(i) {
  const f = {...ficheOf(i.id)}; if (!f.notesOrg && i.notes) f.notesOrg = i.notes;
  const ch = S.rooms.find(c => c.id === i.chambreId), a = age(i.naissance);
  const field = ([k, l, t = 'text']) => `<label><span>${esc(l)}</span>${t === 'textarea' ? `<textarea name="${k}" rows="2">${esc(f[k] || '')}</textarea>` : `<input name="${k}" type="${t}" value="${esc(f[k] || '')}">`}</label>`;
  const extra = Object.entries(f.extra || {}).filter(([, v]) => v);
  openDlg(`<h2>${esc(name(i))}</h2><p class="conf">Fiche confidentielle — visible uniquement par les organisateurs</p>
   <dl class="fdl"><dt>E-mail</dt><dd>${esc(i.email || i.id)}</dd>${i.tel ? `<dt>Téléphone</dt><dd><a href="tel:${esc(i.tel.replace(/[^\d+]/g, ''))}">${esc(i.tel)}</a></dd>` : ''}${i.ville ? `<dt>Ville</dt><dd>${esc(i.ville)}</dd>` : ''}
   <dt>Fiche</dt><dd>${i.sexe ? `${SEXE[i.sexe]} · ${fmt(i.naissance, {day:'2-digit', month:'2-digit', year:'numeric'})}${a !== null ? ` · ${a} ans` : ''}` : 'non remplie'}</dd>
   <dt>Statut</dt><dd>${esc(i.statut || '—')}</dd><dt>Chambre</dt><dd>${ch ? esc(ch.nom) : '—'}</dd>${i.regime ? `<dt>Régime</dt><dd>${esc(i.regime)}</dd>` : ''}</dl>
   ${f.urgenceTel ? `<a class="btn urg" href="tel:${esc(f.urgenceTel.replace(/[^\d+]/g, ''))}">${TELICO}Appeler le contact d’urgence${f.urgenceNom ? ' (' + esc(f.urgenceNom) + ')' : ''}</a>` : ''}
   <div class="grid2">${F.fiche.f.slice(0, 2).map(field).join('')}</div>${F.fiche.f.slice(2).map(field).join('')}
   ${extra.length ? `<details class="fextra" open><summary>Autres réponses du formulaire (${extra.length})</summary><dl class="fdl">${extra.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl></details>` : ''}
   <p class="bad" id="err" role="alert"></p>
   <div class="acts"><span class="sp"></span><button type="button" data-close>Fermer</button><button class="pri">Enregistrer la fiche</button></div>`, {col: 'fiche', id: i.id, obj: i});
}
async function saveFiche(o, i) {
  const b = writeBatch(db);
  b.set(doc(db, 'retraites', S.rid, 'fiches', i.id), {...o, majLe: today()}, {merge: true});
  if (i.notes) b.update(doc(db, 'retraites', S.rid, 'inscrits', i.id), {notes: deleteField()});
  await b.commit();
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
    else if (/urgence|emergency/.test(h) && /(tel|phone|portable|numero|mobile)/.test(h)) m.urgenceTel = i;
    else if (/urgence|emergency/.test(h)) m.urgenceNom = i;
    else if (m.sante === undefined && /(sante|medical|traitement|medicament|handicap)/.test(h)) m.sante = i;
    else if (m.tel === undefined && /(tel|phone|portable|mobile)/.test(h)) m.tel = i;
    else if (m.ville === undefined && /(ville|city|commune)/.test(h)) m.ville = i;
    else if (m.regime === undefined && /(regime|allerg|aliment)/.test(h)) m.regime = i;
    else if (m.sexe === undefined && /(sexe|genre)/.test(h)) m.sexe = i;
    else if (m.naissance === undefined && /(naissance|birth)/.test(h)) m.naissance = i;
    else if (m.notes === undefined && /(remarque|commentaire|note|message|precision)/.test(h)) m.notes = i;
    else if (!/(horodateur|timestamp|horodatage|consentement|accepte|score|rgpd)/.test(h)) (m.extra = m.extra || []).push(i);
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
  let m = mapHeaders(rows[0]), data = rows.slice(1); const head = rows[0];
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
    const p = {email, prenom, nom, tel: g('tel'), ville: g('ville'), regime: g('regime')};
    const ex = {}; (m.extra || []).forEach(k => { if ((r[k] || '').trim()) ex[head[k]] = r[k].trim() });
    p.fiche = {urgenceNom: g('urgenceNom'), urgenceTel: g('urgenceTel'), sante: g('sante'), remarques: g('notes'), extra: ex};
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
    for (let k = 0; k < list.length; k += 150) {
      const b = writeBatch(db);
      list.slice(k, k + 150).forEach(({etat, fiche, ...p}) => {
        b.set(doc(db, 'retraites', rid, 'inscrits', p.email), {...p, statut, montant: '', chambreId: '', inscritLe: today(), source: 'import'});
        b.set(doc(db, 'retraites', rid, 'fiches', p.email), {...fiche, majLe: today()}, {merge: true});
        if (statut === 'Confirmée') b.set(doc(db, 'acces', p.email), {r: {[rid]: true}}, {merge: true});
      });
      await b.commit();
    }
    closeDlg(); toast(`${list.length} personne${list.length > 1 ? 's' : ''} importée${list.length > 1 ? 's' : ''}.`); IMP = null;
  } catch (x) { btn.disabled = false; btn.textContent = 'Réessayer'; $('#err').textContent = dbErr(x) }
}

/* ---------- arrivées (pointage) ---------- */
function vArr(r) {
  tools('arr' + r.id, `<div class="tools"><h2>Arrivées</h2><input id="qa" type="search" placeholder="Rechercher un nom…" value="${esc(S.qa || '')}" aria-label="Rechercher"><label class="chk"><input type="checkbox" id="onlyabs"${S.onlyAbs ? ' checked' : ''}> Seulement les absents</label><button id="printemarg">Feuille d’émargement</button></div>`);
  const A = S.ins.filter(i => i.statut === 'Confirmée').sort(byName), n = A.filter(i => i.present).length;
  let L = A; const q = (S.qa || '').toLowerCase();
  if (q) L = L.filter(i => name(i).toLowerCase().includes(q)); if (S.onlyAbs) L = L.filter(i => !i.present);
  $('#list').innerHTML = `<div class="arrsum"><b>${n} / ${A.length}</b> arrivé${n > 1 ? 's' : ''}<div class="bar"><i style="width:${A.length ? n / A.length * 100 : 0}%"></i></div></div>
  ${!A.length ? '<div class="empty">Aucun inscrit confirmé.</div>' : !L.length ? '<div class="empty">Personne ne correspond.</div>' : `<div class="arrs">${L.map(i => { const ch = S.rooms.find(c => c.id === i.chambreId), fi = ficheOf(i.id);
    return `<button class="arr${i.present ? ' on' : ''}" data-arr="${esc(i.id)}" aria-pressed="${!!i.present}"><span class="arrck" aria-hidden="true">${i.present ? '✓' : ''}</span><span class="arrtx"><b>${esc(name(i))}</b><small>${[ch ? 'Chambre : ' + ch.nom : 'Sans chambre', i.regime, fi.allergies].filter(Boolean).map(esc).join(' · ')}</small>${i.present && i.arriveeLe ? `<small>Arrivé(e) à ${new Date(i.arriveeLe).toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'})}</small>` : ''}</span></button>` }).join('')}</div>`}`;
}
async function toggleArr(id, btn) {
  const i = S.ins.find(x => x.id === id); if (!i) return; btn.disabled = true;
  try { await updateDoc(doc(db, 'retraites', S.rid, 'inscrits', id), i.present ? {present: deleteField(), arriveeLe: deleteField()} : {present: true, arriveeLe: new Date().toISOString()}) }
  catch (x) { toast(dbErr(x)) } btn.disabled = false;
}

/* ---------- impressions ---------- */
function printDlg() {
  openDlg(`<h2>Imprimer une liste</h2><p class="dim" style="margin-top:0">Une page propre s’ouvre pour l’impression. Vous pouvez aussi choisir « Enregistrer en PDF » dans la fenêtre d’impression.</p>
   <div class="plist">${[['cuisine', 'Liste pour la cuisine', 'Noms, régimes et allergies — rien d’autre.'], ['urgence', 'Liste d’urgence', 'Téléphones, contacts d’urgence, santé. Confidentiel.'], ['chambres', 'Répartition des chambres', 'À afficher à l’accueil.'], ['emargement', 'Feuille d’émargement', 'Signatures à l’arrivée et au départ.']].map(([k, t, d]) => `<button type="button" data-print="${k}"><b>${t}</b><small>${d}</small></button>`).join('')}</div>
   <div class="acts"><span class="sp"></span><button type="button" data-close>Fermer</button></div>`, {col: 'info'});
}
function printDoc(kind) {
  const r = S.ret; if (!r) return;
  const A = S.ins.filter(i => i.statut === 'Confirmée').sort(byName), room = i => (S.rooms.find(c => c.id === i.chambreId) || {}).nom || '—';
  const T = {cuisine: 'Liste pour la cuisine', urgence: 'Liste d’urgence — confidentiel', chambres: 'Répartition des chambres', emargement: 'Feuille d’émargement'}[kind];
  const table = (head, rows) => `<table><thead><tr>${head.map(x => `<th>${x}</th>`).join('')}</tr></thead><tbody>${rows.map(rw => `<tr>${rw.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  let body = '';
  if (kind === 'cuisine') {
    const L = A.map(i => [esc(name(i)), esc(i.regime || ''), esc(ficheOf(i.id).allergies || '')]);
    const sp = L.filter(x => x[1] || x[2]);
    body = `<p class="pnote"><b>${A.length} repas par service</b> · ${sp.length} personne${sp.length > 1 ? 's' : ''} avec un régime ou une allergie (en tête de liste).</p>` + table(['Nom', 'Régime alimentaire', 'Allergies'], [...sp, ...L.filter(x => !x[1] && !x[2])]);
  } else if (kind === 'urgence') {
    body = table(['Nom', 'Téléphone', 'Contact d’urgence', 'Tél. urgence', 'Santé / allergies', 'Chambre'], A.map(i => { const f = ficheOf(i.id); return [esc(name(i)), esc(i.tel || ''), esc(f.urgenceNom || ''), esc(f.urgenceTel || ''), esc([f.sante, f.allergies].filter(Boolean).join(' — ')), esc(room(i))] })) + '<p class="pnote">Document confidentiel : à conserver par les organisateurs et à détruire après la retraite.</p>';
  } else if (kind === 'chambres') {
    body = ['H', 'F'].map(t => { const R = S.rooms.filter(c => c.type === t).sort(byName); if (!R.length) return '';
      return `<h2>Chambres ${TYPE[t].toLowerCase()}</h2><div class="pgrid">${R.map(c => `<div class="pbox"><b>${esc(c.nom)}</b>${c.batiment ? `<small>${esc(c.batiment)}</small>` : ''}<ul>${A.filter(i => i.chambreId === c.id).map(i => `<li>${esc(name(i))}</li>`).join('') || '<li class="pdim">—</li>'}</ul><small>${A.filter(i => i.chambreId === c.id).length}/${c.lits} places</small></div>`).join('')}</div>` }).join('');
    const sans = A.filter(i => !i.chambreId); if (sans.length) body += `<p class="pnote">Sans chambre : ${sans.map(i => esc(name(i))).join(', ')}</p>`;
  } else {
    body = table(['Nom', 'Chambre', 'Arrivée (signature)', 'Départ (signature)'], A.map(i => [esc(name(i)), esc(room(i)), '', ''])).replace('<table>', '<table class="sign">');
  }
  const P = $('#printarea');
  P.innerHTML = `<header class="phead"><img src="logo.png" alt=""><div><small>Église copte orthodoxe · Sainte Marie et Saint Jean</small><h1>${esc(T)}</h1><p>${esc(r.titre)} · du ${fmt(r.debut, {day:'numeric', month:'long'})} au ${fmt(r.fin)}${r.lieu ? ' · ' + esc(r.lieu) : ''}</p></div></header>${body}<footer class="pfoot">Imprimé le ${new Date().toLocaleDateString('fr-FR', {day:'numeric', month:'long', year:'numeric'})} · ${A.length} inscrit${A.length > 1 ? 's' : ''} confirmé${A.length > 1 ? 's' : ''}</footer>`;
  closeDlg();
  const img = P.querySelector('img'); const go = () => setTimeout(() => window.print(), 50);
  if (img && !img.complete) img.onload = go; else go();
}

/* ---------- textes de méditation ---------- */
function vTextes(r) {
  const ed = ADM();
  tools('tx' + r.id + ed, `<div class="tools"><h2>Textes et méditations</h2>${ed ? '<button class="pri" data-new="texte">Ajouter un texte</button>' : ''}</div>`);
  const L = [...S.textes].sort((a, b) => ((a.date || '9') + (a.publieLe || '')).localeCompare((b.date || '9') + (b.publieLe || '')));
  if (!L.length) { $('#list').innerHTML = ed ? '<div class="empty"><h3>Aucun texte</h3><p>Publiez les textes des enseignements, une prière, les lectures du jour… Les retraitants les retrouvent dans l’onglet « Textes ».</p><button class="pri" data-new="texte">Ajouter un texte</button></div>' : '<div class="empty"><h3>Aucun texte pour l’instant</h3><p>Les textes des enseignements et des méditations seront publiés ici.</p></div>'; return }
  $('#list').innerHTML = (ed ? '<p class="note">Ces textes sont visibles par les retraitants confirmés dans l’onglet « Textes ».</p>' : '') + `<div class="texts">${L.map((x, k) => `<details class="txt"${!ed && k === 0 && L.length === 1 ? ' open' : ''}><summary><span><b>${esc(x.titre)}</b><small>${[x.date && fmt(x.date, {weekday:'long', day:'numeric', month:'long'}), x.auteur].filter(Boolean).map(esc).join(' · ')}</small></span>${ed ? `<button class="sm" data-edit="texte:${esc(x.id)}">Modifier</button>` : ''}</summary><div class="txtbody">${esc(x.contenu)}</div></details>`).join('')}</div>`;
}

/* ---------- questionnaire de fin de retraite ---------- */
const CRIT = [['generale', 'Impression générale'], ['enseignements', 'Enseignements'], ['priere', 'Temps de prière et offices'], ['hebergement', 'Hébergement'], ['repas', 'Repas'], ['organisation', 'Organisation']];
const avisOpen = r => !!r && today() >= r.fin;
function vAvis(r) {
  if (ADM()) return vAvisAdmin(r);
  tools('av' + r.id + (S.myAvis ? 1 : 0), '<div class="tools"><h2>Votre avis sur la retraite</h2></div>');
  if (!avisOpen(r)) { $('#list').innerHTML = `<div class="empty"><h3>Bientôt</h3><p>Le questionnaire s’ouvrira le dernier jour de la retraite, le ${fmt(r.fin, {weekday:'long', day:'numeric', month:'long'})}.</p></div>`; return }
  if (S.preview) { $('#list').innerHTML = '<p class="note">Aperçu : le questionnaire ci-dessous n’est pas enregistré.</p>' + avisForm({}); return }
  if ($('#avisform')) return; // ne pas effacer une saisie en cours
  $('#list').innerHTML = (S.myAvis ? '<p class="note okm">Merci, votre avis est enregistré. Vous pouvez encore le modifier ci-dessous.</p>' : '<p class="note">Quelques minutes pour nous aider à préparer les prochaines retraites. Merci !</p>') + avisForm(S.myAvis || {});
}
function avisForm(a) {
  const n = a.notes || {};
  return `<form id="avisform" class="avis" novalidate>${CRIT.map(([k, l]) => `<fieldset class="stars"><legend>${l}</legend>${[1, 2, 3, 4, 5].map(v => `<label title="${v}/5"><input type="radio" name="${k}" value="${v}"${+n[k] === v ? ' checked' : ''}><span>★</span></label>`).join('')}</fieldset>`).join('')}
   <label><span>Ce qui vous a le plus touché</span><textarea name="touche" rows="3" maxlength="2000">${esc(a.touche || '')}</textarea></label>
   <label><span>Ce que nous pourrions améliorer</span><textarea name="ameliorer" rows="3" maxlength="2000">${esc(a.ameliorer || '')}</textarea></label>
   <label><span>Un thème que vous aimeriez pour une prochaine retraite</span><input name="theme" maxlength="300" value="${esc(a.theme || '')}"></label>
   <fieldset class="rev"><legend>Souhaitez-vous revenir à une prochaine retraite ?</legend>${['Oui', 'Peut-être', 'Non'].map(v => `<label><input type="radio" name="revenir" value="${v}"${a.revenir === v ? ' checked' : ''}> ${v}</label>`).join('')}</fieldset>
   <label class="chk"><input type="checkbox" name="anonyme"${a.anonyme ? ' checked' : ''}> Je souhaite que mon avis reste anonyme pour les organisateurs</label>
   <p class="bad" id="averr"></p><button class="pri">${a.le ? 'Mettre à jour mon avis' : 'Envoyer mon avis'}</button></form>`;
}
async function sendAvis(f) {
  if (S.preview) return toast('Aperçu : l’avis n’est pas enregistré.');
  const fd = new FormData(f), notes = {};
  CRIT.forEach(([k]) => { const v = +fd.get(k); if (v) notes[k] = v });
  if (!notes.generale) { $('#averr').textContent = 'Merci de donner au moins une note à l’impression générale.'; return }
  const b = f.querySelector('button'); b.disabled = true;
  try {
    await setDoc(doc(db, 'retraites', S.rid, 'avis', low(S.user.email)), {notes, touche: (fd.get('touche') || '').trim(), ameliorer: (fd.get('ameliorer') || '').trim(), theme: (fd.get('theme') || '').trim(), revenir: fd.get('revenir') || '', anonyme: !!fd.get('anonyme'), le: new Date().toISOString()});
    toast('Merci pour votre avis !'); f.remove(); render();
  } catch (x) { b.disabled = false; $('#averr').textContent = dbErr(x) }
}
function vAvisAdmin(r) {
  tools('ava' + r.id, `<div class="tools"><h2>Avis des retraitants</h2><a class="btn" href="#retraites">← Retraites</a></div>`);
  const A = S.avis, conf = S.ins.filter(i => i.statut === 'Confirmée').length;
  if (!A.length) { $('#list').innerHTML = `<div class="empty"><h3>Aucun avis pour l’instant</h3><p>Le questionnaire s’ouvre pour les retraitants le dernier jour (${fmt(r.fin, {day:'numeric', month:'long'})}), dans leur application, jusqu’à la fin de leur accès.</p></div>`; return }
  const avg = k => { const v = A.map(a => +(a.notes || {})[k]).filter(Boolean); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null };
  const rev = ['Oui', 'Peut-être', 'Non'].map(v => [v, A.filter(a => a.revenir === v).length]);
  const who = a => { if (a.anonyme) return 'Anonyme'; const i = S.ins.find(x => x.id === a.id); return i ? name(i) : a.id };
  $('#list').innerHTML = `<p class="note"><b>${A.length}</b> avis reçu${A.length > 1 ? 's' : ''} sur ${conf} retraitant${conf > 1 ? 's' : ''}.</p>
   <div class="home">${`<section class="hcard"><h3>Notes moyennes</h3>${CRIT.map(([k, l]) => { const m = avg(k); return `<div class="avg"><span>${l}</span><span class="avgbar"><i style="width:${m ? m / 5 * 100 : 0}%"></i></span><b>${m ? m.toFixed(1).replace('.', ',') : '—'}</b></div>` }).join('')}</section>`}
   <section class="hcard"><h3>Souhaitent revenir</h3>${rev.map(([v, n]) => `<div class="avg"><span>${v}</span><span class="avgbar"><i style="width:${A.length ? n / A.length * 100 : 0}%"></i></span><b>${n}</b></div>`).join('')}
   ${A.filter(a => a.theme).length ? `<h3 style="margin-top:12px">Thèmes proposés</h3><ul class="themes">${A.filter(a => a.theme).map(a => `<li>${esc(a.theme)}</li>`).join('')}</ul>` : ''}</section></div>
   <h3 style="font-size:20px;margin:24px 0 10px">Commentaires</h3><div class="comments">${A.filter(a => a.touche || a.ameliorer).sort((a, b) => (b.le || '').localeCompare(a.le || '')).map(a => `<article class="hcard"><h3>${esc(who(a))} · ${'★'.repeat(+(a.notes || {}).generale || 0)}</h3>${a.touche ? `<p><b>Ce qui a touché :</b> ${esc(a.touche)}</p>` : ''}${a.ameliorer ? `<p><b>À améliorer :</b> ${esc(a.ameliorer)}</p>` : ''}</article>`).join('') || '<p class="dim">Pas de commentaire écrit.</p>'}</div>`;
}

/* ---------- sauvegarde d'une retraite ---------- */
async function exportRetreat(id, btn) {
  btn.disabled = true;
  try {
    const r = await getDoc(doc(db, 'retraites', id)), out = {exporteLe: new Date().toISOString(), application: 'Retraites · Sainte Marie et Saint Jean', retraite: {id, ...r.data()}};
    for (const sub of ['programme', 'chambres', 'inscrits', 'fiches', 'textes', 'avis']) out[sub] = (await getDocs(collection(db, 'retraites', id, sub))).docs.map(d => ({id: d.id, ...d.data()}));
    const json = JSON.stringify(out, (k, v) => v && typeof v.toDate === 'function' ? v.toDate().toISOString() : v, 2);
    const a = document.createElement('a'), d = out.retraite.debut || today();
    a.href = URL.createObjectURL(new Blob([json], {type: 'application/json'}));
    a.download = `sauvegarde-retraite-${d}-${norm(out.retraite.titre || 'retraite').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)}.json`;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove() }, 1000);
    toast('Sauvegarde téléchargée. Gardez ce fichier en lieu sûr : il contient des données personnelles.');
  } catch (x) { toast(dbErr(x)) } btn.disabled = false;
}

/* ---------- vues ---------- */
const waPhone = t => { let d = String(t || '').replace(/[^\d+]/g, ''); if (d.startsWith('+')) d = d.slice(1); else if (d.startsWith('00')) d = d.slice(2); else if (/^0\d{9}$/.test(d)) d = '33' + d.slice(1); return d };
const dueOf = (i, r) => i.statut === 'Confirmée' && (+r.prix || 0) > 0 ? Math.max(0, (+r.prix || 0) - (+i.montant || 0)) : 0;
function payReminder(i, r) {
  const msg = `Bonjour ${i.prenom || ''}, petit rappel pour la ${r.titre} (du ${fmt(r.debut, {day:'numeric', month:'long'})} au ${fmt(r.fin, {day:'numeric', month:'long'})}) : il reste ${eur(dueOf(i, r))} à régler. Merci et à bientôt ! — Les organisateurs`;
  return `https://wa.me/${waPhone(i.tel)}?text=${encodeURIComponent(msg)}`;
}
function vInscr(r) {
  S.sel = S.sel || new Set();
  tools('ins' + r.id, `<div class="tools"><h2>Registre des inscrits</h2><input id="q" type="search" placeholder="Rechercher un nom, une adresse…" value="${esc(S.q)}" aria-label="Rechercher"><select id="fs" aria-label="Filtrer"><option value="">Tous les statuts</option>${STATUTS.map(s => `<option${s === S.fStat ? ' selected' : ''}>${esc(s)}</option>`).join('')}<option value="__due"${S.fStat === '__due' ? ' selected' : ''}>Reste à payer</option></select><button id="copy">Copier la liste</button><button id="printbtn">Imprimer…</button><button id="importbtn">Importer</button><button class="pri" data-new="inscrits">Inscrire</button></div>`);
  let L = [...S.ins]; const all = L.length, qq = S.q.toLowerCase();
  for (const id of [...S.sel]) if (!S.ins.some(x => x.id === id)) S.sel.delete(id);
  if (qq) L = L.filter(i => [i.prenom, i.nom, i.email, i.ville, i.tel].join(' ').toLowerCase().includes(qq));
  if (S.fStat === '__due') L = L.filter(i => dueOf(i, r) > 0); else if (S.fStat) L = L.filter(i => i.statut === S.fStat);
  L.sort(byName);
  if (!all) { $('#list').innerHTML = '<div class="empty"><h3>Personne n’est encore inscrit</h3><p>Ajoutez chaque retraitant avec sa propre adresse e-mail, ou importez les réponses de votre Google Form. Au statut « Confirmée », il peut se connecter à l’application.</p><button class="pri" data-new="inscrits">Inscrire un retraitant</button></div>'; return }
  // place libérée + liste d'attente
  const cap = +r.capacite || 0, conf = S.ins.filter(i => i.statut === 'Confirmée').length;
  const wait = S.ins.filter(i => i.statut === "Liste d'attente").sort((a, b) => (a.inscritLe || '').localeCompare(b.inscritLe || '') || byName(a, b));
  const free = cap ? cap - conf : 0;
  const waitBox = cap && free > 0 && wait.length ? `<div class="note waitbox"><span>🔔 <b>${free} place${free > 1 ? 's' : ''} libre${free > 1 ? 's' : ''}</b> · ${wait.length} personne${wait.length > 1 ? 's' : ''} en liste d’attente. Prochaine : <b>${esc(name(wait[0]))}</b>${wait[0].inscritLe ? ` (inscrite le ${fmt(wait[0].inscritLe, {day:'numeric', month:'short'})})` : ''}.</span><button class="sm pri" data-promote="${esc(wait[0].id)}">Confirmer ${esc(wait[0].prenom || 'cette personne')}</button></div>` : '';
  const dueAll = S.ins.reduce((s, i) => s + dueOf(i, r), 0);
  const dueBox = S.fStat === '__due' ? `<p class="note">${L.length} personne${L.length > 1 ? 's' : ''} confirmée${L.length > 1 ? 's' : ''} avec un reste à payer · total <b>${eur(dueAll)}</b>. Touchez « Rappel » pour envoyer un message WhatsApp.</p>` : '';
  const bulk = S.sel.size ? `<div class="bulk"><b>${S.sel.size} sélectionné${S.sel.size > 1 ? 's' : ''}</b><label>Passer au statut <select id="bulkstat">${STATUTS.map(s => `<option${s === (S.bulkStat || 'Confirmée') ? ' selected' : ''}>${esc(s)}</option>`).join('')}</select></label><button class="sm pri" id="bulkgo">Appliquer</button><button class="sm" id="bulkclear">Tout désélectionner</button></div>` : '';
  if (!L.length) { $('#list').innerHTML = waitBox + dueBox + bulk + '<div class="empty">Aucun inscrit ne correspond à cette recherche.</div>'; return }
  const st = s => ({'Confirmée':'ok', 'En attente':'warn', "Liste d'attente":'mu', 'Annulée':'bad'})[s] || 'mu';
  const pay = i => { const p = +i.montant || 0, px = +r.prix || 0; if (i.statut === 'Annulée') return ['mu', '—']; if (px > 0 && p >= px) return ['ok', 'Réglé']; if (p > 0) return ['warn', 'Acompte']; return ['bad', 'À régler'] };
  const allSel = L.every(i => S.sel.has(i.id));
  $('#list').innerHTML = waitBox + dueBox + bulk + `<table class="stack ins"><thead><tr><th class="ck"><input type="checkbox" id="selall" aria-label="Tout sélectionner"${allSel ? ' checked' : ''}></th><th>Retraitant</th><th>Statut</th><th>Fiche</th><th>Paiement</th><th>Chambre</th><th>Urgence / santé</th><th></th></tr></thead><tbody>${L.map(i => {
    const [pc, pl] = pay(i), ch = S.rooms.find(c => c.id === i.chambreId), a = age(i.naissance), due = dueOf(i, r);
    return `<tr${S.sel.has(i.id) ? ' class="sel"' : ''}><td class="ck"><input type="checkbox" data-sel="${esc(i.id)}" aria-label="Sélectionner ${esc(name(i))}"${S.sel.has(i.id) ? ' checked' : ''}></td><td class="who"><b>${esc(name(i))}</b><small>${[i.email, i.tel, i.ville].filter(Boolean).map(esc).join(' · ')}</small>${i.present ? '<small class="ok">✓ Arrivé(e)</small>' : ''}</td>
    <td><span class="tag ${st(i.statut)}">${esc(i.statut || '—')}</span></td>
    <td>${i.sexe ? `<span class="badge-${i.sexe.toLowerCase()}">${SEXE[i.sexe]}</span><br><span class="dim">${fmt(i.naissance, {day:'2-digit', month:'2-digit', year:'numeric'})}${a !== null ? ` · ${a} ans` : ''}</span>` : '<span class="dim">Non remplie</span>'}</td>
    <td><span class="tag ${pc}">${pl}</span><br><span class="dim">${eur(i.montant)} / ${eur(r.prix)}</span>${due && i.tel ? `<br><a class="btn wa sm2" href="${esc(payReminder(i, r))}" target="_blank" rel="noopener">${WAICO}Rappel</a>` : ''}</td>
    <td>${ch ? esc(ch.nom) : '<span class="dim">—</span>'}</td>
    <td class="dim">${(fi => [fi.urgenceNom || fi.urgenceTel ? `🚨 ${esc([fi.urgenceNom, fi.urgenceTel].filter(Boolean).join(' · '))}` : '', [i.regime, fi.allergies, fi.sante].filter(Boolean).map(esc).join(' — ')].filter(Boolean).join('<br>'))(ficheOf(i.id))}</td>
    <td><div class="rowbtns"><button class="sm" data-fiche="${esc(i.id)}">Fiche</button><button class="sm" data-edit="inscrits:${esc(i.id)}">Modifier</button></div></td></tr>` }).join('')}</tbody></table><p class="dim">${L.length} sur ${all} inscription${all > 1 ? 's' : ''}.</p>`;
}
async function bulkStatus(statut, btn) {
  const ids = [...S.sel], L = S.ins.filter(i => ids.includes(i.id)); if (!L.length) return;
  btn.disabled = true; let ok = 0, ko = 0;
  for (const i of L) { if (i.statut === statut) { ok++; continue } try { await saveIns({...stripId(i), statut}, i); ok++ } catch (x) { ko++ } }
  S.sel.clear(); render();
  const cap = +(S.ret && S.ret.capacite) || 0, conf = S.ins.filter(i => i.statut === 'Confirmée').length;
  toast((ko ? `${ok} mis à jour, ${ko} en échec.` : `${ok} personne${ok > 1 ? 's' : ''} passée${ok > 1 ? 's' : ''} en « ${statut} ».`) + (cap && statut === 'Confirmée' && conf > cap ? ` Attention : ${conf} confirmés pour ${cap} places.` : ''));
}

const nowHM = () => new Date().toTimeString().slice(0, 5);
function slotNow(P, p) { // activité en cours aujourd'hui ?
  if (p.date !== today() || !p.heure) return false;
  const t = nowHM(); if (p.heure > t) return false;
  if (p.fin) return t < p.fin;
  const nx = P.find(q => q.date === p.date && (q.heure || '') > p.heure);
  if (nx) return t < nx.heure;
  const [hh, mm] = p.heure.split(':').map(Number); const end = `${String(Math.min(23, hh + 1)).padStart(2, '0')}:${String(mm).padStart(2, '0')}`; return t < end;
}
function vProg(r) {
  const ed = ADM(), first = !S.toolsKey.endsWith('prog' + r.id + ed);
  tools('prog' + r.id + ed, `<div class="tools"><h2>Programme de la retraite</h2>${ed ? '<button class="pri" data-new="programme">Ajouter une activité</button>' : ''}</div>`);
  const P = [...S.prog].sort((a, b) => ((a.date || '') + (a.heure || '')).localeCompare((b.date || '') + (b.heure || '')));
  if (!P.length) { $('#list').innerHTML = ed ? '<div class="empty"><h3>Le programme est vide</h3><p>Offices, enseignements, temps de silence et repas, jour après jour.</p><button class="pri" data-new="programme">Ajouter une activité</button></div>' : '<div class="empty"><h3>Programme à venir</h3><p>Le programme détaillé sera publié ici prochainement.</p></div>'; return }
  const days = [...new Set(P.map(p => p.date))], t = today(), tn = nowHM();
  $('#list').innerHTML = days.map(d => { const n = Math.round((new Date(d) - new Date(r.debut)) / 864e5) + 1, isT = d === t, past = d < t;
    return `<section class="day${isT ? ' today' : ''}${past ? ' past' : ''}"${isT ? ' id="aujourdhui"' : ''}><h3>${fmt(d, {weekday:'long', day:'numeric', month:'long'})}${n > 0 ? `<small>Jour ${n}</small>` : ''}${isT ? '<span class="tag ok tday">Aujourd’hui</span>' : ''}</h3>${P.filter(p => p.date === d).map(p => { const now = slotNow(P, p), done = isT && !now && (p.fin || p.heure) < tn && p.heure < tn;
      return `<div class="slot${ed ? '' : ' ro'}${now ? ' now' : ''}${done ? ' done' : ''}"><time>${esc(p.heure)}${p.fin ? `<small>→ ${esc(p.fin)}</small>` : ''}</time><div>${now ? '<span class="nowtag">En ce moment</span>' : ''}<b>${esc(p.titre)}</b><br><span class="dim"><span class="dot" style="background:${TYPES[p.type] || '#888'}"></span>${esc(p.type || '')}${p.lieu ? ' · ' + esc(p.lieu) : ''}${p.intervenant ? ' · ' + esc(p.intervenant) : ''}</span></div>${ed ? `<div><button class="sm" data-edit="programme:${esc(p.id)}">Modifier</button></div>` : ''}</div>` }).join('')}${ed ? `<p><button class="sm" data-new="programme" data-day="${esc(d)}">+ Activité ce jour</button></p>` : ''}</section>` }).join('');
  if (first && days.includes(t)) setTimeout(() => { const el = $('#aujourdhui'); if (el) el.scrollIntoView({block: 'start'}) }, 50);
}

const daysBetween = (a, b) => Math.round((new Date(b + 'T12:00') - new Date(a + 'T12:00')) / 864e5);
function vHome(r) {
  tools('home' + r.id, '');
  const me = ME(), t = today(), ch = S.rooms.find(c => c.id === me.chambreId), lim = r.dateLimiteChambres, isOpen = open_();
  const nuits = Math.max(0, daysBetween(r.debut, r.fin));
  const when = t < r.debut ? (d => d === 1 ? 'Demain !' : `Dans ${d} jours`)(daysBetween(t, r.debut)) : t <= r.fin ? `En cours · jour ${daysBetween(r.debut, t) + 1}` : 'Retraite terminée';
  const now = new Date(), nowKey = t + ' ' + now.toTimeString().slice(0, 5);
  const P = [...S.prog].sort((a, b) => ((a.date || '') + (a.heure || '')).localeCompare((b.date || '') + (b.heure || '')));
  const cur = P.find(p => slotNow(P, p)), next = P.find(p => `${p.date} ${p.heure}` >= nowKey && p !== cur);
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
  ${cur ? card('En ce moment', `<p class="big">${esc(cur.titre)}</p><p>Jusqu’à ${esc(cur.fin || (next && next.date === cur.date ? next.heure : '—'))}${cur.lieu ? ' · ' + esc(cur.lieu) : ''}</p>`, ['programme', 'Programme du jour']) : ''}
  ${card('Prochaine activité', next ? `<p class="big">${esc(next.titre)}</p><p>${fmt(next.date, {weekday:'long', day:'numeric', month:'long'})} à <b>${esc(next.heure)}</b>${next.fin ? ` → ${esc(next.fin)}` : ''}</p><p class="dim"><span class="dot" style="background:${TYPES[next.type] || '#888'}"></span>${esc(next.type || '')}${next.lieu ? ' · ' + esc(next.lieu) : ''}${next.intervenant ? ' · ' + esc(next.intervenant) : ''}</p>` : `<p>${P.length ? 'Le programme de la retraite est terminé.' : 'Le programme sera publié prochainement.'}</p>`, ['programme', 'Tout le programme'])}
  ${card('Ma fiche', `<dl><dt>Nom</dt><dd>${esc(name(me))}</dd><dt>Adresse</dt><dd>${esc(me.email || me.id)}</dd>${me.tel ? `<dt>Téléphone</dt><dd>${esc(me.tel)}</dd>` : ''}<dt>Sexe</dt><dd>${SEXE[me.sexe] || '—'}</dd><dt>Naissance</dt><dd>${fmt(me.naissance, {day:'numeric', month:'long', year:'numeric'})}${age(me.naissance) !== null ? ` · ${age(me.naissance)} ans` : ''}</dd>${me.regime ? `<dt>Régime</dt><dd>${esc(me.regime)}</dd>` : ''}${px ? `<dt>Participation</dt><dd>${paid >= px ? `<span class="ok">Réglée (${eur(px)})</span>` : paid > 0 ? `${eur(paid)} réglés sur ${eur(px)} · <b>reste ${eur(px - paid)}</b>` : `${eur(px)} · <b>à régler</b>`}</dd>` : ''}</dl><p class="dim">Une erreur ? Signalez-la aux organisateurs.</p>`)}
  ${avisOpen(r) ? card('Votre avis', S.myAvis ? '<p>Merci, votre avis est bien enregistré.</p>' : '<p>La retraite touche à sa fin : quelques minutes pour nous dire ce que vous en avez pensé ?</p>', ['avis', S.myAvis ? 'Modifier mon avis' : 'Donner mon avis']) : ''}
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
  tools('inf' + r.id + ed, `<div class="tools"><h2>Infos pratiques</h2>${ed ? '<a class="btn" href="#textes">Textes et méditations</a><button class="pri" data-new="rubrique">Ajouter une rubrique</button>' : ''}</div>${ed ? `<section class="annadm"><h3>Nouvelle annonce</h3><p class="dim">L’annonce la plus récente s’affiche en haut des Infos pratiques et de l’accueil de chaque retraitant.</p>
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
    <div class="row"><button class="sm pri" data-open="${esc(x.id)}">Ouvrir</button><button class="sm" data-edit="retraites:${esc(x.id)}">Modifier</button><button class="sm" data-avis="${esc(x.id)}">Avis</button><button class="sm" data-export="${esc(x.id)}">Sauvegarder</button></div></article>` }).join('')}</div>`;
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
  if (b.id === 'printbtn') return printDlg();
  if (b.dataset.avis) { if (b.dataset.avis !== S.rid) setRetreat(b.dataset.avis); location.hash = 'avis'; return }
  if (b.dataset.export) return exportRetreat(b.dataset.export, b);
  if (b.id === 'printemarg') return printDoc('emargement');
  if (b.dataset.arr) return toggleArr(b.dataset.arr, b);
  if (b.id === 'bulkgo') return bulkStatus($('#bulkstat').value, b);
  if (b.id === 'bulkclear') { S.sel.clear(); return render() }
  if (b.dataset.promote) { const i = S.ins.find(x => x.id === b.dataset.promote); if (!i) return; b.disabled = true; try { await saveIns({...stripId(i), statut: 'Confirmée'}, i); toast(`${name(i)} est confirmé(e) et peut se connecter.`) } catch (x) { b.disabled = false; toast(x.userMsg || dbErr(x)) } return }
  if (b.dataset.fiche) { const i = S.ins.find(x => x.id === b.dataset.fiche); return i && ficheDlg(i) }
  if (b.dataset.anndel) { if (!b.dataset.ok) { b.dataset.ok = 1; b.textContent = 'Confirmer'; return } b.disabled = true; try { await updateDoc(doc(db, 'retraites', S.rid), {annonces: ((S.ret && S.ret.annonces) || []).filter(a => a.id !== b.dataset.anndel)}); toast('Annonce supprimée.') } catch (x) { toast(dbErr(x)) } return }
  if (b.dataset.new === 'equipe') return S.resp ? form('equipe', null, {role: 'organisateur'}) : toast('Seul le responsable peut ajouter des organisateurs.');
  if (b.dataset.new) { const pre = b.dataset.new === 'inscrits' ? {statut:'Confirmée'} : b.dataset.new === 'programme' ? {date: b.dataset.day || S.ret.debut, type:'Office / prière'} : b.dataset.new === 'chambres' ? {lits: 1, type:'H', pmr:'Non'} : {}; return form(b.dataset.new, null, pre) }
  if (b.dataset.edit) { const [c, id] = b.dataset.edit.split(':'); const src = c === 'retraites' ? S.rets : c === 'equipe' ? S.orgs.map(o => ({...o, email: o.id})) : S[{inscrits:'ins', chambres:'rooms', programme:'prog', texte:'textes'}[c]]; const o = src.find(x => x.id === id); return o && form(c, o) }
  if (b.dataset.redit) { const x = rubOf(S.ret).find(y => y.id === b.dataset.redit); return x && form('rubrique', x) }
  if (b.dataset.rmove) { const [k, d] = b.dataset.rmove.split(':').map(Number), L = rubOf(S.ret).map(x => ({...x})), t = k + d; if (t < 0 || t >= L.length) return; [L[k], L[t]] = [L[t], L[k]]; b.disabled = true; try { await updateDoc(doc(db, 'retraites', S.rid), {rubriques: L}) } catch (x) { toast(dbErr(x)) } return }
  if (b.dataset.open) { setRetreat(b.dataset.open); location.hash = 'inscriptions'; return }
  if (b.dataset.unassign) { b.disabled = true; return assign(b.dataset.unassign, '') }
  if (b.id === 'recount') { b.disabled = true; try { await recount() } catch (x) { toast(dbErr(x)) } b.disabled = false; return }
  if (b.id === 'copy') {
    const rows = [['Nom','Prénom','E-mail','Statut','Sexe','Naissance','Âge','Téléphone','Ville','Réglé (€)','Chambre','Régime','Urgence (nom)','Urgence (tél.)','Allergies','Santé','Notes organisateurs'], ...[...S.ins].sort(byName).map(i => [i.nom, i.prenom, i.email, i.statut, SEXE[i.sexe] || '', i.naissance || '', age(i.naissance) ?? '', i.tel, i.ville, i.montant, (S.rooms.find(c => c.id === i.chambreId) || {}).nom, i.regime, ficheOf(i.id).urgenceNom, ficheOf(i.id).urgenceTel, ficheOf(i.id).allergies, ficheOf(i.id).sante, ficheOf(i.id).notesOrg || i.notes])];
    try { await navigator.clipboard.writeText(rows.map(r => r.map(v => String(v ?? '').replace(/[\t\n]/g, ' ')).join('\t')).join('\n')); toast('Liste copiée : collez-la dans un tableur.') } catch (x) { toast('Copie refusée par le navigateur.') }
  }
});
document.addEventListener('change', async e => {
  const t = e.target;
  if (t.id === 'pick') return setRetreat(t.value);
  if (t.id === 'pvsel') { S.pv = t.value; S.toolsKey = ''; return render() }
  if (t.id === 'fs') { S.fStat = t.value; return render() }
  if (t.id === 'bulkstat') { S.bulkStat = t.value; return }
  if (t.id === 'onlyabs') { S.onlyAbs = t.checked; return render() }
  if (t.dataset.sel) { t.checked ? S.sel.add(t.dataset.sel) : S.sel.delete(t.dataset.sel); return render() }
  if (t.id === 'selall') { const vis = [...document.querySelectorAll('[data-sel]')].map(x => x.dataset.sel); vis.forEach(id => t.checked ? S.sel.add(id) : S.sel.delete(id)); return render() }
  if (t.id === 'copyfrom' && t.value) { t.disabled = true; try { await copyRooms(t.value) } catch (x) { toast(dbErr(x)) } t.value = ''; t.disabled = false; return }
  if (t.id === 'deadline') { try { await updateDoc(doc(db, 'retraites', S.rid), {dateLimiteChambres: t.value, limiteChambresTs: t.value ? endOfDay(t.value) : null}); toast(t.value ? 'Date limite enregistrée.' : 'Date limite retirée.') } catch (x) { toast(dbErr(x)) } return }
  if (t.dataset.assign && t.value) { t.disabled = true; return assign(t.value, t.dataset.assign) }
});
document.addEventListener('input', e => { if (e.target.id === 'q') { S.q = e.target.value; render() } if (e.target.id === 'qa') { S.qa = e.target.value; render() } if (e.target.id === 'imptxt') { IMP = null; const g = $('#impgo'); if (g) { g.disabled = true; g.textContent = 'Importer' } } });
setInterval(() => { if (!$('#app').hidden && !S.editing && ['programme', 'accueil'].includes(view()) && !document.activeElement.matches('input,textarea,select')) render() }, 60000);
document.addEventListener('submit', e => { if (e.target.id === 'avisform') { e.preventDefault(); sendAvis(e.target) } });
addEventListener('hashchange', () => { S.toolsKey = ''; render(); scrollTo({top: 0}) });
