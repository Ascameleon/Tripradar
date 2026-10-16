# TripRadar

**Promesse :** repérer des destinations accessibles selon le prix du billet, garder des dates flexibles, puis organiser la comparaison des hébergements.

## Prototype MVP

- Recherche par aéroport/ville de départ, fenêtre de dates et budget maximal.
- Destinations de démonstration triées du prix le plus bas au plus élevé.
- Favoris persistants dans le navigateur.
- Vérification basique de cohérence des dates.
- Filtre texte et tri par prix croissant/décroissant ou nom.
- Recherche live optionnelle sur les cartes de vols si l’API Amadeus est configurée; bascule explicite vers Google Flights sinon.
- Recherche live optionnelle des hôtels via l’API Amadeus, avec repli Booking.com si indisponible.
- Nombre de voyageurs configurable (1 à 6 adultes) et nombre de chambres (1 à 4), transmis aux recherches de vols, d’hôtels et au comparateur externe.
- Manifest PWA, icône dédiée et cache du shell pour ouvrir l’application hors ligne après la première visite.
- Interface responsive mobile/desktop, sans dépendance ni build.

## API de recherche vols et hôtels

Une API Node.js sans dépendances est disponible dans `api/`. Elle utilise l'API Amadeus côté serveur : les secrets ne sont jamais placés dans le navigateur.

1. Installer Node.js 20 ou plus récent.
2. Copier `.env.example` vers `.env` et renseigner `AMADEUS_CLIENT_ID` et `AMADEUS_CLIENT_SECRET` depuis votre compte fournisseur. Ne jamais committer `.env`.
3. Définir `ALLOWED_ORIGIN` sur l’origine exacte de l’interface en production; l’API rejette les autres origines navigateur.
4. En local, lancer `node --env-file=.env api/server.mjs` (Node.js 20.6+). En production, fournir les variables comme secrets d’environnement de la plateforme.
5. Vérifier `GET /api/health`, puis tester `POST /api/flights/search` (`origin`, `destination`, `departureDate`, `returnDate` facultatif, `adults`, `currencyCode`) et `POST /api/hotels/search` (`cityCode`, `checkInDate`, `checkOutDate`, `adults`, `roomQuantity` facultatif (1 à 4 chambres), `currencyCode`).
6. Utiliser l'environnement de test jusqu'à validation du compte et de l'accès production.

Tests locaux : `npm test` (ou `node --test tests/*.mjs api/*.test.mjs`). La suite couvre les validations vols/hôtels et aller-retour, la normalisation et le tri des offres, le rendu du front-end, ainsi qu’un test d’intégration HTTP qui démarre réellement l’API et vérifie la santé, CORS, les types de contenu, les paramètres invalides, l’absence de clés fournisseur et les routes inconnues. La CI GitHub Actions vérifie aussi la configuration Docker Compose et construit l’image du conteneur à chaque push sur `main`. Les tests ne nécessitent aucune clé fournisseur.

**Intégration interface :** les boutons « Vols » tentent maintenant une recherche live via `/api/health` puis `/api/flights/search`. Les départs reconnus incluent Alger (ALG), Oran (ORN), Constantine (CZL), Annaba (AAE), Sétif (QSF), Béjaïa (BJA), Tlemcen (TLM), Batna (BLJ), Biskra (BSK), Ghardaïa (GHA), Tamanrasset (TMR), Tindouf (TIN), Jijel (GJL), Adrar (AZR) et El Oued (ELU), ainsi que les codes IATA saisis directement. Pour une API hébergée sur un autre domaine, renseigner son URL dans `config.js` (`window.TRIPRADAR_API_BASE`) avant déploiement. Définir `ALLOWED_ORIGIN` côté serveur sur l’origine exacte de l’interface en HTTPS, sans joker. Si l’API ou les identifiants Amadeus sont indisponibles, l’interface n’invente aucun tarif et propose une recherche externe. La recherche de vols prend en charge l’aller simple ou l’aller-retour lorsque `returnDate` est fourni; les hôtels peuvent renvoyer des offres pour les dates du séjour lorsque l’accès fournisseur le permet.

## Lancer

Ouvrir `index.html` dans un navigateur moderne. Pour installer l’application et activer le mode hors ligne, la servir en HTTPS (par exemple via GitHub Pages) puis utiliser « Ajouter à l’écran d’accueil » dans le navigateur. Le service worker n’est pas disponible en ouverture `file://`.

## Déploiement

- **Interface statique :** publier `index.html`, `config.js`, `manifest.webmanifest`, `icon.svg` et `sw.js` sur un hébergement HTTPS statique. Si l’API est sur un autre domaine, définir son URL dans `config.js` avant publication.
- **API Docker :** copier `.env.example` vers `.env`, renseigner `AMADEUS_CLIENT_ID`, `AMADEUS_CLIENT_SECRET` et l’origine HTTPS exacte de l’interface dans `ALLOWED_ORIGIN`, puis lancer `docker compose up --build -d`. Contrôler l’état avec `docker compose ps` et `curl http://localhost:3000/api/health`. Le conteneur inclut un healthcheck. Ne jamais incorporer les secrets à l’image ni committer `.env`.
- L’API écoute sur le port `3000` par défaut. Déployer l’API et l’interface sur des services séparés reste possible grâce à la configuration d’origine CORS.

## Limites connues — transparence

Les prix et durées du catalogue de destinations sont **fictifs, à titre de démonstration**. Les vols et hôtels peuvent afficher des offres live uniquement quand l’API Amadeus est correctement configurée, accessible et autorisée à fournir l’inventaire demandé. Les offres ne garantissent pas la disponibilité au moment de la réservation. L’interface peut calculer un total partiel lorsque les deux recherches live ont réussi : vol aller simple ou aller-retour selon les dates saisies + hébergement pour le séjour et une chambre, dans la même devise. Le total reste partiel (frais non fournis, transferts et bagages éventuels); le prototype ne réserve rien.

## Prochaines étapes vers un produit fiable

1. **Bloquant pour le lancement public :** configurer des identifiants fournisseur actifs, déployer l’API et vérifier la couverture réelle depuis l’Algérie, les conditions d’accès et les droits d’affichage.
2. Étendre le calcul aux frais connus, sans mélanger les devises.
3. Ajouter les filtres de durée, bagages, escales, devise, nombre de voyageurs et coût total du séjour.
4. Tester l’installation PWA, le mode hors ligne, l’accessibilité et les parcours mobiles Android/iOS.
5. Exécuter les tests de bout en bout sur l’API déployée, confirmer les tarifs et l’inventaire réels, puis valider les parcours Android/iOS.

**Règle de vérité produit :** tant qu’aucun fournisseur n’est connecté, les prix restent explicitement fictifs et ne doivent jamais être présentés comme des offres disponibles ou réservables.

## Règle produit

Priorité au développement et à la validation de l'utilité. Pas de dépenses initiales ni de monétisation publicitaire avant d'avoir une preuve convaincante d'usage.