# TripRadar

**Promesse :** repérer des destinations accessibles selon le prix du billet, garder des dates flexibles, puis organiser la comparaison des hébergements.

## Prototype MVP

- Recherche par aéroport/ville de départ, fenêtre de dates et budget maximal.
- Destinations de démonstration triées du prix le plus bas au plus élevé.
- Favoris persistants dans le navigateur.
- Vérification basique de cohérence des dates.
- Filtre texte et tri par prix croissant/décroissant ou nom.
- Liens de sortie vers Google Flights et une recherche d’hébergements Booking.com.
- Manifest PWA, icône dédiée et cache du shell pour ouvrir l’application hors ligne après la première visite.
- Interface responsive mobile/desktop, sans dépendance ni build.

## API de recherche de vols (intégration initiale)

Une API Node.js sans dépendances est disponible dans `api/`. Elle utilise l'API Amadeus côté serveur : les secrets ne sont jamais placés dans le navigateur.

1. Installer Node.js 20 ou plus récent.
2. Copier `.env.example` vers `.env` et renseigner `AMADEUS_CLIENT_ID` et `AMADEUS_CLIENT_SECRET` depuis votre compte fournisseur. Ne jamais committer `.env`.
3. Charger les variables d'environnement dans le terminal, puis lancer `node api/server.mjs`.
4. Vérifier `GET /api/health`, puis envoyer un `POST /api/flights/search` avec `origin`, `destination` (codes IATA à 3 lettres), `departureDate` (AAAA-MM-JJ), `adults` et `currencyCode`.
5. Utiliser l'environnement de test jusqu'à validation du compte et de l'accès production.

Tests locaux : `node --test tests/*.mjs api/*.test.mjs`.

**Important :** la recherche live côté serveur est amorcée, mais n'est pas encore reliée au formulaire de l'interface, car celui-ci accepte actuellement des noms de villes libres et ne dispose d'aucun identifiant fournisseur. Il faut aussi configurer des identifiants valides avant qu'une recherche live puisse répondre. Les prix du catalogue affiché restent fictifs.

## Lancer

Ouvrir `index.html` dans un navigateur moderne. Pour installer l’application et activer le mode hors ligne, la servir en HTTPS (par exemple via GitHub Pages) puis utiliser « Ajouter à l’écran d’accueil » dans le navigateur. Le service worker n’est pas disponible en ouverture `file://`.

## Limites connues — transparence

Les prix et durées affichés sont **fictifs, à titre de démonstration**. Le prototype ne lit pas encore de tarifs de vols ou d'hôtels en temps réel et ne réserve rien. Les liens externes constituent une passerelle de recherche, pas une intégration de données certifiée. Les dates saisies servent à la validation de formulaire; le lien fournisseur devra être complété avec un itinéraire et des dates vérifiés avant lancement public.

## Prochaines étapes vers un produit fiable

1. **Données réelles (bloquant pour le lancement public) :** choisir un fournisseur de vols et d’hôtels avec API, vérifier la couverture depuis l’Algérie, les conditions d’accès, les coûts et les droits d’affichage.
2. Ajouter un backend minimal pour agréger, normaliser et horodater les offres; afficher la devise, l’heure de vérification et l’état de disponibilité.
3. Intégrer les hébergements au classement, puis calculer un coût total comparable (vol + nuits + frais connus) sans additionner des prix incompatibles.
4. Ajouter les filtres de durée, bagages, escales, devise, nombre de voyageurs et coût total du séjour.
5. Tester l’installation PWA, le mode hors ligne, l’accessibilité et les parcours mobiles Android/iOS.
6. Automatiser les tests fonctionnels et de non-régression avant le lancement.

**Règle de vérité produit :** tant qu’aucun fournisseur n’est connecté, les prix restent explicitement fictifs et ne doivent jamais être présentés comme des offres disponibles ou réservables.

## Règle produit

Priorité au développement et à la validation de l'utilité. Pas de dépenses initiales ni de monétisation publicitaire avant d'avoir une preuve convaincante d'usage.