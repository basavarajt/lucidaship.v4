import React, { useEffect, useState } from 'react';
import { Loader } from 'lucide-react';

export default function ProgressBar({ isActive, label, estimatedTime = 30 }) {
  const [progress, setProgress] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    if (!isActive) {
      setProgress(0);
      setElapsedTime(0);
      return;
    }

    const startTime = Date.now();
    const estimatedMs = estimatedTime * 1000;

    const progressInterval = setInterval(() => {
      const now = Date.now();
      const elapsed = (now - startTime) / 1000;
      setElapsedTime(elapsed);

      // Simulate progress with easing (slower at the end)
      let newProgress = Math.min(90, (elapsed / estimatedTime) * 100);
      newProgress = Math.pow(newProgress, 1.1); // Ease curve
      setProgress(newProgress);
    }, 100);

    return () => clearInterval(progressInterval);
  }, [isActive, estimatedTime]);

  if (!isActive) return null;

  const minutes = Math.floor(elapsedTime / 60);
  const seconds = Math.floor(elapsedTime % 60);
  const timeString = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

  return (
    <div className="space-y-3 mb-6 p-6 border border-accent/30 bg-accent/5 rounded-lg fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Loader className="w-4 h-4 text-accent animate-spin" />
          <span className="font-mono text-[0.7rem] tracking-[0.2em] uppercase text-accent">
            {label}
          </span>
        </div>
        <div className="text-right">
          <div className="font-mono text-[0.65rem] tracking-[0.15em] uppercase text-dim">
            {Math.round(progress)}%
          </div>
          <div className="font-mono text-[0.55rem] tracking-[0.1em] text-light">
            {timeString}
          </div>
        </div>
      </div>

      <div className="w-full h-2 bg-line rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-accent via-cyan-400 to-accent transition-all duration-200"
          style={{
            width: `${Math.min(progress, 100)}%`,
          }}
        ></div>
      </div>

      <div className="flex justify-between items-center">
        <span className="font-mono text-[0.5rem] tracking-[0.1em] text-dim">
          Processing...
        </span>
        <span className="font-mono text-[0.5rem] tracking-[0.1em] text-dim">
          Est. {estimatedTime}s remaining
        </span>
      </div>
    </div>
  );
}
