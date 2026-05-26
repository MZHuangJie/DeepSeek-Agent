/** 将焦点恢复到聊天输入框（避免 Electron 原生对话框抢焦点后无法输入） */
export function focusChatInput() {
  requestAnimationFrame(() => {
    const textarea = document.querySelector<HTMLTextAreaElement>(
      'textarea[placeholder*="Ask DeepSeek"]'
    );
    if (!textarea) return;
    textarea.focus();
    const len = textarea.value.length;
    textarea.setSelectionRange(len, len);
  });
}
