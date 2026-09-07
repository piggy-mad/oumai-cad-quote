import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const quoteRuns = sqliteTable(
  'quote_runs',
  {
    id: text('id').primaryKey(),
    projectCode: text('project_code').notNull(),
    drawingName: text('drawing_name').notNull(),
    partCount: integer('part_count').notNull(),
    matchedCount: integer('matched_count').notNull(),
    pretaxTotal: real('pretax_total').notNull(),
    taxAmount: real('tax_amount').notNull(),
    grandTotal: real('grand_total').notNull(),
    status: text('status').notNull(),
    payloadJson: text('payload_json').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('idx_quote_runs_project_created').on(table.projectCode, table.createdAt),
  ],
);
