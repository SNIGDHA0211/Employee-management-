import React from 'react';

export type AITool = 'chatgpt' | 'gemini';

const TOOL_META: Record<AITool, { label: string; url: string }> = {
  // Use canonical URLs to avoid unexpected redirects inside iframes.
  chatgpt: { label: 'ChatGPT', url: 'https://chatgpt.com/' },
  gemini: { label: 'Gemini', url: 'https://gemini.google.com/app' }
};

interface AISidePanelProps {
  tool: AITool;
  onClose: () => void;
}

const AISidePanel: React.FC<AISidePanelProps> = ({ tool, onClose }) => {
  const meta = TOOL_META[tool];

  return (
    <aside className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-200 bg-slate-50">
        <div className="min-w-0">
          <div className="text-xs font-black uppercase tracking-widest text-slate-500">
            AI Assistant
          </div>
          <div className="font-black text-slate-900 truncate">{meta.label}</div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              window.open(meta.url, '_blank', 'noopener,noreferrer');
              onClose();
            }}
            className="text-xs font-bold text-blue-600 hover:text-blue-700 underline underline-offset-2"
            title={`Open ${meta.label} in a new tab`}
          >
            Open in new tab
          </button>
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center w-9 h-9 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
            aria-label="Close AI panel"
            title="Close"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="px-4 py-2 text-[11px] text-slate-500 border-b border-slate-200 bg-white">
        Some AI sites block iframe embedding for security. If you see a blank/blocked view, use{' '}
        <span className="font-semibold">Open in new tab</span>.
      </div>

      <div className="h-[70vh] min-h-[480px] bg-slate-100">
        <iframe
          key={tool} // Force remount when switching between tools so we don't "stick" on the previous iframe.
          title={meta.label}
          src={meta.url}
          className="w-full h-full"
          loading="lazy"
          referrerPolicy="no-referrer"
          // Note: many third-party sites will still refuse iframe embedding via X-Frame-Options/CSP.
          sandbox="allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"
          allow="clipboard-read; clipboard-write"
        />
      </div>
    </aside>
  );
};

export default AISidePanel;

