const { db } = require('../config/db');

const COMMISSION_RATE = 0.05;
const CURRENCY_TO_COPPER = {
    gold: 10000,
    silver: 100,
    copper: 1,
};

const toCopper = (gold, silver, copper) =>
    (parseInt(gold || 0, 10) * 10000) + (parseInt(silver || 0, 10) * 100) + parseInt(copper || 0, 10);

const fromCopper = (totalCopper) => {
    const safeTotal = Math.max(parseInt(totalCopper || 0, 10), 0);
    const gold = Math.floor(safeTotal / 10000);
    const silver = Math.floor((safeTotal % 10000) / 100);
    const copper = safeTotal % 100;
    return { gold, silver, copper };
};

const parseDepositAmount = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) return null;
    return parsed;
};

exports.getBankStatus = async (req, res) => {
    const userId = req.user.id;

    try {
        const playerDoc = await db.collection('players').doc(userId).get();
        if (!playerDoc.exists) {
            return res.status(404).json({ message: 'Jugador no encontrado.' });
        }

        const p = playerDoc.data();
        return res.json({
            success: true,
            wallet: { gold: parseInt(p.gold || 0), silver: parseInt(p.silver || 0), copper: parseInt(p.copper || 0) },
            bank: { gold: parseInt(p.bank_gold || 0), silver: parseInt(p.bank_silver || 0), copper: parseInt(p.bank_copper || 0) },
        });
    } catch (error) {
        console.error('Error al consultar banco:', error);
        return res.status(500).json({ message: 'No se pudo cargar el banco.' });
    }
};

exports.depositToBank = async (req, res) => {
    const userId = req.user.id;
    const { currency, amount } = req.body || {};
    const normalizedCurrency = String(currency || '').toLowerCase();
    const depositAmount = parseDepositAmount(amount);

    if (!Object.prototype.hasOwnProperty.call(CURRENCY_TO_COPPER, normalizedCurrency)) {
        return res.status(400).json({ message: 'Moneda invalida. Usa gold, silver o copper.' });
    }
    if (depositAmount === null || depositAmount <= 0) {
        return res.status(400).json({ message: 'Ingresa una cantidad valida para depositar.' });
    }

    const amountCopper = depositAmount * CURRENCY_TO_COPPER[normalizedCurrency];
    const feeCopper = Math.floor(amountCopper * COMMISSION_RATE);
    const netCopper = amountCopper - feeCopper;

    try {
        const playerRef = db.collection('players').doc(userId);
        const result = await db.runTransaction(async (t) => {
            const playerDoc = await t.get(playerRef);
            if (!playerDoc.exists) throw new Error('player_not_found');

            const p = playerDoc.data();
            const walletCopper = toCopper(p.gold, p.silver, p.copper);
            const bankCopper = toCopper(p.bank_gold || 0, p.bank_silver || 0, p.bank_copper || 0);

            if (walletCopper < amountCopper) throw new Error('insufficient_wallet');

            const updatedWallet = fromCopper(walletCopper - amountCopper);
            const updatedBank = fromCopper(bankCopper + netCopper);

            t.update(playerRef, {
                gold: updatedWallet.gold,
                silver: updatedWallet.silver,
                copper: updatedWallet.copper,
                bank_gold: updatedBank.gold,
                bank_silver: updatedBank.silver,
                bank_copper: updatedBank.copper,
            });

            return { wallet: updatedWallet, bank: updatedBank };
        });

        return res.json({
            success: true,
            message: 'Deposito realizado correctamente.',
            wallet: result.wallet,
            bank: result.bank,
            summary: { currency: normalizedCurrency, requestedAmount: depositAmount, requestedCopper: amountCopper, feeCopper, netCopper },
        });
    } catch (error) {
        if (error.message === 'player_not_found') return res.status(404).json({ message: 'Jugador no encontrado.' });
        if (error.message === 'insufficient_wallet') return res.status(400).json({ message: 'No tienes saldo suficiente para ese deposito.' });
        console.error('Error al depositar en banco:', error);
        return res.status(500).json({ message: 'No se pudo completar el deposito.' });
    }
};

exports.withdrawFromBank = async (req, res) => {
    const userId = req.user.id;
    const { currency, amount } = req.body || {};
    const normalizedCurrency = String(currency || '').toLowerCase();
    const withdrawAmount = parseDepositAmount(amount);

    if (!Object.prototype.hasOwnProperty.call(CURRENCY_TO_COPPER, normalizedCurrency)) {
        return res.status(400).json({ message: 'Moneda invalida. Usa gold, silver o copper.' });
    }
    if (withdrawAmount === null || withdrawAmount <= 0) {
        return res.status(400).json({ message: 'Ingresa una cantidad valida para retirar.' });
    }

    const amountCopper = withdrawAmount * CURRENCY_TO_COPPER[normalizedCurrency];

    try {
        const playerRef = db.collection('players').doc(userId);
        const result = await db.runTransaction(async (t) => {
            const playerDoc = await t.get(playerRef);
            if (!playerDoc.exists) throw new Error('player_not_found');

            const p = playerDoc.data();
            const bankCopper = toCopper(p.bank_gold || 0, p.bank_silver || 0, p.bank_copper || 0);

            if (bankCopper < amountCopper) throw new Error('insufficient_bank');

            const walletCopper = toCopper(p.gold, p.silver, p.copper);
            const updatedWallet = fromCopper(walletCopper + amountCopper);
            const updatedBank = fromCopper(bankCopper - amountCopper);

            t.update(playerRef, {
                gold: updatedWallet.gold,
                silver: updatedWallet.silver,
                copper: updatedWallet.copper,
                bank_gold: updatedBank.gold,
                bank_silver: updatedBank.silver,
                bank_copper: updatedBank.copper,
            });

            return { wallet: updatedWallet, bank: updatedBank };
        });

        return res.json({
            success: true,
            message: 'Retiro realizado correctamente.',
            wallet: result.wallet,
            bank: result.bank,
            summary: { currency: normalizedCurrency, requestedAmount: withdrawAmount, requestedCopper: amountCopper, feeCopper: 0, netCopper: amountCopper },
        });
    } catch (error) {
        if (error.message === 'player_not_found') return res.status(404).json({ message: 'Jugador no encontrado.' });
        if (error.message === 'insufficient_bank') return res.status(400).json({ message: 'No tienes saldo suficiente en el banco para ese retiro.' });
        console.error('Error al retirar del banco:', error);
        return res.status(500).json({ message: 'No se pudo completar el retiro.' });
    }
};
