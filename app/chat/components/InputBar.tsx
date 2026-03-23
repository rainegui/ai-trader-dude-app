'use client';

import { useState, useRef, useCallback } from 'react';

// Vercel serverless body limit is ~4.5MB; base64 adds ~33% overhead.
// 3MB raw → ~4MB base64 keeps us safely within limits.
// For larger files, a presigned-upload flow would be needed.
const MAX_FILE_SIZE = 3 * 1024 * 1024; // 3MB (safe for Vercel serverless)
const ACCEPTED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
];

export interface FileAttachment {
  name: string;
  mimeType: string;
  size: number;
  base64Data: string;
  previewUrl: string | null; // object URL for image thumbnails
}

interface InputBarProps {
  onSend: (message: string, file?: FileAttachment) => void;
  disabled: boolean;
}

export default function InputBar({ onSend, disabled }: InputBarProps) {
  const [input, setInput] = useState('');
  const [attachment, setAttachment] = useState<FileAttachment | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if ((!trimmed && !attachment) || disabled) return;
    onSend(trimmed, attachment || undefined);
    setInput('');
    setAttachment(null);
    setFileError(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [input, attachment, disabled, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
  };

  const processFile = useCallback(async (file: File) => {
    setFileError(null);

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setFileError('Unsupported file type. Use JPEG, PNG, GIF, WebP, or PDF.');
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setFileError('File too large. Maximum size is 3MB.');
      return;
    }

    // Read as base64
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip the data:...;base64, prefix
      const base64Data = result.split(',')[1];

      // Create preview URL for images
      const isImage = file.type.startsWith('image/');
      const previewUrl = isImage ? URL.createObjectURL(file) : null;

      setAttachment({
        name: file.name,
        mimeType: file.type,
        size: file.size,
        base64Data,
        previewUrl,
      });
    };
    reader.readAsDataURL(file);
  }, []);

  const removeAttachment = useCallback(() => {
    if (attachment?.previewUrl) {
      URL.revokeObjectURL(attachment.previewUrl);
    }
    setAttachment(null);
    setFileError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [attachment]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="border-t border-border bg-white px-4 py-3 pb-[env(safe-area-inset-bottom,12px)]">
      <div className="max-w-2xl mx-auto">
        {/* File preview chip */}
        {attachment && (
          <div className="mb-2 inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[#e8e2e5] bg-white">
            {/* Thumbnail or file icon */}
            {attachment.previewUrl ? (
              <img
                src={attachment.previewUrl}
                alt={attachment.name}
                className="w-10 h-10 rounded object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded bg-plum-light flex items-center justify-center flex-shrink-0">
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
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-text truncate max-w-[200px]">
                {attachment.name}
              </p>
              <p className="text-[11px] text-muted">
                {formatFileSize(attachment.size)}
              </p>
            </div>
            {/* Remove button */}
            <button
              onClick={removeAttachment}
              className="w-5 h-5 rounded-full flex items-center justify-center hover:bg-bg transition-colors flex-shrink-0"
              aria-label="Remove file"
            >
              <svg
                className="w-3.5 h-3.5 text-muted"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        )}

        {/* File error */}
        {fileError && (
          <p className="text-xs text-red-500 mb-2">{fileError}</p>
        )}

        {/* Input row */}
        <div className="flex items-end gap-2">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_TYPES.join(',')}
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Paperclip button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || !!attachment}
            className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center hover:bg-bg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Attach file"
            title="Attach image or PDF"
          >
            <svg
              className="w-5 h-5 text-[#9a8a9e]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13"
              />
            </svg>
          </button>

          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={attachment ? 'Add a message (optional)...' : 'Ask ATD anything...'}
            disabled={disabled}
            rows={1}
            className="flex-1 resize-none rounded-xl border border-border bg-bg px-4 py-2.5 text-sm text-text placeholder:text-muted focus:outline-none focus:border-input-focus focus:ring-2 focus:ring-input-focus/20 transition-colors disabled:opacity-50"
            style={{ maxHeight: '120px' }}
          />
          <button
            onClick={handleSend}
            disabled={disabled || (!input.trim() && !attachment)}
            className="flex-shrink-0 w-10 h-10 rounded-xl bg-plum text-white flex items-center justify-center hover:bg-plum-deep transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Send message"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
