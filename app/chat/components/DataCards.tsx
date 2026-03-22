'use client';

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

interface ConversationListProps {
  conversations: Array<{
    id: string;
    title: string;
    updated_at: string;
  }>;
  currentId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
}

export function ConversationList({
  conversations,
  currentId,
  onSelect,
  onNew,
}: ConversationListProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="p-3">
        <button
          onClick={onNew}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm text-plum-deep hover:bg-plum-light/30 transition-colors"
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

      <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1">
        {conversations.map((conv) => (
          <button
            key={conv.id}
            onClick={() => onSelect(conv.id)}
            className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${
              currentId === conv.id
                ? 'bg-plum-light text-plum-deep font-medium'
                : 'text-text hover:bg-bg'
            }`}
          >
            <p className="truncate">{conv.title}</p>
            <p className="text-xs text-muted mt-0.5">
              {formatDate(conv.updated_at)}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
    });
  } catch {
    return '';
  }
}
