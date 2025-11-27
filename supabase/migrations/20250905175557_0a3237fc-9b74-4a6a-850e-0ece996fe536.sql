-- Add foreign key relationships for Meta tables
ALTER TABLE meta_campaigns 
DROP CONSTRAINT IF EXISTS meta_campaigns_account_id_fkey;

ALTER TABLE meta_campaigns 
ADD CONSTRAINT meta_campaigns_account_id_fkey 
FOREIGN KEY (account_id) REFERENCES meta_accounts(account_id);

ALTER TABLE meta_ads 
DROP CONSTRAINT IF EXISTS meta_ads_campaign_id_fkey;

ALTER TABLE meta_ads 
ADD CONSTRAINT meta_ads_campaign_id_fkey 
FOREIGN KEY (campaign_id) REFERENCES meta_campaigns(campaign_id);

ALTER TABLE meta_adsets 
DROP CONSTRAINT IF EXISTS meta_adsets_campaign_id_fkey;

ALTER TABLE meta_adsets 
ADD CONSTRAINT meta_adsets_campaign_id_fkey 
FOREIGN KEY (campaign_id) REFERENCES meta_campaigns(campaign_id);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_meta_campaigns_account_id ON meta_campaigns(account_id);
CREATE INDEX IF NOT EXISTS idx_meta_ads_campaign_id ON meta_ads(campaign_id);
CREATE INDEX IF NOT EXISTS idx_meta_adsets_campaign_id ON meta_adsets(campaign_id);