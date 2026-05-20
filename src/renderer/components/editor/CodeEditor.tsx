import React, { useRef } from 'react';
import Editor, { loader, OnMount } from '@monaco-editor/react';
import { useEditorStore } from '../../stores/editor';

loader.config({ paths: { vs: '/vs' } });

interface Props {
  content: string;
  language: string;
  onChange?: (value: string | undefined) => void;
  readOnly?: boolean;
}

export default function CodeEditor({ content, language, onChange, readOnly = false }: Props) {
  const storeRef = useRef(useEditorStore);

  const handleMount: OnMount = (editor, monaco) => {
    // Disable semantic errors in editor (Monaco doesn't have node_modules types)
    monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSyntaxValidation: false,
    });
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

    const updateDiagnostics = () => {
      const markers = monaco.editor.getModelMarkers({});
      let errors = 0;
      let warnings = 0;
      for (const m of markers) {
        if (m.severity === monaco.MarkerSeverity.Error) errors++;
        else if (m.severity === monaco.MarkerSeverity.Warning) warnings++;
      }
      store.setDiagnostics(errors, warnings);
    };

    editor.onDidChangeCursorPosition(updateCursor);
    editor.onDidChangeModel(updateIndent);
    editor.onDidChangeModelOptions(updateIndent);
    monaco.editor.onDidChangeMarkers(updateDiagnostics);

    updateCursor();
    updateIndent();
    updateDiagnostics();
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
