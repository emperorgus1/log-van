# Suivi des améliorations — Carnet de Van

Ce document est la liste de contrôle des améliorations prévues sur la branche
`codex/review-improvements`.

Une case n'est cochée qu'après :

1. l'implémentation ;
2. une vérification dans le navigateur ;
3. un test du comportement concerné.

Légende : **P1** = à faire en premier, **P2** = important, **P3** = amélioration.

## Sécurité et intégrité des données

- [x] **P1 — Protéger tous les textes enregistrés contre l'injection HTML.**
  - Échapper chaque donnée venant de Firestore avant de l'insérer dans du HTML.
  - Corriger les formulaires véhicule, essence, entretien et le rapport imprimable.
  - Vérification : enregistrer des caractères comme `<`, `>`, `&` et `"`, puis vérifier qu'ils s'affichent comme du texte, jamais comme du code.

- [x] **P1 — Confirmer les suppressions.**
  - Demander une confirmation claire avant de supprimer une entrée ou ses documents.
  - Vérification : essayer de supprimer une entrée, annuler, puis vérifier qu'elle est toujours présente.

- [x] **P1 — Éviter les suppressions partielles et les fichiers orphelins.**
  - Gérer les erreurs entre Firestore et Firebase Storage.
  - Nettoyer les fichiers téléversés si l'enregistrement de la fiche échoue.
  - Vérification : simuler un échec d'enregistrement et vérifier qu'aucun document inutile ne reste dans Storage.

- [x] **P2 — Renforcer les règles Firebase.**
  - Conserver l'isolation actuelle par utilisateur.
  - Ajouter la validation des champs attendus dans Firestore et du type de fichier dans Storage.
  - Vérification : publier les règles et vérifier qu'un fichier ou une donnée non conforme est refusé.

- [x] **P2 — Protéger l'utilisation d'OpenRouteService.**
  - Remplacer la clé actuellement visible dans le code.
  - Restreindre son usage ou son quota dans le service, si possible.
  - Vérification : la clé précédente ne fonctionne plus et le calcul de distance continue de fonctionner.

- [x] **P2 — Ajouter les protections d'hébergement.**
  - Définir des en-têtes de sécurité adaptés à Netlify ou à l'hébergement choisi.
  - Limiter les sources externes autorisées sans bloquer Firebase, les cartes ou la connexion Google.
  - Vérification : l'application fonctionne après déploiement et les ressources non autorisées sont bloquées.

## Formulaires, fiabilité et synchronisation

- [x] **P1 — Valider les montants, kilométrages et dates.**
  - Refuser les valeurs invalides, négatives ou incohérentes.
  - Avertir lorsqu'un kilométrage est inférieur au dernier relevé.
  - Vérification : essayer des valeurs comme `abc`, `-20` et un kilométrage qui recule.

- [x] **P1 — Afficher les chargements et les erreurs.**
  - Afficher un état de chargement pendant la lecture ou l'enregistrement.
  - Montrer un message compréhensible si Firebase, la carte ou un téléversement échoue.
  - Vérification : couper temporairement le réseau et contrôler le message affiché.

- [ ] **P2 — Corriger la date locale autour de minuit.**
  - Générer la date à partir du fuseau horaire local, plutôt que de l'heure UTC.
  - Vérification : tester une date vers la fin de journée au Québec.

- [ ] **P2 — Fiabiliser l'impression et l'export.**
  - Attendre la fin réelle de l'impression avant de restaurer l'interface.
  - Vérifier les caractères accentués et les guillemets dans le CSV.
  - Vérification : ouvrir le CSV dans Excel ou LibreOffice et imprimer un rapport.

- [ ] **P2 — Améliorer les calculs.**
  - Calculer la consommation moyenne en tenant compte des distances parcourues.
  - Repérer les relevés incohérents et expliquer les calculs indisponibles.
  - Vérification : comparer le résultat avec un exemple calculé à la main.

- [ ] **P2 — Améliorer la synchronisation entre appareils.**
  - Actualiser les données quand elles changent sur un autre appareil.
  - Éviter d'écraser le profil véhicule complet quand un seul champ est modifié.
  - Vérification : modifier une donnée depuis deux sessions et vérifier le résultat.

- [ ] **P3 — Préparer l'application pour davantage de données.**
  - Charger seulement les données utiles à chaque écran.
  - Ajouter une limite ou une pagination si nécessaire.
  - Vérification : tester avec un volume important de données sans ralentissement notable.

## Hors-ligne, confidentialité et accessibilité

- [x] **P1 — Rendre le mode hors-ligne fiable.**
  - Vérifier le démarrage après une première visite sans Internet.
  - Mettre en cache les ressources nécessaires ou clarifier les limites du mode hors-ligne.
  - Ajouter un indicateur de connexion hors ligne.
  - Vérification : charger l'application, couper Internet, la fermer puis la rouvrir.

- [ ] **P2 — Expliquer l'usage de la localisation (annulé).**
  - Informer que les adresses sont envoyées à Nominatim pour être converties en coordonnées.
  - Informer que les coordonnées peuvent être envoyées à OpenRouteService pour calculer une distance.
  - Mettre en cache les localisations déjà résolues.
  - Vérification : relire l'information avant la première utilisation d'une adresse.

- [x] **P2 — Améliorer l'accessibilité.**
  - Ajouter des libellés accessibles aux boutons icônes.
  - Rendre les fenêtres modales utilisables au clavier et avec un lecteur d'écran.
  - Ajouter un indicateur de focus et respecter la réduction des animations.
  - Vérification : parcourir l'application avec Tabulation, Entrée et Échap.

## Confort visuel et maintenance

- [ ] **P3 — Alléger et enrichir le tableau de bord.**
  - Mettre en avant les indicateurs les plus utiles sur petit écran.
  - Ajouter des graphiques simples pour les dépenses et la consommation.
  - Vérification : contrôler la lisibilité sur téléphone et ordinateur.

- [ ] **P3 — Stabiliser les icônes et le rendu visuel.**
  - Évaluer le remplacement des emojis par des icônes stables si le rendu diffère trop selon l'appareil.
  - Vérification : comparer Android, iPhone et ordinateur lorsque possible.

- [ ] **P2 — Ajouter des tests et de la documentation.**
  - Créer des tests pour les décimales, les dates, les calculs et le CSV.
  - Documenter le déploiement et la configuration Firebase.
  - Vérification : une nouvelle installation peut être déployée à partir du guide.

## Journal des modifications réalisées

| Date | Modification cochée | Vérification effectuée | Notes |
| --- | --- | --- | --- |
| 2026-08-31 | Protection des textes, confirmations, validation et messages d'état | Test sur l'aperçu Netlify | Les quatre éléments ont été vérifiés. |
| 2026-08-31 | Suppressions partielles et fichiers orphelins | Ajout puis suppression d'une pièce jointe et de sa dépense sur l'aperçu Netlify | Règles Firebase Storage publiées et fonctionnement confirmé. |
| 2026-08-31 | Renforcement des règles Firebase | Règles Firestore et Storage publiées dans Firebase | Isolation par compte, validation des données et types de fichiers autorisés. |
| 2026-08-31 | Mode hors-ligne et accessibilité | Vérification du chargement de l'aperçu Netlify | Mise en cache des ressources essentielles, indicateur hors ligne, navigation clavier et respect de la réduction des animations. |
| 2026-08-31 | Usage de la localisation | Décision du propriétaire | Annulé : aucun avertissement ni cache supplémentaire pour les adresses. |
