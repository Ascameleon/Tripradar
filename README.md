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
- Manifest PWA, icône dédiée et cache du shell pour ouvrir l’application hors ligne après la première visite.
- Interface responsive mobile/desktop, sans dépendance ni build.

## API de recherche vols et hôtels

Une API Node.js sans dépendances est disponible dans `api/`. Elle utilise l'API Amadeus côté serveur : les secrets ne sont jamais placés dans le navigateur.

1. Installer Node.js 20 ou plus récent.
2. Copier `.env.example` vers `.env` et renseigner `AMADEUS_CLIENT_ID` et `AMADEUS_CLIENT_SECRET` depuis votre compte fournisseur. Ne jamais committer `.env`.
3. Définir `ALLOWED_ORIGIN` sur l’origine exacte de l’interface en production; l’API rejette les autres origines navigateur.
4. Charger les variables d'environnement dans le terminal, puis lancer `node api/server.mjs`.
5. Vérifier `GET /api/health`, puis tester `POST /api/flights/search` (`origin`, `destination`, `departureDate`, `adults`, `currencyCode`) et `POST /api/hotels/search` (`cityCode`, `checkInDate`, `checkOutDate`, `adults`, `currencyCode`).
6. Utiliser l'environnement de test jusqu'à validation du compte et de l'accès production.

Tests locaux : `node --test tests/*.mjs api/*.test.mjs`. Les tests couvrent les validations vols/hôtels, la normalisation des offres et leur tri par prix; la CI GitHub Actions exécute cette suite à chaque push sur `main`.

**Intégration interface :** les boutons « Vols » tentent maintenant une recherche live via `/api/health` puis `/api/flights/search`. Les départs reconnus incluent Alger (ALG), Oran (ORN), Constantine (CZL) et Annaba (AAE), ainsi que les codes IATA saisis directement. Pour une API hébergée sur un autre domaine, renseigner son URL dans `config.js` (`window.TRIPRADAR_API_BASE`) avant déploiement. Définir `ALLOWED_ORIGIN` côté serveur sur l’origine exacte de l’interface en HTTPS, sans joker. Si l’API ou les identifiants Amadeus sont indisponibles, l’interface n’invente aucun tarif et propose une recherche externe. La recherche de vols porte sur l’aller; les hôtels peuvent renvoyer des offres pour les dates du séjour lorsque l’accès fournisseur le permet.

## Lancer

Ouvrir `index.html` dans un navigateur moderne. Pour installer l’application et activer le mode hors ligne, la servir en HTTPS (par exemple via GitHub Pages) puis utiliser « Ajouter à l’écran d’accueil » dans le navigateur. Le service worker n’est pas disponible en ouverture `file://`.

## Limites connues — transparence

Les prix et durées du catalogue de destinations sont **fictifs, à titre de démonstration**. Les vols et hôtels peuvent afficher des offres live uniquement quand l’API Amadeus est correctement configurée, accessible et autorisée à fournir l’inventaire demandé. Les offres ne garantissent pas la disponibilité au moment de la réservation. Le prototype ne réserve rien et ne calcule pas encore un coût total vol + hôtel.

## Prochaines étapes vers un produit fiable

1. **Bloquant pour le lancement public :** configurer des identifiants fournisseur actifs, déployer l’API et vérifier la couverture réelle depuis l’Algérie, les conditions d’accès et les droits d’affichage.
2. Calculer un coût total comparable (vol aller + hébergement pour le nombre de nuits + frais connus) en gardant les devises et périodes compatibles.
4. Ajouter les filtres de durée, bagages, escales, devise, nombre de voyageurs et coût total du séjour.
5. Tester l’installation PWA, le mode hors ligne, l’accessibilité et les parcours mobiles Android/iOS.
6. Automatiser les tests fonctionnels et de non-régression avant le lancement.

**Règle de vérité produit :** tant qu’aucun fournisseur n’est connecté, les prix restent explicitement fictifs et ne doivent jamais être présentés comme des offres disponibles ou réservables.

## Règle produit

Priorité au développement et à la validation de l'utilité. Pas de dépenses initiales ni de monétisation publicitaire avant d'avoir une preuve convaincante d'usage.