import React, { useRef, useState } from 'react';
import Editor, { loader, OnMount } from '@monaco-editor/react';
import { useEditorStore } from '../../stores/editor';
import { useRefsStore } from '../../stores/refs';

// 配置 Monaco 从本地 public/vs 加载
try {
  loader.config({ paths: { vs: './vs' } });
} catch (e) {
  console.error('[Monaco] loader.config failed:', e);
}

interface Props {
  filePath: string;
  content: string;
  language: string;
  onChange?: (value: string | undefined) => void;
  readOnly?: boolean;
}

export default function CodeEditor({ filePath, content, language, onChange, readOnly = false }: Props) {
  const storeRef = useRef(useEditorStore);
  const editorRef = useRef<import('monaco-editor').editor.IStandaloneCodeEditor | null>(null);
  const [monacoError, setMonacoError] = useState<string | null>(null);
  const goToTarget = useEditorStore(state => state.goToTarget);

  // 检测 Monaco 是否加载成功
  React.useEffect(() => {
    loader.init().then(() => {
    }).catch((err) => {
      console.error('[Monaco] failed to load:', err);
      const detail = err ? (err.stack || err.message || String(err)) : '未知错误';
      setMonacoError(detail);
    });
  }, []);

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
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

    // 禁用默认英文菜单，替换为中文自定义菜单
    editor.updateOptions({ contextmenu: false });
    const menuEl = document.createElement('div');
    menuEl.style.cssText = 'position:fixed;z-index:9999;background:var(--bg-secondary);border:1px solid var(--border);border-radius:6px;padding:4px 0;min-width:200px;box-shadow:0 4px 16px rgba(0,0,0,0.4);display:none;font-size:12px';
    menuEl.className = 'cn-editor-menu';
    document.body.appendChild(menuEl);

    const menuItems: Array<{ label: string; key: string; sep?: boolean }> = [
      { label: '剪切', key: 'cut' },
      { label: '复制', key: 'copy' },
      { label: '粘贴', key: 'paste' },
      { label: '', key: '', sep: true },
      { label: '引用代码到对话', key: 'codeRef' },
      { label: '', key: '', sep: true },
      { label: '全选', key: 'selectAll' },
      { label: '', key: '', sep: true },
      { label: '查找所有引用', key: 'references' },
      { label: '转到定义', key: 'definition' },
      { label: '速览定义', key: 'peek' },
      { label: '', key: '', sep: true },
      { label: '重命名符号', key: 'rename' },
      { label: '格式化文档', key: 'format' },
      { label: '更改所有匹配项', key: 'changeAll' },
    ];

    const buildMenu = () => {
      const sel = editor.getSelection();
      const hasSel = sel && !sel.isEmpty();
      menuEl.innerHTML = '';
      for (const item of menuItems) {
        if (item.sep) { const d = document.createElement('div'); d.style.cssText = 'height:1px;background:var(--border);margin:3px 0'; menuEl.appendChild(d); continue; }
        const el = document.createElement('div');
        el.textContent = item.label;
        const disabled = (item.key === 'cut' || item.key === 'copy' || item.key === 'codeRef') && !hasSel;
        el.style.cssText = 'padding:5px 12px;cursor:pointer;color:var(--text-primary)' + (disabled ? ';opacity:0.4;pointer-events:none' : '');
        el.onmouseenter = () => { el.style.background = 'var(--accent)'; };
        el.onmouseleave = () => { el.style.background = ''; };
        el.onclick = () => {
          hideMenu();
          if (item.key === 'cut' && hasSel) editor.getAction('editor.action.clipboardCutAction')?.run();
          else if (item.key === 'copy' && hasSel) editor.getAction('editor.action.clipboardCopyAction')?.run();
          else if (item.key === 'paste') editor.getAction('editor.action.clipboardPasteAction')?.run();
          else if (item.key === 'selectAll') editor.getAction('editor.action.selectAll')?.run();
          else if (item.key === 'references') editor.getAction('editor.action.goToReferences')?.run();
          else if (item.key === 'definition') editor.getAction('editor.action.revealDefinition')?.run();
          else if (item.key === 'peek') editor.getAction('editor.action.peekDefinition')?.run();
          else if (item.key === 'rename') editor.getAction('editor.action.rename')?.run();
          else if (item.key === 'format') editor.getAction('editor.action.formatDocument')?.run();
          else if (item.key === 'changeAll') editor.getAction('editor.action.changeAll')?.run();
          else if (item.key === 'codeRef' && hasSel) {
            const selection = editor.getSelection()!;
            const model = editor.getModel();
            if (model) {
              const startLine = selection.startLineNumber;
              const endLine = selection.endLineNumber;
              const code = model.getValueInRange(selection);
              const lineRange = startLine === endLine ? `L${startLine}` : `L${startLine}-L${endLine}`;
              const ref = `@${filePath}:${lineRange}\n\`\`\`\n${code}\n\`\`\``;
              useRefsStore.getState().addTextRef(ref);
            }
          }
        };
        menuEl.appendChild(el);
      }
    };

    const hideMenu = () => { menuEl.style.display = 'none'; };
    document.addEventListener('click', hideMenu);

    editor.onContextMenu((e) => {
      e.event.preventDefault();
      buildMenu();
      const ev = (e.event as any).browserEvent ?? e.event;
      menuEl.style.display = 'block';
      menuEl.style.left = `${ev.clientX}px`;
      menuEl.style.top = `${ev.clientY}px`;
      // Keep menu within viewport
      const rect = menuEl.getBoundingClientRect();
      if (rect.bottom > window.innerHeight) menuEl.style.top = `${window.innerHeight - rect.height - 4}px`;
      if (rect.right > window.innerWidth) menuEl.style.left = `${window.innerWidth - rect.width - 4}px`;
    });

    updateCursor();
    updateIndent();
    updateDiagnostics();
  };

  React.useEffect(() => {
    const target = goToTarget;
    const editor = editorRef.current;
    if (!target || !editor || target.path !== filePath) return;
    editor.revealLineInCenter(target.line);
    editor.setPosition({ lineNumber: target.line, column: target.column ?? 1 });
    editor.focus();
    storeRef.current.getState().clearGoToTarget();
  }, [filePath, content, goToTarget]);

  if (monacoError) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{
          padding: '6px 12px', background: 'rgba(239,68,68,0.1)',
          color: '#ef4444', fontSize: 11, borderBottom: '1px solid rgba(239,68,68,0.2)',
        }}>
          ⚠️ Monaco 编辑器加载失败，已回退到文本模式
        </div>
        <textarea
          value={content}
          onChange={e => onChange?.(e.target.value)}
          readOnly={readOnly}
          spellCheck={false}
          style={{
            flex: 1, background: 'var(--bg-primary)', color: 'var(--text-primary)',
            border: 'none', outline: 'none',
            fontFamily: "'Fira Code', 'Consolas', monospace",
            fontSize: 13, lineHeight: 1.6,
            padding: '8px 12px',
            resize: 'none',
            whiteSpace: 'pre',
            overflow: 'auto',
          }}
        />
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
