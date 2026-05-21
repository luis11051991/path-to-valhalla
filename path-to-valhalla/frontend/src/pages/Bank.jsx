import React, { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Landmark, PiggyBank, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { apiUrl } from '../constants/api';

const COMMISSION_RATE = 0.05;

const CURRENCIES = {
    gold: { label: 'Oro', icon: '/icons/currency/gold.png', textClass: 'text-yellow-400', unitCopper: 10000 },
    silver: { label: 'Plata', icon: '/icons/currency/silver.png', textClass: 'text-slate-200', unitCopper: 100 },
    copper: { label: 'Cobre', icon: '/icons/currency/copper.png', textClass: 'text-orange-400', unitCopper: 1 }
};

const toCopper = (gold, silver, copper) =>
    (parseInt(gold || 0, 10) * 10000) + (parseInt(silver || 0, 10) * 100) + parseInt(copper || 0, 10);

const fromCopper = (totalCopper) => {
    const safe = Math.max(parseInt(totalCopper || 0, 10), 0);
    const gold = Math.floor(safe / 10000);
    const silver = Math.floor((safe % 10000) / 100);
    const copper = safe % 100;
    return { gold, silver, copper };
};

const formatCopperBreakdown = (totalCopper) => {
    const { gold, silver, copper } = fromCopper(totalCopper);
    return `${gold} Oro, ${silver} Plata, ${copper} Cobre`;
};

const Bank = ({ user: propUser, onUpdateUser: propOnUpdateUser }) => {
    const contextData = useOutletContext();
    const user = propUser || (contextData ? contextData[0] : null);
    const onUpdateUser = propOnUpdateUser || (contextData ? contextData[1] : null);

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [feedback, setFeedback] = useState(null);

    const [bankData, setBankData] = useState({
        wallet: {
            gold: parseInt(user?.gold || 0, 10),
            silver: parseInt(user?.silver || 0, 10),
            copper: parseInt(user?.copper || 0, 10)
        },
        bank: {
            gold: parseInt(user?.bank_gold || 0, 10),
            silver: parseInt(user?.bank_silver || 0, 10),
            copper: parseInt(user?.bank_copper || 0, 10)
        }
    });

    const [depositInputs, setDepositInputs] = useState({
        gold: '',
        silver: '',
        copper: ''
    });
    const [pendingTransaction, setPendingTransaction] = useState(null);

    const showFeedback = (type, text) => {
        setFeedback({ type, text });
        setTimeout(() => setFeedback(null), 2500);
    };

    useEffect(() => {
        if (!user) return;
        loadBankStatus();
    }, [user?.id]);

    const loadBankStatus = async () => {
        setLoading(true);
        try {
            const response = await fetch(apiUrl('/api/bank/status'), {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            const data = await response.json();

            if (!response.ok || !data.success) {
                showFeedback('error', data.message || 'No se pudo cargar el banco.');
                return;
            }

            setBankData({ wallet: data.wallet, bank: data.bank });
            onUpdateUser?.({
                gold: data.wallet.gold,
                silver: data.wallet.silver,
                copper: data.wallet.copper,
                bank_gold: data.bank.gold,
                bank_silver: data.bank.silver,
                bank_copper: data.bank.copper
            });
        } catch (error) {
            showFeedback('error', 'Error de conexion con el banco.');
        } finally {
            setLoading(false);
        }
    };

    const walletCopper = useMemo(
        () => toCopper(bankData.wallet.gold, bankData.wallet.silver, bankData.wallet.copper),
        [bankData.wallet]
    );

    const bankCopper = useMemo(
        () => toCopper(bankData.bank.gold, bankData.bank.silver, bankData.bank.copper),
        [bankData.bank]
    );

    const openTransactionConfirmation = (action, currencyKey) => {
        const rawAmount = depositInputs[currencyKey];
        const amount = Number.parseInt(rawAmount, 10);
        if (!Number.isFinite(amount) || amount <= 0) {
            showFeedback('error', `Ingresa una cantidad valida de ${CURRENCIES[currencyKey].label}.`);
            return;
        }

        const requestedCopper = amount * CURRENCIES[currencyKey].unitCopper;
        if (action === 'deposit' && walletCopper < requestedCopper) {
            showFeedback('error', 'No tienes saldo suficiente en tu bolsa para depositar.');
            return;
        }

        if (action === 'withdraw' && bankCopper < requestedCopper) {
            showFeedback('error', 'No tienes saldo suficiente en el banco para retirar.');
            return;
        }

        const feeCopper = action === 'deposit' ? Math.floor(requestedCopper * COMMISSION_RATE) : 0;
        const netCopper = requestedCopper - feeCopper;

        setPendingTransaction({
            action,
            currency: currencyKey,
            amount,
            requestedCopper,
            feeCopper,
            netCopper
        });
    };

    const cancelTransaction = () => {
        setPendingTransaction(null);
    };

    const confirmTransaction = async () => {
        if (!pendingTransaction || submitting) return;
        setSubmitting(true);

        try {
            const endpoint = pendingTransaction.action === 'withdraw' ? '/api/bank/withdraw' : '/api/bank/deposit';
            const response = await fetch(apiUrl(endpoint), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    currency: pendingTransaction.currency,
                    amount: pendingTransaction.amount
                })
            });

            const data = await response.json();
            if (!response.ok || !data.success) {
                showFeedback('error', data.message || 'No se pudo completar la operacion bancaria.');
                return;
            }

            setBankData({ wallet: data.wallet, bank: data.bank });
            onUpdateUser?.({
                gold: data.wallet.gold,
                silver: data.wallet.silver,
                copper: data.wallet.copper,
                bank_gold: data.bank.gold,
                bank_silver: data.bank.silver,
                bank_copper: data.bank.copper
            });

            setDepositInputs((prev) => ({ ...prev, [pendingTransaction.currency]: '' }));
            setPendingTransaction(null);
            showFeedback('success', data.message || 'Operacion realizada.');
        } catch (error) {
            showFeedback('error', 'Error de conexion en la operacion bancaria.');
        } finally {
            setSubmitting(false);
        }
    };

    if (!user) return null;

    return (
        <div className="h-full relative overflow-hidden bg-slate-950 text-slate-100">
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(245,158,11,0.20),transparent_40%),radial-gradient(circle_at_80%_90%,rgba(148,163,184,0.16),transparent_35%)]" />
                <div className="absolute inset-0 bg-gradient-to-b from-slate-900/40 via-slate-950/80 to-slate-950" />
            </div>

            <div className="relative z-10 h-full flex flex-col p-4 lg:p-6 gap-4">
                <div className="flex items-center justify-between border border-amber-900/40 bg-slate-900/70 backdrop-blur-md rounded-xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg border border-amber-700/50 bg-amber-900/20">
                            <Landmark className="text-amber-400" size={22} />
                        </div>
                        <div>
                            <h2 className="text-xl font-serif font-bold text-amber-100">Banco de Valhalla</h2>
                            <p className="text-[10px] uppercase tracking-widest text-amber-500/70">Comision: 5% solo al depositar</p>
                        </div>
                    </div>
                    {feedback && (
                        <div className={`text-xs font-bold px-3 py-2 rounded border flex items-center gap-2 ${feedback.type === 'success' ? 'text-green-300 border-green-500/40 bg-green-900/20' : 'text-red-300 border-red-500/40 bg-red-900/20'}`}>
                            {feedback.type === 'success' ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                            {feedback.text}
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
                        <p className="text-[10px] uppercase tracking-widest text-slate-400 mb-3">Bolsa del Jugador</p>
                        {Object.entries(CURRENCIES).map(([key, config]) => (
                            <div key={`wallet-${key}`} className="flex items-center justify-between px-3 py-2 rounded mb-2 bg-black/30 border border-slate-800">
                                <div className="flex items-center gap-2">
                                    <img src={config.icon} alt={config.label} className="w-5 h-5 object-contain" />
                                    <span className="text-sm">{config.label}</span>
                                </div>
                                <span className={`font-mono font-bold ${config.textClass}`}>{bankData.wallet[key] || 0}</span>
                            </div>
                        ))}
                    </div>

                    <div className="rounded-xl border border-emerald-900/40 bg-slate-900/70 p-4">
                        <p className="text-[10px] uppercase tracking-widest text-emerald-400/90 mb-3 flex items-center gap-2">
                            <PiggyBank size={12} />
                            Reserva en Banco
                        </p>
                        {Object.entries(CURRENCIES).map(([key, config]) => (
                            <div key={`bank-${key}`} className="flex items-center justify-between px-3 py-2 rounded mb-2 bg-black/30 border border-slate-800">
                                <div className="flex items-center gap-2">
                                    <img src={config.icon} alt={config.label} className="w-5 h-5 object-contain" />
                                    <span className="text-sm">{config.label}</span>
                                </div>
                                <span className={`font-mono font-bold ${config.textClass}`}>{bankData.bank[key] || 0}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex-1 rounded-xl border border-slate-700 bg-slate-900/70 p-4">
                    {loading ? (
                        <div className="h-full flex items-center justify-center">
                            <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : (
                        <div className="h-full flex flex-col">
                            <div className="mb-4">
                                <p className="text-xs text-slate-300">Selecciona una moneda, monto y accion bancaria.</p>
                                <p className="text-[11px] text-slate-500 mt-1">Depositar descuenta 5%. Retirar no aplica comision.</p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                {Object.entries(CURRENCIES).map(([key, config]) => (
                                    <div key={key} className="rounded-lg border border-slate-700 bg-black/30 p-4">
                                        <div className="flex items-center gap-2 mb-3">
                                            <img src={config.icon} alt={config.label} className="w-6 h-6 object-contain" />
                                            <span className={`font-bold ${config.textClass}`}>{config.label}</span>
                                        </div>
                                        <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-2 space-y-1">
                                            <p>Bolsa: {bankData.wallet[key] || 0}</p>
                                            <p>Banco: {bankData.bank[key] || 0}</p>
                                        </div>
                                        <input
                                            type="number"
                                            min="1"
                                            value={depositInputs[key]}
                                            onChange={(event) =>
                                                setDepositInputs((prev) => ({ ...prev, [key]: event.target.value }))
                                            }
                                            className="w-full px-3 py-2 rounded bg-slate-900 border border-slate-700 text-sm font-mono text-slate-100 outline-none focus:border-amber-500"
                                            placeholder={`Cantidad de ${config.label}`}
                                        />
                                        <div className="mt-3 grid grid-cols-2 gap-2">
                                            <button
                                                onClick={() => openTransactionConfirmation('deposit', key)}
                                                className="py-2 rounded bg-amber-700 hover:bg-amber-600 text-[11px] font-bold uppercase tracking-wider border border-amber-500/50"
                                            >
                                                Depositar
                                            </button>
                                            <button
                                                onClick={() => openTransactionConfirmation('withdraw', key)}
                                                className="py-2 rounded bg-emerald-700 hover:bg-emerald-600 text-[11px] font-bold uppercase tracking-wider border border-emerald-500/50"
                                            >
                                                Retirar
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {pendingTransaction && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="w-full max-w-md rounded-xl border-2 border-amber-600 bg-slate-900 shadow-2xl p-6">
                        <div className="flex items-center justify-center mb-4">
                            <div className="p-3 rounded-full bg-amber-900/30 border border-amber-500/50">
                                <AlertTriangle className="text-amber-400" size={26} />
                            </div>
                        </div>
                        <h3 className="text-center text-xl font-serif font-bold text-amber-200 mb-2">
                            {pendingTransaction.action === 'withdraw' ? 'Confirmar Retiro' : 'Confirmar Deposito'}
                        </h3>
                        <p className="text-center text-sm text-slate-300 mb-5">
                            {pendingTransaction.action === 'withdraw' ? 'Vas a retirar ' : 'Vas a mover '}
                            <span className="font-bold">{pendingTransaction.amount} {CURRENCIES[pendingTransaction.currency].label}</span>
                            {pendingTransaction.action === 'withdraw' ? ' desde tu banco.' : ' desde tu bolsa.'}
                        </p>

                        <div className="rounded-lg border border-slate-700 bg-black/30 p-4 space-y-2 mb-6">
                            <div className="flex justify-between text-xs">
                                <span className="text-slate-400">Monto solicitado</span>
                                <span className="font-mono text-slate-100">{formatCopperBreakdown(pendingTransaction.requestedCopper)}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-red-300">Deduccion ({pendingTransaction.action === 'withdraw' ? '0%' : '5%'})</span>
                                <span className="font-mono text-red-300">{formatCopperBreakdown(pendingTransaction.feeCopper)}</span>
                            </div>
                            <div className="flex justify-between text-xs pt-2 border-t border-slate-700">
                                <span className="text-emerald-300">
                                    {pendingTransaction.action === 'withdraw' ? 'Se acredita en bolsa' : 'Se deposita en banco'}
                                </span>
                                <span className="font-mono text-emerald-300">{formatCopperBreakdown(pendingTransaction.netCopper)}</span>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={cancelTransaction}
                                disabled={submitting}
                                className="flex-1 py-2 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 text-sm font-bold uppercase"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmTransaction}
                                disabled={submitting}
                                className={`flex-1 py-2 rounded text-white text-sm font-bold uppercase disabled:opacity-50 ${
                                    pendingTransaction.action === 'withdraw'
                                        ? 'bg-emerald-700 hover:bg-emerald-600 border border-emerald-500'
                                        : 'bg-amber-700 hover:bg-amber-600 border border-amber-500'
                                }`}
                            >
                                {submitting ? 'Procesando...' : 'Confirmar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Bank;

