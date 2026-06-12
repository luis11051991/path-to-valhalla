import { db } from '../lib/firebase';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';

const getUnreadCount = async (userId) => {
    return new Promise((resolve) => {
        const q = query(
            collection(db, 'messages'),
            where('recipient_id', '==', userId),
            where('is_read', '==', false)
        );
        const unsubscribe = onSnapshot(q, (snap) => {
            resolve(snap.size);
            unsubscribe();
        });
    });
};

const subscribeToMessages = (userId, callback) => {
    // Mensajes recibidos (como destinatario)
    const receivedQ = query(
        collection(db, 'messages'),
        where('recipient_id', '==', userId),
        orderBy('created_at', 'desc')
    );

    // Mensajes enviados (como remitente)  
    const sentQ = query(
        collection(db, 'messages'),
        where('sender_id', '==', userId),
        orderBy('created_at', 'desc')
    );

    let allMessages = [];

    const handleUpdate = () => {
        // Combinar mensajes recibidos y enviados
        return new Promise((resolve) => {
            let receivedDone = false, sentDone = false;
            let receivedMsgs = [], sentMsgs = [];

            const unsubscribe1 = onSnapshot(receivedQ, (snap) => {
                receivedMsgs = snap.docs.map(d => ({ ...d.data(), id: d.id }));
                receivedDone = true;
                if (sentDone) resolve([...receivedMsgs, ...sentMsgs]);
            });

            const unsubscribe2 = onSnapshot(sentQ, (snap) => {
                sentMsgs = snap.docs.map(d => ({ ...d.data(), id: d.id }));
                sentDone = true;
                if (receivedDone) resolve([...receivedMsgs, ...sentMsgs]);
            });

            // Cleanup after first emit
            setTimeout(() => { unsubscribe1(); unsubscribe2(); }, 500);
        }).then(msgs => {
            msgs.sort((a, b) => new Date(b.created_at || b.createdAt) - new Date(a.created_at || a.createdAt));
            if (callback) callback(msgs.slice(0, 200));
        });
    };

    // Initial load
    handleUpdate();

    return () => { /* cleanup */ };
};

const sendMessage = async (recipientUsername, content) => {
    try {
        // Buscar destinatario por username en Firestore
        const recipientSnap = await db.collection('players')
            .where('username', '==', recipientUsername)
            .limit(1)
            .get();

        if (recipientSnap.empty) throw new Error('Usuario no encontrado.');

        const recipientId = recipientSnap.docs[0].id;

        const messageRef = await db.collection('messages').add({
            sender_id: null, // Se setea desde backend o frontend token
            recipient_id: recipientId,
            content,
            is_system: false,
            is_read: false,
            created_at: serverTimestamp(),
        });

        return { success: true, data: { id: messageRef.id } };
    } catch (err) {
        console.error('Error enviando mensaje:', err);
        throw err;
    }
};

const markAsRead = async (messageId, recipientId) => {
    try {
        await db.collection('messages').doc(messageId).update({
            is_read: true,
            read_at: serverTimestamp(),
        });
    } catch (err) {
        console.error(err);
    }
};

const searchUsers = async (queryStr) => {
    try {
        const resultSnap = await db.collection('players')
            .where('username', '>=', queryStr)
            .where('username', '<=', queryStr + '\uf8ff')
            .limit(10)
            .get();

        return resultSnap.docs.map(d => ({ id: d.id, username: d.data().username }));
    } catch (err) {
        console.error(err);
        return [];
    }
};

export const messageService = {
    sendMessage,
    subscribeToMessages,
    markAsRead,
    getUnreadCount,
    searchUsers,
};
