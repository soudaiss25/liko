# liko (Salut Marketplace)

Marketplace de précommande pour les Comores : le client commande des produits achetés à l'étranger (Chine, Sénégal, Niger, Émirats, France), suit sa commande jusqu'à la livraison, et l'équipe gère les achats, les envois et les paiements depuis des espaces dédiés.

![Capture](docs/screenshot.png)
<!-- TODO : ajouter une capture (catalogue ou page de suivi de commande) dans docs/screenshot.png -->

## Contexte

Application destinée à être mise en ligne ; le projet est en cours de développement. Les produits sont achetés après commande, avec un délai de livraison affiché (15 à 30 jours).

## Fonctionnalités principales

- **Catalogue et panier** : produits par catégorie et par origine, photos, panier, tunnel de commande.
- **Suivi de commande** : frise en 7 étapes (commande reçue, confirmée, achat en cours, expédiée, arrivée aux Comores, en livraison, livrée), page de suivi par code, liste « Mes commandes ».
- **Paiement avec avance** : avance, remboursement et historique des paiements, confirmation d'une commande bloquée tant que l'avance n'est pas reçue.
- **Espace collaborateur à l'étranger** : préparation des envois (brouillon, en route, reçu).
- **Espace collaborateur aux Comores** : réception des envois, avec motif en cas d'écart (manquant, abîmé, erreur du fournisseur, surplus).
- **Administration** : produits (photos compressées en WebP avant envoi), commandes, collaborateurs, statistiques de ventes et de marge.
- **Comptes et rôles** : `admin`, `collab_etranger`, `collab_comores`, `client`.

## Stack technique

- Next.js (App Router) 16, React 19, Tailwind CSS 4
- Supabase : authentification, base PostgreSQL, stockage des photos
- Zod (validation des requêtes), bcryptjs, libphonenumber-js
- Vitest, GitHub Actions, déploiement sur Vercel

## Points techniques intéressants

- **Sécurité en base** : RLS et fonctions « guichet » côté Supabase ; la garde de pages côté navigateur ne protège que l'affichage. Le prix d'achat est privé (lecture par fonctions dédiées, test `tests/securite.test.js` qui échoue si une lecture publique peut le laisser fuir), et le navigateur ne peut plus écrire dans la table `users`.
- **Routes serveur** : corps de requête validés en mode strict avec Zod, limiteur de requêtes en base (migration 08).
- **Migrations SQL contrôlées** : `scripts/verifier-migrations.mjs` vérifie le nommage, l'absence de trous, l'absence de `DROP`/`TRUNCATE`/`DELETE` non assumés et l'absence de clé secrète.
- **CI** : tests, build, détection de secrets (gitleaks), `npm audit` et contrôle des migrations ; test de fumée après chaque prévisualisation Vercel.
- **Tests** : 12 fichiers, 158 tests (panier, commandes, envois, avance, limiteur, validation, sécurité, migrations).

## Règles du projet

- **Prix d'achat privé.** La colonne `prix_achat` est privée. Ne jamais faire `select('*')` sur `produits`. Après l'ajout d'une colonne à `produits`, relancer l'étape 2 de la migration 07 (`supabase/migrations/07_prix-achat-prive.sql`) pour que le site puisse la lire.
  - L'admin lit les produits avec `supabase.rpc('produits_admin')`, le collaborateur étranger avec `supabase.rpc('produits_etranger')`.
  - Le test `tests/securite.test.js` échoue si une lecture publique risque de laisser fuir le prix d'achat.

- **Sécurité de la table `users`.** Le navigateur ne peut PLUS écrire dans la table `users` (ni insert, ni update). Toute écriture de profil passe par une route serveur avec le client `service_role`, comme `/api/register`. N'écris jamais de code navigateur qui fait `from('users').insert` ou `.update` (migration 09).
- **Fonctions de rôle.** `est_admin()` et `mon_role()` ne sont plus appelables par un visiteur non connecté (migration 10).

## Pipeline

```
 agent / développeur          GitHub Actions (CI)                  Vercel                 relecture          fusion
 ─────────────────────        ───────────────────────────          ──────────────         ──────────         ─────────
 branche mission-xyz   ──▶    qualite  : tests, build, lint   ──▶  prévisualisation  ──▶  le développeur ──▶ PR → develop
 + PR vers develop            securite : gitleaks, npm audit,      de la branche          ouvre la           (jamais main
                                         migrations SQL            │                      prévisualisation,   avant la fin
                                                                   ▼                      lit la PR           du développement)
                                                          test de fumée (fumee.yml)
```

| Qui | Rôle |
|---|---|
| **Agent** (ou développeur) | Crée une branche par mission depuis `develop`, pousse après chaque tâche, ouvre une PR **vers `develop`** avec le modèle de PR rempli. Ne fusionne jamais. |
| **CI** (`.github/workflows/ci.yml`) | Deux jobs en parallèle. `qualite` : tests, build (variables factices), lint (non bloquant). `securite` : détection de secrets (gitleaks, historique complet de la PR), `npm audit` (échec sur faille haute ou critique des dépendances de production), vérification des migrations SQL (`scripts/verifier-migrations.mjs`). Une nouvelle exécution annule la précédente sur la même branche. Elle ne déploie rien. |
| **Vercel** | Déploie lui-même chaque branche en prévisualisation. Les variables d'environnement (publiques et secrètes) se règlent dans Vercel, jamais dans le dépôt. |
| **Test de fumée** (`.github/workflows/fumee.yml`) | Après chaque prévisualisation réussie (pas la production) : `/`, `/panier`, `/login` répondent 200, une page inexistante 404, `POST /api/register` sans jeton 401, et les en-têtes `Strict-Transport-Security` et `X-Frame-Options` sont présents. Demande le secret GitHub `VERCEL_AUTOMATION_BYPASS_SECRET` ; sans lui, il est ignoré. |
| **Relecture** | Le développeur ouvre la prévisualisation, relit la PR (résumé, captures, cases cochées) et vérifie que les contrôles sont verts. |
| **Fusion** | Le développeur seul fusionne dans `develop`. `main` n'est touchée qu'à la fin du développement. Si la PR contient une migration SQL, il la lance en base. |

Dependabot (`.github/dependabot.yml`) propose chaque semaine, vers `develop`, une PR groupée de mises à jour (mineures et correctifs) pour npm et pour les actions GitHub.

**Migrations SQL** (`supabase/migrations/`) : format `NN_nom-en-minuscules.sql`, suite sans trou ni doublon, jamais de `DROP TABLE`, `TRUNCATE` ou `DELETE FROM` sans le commentaire `-- DESTRUCTIF ASSUMÉ` sur la ligne juste au-dessus, jamais de clé secrète. Vérification locale : `node scripts/verifier-migrations.mjs`. Node 22 partout (`.nvmrc`, `engines`).

## Installation et lancement

Prérequis : Node.js 22 (voir `.nvmrc`) et un projet Supabase.

```bash
npm ci
npm run dev   # http://localhost:3000
```

Variables d'environnement (fichier `.env.local`, jamais commité) :

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Le schéma initial n'est pas dans le dépôt : seules les migrations 07 à 11 sont versionnées dans `supabase/migrations/`. `node scripts/verif-cle.js` indique le type de clé présent dans `SUPABASE_SERVICE_ROLE_KEY` sans l'afficher.

## Tests

```bash
npm test                       # vitest, mode watch
npx vitest run                 # une exécution
npm run test:couverture        # avec couverture
```

## Démo

TODO : ajouter le lien de la démo en ligne.

## Statut

En cours de développement (branche `develop`).
