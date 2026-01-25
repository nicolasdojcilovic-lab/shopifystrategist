# Lib — Utilitaires Centralisés

Ce dossier contient les utilitaires et singletons partagés à travers toute l'application.

---

## 📁 Fichiers

### `prisma.ts`
**Singleton Prisma Client**

Instance unique de PrismaClient pour toute l'application.

**Pattern Next.js** : Évite la création de multiples instances en dev (hot-reload).

**Usage** :
```typescript
import { prisma } from '@/lib/prisma';

// Requête
const products = await prisma.product.findMany();

// Création
const product = await prisma.product.create({
  data: {
    productKey: 'prod_abc123',
    mode: 'solo',
    normalizedUrls: { page_a: 'https://shop.com/product' },
    versions: { NORMALIZE_VERSION: '1.0' },
    canonicalInput: { /* ... */ },
  },
});

// Upsert (insert-if-absent)
const product = await prisma.product.upsert({
  where: { productKey: 'prod_abc123' },
  update: {},
  create: { /* ... */ },
});
```

**Logs** :
- Dev : `['query', 'error', 'warn']` (verbose)
- Prod : `['error']` (minimal)

---

## 🔧 Configuration

### Logging Personnalisé

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: [
    { level: 'query', emit: 'event' },
    { level: 'error', emit: 'stdout' },
    { level: 'warn', emit: 'stdout' },
  ],
});

prisma.$on('query', (e) => {
  console.log('Query:', e.query);
  console.log('Duration:', e.duration + 'ms');
});
```

### Connection Pooling

Prisma gère automatiquement le pool de connexions.

Configuration via `DATABASE_URL` :
```env
# Exemple avec pool size
DATABASE_URL="postgresql://user:pass@localhost:5432/db?schema=public&connection_limit=10"
```

---

## 📚 Références

- **Prisma Docs** : https://www.prisma.io/docs
- **Next.js Best Practices** : https://www.prisma.io/docs/guides/other/troubleshooting-orm/help-articles/nextjs-prisma-client-dev-practices
- **Schema** : `prisma/schema.prisma`
- **README** : `prisma/README.md`

---

**Créé** : 2026-01-24  
**Maintenu par** : Équipe ShopifyStrategist
