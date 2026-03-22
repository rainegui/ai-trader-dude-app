'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MessageBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
}

export default function MessageBubble({
  role,
  content,
  isStreaming,
}: MessageBubbleProps) {
  const isUser = role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div
        className={`max-w-[85%] md:max-w-[75%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-plum-light text-text rounded-br-md'
            : 'bg-white border-l-3 border-plum text-text rounded-bl-md shadow-sm'
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {content}
          </p>
        ) : (
          <div className="markdown-content text-sm leading-relaxed">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
            {isStreaming && (
              <span className="inline-flex gap-1 ml-1 align-baseline">
                <span className="typing-dot w-1.5 h-1.5 rounded-full bg-plum inline-block" />
                <span className="typing-dot w-1.5 h-1.5 rounded-full bg-plum inline-block" />
                <span className="typing-dot w-1.5 h-1.5 rounded-full bg-plum inline-block" />
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
