const pool = require('../config/db');
const { getIO } = require('../socket');

// --- ENVIAR MENSAJE ---
exports.sendMessage = async (req, res) => {
    const { recipientUsername, content, isSystem } = req.body;
    const senderId = req.user ? req.user.id : null; // Si es sistema, senderId puede ser null o un admin específico

    try {
        if (!content) {
            return res.status(400).json({ message: 'El mensaje no puede estar vacío.' });
        }

        // Si es mensaje de usuario a usuario, necesitamos senderId
        if (!isSystem && !senderId) {
            return res.status(401).json({ message: 'No estás autenticado.' });
        }

        // Obtener username del remitente para el socket
        let senderUsername = 'Sistema';
        if (!isSystem && senderId) {
            const senderRes = await pool.query('SELECT username FROM players WHERE id = $1', [senderId]);
            if (senderRes.rows.length > 0) {
                senderUsername = senderRes.rows[0].username;
            }
        }

        // Buscar ID del destinatario
        const recipientRes = await pool.query('SELECT id FROM players WHERE username = $1', [recipientUsername]);

        if (recipientRes.rows.length === 0) {
            return res.status(404).json({ message: 'Usuario destinatario no encontrado.' });
        }

        const recipientId = recipientRes.rows[0].id;

        // Insertar Mensaje
        // Si isSystem es true, sender_id puede ser NULL (o manejado como tal en la DB)
        // Asumiremos que sender_id es NULL si es sistema, o el id del admin si lo envía un admin.
        // Para simplificar: Si es sistema, sender_id es NULL.

        const finalSenderId = isSystem ? null : senderId;

        const insertQuery = `
      INSERT INTO messages (sender_id, recipient_id, content, is_system, created_at)
      VALUES ($1, $2, $3, $4, NOW())
      RETURNING *,
        EXTRACT(EPOCH FROM (NOW() - created_at))::int AS created_seconds_ago,
        (created_at AT TIME ZONE current_setting('TIMEZONE')) AS created_at_instant
    `;

        const result = await pool.query(insertQuery, [finalSenderId, recipientId, content, isSystem || false]);

        // NOTIFICAR POR SOCKET
        try {
            const io = getIO();

            // Construimos el objeto completo similar a lo que devuelve getMyMessages
            const payloadMessage = {
                ...result.rows[0],
                sender_name: senderUsername,
                recipient_name: recipientUsername
            };

            io.to(recipientId).emit('new_message', {
                message: payloadMessage
            });
        } catch (e) {
            console.error("Error socket emit:", e);
        }

        res.status(201).json({ success: true, message: 'Mensaje enviado.', data: result.rows[0] });

    } catch (err) {
        console.error("Error enviando mensaje:", err);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
};

// --- OBTENER CONVERSACIONES / MENSAJES ---
exports.getMyMessages = async (req, res) => {
    const userId = req.user.id;

    try {
        // Obtenemos todos los mensajes donde el usuario es remitente o destinatario
        // Hacemos JOIN con players para obtener nombres
        const query = `
      SELECT 
        m.*,
        EXTRACT(EPOCH FROM (NOW() - m.created_at))::int AS created_seconds_ago,
        (m.created_at AT TIME ZONE current_setting('TIMEZONE')) AS created_at_instant,
        sender.username as sender_name,
        recipient.username as recipient_name
      FROM messages m
      LEFT JOIN players sender ON m.sender_id = sender.id
      LEFT JOIN players recipient ON m.recipient_id = recipient.id
      WHERE m.recipient_id = $1 OR m.sender_id = $1
      ORDER BY m.created_at DESC
    `;

        const result = await pool.query(query, [userId]);

        // Agrupamos por "Interlocutor" para mostrar como conversaciones en el frontend
        // O simplemente devolvemos la lista plana y el frontend procesa.
        // Devolvemos lista plana para flexibilidad.

        res.json({ success: true, messages: result.rows });

    } catch (err) {
        console.error("Error obteniendo mensajes:", err);
        res.status(500).json({ message: 'Error al cargar mensajes.' });
    }
};

// --- MARCAR COMO LEÍDO ---
exports.markAsRead = async (req, res) => {
    const userId = req.user.id;
    const { messageId } = req.body;

    try {
        // Solo permitir marcar como leído si somos el destinatario
        const result = await pool.query(
            'UPDATE messages SET is_read = true WHERE id = $1 AND recipient_id = $2 RETURNING *',
            [messageId, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Mensaje no encontrado o no eres el destinatario.' });
        }

        res.json({ success: true, message: 'Marcado como leído.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al actualizar estado.' });
    }
};

// --- CONTAR NO LEÍDOS ---
exports.getUnreadCount = async (req, res) => {
    const userId = req.user.id;
    try {
        const result = await pool.query('SELECT COUNT(*) FROM messages WHERE recipient_id = $1 AND is_read = false', [userId]);
        res.json({ success: true, count: parseInt(result.rows[0].count) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error contando mensajes.' });
    }
};
