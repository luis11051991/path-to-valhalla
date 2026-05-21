const pool = require('../config/db');

const COMMISSION_RATE = 0.05;
const CURRENCY_TO_COPPER = {
    gold: 10000,
    silver: 100,
    copper: 1
};

let ensureColumnsPromise = null;

const ensureBankColumns = async () => {
    if (!ensureColumnsPromise) {
        ensureColumnsPromise = pool.query(`
            ALTER TABLE players
            ADD COLUMN IF NOT EXISTS bank_gold INTEGER NOT NULL DEFAULT 0,
            ADD COLUMN IF NOT EXISTS bank_silver INTEGER NOT NULL DEFAULT 0,
            ADD COLUMN IF NOT EXISTS bank_copper INTEGER NOT NULL DEFAULT 0
        `).catch((error) => {
            ensureColumnsPromise = null;
            throw error;
        });
    }

    await ensureColumnsPromise;
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
        await ensureBankColumns();

        const result = await pool.query(`
            SELECT gold, silver, copper, bank_gold, bank_silver, bank_copper
            FROM players
            WHERE id = $1
        `, [userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Jugador no encontrado.' });
        }

        const player = result.rows[0];
        return res.json({
            success: true,
            wallet: {
                gold: parseInt(player.gold || 0, 10),
                silver: parseInt(player.silver || 0, 10),
                copper: parseInt(player.copper || 0, 10)
            },
            bank: {
                gold: parseInt(player.bank_gold || 0, 10),
                silver: parseInt(player.bank_silver || 0, 10),
                copper: parseInt(player.bank_copper || 0, 10)
            }
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

    const client = await pool.connect();
    try {
        await ensureBankColumns();
        await client.query('BEGIN');

        const playerResult = await client.query(`
            SELECT gold, silver, copper, bank_gold, bank_silver, bank_copper
            FROM players
            WHERE id = $1
            FOR UPDATE
        `, [userId]);

        if (playerResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Jugador no encontrado.' });
        }

        const player = playerResult.rows[0];
        const walletCopper = toCopper(player.gold, player.silver, player.copper);
        const bankCopper = toCopper(player.bank_gold, player.bank_silver, player.bank_copper);

        if (walletCopper < amountCopper) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'No tienes saldo suficiente para ese deposito.' });
        }

        const updatedWallet = fromCopper(walletCopper - amountCopper);
        const updatedBank = fromCopper(bankCopper + netCopper);

        await client.query(`
            UPDATE players
            SET gold = $1,
                silver = $2,
                copper = $3,
                bank_gold = $4,
                bank_silver = $5,
                bank_copper = $6
            WHERE id = $7
        `, [
            updatedWallet.gold,
            updatedWallet.silver,
            updatedWallet.copper,
            updatedBank.gold,
            updatedBank.silver,
            updatedBank.copper,
            userId
        ]);

        await client.query('COMMIT');

        return res.json({
            success: true,
            message: 'Deposito realizado correctamente.',
            wallet: updatedWallet,
            bank: updatedBank,
            summary: {
                currency: normalizedCurrency,
                requestedAmount: depositAmount,
                requestedCopper: amountCopper,
                feeCopper,
                netCopper
            }
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error al depositar en banco:', error);
        return res.status(500).json({ message: 'No se pudo completar el deposito.' });
    } finally {
        client.release();
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

    const client = await pool.connect();
    try {
        await ensureBankColumns();
        await client.query('BEGIN');

        const playerResult = await client.query(`
            SELECT gold, silver, copper, bank_gold, bank_silver, bank_copper
            FROM players
            WHERE id = $1
            FOR UPDATE
        `, [userId]);

        if (playerResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Jugador no encontrado.' });
        }

        const player = playerResult.rows[0];
        const walletCopper = toCopper(player.gold, player.silver, player.copper);
        const bankCopper = toCopper(player.bank_gold, player.bank_silver, player.bank_copper);

        if (bankCopper < amountCopper) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'No tienes saldo suficiente en el banco para ese retiro.' });
        }

        const updatedWallet = fromCopper(walletCopper + amountCopper);
        const updatedBank = fromCopper(bankCopper - amountCopper);

        await client.query(`
            UPDATE players
            SET gold = $1,
                silver = $2,
                copper = $3,
                bank_gold = $4,
                bank_silver = $5,
                bank_copper = $6
            WHERE id = $7
        `, [
            updatedWallet.gold,
            updatedWallet.silver,
            updatedWallet.copper,
            updatedBank.gold,
            updatedBank.silver,
            updatedBank.copper,
            userId
        ]);

        await client.query('COMMIT');

        return res.json({
            success: true,
            message: 'Retiro realizado correctamente.',
            wallet: updatedWallet,
            bank: updatedBank,
            summary: {
                currency: normalizedCurrency,
                requestedAmount: withdrawAmount,
                requestedCopper: amountCopper,
                feeCopper: 0,
                netCopper: amountCopper
            }
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error al retirar del banco:', error);
        return res.status(500).json({ message: 'No se pudo completar el retiro.' });
    } finally {
        client.release();
    }
};
