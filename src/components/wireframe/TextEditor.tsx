import React, { useEffect, useRef } from 'react';
import { Textarea } from '@/components/ui/textarea';

interface TextEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  className?: string;
  placeholder?: string;
}

export const TextEditor: React.FC<TextEditorProps> = ({
  value,
  onChange,
  onSubmit,
  onCancel,
  className,
  placeholder = 'Digite o texto...',
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
      // Position cursor at end of text instead of selecting all
      const length = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(length, length);
      
      // Auto-resize textarea
      const adjustHeight = () => {
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
          textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
      };
      adjustHeight();
    }
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && e.ctrlKey) {
      e.preventDefault();
      onSubmit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <Textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => {
        onChange(e.target.value);
        // Auto-resize
        e.target.style.height = 'auto';
        e.target.style.height = `${e.target.scrollHeight}px`;
      }}
      onKeyDown={handleKeyDown}
      className={className}
      placeholder={placeholder}
      style={{
        resize: 'none',
        overflow: 'hidden',
        minHeight: '2rem',
      }}
    />
  );
};
