'use client';

import { useState, useRef, useCallback } from 'react';

interface RegimeBadgeProps {
  regime: string | null;
}

export function RegimeBadge({ regime }: RegimeBadgeProps) {
  if (!regime) return null;

  try {
    const data = JSON.parse(regime);
    const label = data.regime || data.current_regime || 'Unknown';
    const confidence = data.confidence;

    // Colour based on regime type
    const colours: Record<string, string> = {
      'risk-on': 'bg-green-100 text-green-800 border-green-200',
      'risk-off': 'bg-red-100 text-red-800 border-red-200',
      transitional: 'bg-amber-100 text-amber-800 border-amber-200',
      neutral: 'bg-gray-100 text-gray-800 border-gray-200',
    };

    const colourClass =
      colours[label.toLowerCase()] ||
      'bg-plum-light text-plum border-plum/20';

    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${colourClass}`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
        {label}
        {confidence && (
          <span className="opacity-60">({confidence}%)</span>
        )}
      </span>
    );
  } catch {
    return null;
  }
}

export interface ConversationEntry {
  id: string;
  title: string;
  updated_at: string;
  last_message_preview?: string | null;
}

interface ConversationListProps {
  conversations: ConversationEntry[];
  currentId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}

export function ConversationList({
  conversations,
  currentId,
  onSelect,
  onNew,
  onDelete,
}: ConversationListProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="p-3">
        <button
          onClick={onNew}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-plum-deep text-white text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 4.5v15m7.5-7.5h-15"
            />
          </svg>
          New conversation
        </button>
      </div>

      <div className="flex-1 overflow-y-auto chat-scroll px-2 pb-3 space-y-0.5">
        {conversations.length === 0 && (
          <p className="text-xs text-muted text-center px-3 py-6">
            No conversations yet
          </p>
        )}
        {conversations.map((conv) => (
          <ConversationItem
            key={conv.id}
            conversation={conv}
            isActive={currentId === conv.id}
            onSelect={onSelect}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  );
}

interface ConversationItemProps {
  conversation: ConversationEntry;
  isActive: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

function ConversationItem({
  conversation,
  isActive,
  onSelect,
  onDelete,
}: ConversationItemProps) {
  const [showDelete, setShowDelete] = useState(false);
  const [swipeX, setSwipeX] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const isSwiping = useRef(false);

  const handleDeleteClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (confirmDelete) {
        onDelete(conversation.id);
        setConfirmDelete(false);
        setShowDelete(false);
      } else {
        setConfirmDelete(true);
      }
    },
    [confirmDelete, conversation.id, onDelete]
  );

  // Mobile swipe handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    isSwiping.current = false;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const deltaX = e.touches[0].clientX - touchStartX.current;
    const deltaY = e.touches[0].clientY - touchStartY.current;

    // Only treat as swipe if horizontal movement dominates
    if (!isSwiping.current && Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
      isSwiping.current = true;
    }

    if (isSwiping.current && deltaX < 0) {
      setSwipeX(Math.max(deltaX, -80));
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (swipeX < -40) {
      // Snap to reveal delete
      setSwipeX(-72);
    } else {
      setSwipeX(0);
    }
    isSwiping.current = false;
  }, [swipeX]);

  const displayTitle = conversation.title || 'New conversation';
  const preview = conversation.last_message_preview;

  return (
    <div
      className="relative overflow-hidden rounded-lg group"
      onMouseEnter={() => setShowDelete(true)}
      onMouseLeave={() => {
        setShowDelete(false);
        setConfirmDelete(false);
      }}
    >
      {/* Delete button revealed by swipe (mobile) */}
      <div className="absolute right-0 top-0 bottom-0 w-[72px] flex items-center justify-center md:hidden">
        <button
          onClick={handleDeleteClick}
          className="w-full h-full flex items-center justify-center bg-red-500 text-white text-xs font-medium"
        >
          {confirmDelete ? 'Confirm?' : 'Delete'}
        </button>
      </div>

      {/* Main conversation button */}
      <button
        onClick={() => {
          if (!isSwiping.current && swipeX === 0) onSelect(conversation.id);
          if (swipeX !== 0) {
            setSwipeX(0);
            setConfirmDelete(false);
          }
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all relative ${
          isActive
            ? 'bg-plum-light text-plum-deep'
            : 'text-text hover:bg-bg'
        }`}
        style={{
          transform: `translateX(${swipeX}px)`,
          transition: isSwiping.current ? 'none' : 'transform 0.2s ease-out',
        }}
      >
        <div className="flex items-start justify-between gap-2">
          <p className={`truncate flex-1 ${isActive ? 'font-medium' : ''}`}>
            {displayTitle}
          </p>
          <span className="text-[11px] text-muted whitespace-nowrap mt-0.5 flex-shrink-0">
            {formatRelativeTime(conversation.updated_at)}
          </span>
        </div>
        {preview && (
          <p className="text-xs text-muted mt-0.5 truncate">{preview}</p>
        )}

        {/* Desktop delete button (hover) */}
        {showDelete && !isActive && (
          <button
            onClick={handleDeleteClick}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-md flex items-center justify-center hover:bg-red-100 transition-colors hidden md:flex"
            title={confirmDelete ? 'Click again to confirm' : 'Delete conversation'}
          >
            {confirmDelete ? (
              <span className="text-[10px] text-red-600 font-medium">?</span>
            ) : (
              <svg
                className="w-3.5 h-3.5 text-muted hover:text-red-500"
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
            )}
          </button>
        )}
      </button>
    </div>
  );
}

function formatRelativeTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
    });
  } catch {
    return '';
  }
}
