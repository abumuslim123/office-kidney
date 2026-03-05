import { useEffect, useMemo, useRef } from 'react';

type Turn = {
  speaker: string;
  text: string;
  start?: number;
  end?: number;
};

type TimedWord = {
  word: string;
  start: number;
  end: number;
  speaker: string;
};

type TranscriptChatProps = {
  turns: Turn[];
  words: TimedWord[] | null;
  currentTime: number;
  keywords: string[];
  highlightedKeywords?: string[];
  onSeek: (time: number) => void;
};

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isKeywordMatch(word: string, keywords: string[]): boolean {
  if (!keywords.length) return false;
  const lower = word.toLowerCase().replace(/[.,!?;:"""''()]/g, '');
  return keywords.some((kw) => lower.includes(kw.toLowerCase()));
}

function getKeywordHighlightClass(word: string, keywords: string[], highlightedKeywords: string[]): string {
  const lower = word.toLowerCase().replace(/[.,!?;:"""''()]/g, '');
  if (highlightedKeywords.length && highlightedKeywords.some((kw) => lower.includes(kw.toLowerCase()))) {
    return 'bg-green-300 bg-opacity-70';
  }
  if (keywords.length && keywords.some((kw) => lower.includes(kw.toLowerCase()))) {
    return 'bg-yellow-200 bg-opacity-70';
  }
  return '';
}

/** Map words to turns based on time overlap */
function mapWordsToTurns(turns: Turn[], words: TimedWord[]): (TimedWord[] | null)[] {
  return turns.map((turn) => {
    if (turn.start == null || turn.end == null) return null;
    const turnWords = words.filter(
      (w) => w.start >= turn.start! - 0.05 && w.start < turn.end! + 0.05,
    );
    return turnWords.length > 0 ? turnWords : null;
  });
}

export default function TranscriptChat({ turns, words, currentTime, keywords, highlightedKeywords = [], onSeek }: TranscriptChatProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeHighlightRef = useRef<HTMLSpanElement | null>(null);
  const activeTurnIdxRef = useRef<number>(-1);

  const turnWords = useMemo(
    () => (words && words.length > 0 ? mapWordsToTurns(turns, words) : null),
    [turns, words],
  );

  // Find active word index via binary search
  const activeWordIdx = useMemo(() => {
    if (!words || !words.length) return -1;
    let lo = 0;
    let hi = words.length - 1;
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (words[mid].end <= currentTime) lo = mid + 1;
      else if (words[mid].start > currentTime) hi = mid - 1;
      else return mid;
    }
    return -1;
  }, [words, currentTime]);

  // Find active turn index
  const activeTurnIdx = useMemo(() => {
    if (currentTime <= 0) return -1;
    for (let i = 0; i < turns.length; i++) {
      const t = turns[i];
      if (t.start != null && t.end != null && currentTime >= t.start && currentTime < t.end + 0.3) {
        return i;
      }
    }
    return -1;
  }, [turns, currentTime]);

  // DOM-based word highlighting for performance (avoid React re-renders at 60fps)
  useEffect(() => {
    if (!containerRef.current) return;

    // Remove previous highlight
    if (activeHighlightRef.current) {
      activeHighlightRef.current.classList.remove('bg-indigo-200');
      activeHighlightRef.current = null;
    }

    if (activeWordIdx < 0) return;

    const el = containerRef.current.querySelector(`[data-widx="${activeWordIdx}"]`) as HTMLSpanElement | null;
    if (el) {
      el.classList.add('bg-indigo-200');
      activeHighlightRef.current = el;
    }
  }, [activeWordIdx]);

  // Auto-scroll to active turn
  useEffect(() => {
    if (activeTurnIdx < 0 || activeTurnIdx === activeTurnIdxRef.current) return;
    activeTurnIdxRef.current = activeTurnIdx;

    const el = containerRef.current?.querySelector(`[data-tidx="${activeTurnIdx}"]`) as HTMLElement | null;
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [activeTurnIdx]);

  const isOperator = (speaker: string) =>
    speaker === 'operator' || speaker === 'speaker-a';

  const speakerLabel = (speaker: string) => {
    if (speaker === 'operator') return 'Оператор';
    if (speaker === 'speaker-a') return 'Спикер A';
    if (speaker === 'speaker-b') return 'Спикер B';
    return 'Собеседник';
  };

  return (
    <div ref={containerRef} className="flex flex-col gap-2 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 220px)' }}>
      {turns.map((turn, idx) => {
        const op = isOperator(turn.speaker);
        const wordsForTurn = turnWords?.[idx];
        const isActive = idx === activeTurnIdx;

        return (
          <div
            key={idx}
            data-tidx={idx}
            className={`flex ${op ? 'justify-start' : 'justify-end'}`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 transition-shadow ${
                op ? 'bg-gray-200 text-gray-900' : 'bg-accent text-white'
              } ${isActive ? 'ring-2 ring-indigo-400' : ''} ${
                turn.start != null ? 'cursor-pointer' : ''
              }`}
              onClick={() => {
                if (turn.start != null) onSeek(turn.start);
              }}
            >
              <div className="text-xs font-semibold opacity-80 mb-0.5">
                {speakerLabel(turn.speaker)}
                {turn.start != null && (
                  <span className="ml-2 opacity-60">
                    {Math.floor(turn.start / 60)}:{Math.floor(turn.start % 60).toString().padStart(2, '0')}
                  </span>
                )}
              </div>
              <div className="text-sm whitespace-pre-wrap leading-relaxed">
                {wordsForTurn ? (
                  wordsForTurn.map((w, wIdx) => {
                    // Find global word index for data-widx
                    const globalIdx = words!.indexOf(w);
                    const kwClass = getKeywordHighlightClass(w.word, keywords, highlightedKeywords);
                    return (
                      <span
                        key={wIdx}
                        data-widx={globalIdx}
                        className={`cursor-pointer rounded-sm transition-colors ${kwClass}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSeek(w.start);
                        }}
                      >
                        {w.word}{' '}
                      </span>
                    );
                  })
                ) : (
                  <span
                    dangerouslySetInnerHTML={{
                      __html: (() => {
                        let html = turn.text;
                        // First pass: green highlights for active topic keywords
                        if (highlightedKeywords.length) {
                          html = html.replace(
                            new RegExp(`(${highlightedKeywords.map(escapeRegExp).join('|')})`, 'gi'),
                            '<mark class="bg-green-300 rounded-sm">$1</mark>',
                          );
                        }
                        // Second pass: yellow highlights for remaining keywords (skip already marked)
                        const remaining = keywords.filter(
                          (kw) => !highlightedKeywords.some((hk) => hk.toLowerCase() === kw.toLowerCase()),
                        );
                        if (remaining.length) {
                          html = html.replace(
                            new RegExp(`(?!<[^>]*)(${remaining.map(escapeRegExp).join('|')})(?![^<]*>)`, 'gi'),
                            '<mark class="bg-yellow-200 rounded-sm">$1</mark>',
                          );
                        }
                        return html;
                      })(),
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
