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

const SPEED_OPTIONS = [1, 1.5, 2, 3, 4];

const AudioPlayer = forwardRef<AudioPlayerHandle, AudioPlayerProps>(({ audioUrl, authToken, onTimeUpdate, markers }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const regionsRef = useRef<ReturnType<typeof RegionsPlugin.create> | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const [volume, setVolume] = useState(1);
  const [speed, setSpeed] = useState(1);

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
      regionsRef.current = regions;

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
        setIsReady(true);
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

  // Update markers when they change
  useEffect(() => {
    const regions = regionsRef.current;
    if (!regions || !isReady) return;
    regions.clearRegions();
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
  }, [markers, isReady]);

  const togglePlay = useCallback(() => {
    wsRef.current?.playPause();
  }, []);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (wsRef.current) {
      wsRef.current.setVolume(val);
    }
  }, []);

  const handleSpeedChange = useCallback(() => {
    setSpeed((prev) => {
      const idx = SPEED_OPTIONS.indexOf(prev);
      const next = SPEED_OPTIONS[(idx + 1) % SPEED_OPTIONS.length];
      if (wsRef.current) {
        wsRef.current.setPlaybackRate(next);
      }
      return next;
    });
  }, []);

  if (loadError) {
    return (
      <div className="flex items-center gap-4 px-4 py-3 bg-white border-t border-gray-200">
        <span className="text-sm text-red-500">Не удалось загрузить аудио</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-white border-t border-gray-200">
      {/* Play/Pause */}
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

      {/* Time */}
      <span className="flex-shrink-0 text-sm text-gray-600 tabular-nums w-24 text-center">
        {formatTime(currentTime)} / {formatTime(duration)}
      </span>

      {/* Waveform */}
      <div ref={containerRef} className="flex-1 min-w-0" />

      {/* Speed */}
      <button
        type="button"
        onClick={handleSpeedChange}
        className="flex-shrink-0 px-2 py-1 text-xs font-semibold rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors tabular-nums min-w-[40px] text-center"
        title="Скорость воспроизведения"
      >
        x{speed % 1 === 0 ? speed : speed.toFixed(1)}
      </button>

      {/* Volume */}
      <div className="flex-shrink-0 flex items-center gap-1.5">
        <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
          {volume === 0 ? (
            <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
          ) : volume < 0.5 ? (
            <path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z" />
          ) : (
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
          )}
        </svg>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={volume}
          onChange={handleVolumeChange}
          className="w-20 h-1 accent-indigo-600 cursor-pointer"
          title={`Громкость: ${Math.round(volume * 100)}%`}
        />
      </div>
    </div>
  );
});

AudioPlayer.displayName = 'AudioPlayer';

export default AudioPlayer;
