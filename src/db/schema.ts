import { pgTable, text, smallint, integer, primaryKey } from 'drizzle-orm/pg-core';

export const translations = pgTable(
  'translations',
  {
    lang_id: integer().notNull(),
    chapter_num: smallint().notNull(),
    index: smallint().notNull(),
    text: text().default('').notNull()
  },
  (table) => [primaryKey({ columns: [table.lang_id, table.chapter_num, table.index] })]
);
