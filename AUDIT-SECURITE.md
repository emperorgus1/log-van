# Audit de sécurité — Carnet de Van — 8 septembre 2026

Date de l’audit : 8 septembre 2026

## Objectif

Ce document rassemble les risques de sécurité et de confidentialité repérés dans l’application afin de pouvoir les corriger progressivement.

L’examen effectué est un audit statique du code source. Ce n’est pas un test d’intrusion. Certains éléments configurés dans Firebase, Google Cloud, Netlify ou GitHub ne peuvent pas être confirmés uniquement à partir des fichiers du projet.

## Résumé

Aucune vulnérabilité critique permettant directement à un utilisateur de consulter ou de modifier les données d’un autre compte n’a été trouvée dans le code examiné.

La base de sécurité est saine : authentification Google, séparation des utilisateurs dans Firebase, validation côté serveur et protection des textes injectés dans l’interface.

Les principaux risques concernent :

1. les liens durables vers les pièces jointes;
2. l’utilisation sans authentification de la fonction de calcul de distance;
3. la conservation locale des données après une déconnexion;
4. l’absence apparente de Firebase App Check;
5. les formules potentiellement dangereuses dans les fichiers CSV;
6. les dépendances chargées depuis des services externes;
7. la validation limitée du contenu réel des pièces jointes.

## Plan d’action recommandé

### Priorité élevée

- [ ] Remplacer les liens durables des pièces jointes par un téléchargement qui vérifie l’utilisateur Firebase connecté.
- [ ] Vérifier que les règles Firestore et Storage présentes dans le projet sont réellement publiées en production.

### Priorité moyenne

- [ ] Protéger la fonction Netlify de calcul de distance avec l’authentification Firebase.
- [ ] Ajouter une limitation de fréquence à la fonction de calcul de distance.
- [ ] Examiner l’activation de Firebase App Check.
- [ ] Ajouter une option « Déconnexion et effacement des données de cet appareil ».
- [ ] Réduire la présence des coordonnées précises dans les journaux réseau.
- [ ] Vérifier les restrictions appliquées à la clé Firebase dans Google Cloud.

### Priorité faible ou amélioration préventive

- [ ] Neutraliser les cellules pouvant devenir des formules dans les exports CSV.
- [ ] Héberger Leaflet localement ou ajouter un contrôle d’intégrité approprié.
- [ ] Établir une procédure de mise à jour régulière des modules Firebase.
- [ ] Vérifier le contenu réel des fichiers joints, et pas seulement leur type déclaré.
- [ ] Ajouter ou vérifier la politique HSTS du site en production.
- [ ] Vérifier les alertes de quota et de facturation.
- [ ] Examiner les sauvegardes et la restauration des données supprimées.

## 1. Liens durables vers les pièces jointes

**Niveau : élevé pour la confidentialité**

Après l’envoi d’une pièce jointe, l’application appelle `getDownloadURL()` et conserve l’adresse obtenue dans Firestore.

Ces adresses doivent être considérées comme des liens secrets. Une personne qui obtient un de ces liens pourrait potentiellement télécharger le fichier sans utiliser l’interface normale de l’application.

Sources possibles de fuite :

- lien copié ou partagé accidentellement;
- historique ou cache du navigateur;
- extension de navigateur malveillante;
- sauvegarde ou export de Firestore;
- journaux contenant accidentellement l’adresse.

**Fichier concerné :** `js/attachments.js`

**Correction recommandée :** télécharger le fichier au moyen d’une requête authentifiée avec Firebase plutôt que conserver une adresse de téléchargement durable.

## 2. Fonction de calcul de distance sans authentification

**Niveau : moyen**

La fonction Netlify qui communique avec HeiGIT/OpenRouteService ne vérifie pas actuellement l’identité Firebase de la personne qui l’appelle.

Une personne qui découvre son adresse pourrait l’appeler automatiquement et consommer :

- le quota OpenRouteService;
- les exécutions Netlify;
- éventuellement les limites d’un forfait gratuit ou payant.

Protections déjà présentes :

- validation des coordonnées;
- destination externe fixe;
- clé OpenRouteService conservée côté serveur;
- réponse limitée à la distance calculée.

Aucune possibilité évidente de rediriger la fonction vers un serveur arbitraire n’a été trouvée.

**Fichier concerné :** `netlify/functions/distance.mjs`

**Corrections recommandées :**

- vérifier un jeton Firebase dans la fonction;
- limiter le nombre de requêtes par utilisateur ou adresse IP;
- mettre en cache les calculs identiques lorsque cela est pertinent.

## 3. Confidentialité des coordonnées

**Niveau : moyen pour la confidentialité**

Les coordonnées du domicile et de la destination sont envoyées dans les paramètres d’une requête `GET` vers Netlify. Elles peuvent donc apparaître dans différents journaux techniques.

Une adresse saisie sous forme de texte est aussi envoyée à Nominatim afin d’obtenir ses coordonnées. Les tuiles de carte demandées indiquent approximativement à OpenStreetMap la région consultée.

**Fichier concerné :** `js/geo.js`

**Corrections recommandées :**

- utiliser une requête `POST` pour transmettre les coordonnées;
- limiter ou désactiver la journalisation des paramètres sensibles;
- expliquer clairement quels services tiers reçoivent les données;
- arrondir les coordonnées lorsqu’une précision exacte n’est pas nécessaire.

## 4. Données conservées localement

**Niveau : moyen sur un appareil partagé ou perdu**

Firestore utilise IndexedDB pour permettre le fonctionnement hors ligne. Les données peuvent donc rester physiquement dans le profil du navigateur après la déconnexion.

Sur un appareil personnel bien protégé, le risque est limité. Sur un ordinateur partagé, perdu ou compromis, une personne ayant accès au profil du navigateur pourrait inspecter les données locales.

Il n’existe pas non plus de chiffrement de bout en bout : Firebase doit pouvoir traiter les données enregistrées.

**Fichier concerné :** `js/firebase.js`

**Corrections recommandées :**

- offrir une déconnexion qui efface également les données locales;
- avertir l’utilisateur sur les appareils partagés;
- protéger le compte Google avec l’authentification à deux facteurs.

## 5. Protection Firebase contre les abus

**Niveau : moyen**

Firebase App Check n’apparaît pas dans le code actuel. Sans cette protection, les appels de l’application peuvent être reproduits par un programme extérieur.

Les règles Firebase empêchent normalement la lecture des données des autres utilisateurs, mais elles ne préviennent pas tous les scénarios de création automatisée de comptes ou de consommation abusive des quotas.

**Fichier concerné :** `js/firebase.js`

**Corrections recommandées :**

- évaluer App Check avec une solution adaptée au Web;
- surveiller les métriques avant d’activer son application obligatoire;
- vérifier les restrictions de la clé Firebase;
- déterminer si tous les comptes Google doivent pouvoir utiliser l’application.

### À propos de la clé Firebase visible

La clé présente dans le code du navigateur n’est pas considérée comme un mot de passe. Une application Web Firebase doit fournir cette configuration au navigateur.

La sécurité dépend principalement des règles Firebase, des restrictions de la clé et d’App Check. La clé devrait être limitée uniquement aux API Firebase nécessaires.

## 6. Injection de formules dans les exports CSV

**Niveau : faible à moyen**

Les guillemets sont correctement protégés dans les fichiers CSV, mais les cellules textuelles commençant par `=`, `+`, `-` ou `@` ne sont pas neutralisées.

Certains tableurs pourraient interpréter ces cellules comme des formules lors de l’ouverture du fichier.

Le risque est actuellement limité parce que les données sont normalement saisies par le propriétaire du compte. Il augmenterait si l’application permettait un jour d’importer ou de partager des données provenant d’autres personnes.

**Fichier concerné :** `js/views/reports.js`

**Correction recommandée :** préfixer les cellules textuelles dangereuses par une apostrophe avant la création du CSV.

## 7. Dépendances externes

**Niveau : faible à moyen**

Leaflet est chargé directement depuis `unpkg.com`, tandis que Firebase est chargé depuis `gstatic.com`.

Les versions sont fixes, ce qui est positif. Cependant, aucun contrôle d’intégrité cryptographique n’est appliqué à Leaflet. Une compromission du service externe ou de la ressource publiée pourrait affecter l’application.

La politique de sécurité du site autorise les scripts provenant de ces domaines.

**Fichiers concernés :**

- `js/views/places.js`;
- `js/firebase.js`;
- `js/db.js`;
- `js/attachments.js`;
- `_headers`.

**Corrections recommandées :**

- conserver Leaflet directement dans le projet ou ajouter un contrôle d’intégrité;
- vérifier périodiquement les nouvelles versions de Firebase;
- limiter les domaines autorisés par la politique de sécurité au strict nécessaire.

## 8. Validation des fichiers joints

**Niveau : faible dans le contexte actuel**

L’application et Firebase Storage vérifient la taille et le type MIME déclaré. Les fichiers HTML et SVG ne sont pas autorisés, ce qui réduit le risque d’exécution de contenu actif.

Le type MIME provient toutefois du client et peut être falsifié. Le contenu réel du fichier n’est pas analysé côté serveur.

**Fichiers concernés :**

- `js/attachments.js`;
- `storage.rules`.

**Correction recommandée :** si l’application devient publique ou multi-utilisateur, analyser les fichiers côté serveur et vérifier leur signature réelle.

## 9. En-têtes de sécurité

**Niveau : à vérifier en production**

Le fichier `_headers` prévoit plusieurs protections utiles :

- politique de sécurité du contenu;
- interdiction d’intégrer l’application dans une autre page;
- protection contre la détection incorrecte des types de fichiers;
- politique de référent;
- restriction de la géolocalisation;
- blocage des objets intégrés.

Ce fichier est compris par Netlify, mais ne serait pas automatiquement appliqué par GitHub Pages. L’adresse de production et les en-têtes réellement reçus doivent donc être vérifiés.

Une politique HSTS explicite n’apparaît pas dans le fichier.

**Fichier concerné :** `_headers`

## 10. Protections jugées satisfaisantes

Les éléments suivants ne présentent pas de vulnérabilité directe dans le code examiné :

- séparation des documents Firestore par identifiant utilisateur;
- séparation des fichiers Storage par identifiant utilisateur;
- obligation d’être authentifié pour lire les données;
- validation des champs et limitation de leur taille dans Firestore;
- limitation des pièces jointes à moins de 10 Mo;
- refus des fichiers HTML et SVG;
- protection des textes avant leur insertion dans le HTML;
- protection des noms et notes dans les infobulles de la carte;
- absence d’utilisation de `eval()` ou d’un équivalent;
- clé OpenRouteService absente du code public;
- validation stricte des coordonnées dans la fonction Netlify;
- liens ouverts dans un nouvel onglet accompagnés de `rel="noopener"`;
- communications externes effectuées en HTTPS;
- politique empêchant l’intégration dans une iframe, si les en-têtes sont actifs.

## 11. Éléments à vérifier dans les consoles d’administration

Ces points ne peuvent pas être confirmés uniquement avec le code du projet :

- [ ] Règles Firestore publiées et identiques à `firestore.rules`.
- [ ] Règles Storage publiées et identiques à `storage.rules`.
- [ ] État de Firebase App Check.
- [ ] Restrictions de la clé Firebase dans Google Cloud.
- [ ] Domaines autorisés pour l’authentification Google.
- [ ] Comptes possédant des droits administratifs sur Firebase et Google Cloud.
- [ ] Alertes de quota et de facturation Firebase, Google Cloud et Netlify.
- [ ] Politique de conservation des journaux Netlify contenant les coordonnées.
- [ ] Sauvegardes Firestore et méthode de restauration.
- [ ] En-têtes HTTP réellement servis en production.
- [ ] Protection de la branche principale GitHub.
- [ ] Analyse de secrets et alertes de dépendances GitHub.

## Ordre suggéré pour les prochaines séances

1. Vérifier les configurations réellement publiées dans Firebase et Netlify.
2. Sécuriser l’accès aux pièces jointes.
3. Protéger la fonction de calcul de distance et réduire la journalisation des coordonnées.
4. Examiner et déployer Firebase App Check.
5. Ajouter l’effacement local lors de la déconnexion.
6. Corriger l’export CSV.
7. Renforcer les dépendances et les en-têtes de sécurité.
8. Ajouter des mécanismes de sauvegarde, de surveillance et d’alerte.

## État du suivi

Ce document doit être mis à jour à mesure que les correctifs sont appliqués. Chaque action terminée peut être cochée, accompagnée du numéro du commit correspondant et de la date de vérification.
