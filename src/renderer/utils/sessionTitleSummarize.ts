import { useChatStore } from '../stores/chat';
import { useModelStore } from '../stores/model';
import { extractPlainUserText } from '../utils/sessionTitle';

export async function summarizeSessionTitleIfNeeded(sessionId: string) {
  const chatStore = useChatStore.getState();
  const session = chatStore.sessions.find(s => s.id === sessionId);
  if (!session?.titlePending) return;

  const userMsg = session.messages.find(m => m.role === 'user');
  if (!userMsg) return;

  const assistantMsg = [...session.messages]
    .reverse()
    .find(m => m.role === 'assistant' && (m.content.trim() || m.thinkingContent?.trim()));

  const model = useModelStore.getState().getActiveModel();
  const apiKey = model.apiKey || await window.api.settings.getApiKey();
  if (!apiKey) {
    chatStore.updateSessionTitle(sessionId, session.title, false);
    return;
  }

  try {
    const result = await window.api.sessions.generateTitle({
      userMessage: extractPlainUserText(userMsg),
      assistantPreview: assistantMsg?.content?.trim() || assistantMsg?.thinkingContent?.trim(),
      model: model.model,
      baseUrl: model.baseUrl,
      apiKey,
    });

    if (result.success && result.title) {
      chatStore.updateSessionTitle(sessionId, result.title, false);
      return;
    }
  } catch {
    // 保留 fallback 标题
  }

  chatStore.updateSessionTitle(sessionId, session.title, false);
}
