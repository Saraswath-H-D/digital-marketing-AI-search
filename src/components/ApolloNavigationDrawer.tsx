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
  activeView: string;
  setActiveView: (view: string) => void;
  onShowMessage: (text: string, type: 'success' | 'error') => void;
  onAddTeammateClick?: () => void;
  onOpenSupabase?: () => void;
}

export default function ApolloNavigationDrawer({
  activeView,
  setActiveView,
  onShowMessage,
  onAddTeammateClick,
  onOpenSupabase
}: ApolloNavigationDrawerProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Accordion state
  const [openSections, setOpenSections] = useState({
    workspace: true,
    discover: true,
    outreach: true,
    management: true,
  });

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const handleItemClick = (name: string) => {
    setActiveView(name);
    if (name === 'Supabase Sync' && onOpenSupabase) {
      onOpenSupabase();
    } else if (name !== 'Contacts') {
      onShowMessage(`"${name}" view activated!`, 'success');
    }
  };

  const renderMenuItem = (name: string, icon: React.ReactNode, badge?: string) => {
    const isActive = activeView === name;
    
    if (isCollapsed) {
      return (
        <button
          key={name}
          onClick={() => handleItemClick(name)}
          className={`w-10 h-10 mx-auto my-1 flex items-center justify-center rounded-xl transition-all relative group cursor-pointer ${
            isActive 
              ? 'bg-purple-400/35 text-purple-100 shadow-md font-bold border-l-4 border-purple-400 ring-1 ring-purple-400/40' 
              : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-100'
          }`}
          title={name}
        >
          {icon}
          {badge && (
            <span className="absolute top-1 right-1 px-1 py-0.2 text-[8px] font-extrabold bg-purple-400 text-slate-950 rounded-full">
              {badge}
            </span>
          )}
          {/* Tooltip */}
          <div className="absolute left-full ml-2 px-2.5 py-1 bg-slate-900 text-white text-3xs font-extrabold rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 whitespace-nowrap z-50 shadow-lg border border-slate-700">
            {name}
          </div>
        </button>
      );
    }

    return (
      <button
        key={name}
        onClick={() => handleItemClick(name)}
        className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-all cursor-pointer ${
          isActive 
            ? 'bg-purple-400/35 text-purple-100 font-black shadow-md border-l-4 border-purple-400 ring-1 ring-purple-400/40' 
            : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
        }`}
      >
        <div className="flex items-center space-x-2.5 min-w-0">
          <span className={isActive ? 'text-purple-300 drop-shadow-xs font-bold' : 'text-slate-400'}>{icon}</span>
          <span className="truncate">{name}</span>
        </div>
        {badge && (
          <span className={`px-2 py-0.5 text-[9px] font-extrabold rounded-full leading-none shrink-0 ${
            badge === 'NEW' 
              ? 'bg-purple-400 text-slate-950 font-black shadow-2xs' 
              : isActive 
                ? 'bg-purple-300/40 text-purple-100 border border-purple-300/50' 
                : 'bg-indigo-900/80 text-indigo-200 border border-indigo-700/60'
          }`}>
            {badge}
          </span>
        )}
      </button>
    );
  };

  return (
    <aside 
      id="apollo-navigation-drawer"
      className={`border-r border-purple-900/60 bg-[#240a34] text-purple-100 flex flex-col h-full shrink-0 select-none transition-all duration-300 ${
        isCollapsed ? 'w-16' : 'w-60'
      }`}
    >
      {/* Brand & Toggle Header - Professional Deep Purple */}
      <div className="h-16 px-4 border-b border-purple-900/60 flex items-center justify-between bg-purple-950/70">
        {!isCollapsed && (
          <div className="flex items-center space-x-2.5 min-w-0">
            {/* Bright Gradient Brand Icon */}
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-500 via-indigo-500 to-pink-400 text-white flex items-center justify-center shrink-0 shadow-lg shadow-purple-950/80 ring-2 ring-purple-400/30">
              <Grid className="w-4 h-4" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-black text-sm text-white tracking-widest leading-none font-display">APOLLO</span>
              <span className="text-[9px] text-purple-300 font-extrabold uppercase tracking-wider mt-1">Lead Intelligence Platform</span>
            </div>
          </div>
        )}
        
        {isCollapsed && (
          <div className="mx-auto w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-500 via-indigo-500 to-pink-400 text-white flex items-center justify-center shrink-0 shadow-lg shadow-purple-950/80">
            <Grid className="w-4 h-4" />
          </div>
        )}

        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={`p-1.5 rounded-lg border border-purple-800/60 hover:bg-purple-900/60 text-purple-300 hover:text-white cursor-pointer ${
            isCollapsed ? 'mx-auto mt-0' : 'ml-2'
          }`}
          title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {isCollapsed ? <ChevronRightIcon className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Main Navigation Items */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4 scrollbar-none">
        
        {/* Workspace section */}
        <div>
          {!isCollapsed && (
            <button
              onClick={() => toggleSection('workspace')}
              className="w-full flex items-center justify-between py-1 px-1.5 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest hover:text-slate-200 transition-colors cursor-pointer"
            >
              <span>WORKSPACE</span>
              {openSections.workspace ? <ChevronDown className="w-3 h-3 text-slate-400" /> : <ChevronRight className="w-3 h-3 text-slate-400" />}
            </button>
          )}
          
          {(openSections.workspace || isCollapsed) && (
            <div className={`space-y-1 ${!isCollapsed ? 'mt-1' : ''}`}>
              {renderMenuItem('Home', <Home className="w-4 h-4 text-cyan-400" />)}
              {renderMenuItem('AI Assistant', <Sparkles className="w-4 h-4 text-purple-400" />, 'NEW')}
            </div>
          )}
        </div>

        {/* Discover & Enrich section */}
        <div className="pt-2 border-t border-slate-800/60">
          {!isCollapsed && (
            <button
              onClick={() => toggleSection('discover')}
              className="w-full flex items-center justify-between py-1 px-1.5 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest hover:text-slate-200 transition-colors cursor-pointer"
            >
              <span>DISCOVER & ENRICH</span>
              {openSections.discover ? <ChevronDown className="w-3 h-3 text-slate-400" /> : <ChevronRight className="w-3 h-3 text-slate-400" />}
            </button>
          )}
          
          {(openSections.discover || isCollapsed) && (
            <div className={`space-y-1 ${!isCollapsed ? 'mt-1' : ''}`}>
              {renderMenuItem('Contacts', <Users className="w-4 h-4 text-indigo-400" />, '12k')}
              {renderMenuItem('Organizations', <Building className="w-4 h-4 text-emerald-400" />)}
              {renderMenuItem('Directories', <List className="w-4 h-4 text-amber-400" />)}
              {renderMenuItem('Data Enhancement', <Database className="w-4 h-4 text-blue-400" />, 'PRO')}
            </div>
          )}
        </div>

        {/* Outreach section */}
        <div className="pt-2 border-t border-slate-800/60">
          {!isCollapsed && (
            <button
              onClick={() => toggleSection('outreach')}
              className="w-full flex items-center justify-between py-1 px-1.5 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest hover:text-slate-200 transition-colors cursor-pointer"
            >
              <span>OUTREACH</span>
              {openSections.outreach ? <ChevronDown className="w-3 h-3 text-slate-400" /> : <ChevronRight className="w-3 h-3 text-slate-400" />}
            </button>
          )}
          
          {(openSections.outreach || isCollapsed) && (
            <div className={`space-y-1 ${!isCollapsed ? 'mt-1' : ''}`}>
              {renderMenuItem('Campaigns', <Send className="w-4 h-4 text-purple-400" />, '3')}
              {renderMenuItem('Messages', <Mail className="w-4 h-4 text-blue-400" />)}
              {renderMenuItem('Phone Calls', <Phone className="w-4 h-4 text-emerald-400" />)}
              {renderMenuItem('Action Items', <CheckSquare className="w-4 h-4 text-rose-400" />, '12')}
            </div>
          )}
        </div>

        {/* Management section */}
        <div className="pt-2 border-t border-slate-800/60">
          {!isCollapsed && (
            <button
              onClick={() => toggleSection('management')}
              className="w-full flex items-center justify-between py-1 px-1.5 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest hover:text-slate-200 transition-colors cursor-pointer"
            >
              <span>MANAGEMENT</span>
              {openSections.management ? <ChevronDown className="w-3 h-3 text-slate-400" /> : <ChevronRight className="w-3 h-3 text-slate-400" />}
            </button>
          )}
          
          {(openSections.management || isCollapsed) && (
            <div className={`space-y-1 ${!isCollapsed ? 'mt-1' : ''}`}>
              {renderMenuItem('Bookmarks', <Bookmark className="w-4 h-4 text-amber-400" />)}
              {renderMenuItem('Deliverability', <Activity className="w-4 h-4 text-emerald-400" />)}
              {renderMenuItem('Settings', <Settings className="w-4 h-4 text-slate-400" />)}
            </div>
          )}
        </div>

      </div>

      {/* Footer Navigation & Teammates Button */}
      <div className="p-3 border-t border-slate-800 space-y-2 bg-slate-950/60">
        
        {/* Bright Gradient + Add Teammates Button */}
        {!isCollapsed ? (
          <button
            onClick={() => {
              if (onAddTeammateClick) onAddTeammateClick();
              else onShowMessage('Teammate Invitation Dialog opened!', 'success');
            }}
            className="w-full bg-gradient-to-r from-amber-400 via-orange-400 to-pink-500 hover:from-amber-300 hover:to-pink-400 active:scale-95 text-slate-950 font-black rounded-xl text-xs py-2.5 px-3 flex items-center justify-center space-x-2 shadow-lg shadow-orange-950/40 transition-all cursor-pointer border border-amber-300/30"
          >
            <UserPlus className="w-4 h-4 shrink-0 stroke-[2.5]" />
            <span className="truncate">+ Add Teammates</span>
          </button>
        ) : (
          <button
            onClick={() => {
              if (onAddTeammateClick) onAddTeammateClick();
              else onShowMessage('Add teammates clicked!', 'success');
            }}
            className="w-10 h-10 mx-auto flex items-center justify-center bg-gradient-to-r from-amber-400 to-pink-500 text-slate-950 rounded-xl shadow-lg transition-transform active:scale-95 cursor-pointer"
            title="Add Teammates"
          >
            <UserPlus className="w-4 h-4 stroke-[2.5]" />
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
