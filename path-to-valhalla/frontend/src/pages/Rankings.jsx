import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Crown, Medal, Search, Shield, Swords, ChevronLeft, ChevronRight, Users, Building2, Star, Trophy, X, AlertTriangle } from 'lucide-react';
import { rankingService } from '../services/rankingService';
import PlayerProfileModal from '../components/player/PlayerProfileModal';

const TABS = [
  { id: 'heroes', label: 'Héroes', icon: Swords },
  { id: 'alliances', label: 'Alianzas', icon: Shield },
];

const RACE_FILTERS = [
  { value: '', label: 'General' },
  { value: 'human', label: 'Humanos' },
  { value: 'elf', label: 'Elfos' },
  { value: 'dwarf', label: 'Enanos' },
  { value: 'goblin', label: 'Goblins' },
  { value: 'orc', label: 'Orcos' },
  { value: 'feline', label: 'Felinos' },
];

const RACE_TRANSLATION = {
  human: 'Humano',
  elf: 'Elfo',
  dwarf: 'Enano',
  goblin: 'Goblin',
  orc: 'Orco',
  feline: 'Felino',
};

const PAGE_SIZE = 20;

const TOP_CLASSES = [
  'border-yellow-500/50 bg-gradient-to-r from-yellow-900/20 to-transparent shadow-[0_0_15px_rgba(234,179,8,0.08)]',
  'border-slate-300/30 bg-gradient-to-r from-slate-700/20 to-transparent shadow-[0_0_10px_rgba(148,163,184,0.05)]',
  'border-amber-700/40 bg-gradient-to-r from-amber-800/20 to-transparent shadow-[0_0_10px_rgba(180,83,9,0.05)]',
];

function getInitials(name) {
  if (!name) return '?';
  return name.charAt(0).toUpperCase();
}

const formatPower = (value) => Number(value || 0).toLocaleString('es-ES');

function formatRace(race) {
  if (!race) return '';
  const lower = race.toLowerCase();
  return RACE_TRANSLATION[lower] || race;
}

function Rankings({ user }) {
  const [activeTab, setActiveTab] = useState('heroes');
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [heroRaceFilter, setHeroRaceFilter] = useState('');
  const [profilePlayerId, setProfilePlayerId] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const opts = { page, limit: PAGE_SIZE, search };
      const result = activeTab === 'heroes'
        ? await rankingService.getHeroes({ ...opts, race: heroRaceFilter })
        : await rankingService.getAlliances(opts);

      if (result.success) {
        setData(result.data);
        setTotal(result.total);
        setTotalPages(result.totalPages);
      } else {
        setFetchError(result.message || 'Error al cargar el ranking.');
        setData([]);
      }
    } catch (err) {
      console.error('Error fetching rankings:', err);
      setFetchError('No se pudo cargar el ranking.');
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab, page, search, heroRaceFilter]);

  useEffect(() => {
    setPage(1);
  }, [activeTab, search, heroRaceFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSearch = (e) => {
    e.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  };

  const clearSearch = () => {
    setSearchInput('');
    setSearch('');
    setPage(1);
  };

  const handleRaceFilter = (race) => {
    setHeroRaceFilter(race);
    setPage(1);
  };

  const getRankBadge = (index) => {
    if (index === 0) return <Crown size={20} className="text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.7)]" />;
    if (index === 1) return <Medal size={18} className="text-slate-300 drop-shadow-[0_0_4px_rgba(148,163,184,0.4)]" />;
    if (index === 2) return <Medal size={18} className="text-amber-700 drop-shadow-[0_0_4px_rgba(180,83,9,0.4)]" />;
    return (
      <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold font-mono ${
        index < 9 ? 'bg-slate-800/80 text-slate-400 border border-slate-700/50' : 'text-slate-600'
      }`}>
        {index + 1}
      </span>
    );
  };

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 relative">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-amber-900/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-amber-800/5 rounded-full blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(120,53,15,0.06),transparent_70%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,rgba(15,23,42,0.4),transparent_60%)]" />
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-amber-700/20 to-transparent" />
      </div>

      <div className="relative bg-gradient-to-b from-slate-900/60 to-slate-950/40 border border-amber-900/30 rounded-xl overflow-hidden backdrop-blur-[1px]">
        {/* Header */}
        <div className="relative border-b border-amber-900/30 bg-gradient-to-r from-amber-900/10 via-transparent to-amber-900/5 px-6 py-5">
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-amber-700/50 to-transparent" />
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-900/60 to-amber-950/60 border border-amber-700/40 flex items-center justify-center shadow-lg shrink-0">
              <Trophy size={24} className="text-amber-400 drop-shadow-[0_0_6px_rgba(245,158,11,0.5)]" />
            </div>
            <div>
              <h1 className="text-2xl font-serif font-bold text-amber-100 tracking-wide">Rankings</h1>
              <p className="text-xs text-slate-400 mt-0.5">Los héroes y alianzas más poderosos de Valhallus.</p>
            </div>
          </div>
        </div>

        {/* Tabs + Search */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between px-6 py-4 border-b border-amber-900/20">
          <div className="flex gap-1 bg-slate-900/60 border border-amber-900/30 rounded-lg p-1">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-all ${
                  activeTab === tab.id
                    ? 'bg-amber-900/60 text-amber-100 shadow-[inset_0_1px_0_rgba(245,158,11,0.15)]'
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
                className="w-full sm:w-56 pl-9 pr-8 py-2 bg-slate-900/60 border border-amber-900/30 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-600/50 transition-colors"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => setSearchInput('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            {search && (
              <button
                type="button"
                onClick={clearSearch}
                className="px-3 py-2 bg-slate-800/60 border border-amber-900/30 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:border-amber-700/40 transition-all"
              >
                Limpiar
              </button>
            )}
          </form>
        </div>

        {/* Race filters (heroes only) */}
        {activeTab === 'heroes' && (
          <div className="px-6 pt-4 pb-1 border-b border-amber-900/20">
            <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-amber-900/30 scrollbar-track-transparent">
              {RACE_FILTERS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => handleRaceFilter(value)}
                  className={`shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all border ${
                    heroRaceFilter === value
                      ? 'bg-amber-900/60 text-amber-100 border-amber-600/40 shadow-[inset_0_1px_0_rgba(245,158,11,0.15)]'
                      : 'bg-slate-900/60 text-slate-400 border-amber-900/20 hover:text-amber-100 hover:border-amber-700/30 hover:bg-slate-800/60'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Count */}
        {total > 0 && !loading && (
          <div className="px-6 pt-4 pb-1">
            <p className="text-xs text-slate-500">
              Mostrando <span className="text-amber-400 font-semibold">{data.length}</span> de{' '}
              <span className="text-amber-400 font-semibold">{total}</span> {activeTab === 'heroes' ? 'héroes' : 'alianzas'}
            </p>
          </div>
        )}

        {/* Body */}
        <div className="px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-amber-600/50 border-t-amber-400 rounded-full animate-spin" />
            </div>
          ) : fetchError ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500">
              <AlertTriangle size={36} className="mb-3 text-red-400/60" />
              <p className="text-sm text-red-300/80">{fetchError}</p>
              <button
                onClick={fetchData}
                className="mt-4 px-4 py-2 bg-slate-800/60 border border-amber-900/30 rounded-lg text-xs text-slate-300 hover:bg-slate-700/60 transition-all"
              >
                Reintentar
              </button>
            </div>
          ) : data.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500">
              <Search size={32} className="mb-3 opacity-30" />
              <p className="text-sm text-slate-400">
                {activeTab === 'heroes'
                  ? heroRaceFilter
                    ? `No hay héroes ${RACE_FILTERS.find(r => r.value === heroRaceFilter)?.label?.toLowerCase() || ''} en este ranking todavía.`
                    : 'No se encontraron héroes.'
                  : 'No se encontraron alianzas.'}
              </p>
              {(search || heroRaceFilter) && (
                <>
                  <p className="text-xs text-slate-600 mt-1">Prueba con otro filtro o limpia la búsqueda.</p>
                  <button
                    onClick={() => { clearSearch(); setHeroRaceFilter(''); }}
                    className="mt-4 px-4 py-2 bg-slate-800/60 border border-amber-900/30 rounded-lg text-xs text-slate-300 hover:bg-slate-700/60 transition-all"
                  >
                    Limpiar filtros
                  </button>
                </>
              )}
            </div>
          ) : activeTab === 'heroes' ? (
            <div className="space-y-2">
              {data.map((hero, index) => (
                <button
                  key={hero.id}
                  onClick={() => setProfilePlayerId(hero.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left group ${
                    index < 3
                      ? TOP_CLASSES[index]
                      : 'bg-slate-900/40 border-amber-900/20 hover:bg-slate-800/60 hover:border-amber-700/40'
                  }`}
                >
                  <div className="flex items-center justify-center w-10 h-10 shrink-0">
                    {getRankBadge(index)}
                  </div>

                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-900/40 to-slate-800 border border-amber-900/30 flex items-center justify-center text-lg font-bold text-amber-400/80 shrink-0">
                    {getInitials(hero.username)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-slate-100 truncate group-hover:text-amber-200 transition-colors">
                        {hero.username}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-[10px] uppercase text-emerald-400/80 bg-emerald-900/30 px-1.5 py-0.5 rounded">
                        {formatRace(hero.race)}
                      </span>
                      {hero.class_name && (
                        <span className="text-[10px] uppercase text-sky-400/80 bg-sky-900/30 px-1.5 py-0.5 rounded">
                          {hero.class_name}
                        </span>
                      )}
                      {hero.alliance_name && (
                        <span className="flex items-center gap-1 text-[10px] text-amber-500/70">
                          <Shield size={9} className="shrink-0" />
                          {hero.alliance_name}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-0.5 shrink-0">
                    <span className="flex items-center gap-1 text-[11px] text-slate-400">
                      <Star size={11} className="text-amber-500/60" />
                      Nv.{hero.level}
                    </span>
                    <span className="font-bold text-sm text-amber-300 font-mono tabular-nums">
                      {formatPower(hero.power)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {data.map((alliance, index) => (
                <Link
                  key={alliance.id}
                  to={`/alliance/${alliance.id}`}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all group ${
                    index < 3
                      ? TOP_CLASSES[index]
                      : 'bg-slate-900/40 border-amber-900/20 hover:bg-slate-800/60 hover:border-amber-700/40'
                  }`}
                >
                  <div className="flex items-center justify-center w-10 h-10 shrink-0">
                    {getRankBadge(index)}
                  </div>

                  <div className="w-10 h-10 rounded-lg bg-slate-800 border border-amber-900/30 flex items-center justify-center overflow-hidden shrink-0">
                    {alliance.logo_url ? (
                      <img src={alliance.logo_url} alt="" className="w-full h-full object-cover" onError={e => { e.target.style.display = 'none' }} />
                    ) : (
                      <Shield size={18} className="text-amber-600/50" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-slate-100 truncate group-hover:text-amber-200 transition-colors">
                        {alliance.name}
                      </span>
                      {alliance.tag && (
                        <span className="text-[10px] font-mono text-amber-500/70 bg-amber-900/20 px-1.5 py-0.5 rounded">
                          [{alliance.tag}]
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="flex items-center gap-1 text-[11px] text-slate-500">
                        <Users size={11} />
                        {alliance.members_count} miembros
                      </span>
                      <span className="flex items-center gap-1 text-[11px] text-slate-500">
                        <Building2 size={11} />
                        {alliance.buildings_score} edificios
                      </span>
                      {alliance.leader_name && (
                        <span className="text-[11px] text-amber-600/60 truncate">
                          Líder: {alliance.leader_name}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="font-bold text-sm text-amber-300 font-mono tabular-nums">
                      {formatPower(alliance.total_power)}
                    </span>
                    <div className="text-[10px] text-slate-600 mt-0.5">poder total</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && !loading && (
          <div className="flex items-center justify-center gap-2 px-6 pb-6">
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
      </div>

      <PlayerProfileModal
        playerId={profilePlayerId}
        isOpen={Boolean(profilePlayerId)}
        onClose={() => setProfilePlayerId(null)}
      />
    </div>
  );
}

export default Rankings;
