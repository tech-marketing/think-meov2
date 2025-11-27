-- Inserir dados de teste nas métricas dos anúncios Meta
-- Primeiro, vamos pegar alguns ad_ids existentes e inserir métricas para eles
INSERT INTO meta_ad_metrics (
  ad_id, 
  account_id, 
  company_id,
  date_start, 
  date_stop, 
  impressions, 
  clicks, 
  spend, 
  reach, 
  frequency,
  ctr, 
  cpc, 
  cpm, 
  conversions, 
  conversion_rate,
  roas,
  cost_per_conversion
) VALUES
-- Dados para o primeiro anúncio
('120200710050070575', '580127709661701', (SELECT id FROM companies LIMIT 1), 
 CURRENT_DATE - INTERVAL '7 days', CURRENT_DATE - INTERVAL '6 days',
 15420, 342, 125.50, 12300, 1.25,
 2.22, 0.37, 8.14, 18, 5.26,
 3.2, 6.97),

('120200710050070575', '580127709661701', (SELECT id FROM companies LIMIT 1),
 CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE - INTERVAL '5 days',
 18250, 405, 148.20, 14100, 1.29,
 2.22, 0.37, 8.12, 21, 5.19,
 3.4, 7.06),

-- Dados para o segundo anúncio
('120200711067520575', '580127709661701', (SELECT id FROM companies LIMIT 1),
 CURRENT_DATE - INTERVAL '7 days', CURRENT_DATE - INTERVAL '6 days',
 12800, 256, 98.40, 10200, 1.25,
 2.00, 0.38, 7.69, 12, 4.69,
 2.8, 8.20),

('120200711067520575', '580127709661701', (SELECT id FROM companies LIMIT 1),
 CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE - INTERVAL '5 days',
 14200, 284, 108.50, 11400, 1.25,
 2.00, 0.38, 7.64, 15, 5.28,
 3.1, 7.23),

-- Dados para o terceiro anúncio
('120200718498360575', '580127709661701', (SELECT id FROM companies LIMIT 1),
 CURRENT_DATE - INTERVAL '7 days', CURRENT_DATE - INTERVAL '6 days',
 9500, 190, 75.20, 8100, 1.17,
 2.00, 0.40, 7.92, 8, 4.21,
 2.5, 9.40),

('120200718498360575', '580127709661701', (SELECT id FROM companies LIMIT 1),
 CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE - INTERVAL '5 days',
 11200, 224, 86.40, 9800, 1.14,
 2.00, 0.39, 7.71, 11, 4.91,
 2.9, 7.85),

-- Dados para o quarto anúncio
('120200718498380575', '580127709661701', (SELECT id FROM companies LIMIT 1),
 CURRENT_DATE - INTERVAL '7 days', CURRENT_DATE - INTERVAL '6 days',
 22100, 531, 189.50, 18200, 1.21,
 2.40, 0.36, 8.58, 28, 5.27,
 4.2, 6.77),

('120200718498380575', '580127709661701', (SELECT id FROM companies LIMIT 1),
 CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE - INTERVAL '5 days',
 26800, 642, 225.40, 21500, 1.25,
 2.40, 0.35, 8.41, 35, 5.45,
 4.6, 6.44),

-- Dados para o quinto anúncio
('120204013730550091', '580127709661701', (SELECT id FROM companies LIMIT 1),
 CURRENT_DATE - INTERVAL '7 days', CURRENT_DATE - INTERVAL '6 days',
 8900, 178, 68.20, 7600, 1.17,
 2.00, 0.38, 7.66, 7, 3.93,
 2.2, 9.74),

('120204013730550091', '580127709661701', (SELECT id FROM companies LIMIT 1),
 CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE - INTERVAL '5 days',
 10400, 208, 79.30, 8900, 1.17,
 2.00, 0.38, 7.63, 9, 4.33,
 2.6, 8.81);