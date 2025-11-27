interface CommentWithMentionsProps {
  content: string;
  className?: string;
}

export const CommentWithMentions = ({ content, className = "" }: CommentWithMentionsProps) => {
  // Regex para detectar menções no formato @username (letras, números, pontos e underscores)
  const mentionRegex = /@[a-z0-9._]+/gi;
  
  const renderContentWithMentions = () => {
    const parts = [];
    let lastIndex = 0;
    let match;

    // Reset regex lastIndex
    mentionRegex.lastIndex = 0;

    while ((match = mentionRegex.exec(content)) !== null) {
      // Adicionar texto antes da menção
      if (match.index > lastIndex) {
        parts.push(
          <span key={`text-${lastIndex}`}>
            {content.substring(lastIndex, match.index)}
          </span>
        );
      }

      // Adicionar a menção com texto roxo (sem badge)
      parts.push(
        <span 
          key={`mention-${match.index}`} 
          className="text-purple-600 dark:text-purple-400 font-medium"
        >
          {match[0]}
        </span>
      );

      lastIndex = match.index + match[0].length;
    }

    // Adicionar texto restante após última menção
    if (lastIndex < content.length) {
      parts.push(
        <span key={`text-${lastIndex}`}>
          {content.substring(lastIndex)}
        </span>
      );
    }

    return parts;
  };

  return (
    <p className={className}>
      {renderContentWithMentions()}
    </p>
  );
};
