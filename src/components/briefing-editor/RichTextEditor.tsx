import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { FontFamily } from '@tiptap/extension-font-family';
import TextAlign from '@tiptap/extension-text-align';
import ImageExtension from '@tiptap/extension-image';
import { Button } from '@/components/ui/button';
import {
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Link,
  ImageIcon,
  Type,
  Undo,
  Redo,
  Minus,
  Square,
  Circle,
  Triangle
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useRef } from 'react';

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  editable?: boolean;
}

export const RichTextEditor = ({ content, onChange, editable = true }: RichTextEditorProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3]
        }
      }),
      TextStyle,
      Color,
      FontFamily,
      TextAlign.configure({
        types: ['heading', 'paragraph']
      }),
      ImageExtension.configure({
        inline: true,
        allowBase64: true,
      })
    ],
    content,
    editable,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[400px] p-4'
      }
    }
  });

  if (!editor) {
    return null;
  }

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const url = e.target?.result as string;
        editor.chain().focus().setImage({ src: url }).run();
      };
      reader.readAsDataURL(file);
    }
  };

  const insertShape = (shape: 'rectangle' | 'circle' | 'triangle') => {
    let svg = '';
    const color = '#3b82f6'; // Default blue color
    
    switch (shape) {
      case 'rectangle':
        svg = `<svg width="120" height="80" xmlns="http://www.w3.org/2000/svg"><rect width="120" height="80" fill="${color}" rx="4"/></svg>`;
        break;
      case 'circle':
        svg = `<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="45" fill="${color}"/></svg>`;
        break;
      case 'triangle':
        svg = `<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg"><polygon points="50,10 90,90 10,90" fill="${color}"/></svg>`;
        break;
    }
    
    const dataUrl = `data:image/svg+xml;base64,${btoa(svg)}`;
    editor.chain().focus().setImage({ src: dataUrl }).run();
  };

  return (
    <div className="border border-border rounded-lg bg-background">
      {/* Toolbar */}
      <div className="flex items-center gap-1 p-2 border-b border-border flex-wrap bg-muted/30">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          className="h-8 w-8 p-0"
        >
          <Undo className="h-4 w-4" />
        </Button>
        
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          className="h-8 w-8 p-0"
        >
          <Redo className="h-4 w-4" />
        </Button>

        <div className="w-px h-6 bg-border mx-1" />

        <Select
          value="Montserrat"
          onValueChange={(value) => editor.chain().focus().setFontFamily(value).run()}
        >
          <SelectTrigger className="h-8 w-[120px] text-xs">
            <SelectValue placeholder="Fonte" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Inter">Inter</SelectItem>
            <SelectItem value="Montserrat">Montserrat</SelectItem>
            <SelectItem value="Arial">Arial</SelectItem>
            <SelectItem value="Georgia">Georgia</SelectItem>
          </SelectContent>
        </Select>

        <div className="w-px h-6 bg-border mx-1" />

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`h-8 w-8 p-0 ${editor.isActive('bold') ? 'bg-muted' : ''}`}
        >
          <Bold className="h-4 w-4" />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`h-8 w-8 p-0 ${editor.isActive('italic') ? 'bg-muted' : ''}`}
        >
          <Italic className="h-4 w-4" />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={`h-8 w-8 p-0 ${editor.isActive('strike') ? 'bg-muted' : ''}`}
        >
          <Type className="h-4 w-4" />
        </Button>

        <div className="w-px h-6 bg-border mx-1" />

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          className={`h-8 w-8 p-0 ${editor.isActive({ textAlign: 'left' }) ? 'bg-muted' : ''}`}
        >
          <AlignLeft className="h-4 w-4" />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          className={`h-8 w-8 p-0 ${editor.isActive({ textAlign: 'center' }) ? 'bg-muted' : ''}`}
        >
          <AlignCenter className="h-4 w-4" />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          className={`h-8 w-8 p-0 ${editor.isActive({ textAlign: 'right' }) ? 'bg-muted' : ''}`}
        >
          <AlignRight className="h-4 w-4" />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign('justify').run()}
          className={`h-8 w-8 p-0 ${editor.isActive({ textAlign: 'justify' }) ? 'bg-muted' : ''}`}
        >
          <AlignJustify className="h-4 w-4" />
        </Button>

        <div className="w-px h-6 bg-border mx-1" />

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`h-8 w-8 p-0 ${editor.isActive('bulletList') ? 'bg-muted' : ''}`}
        >
          <List className="h-4 w-4" />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`h-8 w-8 p-0 ${editor.isActive('orderedList') ? 'bg-muted' : ''}`}
        >
          <ListOrdered className="h-4 w-4" />
        </Button>

        <div className="w-px h-6 bg-border mx-1" />

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          className="h-8 w-8 p-0"
        >
          <Minus className="h-4 w-4" />
        </Button>

        <div className="w-px h-6 bg-border mx-1" />

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          className="h-8 w-8 p-0"
          title="Inserir imagem"
        >
          <ImageIcon className="h-4 w-4" />
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          className="hidden"
        />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              title="Inserir forma"
            >
              <Square className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => insertShape('rectangle')}>
              <Square className="h-4 w-4 mr-2" />
              Retângulo
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => insertShape('circle')}>
              <Circle className="h-4 w-4 mr-2" />
              Círculo
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => insertShape('triangle')}>
              <Triangle className="h-4 w-4 mr-2" />
              Triângulo
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Editor Content */}
      <EditorContent editor={editor} className="min-h-[400px]" />
    </div>
  );
};
