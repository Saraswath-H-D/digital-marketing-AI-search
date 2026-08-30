import React from 'react';
import {
  Home,
  Sparkles,
  Users,
  Building,
  List,
  Database,
  Send,
  Mail,
  Phone,
  CheckSquare,
  Bookmark,
  UserPlus,
  Activity,
  Settings
} from 'lucide-react';

interface OperonNavigationDrawerProps {
  activeView: string;
  setActiveView: (view: string) => void;
  onShowMessage: (text: string, type: 'success' | 'error') => void;
  onAddTeammateClick?: () => void;
  onOpenSupabase?: () => void;
  onOpenSectionModal?: (section: string) => void;
  onOpenAIAssistant?: () => void;
  onOpenDataEnhancement?: () => void;
  contactsCount?: number;
}

// Design.md §6: sidebar is a 96px icon-only rail — .sidebar / .sidebar-item in
// index.css already carry the exact spec (48×48, radius 0.875rem, idle #94A3B8,
// hover bg rgba(255,255,255,.6)+#475569, active bg #fff/#6366F1 (dark:
// rgba(99,102,241,.22)/#A5B4FC), tooltip = dark chip to the right on hover).
// Views that already render real content in App.tsx's routing (no popup needed —
// clicking just switches the main content area).
const REAL_VIEWS = new Set(['Contacts', 'Campaigns', 'Messages', 'Phone Calls', 'Action Items', 'Deliverability', 'Settings']);

export default function OperonNavigationDrawer({
  activeView,
  setActiveView,
  onShowMessage,
  onAddTeammateClick,
  onOpenSupabase,
  onOpenSectionModal,
  onOpenAIAssistant,
  onOpenDataEnhancement,
  contactsCount
}: OperonNavigationDrawerProps) {
  const handleItemClick = (name: string) => {
    setActiveView(name);

    if (name === 'Supabase Sync' && onOpenSupabase) {
      onOpenSupabase();
      return;
    }
    if (name === 'AI Assistant') {
      onOpenAIAssistant?.();
      return;
    }
    if (name === 'Data Enhancement') {
      onOpenDataEnhancement?.();
      return;
    }
    if (REAL_VIEWS.has(name)) {
      if (name !== 'Contacts') onShowMessage(`"${name}" view activated!`, 'success');
      return;
    }
    // Home, Organizations, Directories, Bookmarks — no dedicated full-page view yet,
    // so surface a real popup instead of silently falling back to the Contacts table.
    onOpenSectionModal?.(name);
  };

  const renderItem = (name: string, icon: React.ReactNode, badge?: string) => {
    const isActive = activeView === name;
    return (
      <button
        key={name}
        onClick={() => handleItemClick(name)}
        className="flex flex-col items-center gap-1 w-full cursor-pointer"
        title={name}
      >
        <div className={`sidebar-item relative ${isActive ? 'active' : ''}`}>
          {icon}
          {badge && (
            <span className="absolute top-1 right-1 px-1 py-0.2 text-[8px] font-extrabold bg-purple-600 text-white rounded-full leading-none">
              {badge}
            </span>
          )}
        </div>
        {/* Name below each icon */}
        <span
          className={`text-[8.5px] font-bold leading-[1.1] text-center px-0.5 ${
            isActive ? 'text-[#6366F1] dark:text-[#A5B4FC]' : 'text-[var(--text-muted)]'
          }`}
          style={{ maxWidth: '78px' }}
        >
          {name}
        </span>
      </button>
    );
  };

  const divider = <div className="w-8 border-t border-[var(--border-subtle)] my-2" />;

  return (
    <aside id="operon-navigation-drawer" className="sidebar">
      {/* Logo mark — Design.md §6: 44×44 rounded 0.875rem, indigo→purple gradient, sparkle SVG */}
      <div
        className="w-11 h-11 rounded-[0.875rem] bg-[linear-gradient(135deg,#6366F1,#7C3AED)] text-white flex items-center justify-center shrink-0 shadow-sm mb-4"
        title="Operon"
      >
        <Sparkles className="w-5 h-5" />
      </div>

      {/*
        Nav items — icon + name label, grouped by hairline dividers.
        Deliberately NOT overflow-y-auto: mixing overflow-y:auto with overflow-x:visible
        isn't actually possible (the CSS spec computes overflow-x to auto too whenever
        overflow-y isn't visible), which would silently clip the hover tooltips that
        extend past the 96px rail to the right. The icon rail's total height comfortably
        fits the shell's 95vh in practice, so a scroll container isn't needed here.
      */}
      <nav className="flex-1 flex flex-col items-center gap-1.5">
        {renderItem('Home', <Home className="w-5 h-5" />)}
        {renderItem('AI Assistant', <Sparkles className="w-5 h-5" />, 'NEW')}

        {divider}

        {renderItem('Contacts', <Users className="w-5 h-5" />, contactsCount !== undefined ? String(contactsCount) : undefined)}
        {renderItem('Organizations', <Building className="w-5 h-5" />)}
        {renderItem('Directories', <List className="w-5 h-5" />)}
        {renderItem('Data Enhancement', <Database className="w-5 h-5" />, 'PRO')}

        {divider}

        {renderItem('Campaigns', <Send className="w-5 h-5" />, '3')}
        {renderItem('Messages', <Mail className="w-5 h-5" />)}
        {renderItem('Phone Calls', <Phone className="w-5 h-5" />)}
        {renderItem('Action Items', <CheckSquare className="w-5 h-5" />, '12')}

        {divider}

        {renderItem('Bookmarks', <Bookmark className="w-5 h-5" />)}
        {renderItem('Deliverability', <Activity className="w-5 h-5" />)}
        {renderItem('Settings', <Settings className="w-5 h-5" />)}
      </nav>

      {/* Footer — Add Teammates, same icon+label treatment */}
      <button
        onClick={() => {
          if (onAddTeammateClick) onAddTeammateClick();
          else onShowMessage('Teammate Invitation Dialog opened!', 'success');
        }}
        className="flex flex-col items-center gap-1 w-full mt-2 mb-1 cursor-pointer shrink-0"
        title="Add Teammates"
      >
        <div className="w-12 h-12 flex items-center justify-center rounded-[0.875rem] bg-[linear-gradient(135deg,#7C3AED,#4F46E5)] text-white shadow-[0_8px_20px_rgba(124,58,237,0.35)] transition-transform active:scale-95">
          <UserPlus className="w-5 h-5 stroke-[2.5]" />
        </div>
        <span className="text-[8.5px] font-bold leading-[1.1] text-center px-0.5 text-[var(--text-muted)]" style={{ maxWidth: '78px' }}>
          Add Teammates
        </span>
      </button>
    </aside>
  );
}
