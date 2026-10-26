This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Règles du projet

- **Prix d'achat privé.** La colonne `prix_achat` est privée. Ne jamais faire `select('*')` sur `produits`. Après l'ajout d'une colonne à `produits`, relancer l'étape 2 de la migration 07 (`supabase/migrations/07_prix-achat-prive.sql`) pour que le site puisse la lire.
  - L'admin lit les produits avec `supabase.rpc('produits_admin')`, le collaborateur étranger avec `supabase.rpc('produits_etranger')`.
  - Le test `tests/securite.test.js` échoue si une lecture publique risque de laisser fuir le prix d'achat.

- **Sécurité de la table `users`.** Le navigateur ne peut PLUS écrire dans la table `users` (ni insert, ni update). Toute écriture de profil passe par une route serveur avec le client `service_role`, comme `/api/register`. N'écris jamais de code navigateur qui fait `from('users').insert` ou `.update` (migration 09).
- **Fonctions de rôle.** `est_admin()` et `mon_role()` ne sont plus appelables par un visiteur non connecté (migration 10).

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
