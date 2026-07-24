import React, { useState } from 'react';
import { 
  Home, 
  Sparkles, 
  Search, 
  Users, 
  Building, 
  List, 
  Database, 
  Send, 
  Mail, 
  Phone, 
  CheckSquare, 
  DollarSign, 
  Calendar, 
  MessageSquare, 
  TrendingUp, 
  Workflow, 
  BarChart2, 
  Globe, 
  FileText, 
  Bookmark, 
  UserPlus, 
  Activity, 
  Settings, 
  ChevronDown, 
  ChevronRight,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
  HelpCircle,
  Menu,
  Grid
} from 'lucide-react';

interface ApolloNavigationDrawerProps {
  onShowMessage: (text: string, type: 'success' | 'error') => void;
  onAddLeadClick?: () => void;
  onOpenSupabase?: () => void;
}

export default function ApolloNavigationDrawer({
  onShowMessage,
  onAddLeadClick,
  onOpenSupabase
}: ApolloNavigationDrawerProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeItem, setActiveItem] = useState('Contacts');

  // Accordion state
  const [openSections, setOpenSections] = useState({
    prospect: true,
    engage: true,
    win: false,
    tools: false,
    inbound: false,
    saved: false,
  });

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const handleItemClick = (name: string) => {
    setActiveItem(name);
    if (name === 'Supabase Sync' && onOpenSupabase) {
      onOpenSupabase();
    } else if (name !== 'Contacts') {
      onShowMessage(`"${name}" view is active!`, 'success');
    }
  };

  const renderMenuItem = (name: string, icon: React.ReactNode, hasBadge: boolean = false) => {
    const isActive = activeItem === name;
    
    if (isCollapsed) {
      return (
        <button
          key={name}
          onClick={() => handleItemClick(name)}
          className={`w-10 h-10 mx-auto my-1 flex items-center justify-center rounded-lg transition-all relative group cursor-pointer ${
            isActive 
              ? 'bg-[#2b3a52] text-white shadow-xs font-bold' 
              : 'text-slate-400 hover:bg-[#233044] hover:text-slate-100'
          }`}
          title={name}
        >
          {icon}
          {hasBadge && (
            <span className="absolute top-1 right-1 w-2 h-2 bg-emerald-400 rounded-full" />
          )}
          {/* Tooltip */}
          <div className="absolute left-full ml-2 px-2 py-1 bg-slate-900 text-white text-3xs font-semibold rounded-md opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 whitespace-nowrap z-50 shadow-md">
            {name}
          </div>
        </button>
      );
    }

    return (
      <button
        key={name}
        onClick={() => handleItemClick(name)}
        className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
          isActive 
            ? 'bg-[#2b3a52] text-white font-bold shadow-xs' 
            : 'text-slate-300 hover:bg-[#233044] hover:text-white'
        }`}
      >
        <div className="flex items-center space-x-2.5 min-w-0">
          <span className={isActive ? 'text-white' : 'text-slate-400'}>{icon}</span>
          <span className="truncate">{name}</span>
        </div>
        {hasBadge && (
          <span className="px-1.5 py-0.5 text-3xs font-extrabold bg-emerald-900/60 text-emerald-300 border border-emerald-700/50 rounded-full leading-none shrink-0 scale-90">
            New
          </span>
        )}
      </button>
    );
  };

  return (
    <aside 
      id="apollo-navigation-drawer"
      className={`border-r border-slate-800 bg-[#1c2533] text-slate-300 flex flex-col h-full shrink-0 select-none transition-all duration-300 ${
        isCollapsed ? 'w-16' : 'w-60'
      }`}
    >
      {/* Brand & Toggle Header */}
      <div className="h-14 px-4 border-b border-slate-800/80 flex items-center justify-between">
        {!isCollapsed && (
          <div className="flex items-center space-x-2.5 min-w-0">
            {/* Grid Blue Apollo Logo Icon */}
            <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Grid className="w-4 h-4" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-black text-sm text-white tracking-wider leading-none font-display">APOLLO</span>
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">ENTERPRISE EDITION</span>
            </div>
          </div>
        )}
        
        {isCollapsed && (
          <div className="mx-auto w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <Grid className="w-4 h-4" />
          </div>
        )}

        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={`p-1.5 rounded-lg border border-slate-700/60 hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer ${
            isCollapsed ? 'mx-auto mt-0' : 'ml-2'
          }`}
          title={isCollapsed ? 'Expand Navigation' : 'Collapse Navigation'}
        >
          {isCollapsed ? <ChevronRightIcon className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Main Navigation Items */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-none">
        
        {/* Simple Top row menu */}
        <div className="space-y-0.5">
          {renderMenuItem('Home', <Home className="w-4 h-4" />)}
          {renderMenuItem('AI Assistant', <Sparkles className="w-4 h-4 text-indigo-400" />)}
        </div>

        {/* Accordions */}
        <div className="space-y-2 pt-2 border-t border-slate-800/80">
          
          {/* Prospect and enrich section */}
          <div>
            {!isCollapsed && (
              <button
                onClick={() => toggleSection('prospect')}
                className="w-full flex items-center justify-between py-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-slate-200 transition-colors cursor-pointer px-1"
              >
                <div className="flex items-center space-x-1.5">
                  <span>DISCOVER & ENRICH</span>
                </div>
                {openSections.prospect ? <ChevronDown className="w-3 h-3 text-slate-400" /> : <ChevronRight className="w-3 h-3 text-slate-400" />}
              </button>
            )}
            
            {(openSections.prospect || isCollapsed) && (
              <div className={`space-y-0.5 ${!isCollapsed ? 'mt-1 pl-0.5' : ''}`}>
                {renderMenuItem('Contacts', <Users className="w-4 h-4" />)}
                {renderMenuItem('Organizations', <Building className="w-4 h-4" />)}
                {renderMenuItem('Directories', <List className="w-4 h-4" />)}
                {renderMenuItem('Data Enhancement', <Database className="w-4 h-4" />)}

              </div>
            )}
          </div>

          {/* Engage section */}
          <div>
            {!isCollapsed && (
              <button
                onClick={() => toggleSection('engage')}
                className="w-full flex items-center justify-between py-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-slate-200 transition-colors cursor-pointer px-1"
              >
                <div className="flex items-center space-x-1.5">
                  <span>OUTREACH</span>
                </div>
                {openSections.engage ? <ChevronDown className="w-3 h-3 text-slate-400" /> : <ChevronRight className="w-3 h-3 text-slate-400" />}
              </button>
            )}
            
            {(openSections.engage || isCollapsed) && (
              <div className={`space-y-0.5 ${!isCollapsed ? 'mt-1 pl-0.5' : ''}`}>
                {renderMenuItem('Campaigns', <Send className="w-4 h-4" />)}
                {renderMenuItem('Messages', <Mail className="w-4 h-4" />)}
                {renderMenuItem('Phone Calls', <Phone className="w-4 h-4" />)}
                {renderMenuItem('Action Items', <CheckSquare className="w-4 h-4" />)}
              </div>
            )}
          </div>

          {/* Saved records */}
          <div>
            {!isCollapsed && (
              <button
                onClick={() => toggleSection('saved')}
                className="w-full flex items-center justify-between py-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-slate-200 transition-colors cursor-pointer px-1"
              >
                <div className="flex items-center space-x-1.5">
                  <span>BOOKMARKS</span>
                </div>
                {openSections.saved ? <ChevronDown className="w-3 h-3 text-slate-400" /> : <ChevronRight className="w-3 h-3 text-slate-400" />}
              </button>
            )}
            
            {(openSections.saved || isCollapsed) && (
              <div className={`space-y-0.5 ${!isCollapsed ? 'mt-1 pl-0.5' : ''}`}>
                {renderMenuItem('Saved Contacts', <Bookmark className="w-4 h-4 text-blue-400" />)}
              </div>
            )}
          </div>

        </div>

      </div>

      {/* Footer Navigation Elements */}
      <div className="p-3 border-t border-slate-800 space-y-2 bg-[#171f2d]">
        
        {/* Yellow Add teammates button */}
        {!isCollapsed ? (
          <button
            onClick={() => {
              if (onAddLeadClick) onAddLeadClick();
              onShowMessage('Added quick teammate invitation modal!', 'success');
            }}
            className="w-full bg-amber-400 hover:bg-amber-300 active:bg-amber-500 text-slate-950 font-extrabold rounded-lg text-xs py-2 px-3 flex items-center justify-center space-x-2 shadow-xs transition-colors cursor-pointer"
          >
            <UserPlus className="w-4 h-4 shrink-0" />
            <span className="truncate">+ Add teammates</span>
          </button>
        ) : (
          <button
            onClick={() => onShowMessage('Add teammates clicked!', 'success')}
            className="w-10 h-10 mx-auto flex items-center justify-center bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-lg shadow-xs transition-colors cursor-pointer"
            title="Add teammates"
          >
            <UserPlus className="w-4 h-4" />
          </button>
        )}

        {/* Deliverability */}
        {isCollapsed ? (
          <button
            onClick={() => handleItemClick('Deliverability')}
            className="w-10 h-10 mx-auto flex items-center justify-center rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Deliverability"
          >
            <Activity className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={() => handleItemClick('Deliverability')}
            className="w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white flex items-center space-x-2.5 transition-colors cursor-pointer"
          >
            <Activity className="w-3.5 h-3.5 text-slate-400" />
            <span className="truncate">Deliverability</span>
          </button>
        )}

        {/* Settings */}
        {isCollapsed ? (
          <button
            onClick={() => handleItemClick('Settings')}
            className="w-10 h-10 mx-auto flex items-center justify-center rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={() => handleItemClick('Settings')}
            className="w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white flex items-center justify-between transition-colors cursor-pointer"
          >
            <div className="flex items-center space-x-2.5 min-w-0">
              <Settings className="w-3.5 h-3.5 text-slate-400" />
              <span className="truncate">Settings</span>
            </div>
          </button>
        )}

      </div>
    </aside>
  );
}

// Logo icon
function AsteriskLogo({ className }: { className?: string }) {
  return (
    <svg 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2.5" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <line x1="12" y1="2" x2="12" y2="22" />
      <line x1="17" y1="5" x2="7" y2="19" />
      <line x1="19" y1="12" x2="5" y2="12" />
      <line x1="17" y1="19" x2="7" y2="5" />
    </svg>
  );
}
