import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Crown, Medal, Search, Shield, Swords, ChevronLeft, ChevronRight, Users, Building2, Star } from 'lucide-react';
import { rankingService } from '../services/rankingService';
import PlayerProfileModal from '../components/player/PlayerProfileModal';

const TABS = [
  { id: 'heroes', label: 'Héroes', icon: Swords },
  { id: 'alliances', label: 'Alianzas', icon: Shield },
];

const PAGE_SIZE = 20;

function Rankings({ user }) {
  const [activeTab, setActiveTab] = useState('heroes');
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [profilePlayerId, setProfilePlayerId] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = activeTab === 'heroes'
        ? await rankingService.getHeroes(page, PAGE_SIZE, search)
        : await rankingService.getAlliances(page, PAGE_SIZE, search);

      if (result.success) {
        setData(result.data);
        setTotal(result.total);
        setTotalPages(result.totalPages);
      }
    } catch (err) {
      console.error('Error fetching rankings:', err);
    } finally {
      setLoading(false);
    }
  }, [activeTab, page, search]);

  useEffect(() => {
    setPage(1);
  }, [activeTab, search]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSearch = (e) => {
    e.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  };

  const getRankBadge = (index) => {
    if (index === 0) return <Crown size={18} className="text-yellow-400 drop-shadow-[0_0_6px_rgba(250,204,21,0.6)]" />;
    if (index === 1) return <Medal size={16} className="text-slate-300" />;
    if (index === 2) return <Medal size={16} className="text-amber-700" />;
    return <span className="text-xs text-slate-500 w-5 text-center font-mono">{index + 1}</span>;
  };

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-5">
      <div className="flex items-center gap-3 border-b border-amber-900/30 pb-4">
        <Swords className="text-amber-500" size={28} />
        <div>
          <h1 className="text-2xl font-serif font-bold text-amber-100 tracking-wide">Rankings</h1>
          <p className="text-xs text-slate-400 mt-0.5">Los más poderosos de Valhalla</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-1 bg-slate-900/60 border border-amber-900/30 rounded-lg p-1">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-all ${
                activeTab === tab.id
                  ? 'bg-amber-900/50 text-amber-100 shadow-inner'
                  : 'text-slate-400 hover:text-amber-100 hover:bg-white/5'
              }`}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSearch} className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder={`Buscar ${activeTab === 'heroes' ? 'héroe' : 'alianza'}...`}
              className="w-full sm:w-56 pl-9 pr-3 py-2 bg-slate-900/60 border border-amber-900/30 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-600/50 transition-colors"
            />
          </div>
        </form>
      </div>

      {total > 0 && (
        <p className="text-xs text-slate-500">
          Mostrando <span className="text-amber-400 font-semibold">{data.length}</span> de{' '}
          <span className="text-amber-400 font-semibold">{total}</span> {activeTab === 'heroes' ? 'héroes' : 'alianzas'}
        </p>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-amber-600/50 border-t-amber-400 rounded-full animate-spin" />
        </div>
      ) : data.length === 0 ? (
        <div className="text-center py-20 text-slate-500">
          <Search size={40} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">No se encontraron resultados.</p>
        </div>
      ) : activeTab === 'heroes' ? (
        <div className="space-y-1.5">
          {data.map((hero, index) => (
            <button
              key={hero.id}
              onClick={() => setProfilePlayerId(hero.id)}
              className="w-full flex items-center gap-3 px-4 py-3 bg-slate-900/40 border border-amber-900/20 rounded-lg hover:bg-slate-800/60 hover:border-amber-700/40 transition-all text-left group"
            >
              <div className="flex items-center justify-center w-8 h-8">
                {getRankBadge(index)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-100 truncate group-hover:text-amber-200 transition-colors">
                    {hero.username}
                  </span>
                  <span className="text-[10px] uppercase text-slate-500 bg-slate-800/80 px-1.5 py-0.5 rounded">
                    {hero.race}
                  </span>
                  <span className="text-[10px] uppercase text-slate-500 bg-slate-800/80 px-1.5 py-0.5 rounded">
                    {hero.class_name}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs text-slate-400 shrink-0">
                <span className="flex items-center gap-1">
                  <Star size={12} className="text-amber-500/70" />
                  Nv.{hero.level}
                </span>
                <span className="font-bold text-amber-300 font-mono tabular-nums min-w-[5ch] text-right">
                  {Number(hero.power).toLocaleString('es-ES')}
                </span>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-1.5">
          {data.map((alliance, index) => (
            <Link
              key={alliance.id}
              to={`/alliance/${alliance.id}`}
              className="flex items-center gap-3 px-4 py-3 bg-slate-900/40 border border-amber-900/20 rounded-lg hover:bg-slate-800/60 hover:border-amber-700/40 transition-all group"
            >
              <div className="flex items-center justify-center w-8 h-8">
                {getRankBadge(index)}
              </div>

              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-slate-800 border border-amber-900/30 flex items-center justify-center overflow-hidden shrink-0">
                  {alliance.logo_url ? (
                    <img src={alliance.logo_url} alt="" className="w-full h-full object-cover" onError={e => { e.target.style.display = 'none' }} />
                  ) : (
                    <Shield size={18} className="text-amber-600/50" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-100 truncate group-hover:text-amber-200 transition-colors">
                      {alliance.name}
                    </span>
                    {alliance.tag && (
                      <span className="text-[10px] font-mono text-amber-500/70 bg-amber-900/20 px-1.5 py-0.5 rounded">
                        [{alliance.tag}]
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs text-slate-400 shrink-0">
                <span className="flex items-center gap-1">
                  <Users size={12} />
                  {alliance.members_count}
                </span>
                <span className="flex items-center gap-1">
                  <Building2 size={12} />
                  {alliance.buildings_score}
                </span>
                <span className="font-bold text-amber-300 font-mono tabular-nums min-w-[5ch] text-right">
                  {Number(alliance.total_power).toLocaleString('es-ES')}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="flex items-center gap-1 px-3 py-2 bg-slate-900/60 border border-amber-900/30 rounded-lg text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <ChevronLeft size={14} />
            Anterior
          </button>

          <div className="flex gap-1">
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let pageNum;
              if (totalPages <= 7) {
                pageNum = i + 1;
              } else if (page <= 4) {
                pageNum = i + 1;
              } else if (page >= totalPages - 3) {
                pageNum = totalPages - 6 + i;
              } else {
                pageNum = page - 3 + i;
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                    page === pageNum
                      ? 'bg-amber-900/60 text-amber-100 border border-amber-600/40'
                      : 'bg-slate-900/40 text-slate-400 border border-transparent hover:bg-slate-800/60'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="flex items-center gap-1 px-3 py-2 bg-slate-900/60 border border-amber-900/30 rounded-lg text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            Siguiente
            <ChevronRight size={14} />
          </button>
        </div>
      )}

      <PlayerProfileModal
        playerId={profilePlayerId}
        isOpen={Boolean(profilePlayerId)}
        onClose={() => setProfilePlayerId(null)}
      />
    </div>
  );
}

export default Rankings;
