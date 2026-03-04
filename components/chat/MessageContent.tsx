import React from 'react';

/** Matches emoji characters (Unicode property, ES2018+) */
const EMOJI_REGEX = /\p{Emoji}/gu;

/** Check if a string is only emojis (and optional spaces/ZWNJ between them). */
function parseMessageContent(text: string): {
  isEmojiOnly: boolean;
  emojiCount: number;
  content: string;
} {
  const content = (text || '').trim();
  if (!content) return { isEmojiOnly: false, emojiCount: 0, content };

  try {
    const emojiMatches = content.match(EMOJI_REGEX) ?? [];
    const withoutEmojis = content.replace(EMOJI_REGEX, '').replace(/\s/g, '');
    const isEmojiOnly = withoutEmojis.length === 0 && emojiMatches.length >= 1;

    return {
      isEmojiOnly,
      emojiCount: emojiMatches.length,
      content,
    };
  } catch {
    return { isEmojiOnly: false, emojiCount: 0, content };
  }
}

/** Font size for emoji-only messages (1–5+ emojis), scales down as count increases */
const EMOJI_SIZES: Record<number, string> = {
  1: 'text-5xl sm:text-6xl',   // 1 emoji: largest
  2: 'text-4xl sm:text-5xl',   // 2 emojis
  3: 'text-3xl sm:text-4xl',   // 3 emojis
  4: 'text-2xl sm:text-3xl',   // 4 emojis
  5: 'text-xl sm:text-2xl',    // 5 emojis
};

function getEmojiSizeClass(count: number): string {
  if (count <= 0) return 'text-sm';
  if (count >= 6) return 'text-lg sm:text-xl'; // 6+ emojis: still larger than normal
  return EMOJI_SIZES[count as 1 | 2 | 3 | 4 | 5] ?? 'text-xl';
}

export interface MessageContentProps {
  /** The message text to render */
  content: string;
  /** Whether this is the current user's message (for styling) */
  isOwn: boolean;
  /** Optional extra class names for the wrapper */
  className?: string;
}

/**
 * Renders message content with emoji-aware styling.
 * - Emoji-only messages (1–5 emojis): displayed larger
 * - Text + emojis: normal message size
 * - Works for both sent and received bubbles
 */
export const MessageContent: React.FC<MessageContentProps> = ({
  content,
  isOwn,
  className = '',
}) => {
  const { isEmojiOnly, emojiCount, content: trimmed } = parseMessageContent(content);

  const textColor = isOwn ? 'text-white' : 'text-gray-800';

  if (isEmojiOnly) {
    const sizeClass = getEmojiSizeClass(emojiCount);
    return (
      <div
        className={`leading-relaxed flex flex-wrap items-center justify-center gap-0.5 py-1 ${sizeClass} ${textColor} ${className}`}
        role="img"
        aria-label={trimmed}
      >
        {trimmed}
      </div>
    );
  }

  return (
    <p className={`text-sm leading-relaxed whitespace-pre-wrap ${textColor} ${className}`}>
      {content}
    </p>
  );
};
