# Retraites — Église copte orthodoxe Sainte Marie et Saint Jean

Application des retraites spirituelles de la paroisse.

- **Retraitants** : connexion avec l'adresse e-mail donnée à l'inscription, fiche (sexe, date de naissance), programme, choix de la chambre, infos pratiques.
- **Organisateurs** : inscriptions, paiements, chambres, programme, infos pratiques, retraites, équipe.

Adresse : https://ste-marie-st-jean.github.io/Ste-Marie-et-St-Jean-App/

Application web installable (« Ajouter à l'écran d'accueil »), hébergée sur GitHub Pages. Les données et les connexions sont gérées par Firebase (projet `ste-marie-et-st-jean-app`) : **aucune donnée personnelle n'est stockée dans ce dépôt**.

## Règles d'accès
- Seuls les inscrits au statut **Confirmée** peuvent se connecter, jusqu'à **7 jours après le dernier jour** de la retraite.
- Chaque personne a sa propre adresse e-mail et son propre mot de passe ; l'adresse doit être confirmée par e-mail.
- La fiche (sexe, date de naissance) est remplie une seule fois ; seuls les organisateurs peuvent la corriger.
- Chambres réservées aux hommes ou aux femmes ; chacun choisit la sienne parmi celles de son sexe, tant qu'il reste de la place, jusqu'à la date limite fixée par les organisateurs.
- Ces règles sont vérifiées par le serveur (fichier `firestore.rules`).

## Mise en service (une seule fois)
1. **Publier les règles de sécurité** : console Firebase → Firestore Database → onglet « Règles » → remplacer tout le contenu par celui de `firestore.rules` → « Publier ».
2. **Déclarer le responsable** : Firestore Database → « Données » → « Commencer une collection » → ID : `organisateurs` → ID du document : votre adresse e-mail **en minuscules** → champ `nom` (chaîne) et champ `role` (chaîne) = `responsable` → « Enregistrer ». Seul un responsable peut ensuite ajouter ou retirer des organisateurs depuis l'application.
3. **Activer GitHub Pages** : ce dépôt → Settings → Pages → Source « Deploy from a branch » → Branch `main`, dossier `/ (root)` → Save.
4. Ouvrir l'application, choisir « Première connexion » avec votre adresse, confirmer l'e-mail reçu. Les autres organisateurs s'ajoutent ensuite depuis l'onglet « Organisateurs » de l'application.

## Fichiers
| Fichier | Rôle |
|---|---|
| `index.html`, `style.css`, `app.js` | L'application |
| `config.js` | Identifiants publics du projet Firebase |
| `firestore.rules` | Règles de sécurité à publier dans Firebase |
| `manifest.webmanifest`, `sw.js`, `icons/` | Installation sur téléphone |
