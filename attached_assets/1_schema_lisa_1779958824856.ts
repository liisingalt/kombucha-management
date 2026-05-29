// =====================================================================
//  LAO TABELID  —  lisa see plokk oma faili  shared/schema.ts  LÕPPU
//  Kui mõni import on Sul juba olemas, ära seda topelt kirjuta.
// =====================================================================
import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  jsonb,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// Pudelid: üks rida iga suuruse kohta (330, 500, 750). Sõltumatu maitsest.
export const bottleStock = pgTable("bottle_stock", {
  id: serial("id").primaryKey(),
  size: integer("size").notNull().unique(),
  qty: integer("qty").notNull().default(0),
});

// Sildid: maitse + suurus.
// flavorId viitab Sinu olemasolevale maitsete tabelile.
// NB! Kui Sinu maitse id on tekst või uuid, muuda allpool integer -> text.
export const labelStock = pgTable(
  "label_stock",
  {
    id: serial("id").primaryKey(),
    flavorId: integer("flavor_id").notNull(),
    size: integer("size").notNull(),
    qty: integer("qty").notNull().default(0),
  },
  (t) => ({
    uniq: uniqueIndex("label_flavor_size_uniq").on(t.flavorId, t.size),
  })
);

// Korgid: suurus + tüüp + värv. Tüüp on nt kroonkork või punnkork.
export const capStock = pgTable("cap_stock", {
  id: serial("id").primaryKey(),
  size: integer("size").notNull(),
  type: text("type").notNull().default(""),
  color: text("color").notNull().default(""),
  qty: integer("qty").notNull().default(0),
});

// Maitse vaikekork (valikuline): millist korki villimisel automaatselt pakutakse.
export const flavorCapDefault = pgTable(
  "flavor_cap_default",
  {
    id: serial("id").primaryKey(),
    flavorId: integer("flavor_id").notNull(),
    size: integer("size").notNull(),
    capId: integer("cap_id").notNull(),
  },
  (t) => ({
    uniq: uniqueIndex("flavor_cap_default_uniq").on(t.flavorId, t.size),
  })
);

// Liikumised: iga ost ja villimine, et kanne saaks ühe vajutusega tagasi võtta.
export const inventoryMovement = pgTable("inventory_movement", {
  id: serial("id").primaryKey(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  kind: text("kind").notNull(), // "ost" | "villimine"
  summary: text("summary").notNull(),
  deltas: jsonb("deltas").notNull(),
});
