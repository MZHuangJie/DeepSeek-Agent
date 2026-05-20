import React, { useRef } from 'react';
import Editor, { loader, OnMount } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { useEditorStore } from '../../stores/editor';

(window as any).MonacoEnvironment = {
  getWorker(_: any, label: string) {
    const entryMap: Record<string, string> = {
      json: 'monaco-editor/esm/vs/language/json/json.worker.js',
      css: 'monaco-editor/esm/vs/language/css/css.worker.js',
      scss: 'monaco-editor/esm/vs/language/css/css.worker.js',
      less: 'monaco-editor/esm/vs/language/css/css.worker.js',
      html: 'monaco-editor/esm/vs/language/html/html.worker.js',
      handlebars: 'monaco-editor/esm/vs/language/html/html.worker.js',
      razor: 'monaco-editor/esm/vs/language/html/html.worker.js',
      typescript: 'monaco-editor/esm/vs/language/typescript/ts.worker.js',
      javascript: 'monaco-editor/esm/vs/language/typescript/ts.worker.js',
    };
    const entry = entryMap[label] || 'monaco-editor/esm/vs/editor/editor.worker.js';
    return new Worker(new URL(entry, import.meta.url), { type: 'module' });
  },
};

loader.config({ monaco });

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
      loading={null}
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
