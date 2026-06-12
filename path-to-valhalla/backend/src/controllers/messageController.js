const { db } = require('../config/db');
const { getIO } = require('../socket');

exports.sendMessage = async (req, res) => {
    const { recipientUsername, content, isSystem } = req.body;
    const senderId = req.user ? req.user.id : null;

    try {
        if (!content) return res.status(400).json({ message: 'El mensaje no puede estar vacio.' });
        if (!isSystem && !senderId) return res.status(401).json({ message: 'No estas autenticado.' });

        // Obtener username del remitente
        let senderUsername = 'Sistema';
        if (!isSystem && senderId) {
            const senderDoc = await db.collection('players').doc(senderId).get();
            if (senderDoc.exists) senderUsername = senderDoc.data().username;
        }

        // Buscar ID del destinatario por username
        const recipientSnap = await db.collection('players')
            .where('username', '==', recipientUsername)
            .limit(1)
            .get();

        if (recipientSnap.empty) {
            return res.status(404).json({ message: 'Usuario destinatario no encontrado.' });
        }

        const recipientId = recipientSnap.docs[0].id;
        const finalSenderId = isSystem ? null : senderId;

        // Insertar Mensaje en la coleccion de mensajes del destinatario
        const msgRef = db.collection('messages').doc();
        await msgRef.set({
            sender_id: finalSenderId,
            recipient_id: recipientId,
            content,
            is_system: !!isSystem,
            created_at: new Date(),
        });

        // NOTIFICAR POR SOCKET
        try {
            const io = getIO();
            const payloadMessage = {
                ...msgRef.data ? await msgRef.get().then(d => d.data()) : {},
                id: msgRef.id,
                sender_name: senderUsername,
                recipient_name: recipientUsername,
                created_at: new Date().toISOString(),
                is_read: false,
            };

            io.to(recipientId).emit('new_message', { message: payloadMessage });
        } catch (e) {
            console.error('Error socket emit:', e);
        }

        res.status(201).json({ success: true, message: 'Mensaje enviado.', data: { id: msgRef.id, recipient_id: recipientId, content, is_read: false, created_at: new Date().toISOString() } });

    } catch (err) {
        console.error('Error enviando mensaje:', err);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
};

exports.getMyMessages = async (req, res) => {
    const userId = req.user.id;

    try {
        // Obtener mensajes donde el usuario es destinatario
        const recipientSnap = await db.collection('messages')
            .where('recipient_id', '==', userId)
            .orderBy('created_at', 'desc')
            .limit(100)
            .get();

        // Obtener mensajes donde el usuario es remitente  
        const senderSnap = await db.collection('messages')
            .where('sender_id', '==', userId)
            .orderBy('created_at', 'desc')
            .limit(100)
            .get();

        // Combinar y ordenar por fecha
        let messages = [];
        
        for (const doc of recipientSnap.docs) {
            const data = doc.data();
            let senderName = 'Sistema';
            if (data.sender_id) {
                const sDoc = await db.collection('players').doc(data.sender_id).get();
                if (sDoc.exists) senderName = sDoc.data().username;
            }
            messages.push({ ...data, id: doc.id, sender_name: senderName, recipient_name: 'me' });
        }

        for (const doc of senderSnap.docs) {
            const data = doc.data();
            let recipientName = '';
            if (data.recipient_id) {
                const rDoc = await db.collection('players').doc(data.recipient_id).get();
                if (rDoc.exists) recipientName = rDoc.data().username;
            }
            messages.push({ ...data, id: doc.id, sender_name: 'me', recipient_name: recipientName });
        }

        // Ordenar por fecha descendente y limitar
        messages.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        
        res.json({ success: true, messages: messages.slice(0, 200) });

    } catch (err) {
        console.error('Error obteniendo mensajes:', err);
        res.status(500).json({ message: 'Error al cargar mensajes.' });
    }
};

exports.markAsRead = async (req, res) => {
    const userId = req.user.id;
    const { messageId } = req.body;

    try {
        const msgRef = db.collection('messages').doc(messageId);
        const msgDoc = await msgRef.get();

        if (!msgDoc.exists || msgDoc.data().recipient_id !== userId) {
            return res.status(404).json({ message: 'Mensaje no encontrado o no eres el destinatario.' });
        }

        await msgRef.update({ is_read: true, read_at: new Date() });
        
        // NOTIFICAR al emisor
        try {
            const io = getIO();
            io.to(msgDoc.data().sender_id).emit('message_read', { messageId });
        } catch (e) {}

        res.json({ success: true, message: 'Marcado como leido.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al actualizar estado.' });
    }
};

exports.getUnreadCount = async (req, res) => {
    const userId = req.user.id;
    try {
        const resultSnap = await db.collection('messages')
            .where('recipient_id', '==', userId)
            .where('is_read', '==', false)
            .get();
        res.json({ success: true, count: resultSnap.size });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error contando mensajes.' });
    }
};
