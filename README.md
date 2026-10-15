# TripRadar

**Promesse :** repérer des destinations accessibles selon le prix du billet, garder des dates flexibles, puis organiser la comparaison des hébergements.

## Prototype MVP

- Recherche par aéroport/ville de départ, fenêtre de dates et budget maximal.
- Destinations de démonstration triées du prix le plus bas au plus élevé.
- Favoris persistants dans le navigateur.
- Vérification basique de cohérence des dates.
- Liens de sortie vers une recherche externe pour continuer la comparaison.
- Interface responsive mobile/desktop, sans dépendance ni build.

## Lancer

Ouvrir `index.html` dans un navigateur moderne ou activer GitHub Pages sur la branche `main` avec la racine comme dossier de publication.

## Limites connues — transparence

Les prix et durées affichés sont **fictifs, à titre de démonstration**. Le prototype ne lit pas encore de tarifs de vols ou d'hôtels en temps réel et ne réserve rien. Les liens externes constituent une passerelle de recherche, pas une intégration de données certifiée. Les dates saisies servent à la validation de formulaire; le lien fournisseur devra être complété avec un itinéraire et des dates vérifiés avant lancement public.

## Prochaines étapes vers un produit fiable

1. Choisir un fournisseur d'inventaire vols/hôtels offrant une API et vérifier ses conditions d'accès, sa couverture depuis l'Algérie et ses coûts.
2. Ajouter un backend minimal pour agréger, normaliser et horodater les offres; ne jamais présenter une donnée expirée comme disponible.
3. Ajouter les filtres de durée, bagages, escales, devise et coût total séjour.
4. Ajouter l'hébergement après le classement initial des vols, puis le coût total et la détection des variations.
5. Automatiser les tests fonctionnels, l'accessibilité et les tests mobile avant le lancement.

## Règle produit

Priorité au développement et à la validation de l'utilité. Pas de dépenses initiales ni de monétisation publicitaire avant d'avoir une preuve convaincante d'usage.