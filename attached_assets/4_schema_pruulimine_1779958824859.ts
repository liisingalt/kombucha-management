// =====================================================================
//  PRUULIMISE TABELID  —  lisa see plokk samasse faili  shared/schema.ts
//  (imporditud read võivad olla juba olemas eelmisest plokist — ära korda)
// =====================================================================
import { pgTable, serial, integer, real, text, timestamp } from "drizzle-orm/pg-core";

// Tee varu grammides, sordi kaupa. Pruulimine arvab siit tee maha.
export const teaStock = pgTable("tea_stock", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(), // nt "roheline Mozum"
  qtyG: integer("qty_g").notNull().default(0),
});

// Üks pruulimine = üks rida. Hoiab kogu protsessi ja arvutused alles.
export const brews = pgTable("brews", {
  id: serial("id").primaryKey(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  date: text("date").notNull(), // Kp, nt "2026-05-25"
  boiledL: real("boiled_l").notNull(), // Vesi keema, L
  startBoilTime: text("start_boil_time").default(""), // Alustasin keetmist kl
  tempReachedMin: integer("temp_reached_min"), // Temp saavutas, min
  temp: integer("temp"), // Temp
  teaStockId: integer("tea_stock_id"), // viide tee varule
  teaSort: text("tea_sort").default(""), // Tee sort, nimi
  teaG: integer("tea_g").notNull().default(0), // Tee, g (arvutatud)
  steepMin: integer("steep_min").default(10), // Min tõmbab
  steepHeat: integer("steep_heat").default(0), // Tõmbamise kuumus
  sugarG: integer("sugar_g").notNull().default(0), // Suhkur, g (arvutatud)
  coldWaterL: real("cold_water_l").notNull().default(0), // Külm vesi, L
  coolStartTime: text("cool_start_time").default(""), // Jahtuma kl
  coolPlace: text("cool_place").default(""), // Jahtumiskoht
  coolTemp: integer("cool_temp"), // Jahtumiskoha temperatuur
  continuedTime: text("continued_time").default(""), // Tegutsesin edasi kl
  notes: text("notes").default(""), // Soovitused
  starterPct: integer("starter_pct").notNull().default(20), // Juuretise %
  starterG: integer("starter_g").notNull().default(0), // Juuretis, g (arvutatud)
  electricityKwh: real("electricity_kwh"), // Elektrikulu kW/h
});
