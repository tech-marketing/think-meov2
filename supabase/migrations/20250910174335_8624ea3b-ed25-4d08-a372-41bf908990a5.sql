-- Add foreign key relationship between meta_ad_metrics and meta_ads
ALTER TABLE meta_ad_metrics 
ADD CONSTRAINT fk_meta_ad_metrics_ad_id 
FOREIGN KEY (ad_id) REFERENCES meta_ads(ad_id);

-- Add foreign key relationship between meta_ads and meta_campaigns  
ALTER TABLE meta_ads 
ADD CONSTRAINT fk_meta_ads_campaign_id 
FOREIGN KEY (campaign_id) REFERENCES meta_campaigns(campaign_id);