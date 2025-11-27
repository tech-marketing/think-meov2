-- Remove the duplicate foreign key constraints that are causing ambiguity
ALTER TABLE meta_ad_metrics 
DROP CONSTRAINT IF EXISTS fk_meta_ad_metrics_ad_id;

ALTER TABLE meta_ads 
DROP CONSTRAINT IF EXISTS fk_meta_ads_campaign_id;