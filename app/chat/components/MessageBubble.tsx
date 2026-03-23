'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ReportInfo {
  title: string;
  url: string;
  format: string;
  expires: string;
}

interface MessageBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
  fileAttached?: {
    name: string;
    type: string;
  };
  report?: ReportInfo;
}

function ReportCard({ report }: { report: ReportInfo }) {
  const isExpired = report.expires
    ? new Date(report.expires).getTime() < Date.now()
    : false;

  return (
    <div className="mt-3 rounded-xl border border-plum/20 bg-plum-light/40 px-4 py-3">
      <div className="flex items-center gap-2.5">
        <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-plum/10 flex items-center justify-center">
          <svg
            className="w-5 h-5 text-plum"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
            />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-plum-deep truncate">
            {report.title}
          </p>
          {isExpired ? (
            <p className="text-xs text-muted mt-0.5">
              Report expired — ask ATD to regenerate
            </p>
          ) : (
            <a
              href={report.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 mt-1.5 px-3 py-1.5 rounded-lg bg-plum text-white text-xs font-medium hover:bg-plum-deep transition-colors"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
                />
              </svg>
              Download Report
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MessageBubble({
  role,
  content,
  isStreaming,
  fileAttached,
  report,
}: MessageBubbleProps) {
  const isUser = role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div
        className={`max-w-[90%] md:max-w-[85%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-plum-light text-text rounded-br-md'
            : 'bg-white border-l-3 border-plum text-text rounded-bl-md shadow-sm'
        }`}
      >
        {/* File attachment indicator */}
        {fileAttached && (
          <div className="flex items-center gap-2 mb-2 px-2 py-1.5 rounded-md bg-bg/60 border border-border/50">
            {fileAttached.type.startsWith('image/') ? (
              <svg
                className="w-4 h-4 text-plum flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.41a2.25 2.25 0 013.182 0l2.909 2.91m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
                />
              </svg>
            ) : (
              <svg
                className="w-4 h-4 text-plum flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                />
              </svg>
            )}
            <span className="text-xs text-muted truncate">
              {fileAttached.name}
            </span>
          </div>
        )}

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

        {/* Report download card */}
        {report && !isUser && <ReportCard report={report} />}
      </div>
    </div>
  );
}
