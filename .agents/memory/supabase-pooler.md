---
name: Supabase pooler connection
description: Replit shell cannot reach Supabase direct connection (IPv6); must use session pooler URI
---

The Replit environment cannot reach the Supabase direct PostgreSQL connection (IPv6 address unreachable). The session pooler uses IPv4 and works fine.

**Correct DATABASE_URL format:**
```
postgresql://postgres.[PROJECT_REF]:[URL_ENCODED_PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres
```

**Why:** Supabase direct connection resolves to an IPv6 address (2a05:...) that is ENETUNREACH from Replit. The session pooler resolves to an IPv4 address (e.g. 13.39.9.193) which is reachable.

**How to apply:** When DATABASE_URL needs updating, always use the Session pooler URI from Supabase dashboard (Project Settings → Database → Connect → Session pooler). Special characters in password must be URL-encoded (e.g. `!` → `%21`).

**DB migrations:** drizzle-kit push also fails (same IPv6 issue). Use `psql` directly with PGPASSWORD or route DDL through the API server's pool which picks up DATABASE_URL at startup.
