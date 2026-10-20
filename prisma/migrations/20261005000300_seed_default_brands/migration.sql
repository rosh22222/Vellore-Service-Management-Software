INSERT INTO "Brand" ("id", "name", "slug", "isActive", "createdAt", "updatedAt")
VALUES
  ('brand_avon', 'AVON', 'avon', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('brand_excel_lets_play', 'Excel Let''s Play', 'excel-let-s-play', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('brand_firm', 'Firm', 'firm', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('brand_hercules', 'Hercules', 'hercules', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('brand_maxpro', 'Maxpro', 'maxpro', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('brand_reebok', 'Reebok', 'reebok', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('brand_span', 'Span', 'span', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('brand_welcare', 'Welcare', 'welcare', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO UPDATE SET
  "name" = EXCLUDED."name",
  "isActive" = true,
  "updatedAt" = CURRENT_TIMESTAMP;
