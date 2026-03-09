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
  operatorName?: string;
  abonentName?: string;
  fillerWords?: string[];
  negativeWords?: string[];
};

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const clean = (s: string) => s.toLowerCase().replace(/[.,!?;:"""''()]/g, '');

type HighlightColor = 'green' | 'yellow' | 'orange' | 'red';

/** Build a set of word indices that match keywords (supports multi-word phrases) */
function buildKeywordHighlightMap(
  words: { word: string }[],
  keywords: string[],
  highlightedKeywords: string[],
  fillerWords: string[] = [],
  negativeWords: string[] = [],
): Map<number, HighlightColor> {
  const result = new Map<number, HighlightColor>();
  const highlightedSet = new Set(highlightedKeywords.map((k) => k.toLowerCase()));

  // Priority: green (active topic) > yellow (topic) > red (negative) > orange (filler)
  const groups: { words: string[]; color: HighlightColor }[] = [
    { words: [...new Set([...highlightedKeywords, ...keywords])], color: 'yellow' },
    { words: negativeWords, color: 'red' },
    { words: fillerWords, color: 'orange' },
  ];

  for (const group of groups) {
    for (const kw of group.words) {
      const parts = kw.toLowerCase().split(/\s+/).filter(Boolean);
      if (!parts.length) continue;
      for (let i = 0; i <= words.length - parts.length; i++) {
        let matched = true;
        for (let j = 0; j < parts.length; j++) {
          if (clean(words[i + j].word) !== parts[j]) {
            matched = false;
            break;
          }
        }
        if (matched) {
          let color = group.color;
          // Active topic keywords get green
          if (color === 'yellow' && highlightedSet.has(kw.toLowerCase())) color = 'green';
          for (let j = 0; j < parts.length; j++) {
            const existing = result.get(i + j);
            // Higher priority colors don't get overwritten
            if (!existing || (color === 'green' && existing !== 'green')) {
              result.set(i + j, color);
            }
          }
        }
      }
    }
  }
  return result;
}

function getHighlightClass(color: HighlightColor | undefined): string {
  if (color === 'green') return 'bg-green-200 rounded-sm px-0.5';
  if (color === 'yellow') return 'bg-yellow-100 rounded-sm px-0.5';
  if (color === 'orange') return 'bg-orange-100 text-orange-800 rounded-sm px-0.5';
  if (color === 'red') return 'bg-red-100 text-red-800 rounded-sm px-0.5';
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

export default function TranscriptChat({
  turns, words, currentTime, keywords, highlightedKeywords = [], onSeek,
  operatorName = 'Оператор', abonentName = 'Собеседник',
  fillerWords = [], negativeWords = [],
}: TranscriptChatProps) {
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
      activeHighlightRef.current.classList.remove('bg-indigo-200', 'rounded-sm');
      activeHighlightRef.current = null;
    }

    if (activeWordIdx < 0) return;

    const el = containerRef.current.querySelector(`[data-widx="${activeWordIdx}"]`) as HTMLSpanElement | null;
    if (el) {
      el.classList.add('bg-indigo-200', 'rounded-sm');
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
    if (isOperator(speaker)) return operatorName;
    if (speaker === 'speaker-b') return 'Спикер B';
    return abonentName;
  };

  return (
    <div ref={containerRef} className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 220px)', padding: 10 }}>
      <div className="text-base font-semibold text-gray-900 mb-4">Расшифровка</div>
      <div className="space-y-3">
        {turns.map((turn, idx) => {
          const wordsForTurn = turnWords?.[idx];
          const isActive = idx === activeTurnIdx;
          const highlightMap = wordsForTurn && isOperator(turn.speaker)
            ? buildKeywordHighlightMap(wordsForTurn, keywords, highlightedKeywords, fillerWords, negativeWords)
            : null;

          return (
            <div
              key={idx}
              data-tidx={idx}
              className={`flex gap-4 py-1.5 transition-colors ${isActive ? 'bg-indigo-50/60 -mx-2 px-2 rounded-lg' : ''} ${turn.start != null ? 'cursor-pointer' : ''}`}
              onClick={() => { if (turn.start != null) onSeek(turn.start); }}
            >
              {/* Speaker name column */}
              <div className="flex-shrink-0 w-40 text-right">
                <span className={`text-sm font-semibold ${isOperator(turn.speaker) ? 'text-gray-900' : 'text-gray-500'}`}>
                  {speakerLabel(turn.speaker)}:
                </span>
                {turn.start != null && (
                  <div className="text-xs text-gray-400 mt-0.5">
                    {Math.floor(turn.start / 60)}:{Math.floor(turn.start % 60).toString().padStart(2, '0')}
                  </div>
                )}
              </div>

              {/* Text column */}
              <div className="flex-1 text-sm text-gray-800 leading-relaxed">
                {wordsForTurn ? (
                  wordsForTurn.map((w, wIdx) => {
                    const globalIdx = words!.indexOf(w);
                    const kwClass = getHighlightClass(highlightMap?.get(wIdx));
                    return (
                      <span
                        key={wIdx}
                        data-widx={globalIdx}
                        className={`cursor-pointer transition-colors ${kwClass}`}
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
                        if (isOperator(turn.speaker)) {
                          if (highlightedKeywords.length) {
                            html = html.replace(
                              new RegExp(`(${highlightedKeywords.map(escapeRegExp).join('|')})`, 'gi'),
                              '<mark class="bg-green-200 rounded-sm px-0.5">$1</mark>',
                            );
                          }
                          const remaining = keywords.filter(
                            (kw) => !highlightedKeywords.some((hk) => hk.toLowerCase() === kw.toLowerCase()),
                          );
                          if (remaining.length) {
                            html = html.replace(
                              new RegExp(`(?!<[^>]*)(${remaining.map(escapeRegExp).join('|')})(?![^<]*>)`, 'gi'),
                              '<mark class="bg-yellow-100 rounded-sm px-0.5">$1</mark>',
                            );
                          }
                          if (negativeWords.length) {
                            html = html.replace(
                              new RegExp(`(?!<[^>]*)(${negativeWords.map(escapeRegExp).join('|')})(?![^<]*>)`, 'gi'),
                              '<mark class="bg-red-100 text-red-800 rounded-sm px-0.5">$1</mark>',
                            );
                          }
                          if (fillerWords.length) {
                            html = html.replace(
                              new RegExp(`(?!<[^>]*)(${fillerWords.map(escapeRegExp).join('|')})(?![^<]*>)`, 'gi'),
                              '<mark class="bg-orange-100 text-orange-800 rounded-sm px-0.5">$1</mark>',
                            );
                          }
                        }
                        return html;
                      })(),
                    }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
