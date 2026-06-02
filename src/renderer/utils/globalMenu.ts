const MENU_EVENT = 'app:menu-changed';
let currentSource: string | null = null;

/** 通知全局：有一个新菜单要打开，其他菜单应关闭 */
export function notifyMenuOpened(source: string): void {
  currentSource = source;
  window.dispatchEvent(new CustomEvent(MENU_EVENT, { detail: { source } }));
}

/** 通知全局：菜单已关闭 */
export function notifyMenuClosed(source: string): void {
  if (currentSource === source) currentSource = null;
}

/** 订阅菜单变更事件，返回取消订阅函数。当其他菜单打开时回调 */
export function onOtherMenuOpened(source: string, callback: () => void): () => void {
  const handler = (e: Event) => {
    const detail = (e as CustomEvent).detail as { source: string };
    if (detail.source !== source) callback();
  };
  window.addEventListener(MENU_EVENT, handler);
  return () => window.removeEventListener(MENU_EVENT, handler);
}
