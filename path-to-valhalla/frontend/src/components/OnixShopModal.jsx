import React, { useState } from 'react';
import { Gift, PlayCircle, Store, Users, X } from 'lucide-react';

const ONYX_PACKAGES = [
  { id: 'starter', amount: '150 Ónix', price: '$2.99' },
  { id: 'hunter', amount: '500 Ónix', price: '$6.99' },
  { id: 'berserker', amount: '1,200 Ónix', price: '$12.99' },
  { id: 'odin', amount: '2,800 Ónix', price: '$24.99' },
];

const FREE_REWARDS = [
  { id: 'daily', title: 'Recompensa diaria', reward: '+10', icon: Gift },
  { id: 'watch', title: 'Ver anuncio', reward: '+15', icon: PlayCircle },
  { id: 'invite', title: 'Invita a un amigo', reward: '+50', icon: Users },
];

const OnixShopModal = ({ isOpen, onClose }) => {
  const [tab, setTab] = useState('buy');

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-md p-4"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 w-full max-w-2xl rounded-xl border border-purple-500/30 flex flex-col overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-4 bg-gradient-to-r from-slate-900 to-purple-900/40 border-b border-purple-500/20">
          <div className="flex items-center gap-2">
            <Store className="text-purple-400" />
            <h3 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-200 to-purple-400">
              Tienda de Ónix
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white" aria-label="Cerrar tienda">
            <X size={20} />
          </button>
        </div>

        <div className="flex border-b border-slate-700">
          <button
            onClick={() => setTab('buy')}
            className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider ${
              tab === 'buy'
                ? 'bg-purple-900/20 text-purple-300 border-b-2 border-purple-500'
                : 'text-slate-500'
            }`}
          >
            Comprar
          </button>
          <button
            onClick={() => setTab('earn')}
            className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider ${
              tab === 'earn'
                ? 'bg-green-900/20 text-green-300 border-b-2 border-green-500'
                : 'text-slate-500'
            }`}
          >
            Gratis
          </button>
        </div>

        <div className="p-6 bg-slate-950 min-h-[300px]">
          {tab === 'buy' ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {ONYX_PACKAGES.map((pkg) => (
                <div key={pkg.id} className="bg-slate-900 rounded p-4 border border-slate-700 text-center">
                  <img
                    src="/icons/currency/onix.png"
                    alt="Ónix"
                    className="mx-auto mb-2 w-7 h-7 object-contain drop-shadow-[0_0_6px_rgba(168,85,247,0.7)]"
                  />
                  <div className="text-white font-bold mb-2">{pkg.amount}</div>
                  <button className="w-full bg-slate-800 text-white rounded text-sm py-1 border border-slate-600 hover:bg-slate-700 transition-colors">
                    {pkg.price}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {FREE_REWARDS.map((reward) => (
                <div
                  key={reward.id}
                  className="flex justify-between bg-slate-900 p-3 rounded border border-slate-700 items-center"
                >
                  <div className="flex gap-3 items-center">
                    <reward.icon className="text-slate-400" />
                    <div className="text-sm font-bold text-slate-200">{reward.title}</div>
                  </div>
                  <button className="text-xs bg-green-700 text-white px-3 py-1 rounded hover:bg-green-600 transition-colors">
                    {reward.reward}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OnixShopModal;
