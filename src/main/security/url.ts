const BLOCKED_HOSTNAMES = new Set(['localhost', '0.0.0.0', '::1', '[::1]']);

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split('.').map((p) => Number(p));
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) return false;
  if (parts[0] === 10) return true;
  if (parts[0] === 127) return true;
  if (parts[0] === 0) return true;
  if (parts[0] === 169 && parts[1] === 254) return true;
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  if (parts[0] === 192 && parts[1] === 168) return true;
  return false;
}

function isBlockedHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase().replace(/^\[/, '').replace(/\]$/, '');
  if (BLOCKED_HOSTNAMES.has(lower)) return true;
  if (lower.endsWith('.localhost')) return true;
  if (lower.startsWith('127.')) return true;
  if (lower.startsWith('10.')) return true;
  if (lower.startsWith('192.168.')) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(lower)) return true;
  if (lower.startsWith('169.254.')) return true;
  if (lower.startsWith('fe80:') || lower.startsWith('fc') || lower.startsWith('fd')) return true;
  return isPrivateIpv4(lower);
}

/** 校验外部 URL，拦截 SSRF（localhost / 内网 / 非 http(s)） */
export function validateExternalUrl(urlString: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(urlString.trim());
  } catch {
    throw new Error('URL 格式无效');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('仅允许 http/https 协议');
  }

  if (parsed.username || parsed.password) {
    throw new Error('URL 不允许包含用户名或密码');
  }

  const hostname = parsed.hostname;
  if (!hostname) {
    throw new Error('URL 缺少主机名');
  }

  if (isBlockedHostname(hostname)) {
    throw new Error(`不允许访问内网或本地地址: ${hostname}`);
  }

  return parsed;
}
