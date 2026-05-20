import React, { useRef } from 'react';
import Editor, { loader, OnMount } from '@monaco-editor/react';
import type * as monaco from 'monaco-editor';
import { useEditorStore } from '../../stores/editor';

loader.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs' } });

interface Props {
  content: string;
  language: string;
  onChange?: (value: string | undefined) => void;
  readOnly?: boolean;
}

export default function CodeEditor({ content, language, onChange, readOnly = false }: Props) {
  const storeRef = useRef(useEditorStore);

  const handleMount: OnMount = (editor, _monaco) => {
    const store = storeRef.current.getState();

    const updateCursor = () => {
      const pos = editor.getPosition();
      if (pos) {
        store.setCursor(pos.lineNumber, pos.column);
      }
    };

    const updateIndent = () => {
      const model = editor.getModel();
      if (model) {
        const opts = model.getOptions();
        store.setIndent(opts.insertSpaces, opts.tabSize);
        store.setEol(model.getEOL() === '\r\n' ? 'CRLF' : 'LF');
      }
    };

    editor.onDidChangeCursorPosition(updateCursor);
    editor.onDidChangeModel(updateIndent);
    editor.onDidChangeModelOptions(updateIndent);

    updateCursor();
    updateIndent();
  };

  return (
    <Editor
      value={content}
      language={language}
      onChange={onChange}
      onMount={handleMount}
      theme="vs-dark"
      options={{
        readOnly,
        minimap: { enabled: false },
        fontSize: 13,
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        padding: { top: 8 },
        automaticLayout: true,
      }}
      height="100%"
    />
  );
}
