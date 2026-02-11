# ShopifyStrategist

Agency-grade PDP audit & battlecard generator (SSOT-driven).

---

## Commandes de production

| Commande | Rôle |
|----------|------|
| `npm run diag:mass` | **Test** — Diagnostic multi-sites (batch) |
| `npm run test:audit` | **Exécution** — Pipeline audit complet (1 URL) |
| **API** | `POST /api/audit-solo` — Lance un audit SOLO |

### Accès API

- **POST /api/audit-solo** — Lance un audit sur une URL PDP
- **GET /api/audit/[auditKey]** — Récupère le statut et les URLs des rapports (HTML, PDF)

### Démarrage

```bash
npm install
npm run dev          # Développement
npm run build        # Production
npm run start        # Serveur production
```

---

## Documentation

- **docs/DEVELOPER_GUIDE.md** — Commandes officielles et flux SSOT
- **docs/ARCHITECTURE_MAP.md** — Carte d'architecture
- **docs/SSOT/** — Documents source de vérité
