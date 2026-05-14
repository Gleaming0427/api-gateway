Audit de sécurité des fichiers : $ARGUMENTS

Si aucun argument, passe tous les fichiers modifiés (staged et unstaged) à la review.

Applique strictement la checklist du skill security-review (8 catégories : Auth JWT, Rate Limiting, Input Validation, Secrets, IAM, Dependencies, Data Exposure, Transport).

Format de sortie :
- 🔐 Security Review — [fichiers analysés]
- ✅ Conforme : [N/8]
- ⚠️ Attention : [catégorie — détail]
- 🔴 Bloquant : [catégorie — vulnérabilité confirmée]
- Verdict : [✅ Ready / ⚠️ Deployable with caution / 🔴 Do not deploy]

Ne corrige rien automatiquement. Signale, explique le risque, et laisse décider.
