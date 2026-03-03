import { forwardRef, useEffect, useImperativeHandle, useRef, useState, useCallback } from 'react';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions';

export type AudioPlayerHandle = {
  seekTo: (time: number) => void;
  play: () => void;
  pause: () => void;
};

export type WaveformMarker = {
  time: number;
  label?: string;
  color?: string;
};

type AudioPlayerProps = {
  audioUrl: string;
  authToken?: string;
  onTimeUpdate: (time: number) => void;
  markers?: WaveformMarker[];
};

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const AudioPlayer = forwardRef<AudioPlayerHandle, AudioPlayerProps>(({ audioUrl, authToken, onTimeUpdate, markers }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loadError, setLoadError] = useState(false);

  useImperativeHandle(ref, () => ({
    seekTo: (time: number) => {
      const ws = wsRef.current;
      if (!ws || !duration) return;
      ws.seekTo(Math.min(Math.max(time / duration, 0), 1));
    },
    play: () => wsRef.current?.play(),
    pause: () => wsRef.current?.pause(),
  }));

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;
    let blobUrl: string | null = null;

    const init = async () => {
      // Fetch audio with auth token, then create blob URL
      let url = audioUrl;
      if (authToken) {
        try {
          const res = await fetch(audioUrl, {
            headers: { Authorization: `Bearer ${authToken}` },
          });
          if (!res.ok) {
            setLoadError(true);
            return;
          }
          const blob = await res.blob();
          if (cancelled) return;
          blobUrl = URL.createObjectURL(blob);
          url = blobUrl;
        } catch {
          if (!cancelled) setLoadError(true);
          return;
        }
      }

      if (cancelled || !containerRef.current) return;

      const regions = RegionsPlugin.create();

      const ws = WaveSurfer.create({
        container: containerRef.current,
        waveColor: '#d1d5db',
        progressColor: '#6366f1',
        cursorColor: '#4f46e5',
        barWidth: 2,
        barGap: 1,
        barRadius: 2,
        height: 48,
        url,
        plugins: [regions],
      });

      ws.on('ready', () => {
        setDuration(ws.getDuration());

        // Add keyword markers on the waveform
        if (markers?.length) {
          markers.forEach((m) => {
            regions.addRegion({
              start: m.time,
              end: m.time + 0.15,
              color: m.color || 'rgba(234, 179, 8, 0.5)',
              drag: false,
              resize: false,
            });
          });
        }
      });

      ws.on('timeupdate', (time: number) => {
        setCurrentTime(time);
        onTimeUpdate(time);
      });

      ws.on('seeking', (time: number) => {
        setCurrentTime(time);
        onTimeUpdate(time);
      });

      ws.on('play', () => setIsPlaying(true));
      ws.on('pause', () => setIsPlaying(false));
      ws.on('finish', () => setIsPlaying(false));

      wsRef.current = ws;
    };

    init();

    return () => {
      cancelled = true;
      wsRef.current?.destroy();
      wsRef.current = null;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [audioUrl, authToken]); // eslint-disable-line react-hooks/exhaustive-deps

  const togglePlay = useCallback(() => {
    wsRef.current?.playPause();
  }, []);

  if (loadError) {
    return (
      <div className="flex items-center gap-4 px-4 py-3 bg-white border-t border-gray-200">
        <span className="text-sm text-red-500">Не удалось загрузить аудио</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4 px-4 py-3 bg-white border-t border-gray-200">
      <button
        type="button"
        onClick={togglePlay}
        className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
      >
        {isPlaying ? (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="4" width="4" height="16" />
            <rect x="14" y="4" width="4" height="16" />
          </svg>
        ) : (
          <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
            <polygon points="5,3 19,12 5,21" />
          </svg>
        )}
      </button>
      <span className="flex-shrink-0 text-sm text-gray-600 tabular-nums w-24 text-center">
        {formatTime(currentTime)} / {formatTime(duration)}
      </span>
      <div ref={containerRef} className="flex-1 min-w-0" />
    </div>
  );
});

AudioPlayer.displayName = 'AudioPlayer';

export default AudioPlayer;
