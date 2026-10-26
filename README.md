This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

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

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.js`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
