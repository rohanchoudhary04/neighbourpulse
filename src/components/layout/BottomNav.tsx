import React from 'react';
import { NavLink } from 'react-router-dom';
import { Map, PlusCircle, FileText, Bell } from 'lucide-react';

export const BottomNav: React.FC = () => {
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-lg border-t border-slate-200 z-30 pb-[env(safe-area-inset-bottom)]">
      <div className="grid grid-cols-3 h-16 items-center px-4">
        {/* Map Tab */}
        <NavLink
          to="/"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center gap-1 transition-colors ${isActive ? 'text-blue-600 font-bold' : 'text-slate-500 hover:text-slate-700'}`
          }
        >
          <Map className="w-5 h-5" />
          <span className="text-[11px]">Map</span>
        </NavLink>

        {/* Floating Report Button */}
        <NavLink
          to="/report"
          className="flex flex-col items-center justify-center -mt-5"
        >
          <div className="w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shadow-lg shadow-blue-600/30 active:scale-95 transition-transform">
            <PlusCircle className="w-6 h-6" />
          </div>
          <span className="text-[11px] font-semibold text-blue-600 mt-1">Report</span>
        </NavLink>

        {/* My Reports Tab */}
        <NavLink
          to="/my-reports"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center gap-1 transition-colors ${isActive ? 'text-blue-600 font-bold' : 'text-slate-500 hover:text-slate-700'}`
          }
        >
          <FileText className="w-5 h-5" />
          <span className="text-[11px]">My Reports</span>
        </NavLink>
      </div>
    </nav>
  );
};

