Génère ou met à jour la documentation pour : $ARGUMENTS

Si aucun argument, demande la cible (un module core, un handler Lambda, une stack SST, un endpoint API, une table DynamoDB).

Règles :
- En anglais.
- Format markdown.
- Concis : ce qu'un dev qui découvre a besoin de savoir, pas une thèse.
- Inclus :
  - Vue d'ensemble (1 paragraphe)
  - Comment l'utiliser (avec un exemple de code et les bindings SST)
  - API / interface publique
  - Gotchas / points d'attention (cold start, consistency model, permissions IAM)
- Pas de roman, pas de redites.

Sauvegarde dans `docs/[nom-pertinent].md` ou met à jour le fichier existant.

Pour les modules core : un seul .md par module.
Pour les stacks : documenter les ressources créées et leurs bindings.
