import React, { useRef, useState } from 'react';
import Editor, { loader, OnMount } from '@monaco-editor/react';
import { useEditorStore } from '../../stores/editor';

// 配置 Monaco 从本地 public/vs 加载
try {
  loader.config({ paths: { vs: '/vs' } });
} catch (e) {
  console.error('[Monaco] loader.config failed:', e);
}

interface Props {
  content: string;
  language: string;
  onChange?: (value: string | undefined) => void;
  readOnly?: boolean;
}

export default function CodeEditor({ content, language, onChange, readOnly = false }: Props) {
  const storeRef = useRef(useEditorStore);
  const [monacoError, setMonacoError] = useState<string | null>(null);

  // 检测 Monaco 是否加载成功
  React.useEffect(() => {
    loader.init().then(() => {
      console.log('[Monaco] loaded successfully');
    }).catch((err) => {
      console.error('[Monaco] failed to load:', err);
      const detail = err ? (err.stack || err.message || String(err)) : '未知错误';
      setMonacoError(detail);
    });
  }, []);

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

  if (monacoError) {
    return (
      <div style={{
        height: '100%', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        color: '#ef4444', fontSize: 13, padding: 20, overflow: 'auto',
      }}>
        <div style={{ marginBottom: 8 }}>⚠️ 编辑器加载失败</div>
        <pre style={{
          color: 'var(--text-secondary)', fontSize: 11, textAlign: 'left',
          background: 'var(--bg-tertiary)', padding: 10, borderRadius: 6,
          maxWidth: '100%', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          fontFamily: 'monospace', lineHeight: 1.5,
        }}>
          {monacoError}
        </pre>
        <div style={{ marginTop: 12, color: 'var(--text-secondary)', fontSize: 11, textAlign: 'center' }}>
          请检查 public/vs 目录是否存在，或尝试执行：<br/>
          <code style={{ background: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: 3 }}>
            node scripts/setup-monaco.js
          </code>
        </div>
      </div>
    );
  }

  return (
    <Editor
      value={content}
      language={language}
      onChange={onChange}
      onMount={handleMount}
      theme="vs-dark"
      loading={
        <div style={{
          height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-secondary)', fontSize: 12,
        }}>
          正在加载编辑器...
        </div>
      }
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
