-- Adicionar coluna comment_id para rastrear qual comentário gerou a menção
ALTER TABLE notifications 
ADD COLUMN comment_id UUID REFERENCES comments(id) ON DELETE CASCADE;

-- Criar índice para melhorar performance de queries
CREATE INDEX IF NOT EXISTS idx_notifications_comment_id 
ON notifications(comment_id);

-- Comentário explicativo
COMMENT ON COLUMN notifications.comment_id IS 'ID do comentário que gerou esta notificação (quando type=mention)';