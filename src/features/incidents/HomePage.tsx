import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  PlusCircle, 
  Map as MapIcon, 
  ListFilter, 
  Search, 
  Filter, 
  AlertCircle,
  Clock,
  MapPin,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  Users
} from 'lucide-react';
import { IncidentMap } from '../../components/map/IncidentMap';
import { HealthScoreCard } from '../health-score/HealthScoreCard';
import { IncidentPreviewSheet } from '../../components/incidents/IncidentPreviewSheet';
import { CategoryBadge, CategoryIcon, StatusBadge, VerificationBadge } from '../../components/ui/CategoryBadge';
import { incidentService } from '../../services/incidentService';
import { useAuth } from '../auth/AuthContext';
import { Community, HealthScoreResult, Incident, IncidentCategory, IncidentStatus } from '../../types';

const CATEGORIES: { id: IncidentCategory | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'water', label: 'Water' },
  { id: 'power', label: 'Power' },
  { id: 'road', label: 'Road' },
  { id: 'safety', label: 'Safety' },
  { id: 'garbage', label: 'Garbage' },
  { id: 'animals', label: 'Animals' },
];

export const HomePage: React.FC = () => {
  const { user } = useAuth();
  const currentCommunity = incidentService.getCurrentCommunity();

  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [healthScore, setHealthScore] = useState<HealthScoreResult>({
    score: 80,
    label: 'Good',
    openVerifiedCount: 2,
    totalVerifiedCount: 3,
    unverifiedOpenCount: 3,
    hasHistory: true,
    message: '',
  });

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const [incidentList, score] = await Promise.all([
        incidentService.getIncidents(currentCommunity.id, {
          category: selectedCategory,
          status: selectedStatus,
          search: searchQuery,
        }),
        incidentService.calculateHealthScore(currentCommunity.id),
      ]);
      setIncidents(incidentList);
      setHealthScore(score);
    } catch (err) {
      console.error('Failed to load incident data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const unsubscribe = incidentService.subscribe(() => {
      loadData();
    });
    return unsubscribe;
  }, [currentCommunity.id, selectedCategory, selectedStatus, searchQuery]);

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-4rem)] max-w-7xl mx-auto w-full px-3 sm:px-6 lg:px-8 py-3 sm:py-4">
      {/* Top Section: Health Score Card & Category Bar */}
      <div className="flex-shrink-0 space-y-3 mb-3">
        {/* Health Score Card */}
        <HealthScoreCard scoreData={healthScore} />

        {/* Category Filter Chips & View Mode Toggle */}
        <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar py-1">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {CATEGORIES.map((cat) => {
              const isActive = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-600/30'
                      : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                  }`}
                >
                  {cat.id !== 'all' && (
                    <CategoryIcon category={cat.id as IncidentCategory} className="w-3.5 h-3.5" />
                  )}
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>

          {/* Map / List Toggle */}
          <div className="flex items-center bg-white border border-slate-200 rounded-xl p-0.5 shadow-2xs flex-shrink-0">
            <button
              onClick={() => setViewMode('map')}
              className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors ${
                viewMode === 'map' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Map View"
              aria-label="Map View"
            >
              <MapIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Map</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors ${
                viewMode === 'list' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="List View"
              aria-label="List View"
            >
              <ListFilter className="w-4 h-4" />
              <span className="hidden sm:inline">List</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Interactive Content Area: Map + Desktop Sidebar */}
      <div className="flex-1 min-h-0 flex gap-4 relative">
        {/* Map Section */}
        <div className={`flex-1 h-full min-h-[350px] relative rounded-2xl overflow-hidden ${viewMode === 'list' ? 'hidden md:block' : 'block'}`}>
          <IncidentMap
            community={currentCommunity}
            incidents={incidents}
            selectedIncident={selectedIncident}
            onSelectIncident={(inc) => setSelectedIncident(inc)}
            userId={user?.id}
            className="w-full h-full"
          />

          {/* Floating Mobile Report Button */}
          <div className="md:hidden absolute bottom-4 right-4 z-20">
            <Link
              to="/report"
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-3 rounded-full shadow-lg shadow-blue-600/40 active:scale-95 transition-all"
            >
              <PlusCircle className="w-5 h-5" />
              <span>Report issue</span>
            </Link>
          </div>
        </div>

        {/* Desktop Incidents Sidebar / Mobile List View */}
        <div
          className={`w-full md:w-96 flex flex-col bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden ${
            viewMode === 'map' ? 'hidden md:flex' : 'flex'
          }`}
        >
          {/* Sidebar Header & Search/Status Filter */}
          <div className="p-3 border-b border-slate-100 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Neighbourhood Incidents ({incidents.length})
              </span>

              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 focus:outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>

            {/* Quick search input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search issues, landmarks..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
            </div>
          </div>

          {/* Incidents Scrollable List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2 space-y-2">
            {incidents.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs px-4">
                <AlertCircle className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="font-semibold text-slate-700">No matching issues</p>
                <p className="mt-1 text-slate-400">
                  Try adjusting category filters or report a new issue if you notice something.
                </p>
                <Link
                  to="/report"
                  className="mt-3 inline-flex items-center gap-1.5 text-blue-600 font-bold hover:underline"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  Report an issue
                </Link>
              </div>
            ) : (
              incidents.map((inc) => {
                const isSelected = selectedIncident?.id === inc.id;
                return (
                  <div
                    key={inc.id}
                    onClick={() => setSelectedIncident(inc)}
                    className={`cursor-pointer p-3 rounded-xl border transition-all ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/50 shadow-2xs'
                        : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50/60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <CategoryBadge category={inc.category} />
                        <StatusBadge status={inc.status} />
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap">
                        {new Date(inc.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </span>
                    </div>

                    <h4 className="text-xs font-bold text-slate-900 line-clamp-1">
                      {inc.title}
                    </h4>
                    <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">
                      {inc.description}
                    </p>

                    <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 pt-1.5 border-t border-slate-100/80">
                      <div className="flex items-center gap-1 truncate max-w-[170px]">
                        <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0" />
                        <span className="truncate">{inc.locationLabel}</span>
                      </div>

                      <div className="flex items-center gap-1 text-blue-600 font-semibold flex-shrink-0">
                        <Users className="w-3 h-3" />
                        <span>{inc.confirmationCount} corroborations</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Selected Incident Bottom Sheet (on mobile or desktop preview) */}
      <IncidentPreviewSheet
        incident={selectedIncident}
        onClose={() => setSelectedIncident(null)}
      />
    </div>
  );
};

