-- Fix primary keys for Meta tables to enable proper foreign key relationships
-- Drop existing constraints first
ALTER TABLE meta_accounts DROP CONSTRAINT IF EXISTS meta_accounts_pkey;
ALTER TABLE meta_campaigns DROP CONSTRAINT IF EXISTS meta_campaigns_pkey;
ALTER TABLE meta_ads DROP CONSTRAINT IF EXISTS meta_ads_pkey;

-- Add proper primary keys using the ID columns
ALTER TABLE meta_accounts ADD PRIMARY KEY (account_id);
ALTER TABLE meta_campaigns ADD PRIMARY KEY (campaign_id);
ALTER TABLE meta_ads ADD PRIMARY KEY (ad_id);

-- Now add the foreign key relationships
ALTER TABLE meta_campaigns 
ADD CONSTRAINT meta_campaigns_account_id_fkey 
FOREIGN KEY (account_id) REFERENCES meta_accounts(account_id);

ALTER TABLE meta_ads 
ADD CONSTRAINT meta_ads_campaign_id_fkey 
FOREIGN KEY (campaign_id) REFERENCES meta_campaigns(campaign_id);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_meta_campaigns_account_id ON meta_campaigns(account_id);
CREATE INDEX IF NOT EXISTS idx_meta_ads_campaign_id ON meta_ads(campaign_id);