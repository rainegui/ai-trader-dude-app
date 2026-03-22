'use client';

import { useEffect, useState } from 'react';

interface ThinkingIndicatorProps {
  /** Override the default "ATD is thinking..." text */
  statusText?: string;
}

export default function ThinkingIndicator({ statusText }: ThinkingIndicatorProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const text =
    statusText ||
    (elapsed >= 5
      ? 'Still thinking — this one\u2019s taking a moment...'
      : 'ATD is thinking...');

  return (
    <div className="flex justify-start mb-4">
      <div className="max-w-[85%] md:max-w-[75%] rounded-2xl px-4 py-3 bg-white border-l-3 border-plum rounded-bl-md shadow-sm">
        <div className="flex items-center gap-2">
          <span className="thinking-dots inline-flex gap-1">
            <span className="thinking-dot w-1.5 h-1.5 rounded-full bg-plum/40 inline-block" />
            <span className="thinking-dot w-1.5 h-1.5 rounded-full bg-plum/40 inline-block" />
            <span className="thinking-dot w-1.5 h-1.5 rounded-full bg-plum/40 inline-block" />
          </span>
          <span className="text-sm text-[#9a8a9e] select-none">{text}</span>
        </div>
      </div>
    </div>
  );
}
