// URL detection for douyin and bilibili share links

const SHARE_URL_PATTERNS: { platform: 'douyin' | 'bilibili'; patterns: RegExp[] }[] = [
  {
    platform: 'douyin',
    patterns: [/douyin\.com/i, /iesdouyin\.com/i],
  },
  {
    platform: 'bilibili',
    patterns: [/bilibili\.com/i, /b23\.tv/i, /acg\.tv/i],
  },
];

export interface DetectedPlatform {
  isVideoShare: boolean;
  platform?: 'douyin' | 'bilibili';
  matchedPattern?: string;
  matchedText?: string;
}

/**
 * Detect if text contains a douyin or bilibili share link.
 * This is a lightweight pre-check; the actual parsing is done by the API.
 */
export function detectVideoShare(text: string): DetectedPlatform {
  for (const entry of SHARE_URL_PATTERNS) {
    for (const pattern of entry.patterns) {
      const match = text.match(pattern);
      if (match) {
        return {
          isVideoShare: true,
          platform: entry.platform,
          matchedPattern: pattern.source,
          matchedText: match[0],
        };
      }
    }
  }
  return { isVideoShare: false };
}
