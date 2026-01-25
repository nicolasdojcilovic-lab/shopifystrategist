# supabase/ — Database Migrations & Config

Ce dossier contient les migrations SQL et la configuration Supabase.

## Structure

### `migrations/`
Migrations SQL versionnées (ordre chronologique).

**Convention de nommage** :
```
YYYYMMDDHHMMSS_description.sql
```

Exemple :
```
20260123120000_create_audits_table.sql
20260123121500_create_tickets_table.sql
```

### Règles

1. **DB = Source de vérité** pour les schémas relationnels.
2. **Migrations forward-only** : Jamais de rollback destructif en production.
3. **Clés déterministes** : Utiliser `audit_key`, `product_key`, etc. (voir `docs/DB_SCHEMA.md`).
4. **No secrets** : Utiliser des variables d'environnement pour les connexions.

### Référence SSOT

- `docs/DB_SCHEMA.md` : Schéma complet de la base de données
- `docs/RUNBOOK_OPERATIONS.md` : Opérations et maintenance

### Initialisation (à venir - Step 3)

```bash
# Initialiser Supabase localement
supabase init

# Créer une nouvelle migration
supabase migration new <description>

# Appliquer les migrations
supabase db push
```

---

**Note** : Ce dossier sera utilisé à partir de Step 3 (après fixtures + smoke runner).
