import React, { useState, useEffect, useRef } from 'react';
import { messageService } from '../services/messageService';
import { Send, User, Shield, Info } from 'lucide-react';

// Componente para una burbuja de mensaje
const MessageBubble = ({ message, isMe }) => {
    const time = new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return (
        <div className={`flex w-full mb-4 ${isMe ? 'justify-end' : 'justify-start'}`}>
            <div className={`
                max-w-[70%] rounded-lg p-3 relative
                ${message.is_system
                    ? 'bg-amber-900/40 border border-amber-500/50 text-amber-100'
                    : isMe
                        ? 'bg-slate-700 text-slate-100 rounded-br-none'
                        : 'bg-slate-800 text-slate-300 rounded-bl-none'}
            `}>
                {message.is_system && (
                    <div className="flex items-center gap-2 mb-1 text-xs text-amber-400 font-bold uppercase tracking-wider">
                        <Shield size={12} />
                        Sistema
                    </div>
                )}
                <p className="text-sm leading-relaxed">{message.content}</p>
                <span className="text-[10px] opacity-50 block text-right mt-1">{time}</span>
            </div>
        </div>
    );
};

const MessagingPage = ({ user, socket, onMessageRead }) => {
    const [messages, setMessages] = useState([]);
    const [conversations, setConversations] = useState({}); // Key: UserID, Value: { username, messages: [] }
    const [selectedId, setSelectedId] = useState(null); // ID del usuario del chat abierto
    const [newMessage, setNewMessage] = useState('');
    const [newRecipientName, setNewRecipientName] = useState(''); // Nombre para iniciar nuevo chat
    const [filteredUsers, setFilteredUsers] = useState([]); // Resultados búsqueda
    const [showSuggestions, setShowSuggestions] = useState(false);

    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const scrollRef = useRef(null);

    // Cargar mensajes
    const loadMessages = async () => {
        try {
            setLoading(true);
            const data = await messageService.getMyMessages();
            if (data.success) {
                processMessages(data.messages);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // Procesar mensajes en conversaciones (AGRUPADO POR ID)
    const processMessages = (msgs) => {
        const convos = {};

        msgs.forEach(msg => {
            const isMeSender = String(msg.sender_id) === String(user.id);

            // Determinar ID y Nombre del "Otro"
            let otherId, otherName;

            if (msg.is_system) {
                otherId = 'system';
                otherName = 'Sistema';
            } else {
                otherId = isMeSender ? msg.recipient_id : msg.sender_id;
                otherName = isMeSender ? msg.recipient_name : msg.sender_name;
            }

            if (!otherId) return; // Skip invalid

            if (!convos[otherId]) {
                convos[otherId] = {
                    username: otherName || 'Desconocido',
                    messages: []
                };
            }

            // Actualizar nombre si encontramos uno mejor (no Desconocido)
            if (otherName && convos[otherId].username === 'Desconocido') {
                convos[otherId].username = otherName;
            }

            convos[otherId].messages.push(msg);
        });

        // Ordenar mensajes
        Object.keys(convos).forEach(key => {
            convos[key].messages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        });

        // Ordenar conversaciones por fecha del último mensaje
        const orderedConvos = {};
        Object.keys(convos)
            .sort((a, b) => {
                const lastA = convos[a].messages[convos[a].messages.length - 1];
                const lastB = convos[b].messages[convos[b].messages.length - 1];
                return new Date(lastB.created_at) - new Date(lastA.created_at);
            })
            .forEach(key => {
                orderedConvos[key] = convos[key];
            });

        setConversations(orderedConvos);
        setMessages(msgs);
    };

    // Efecto Socket
    useEffect(() => {
        if (!socket) return;
        const handleNewMessage = (data) => {
            const newMsg = data.message;

            // Patch nombres si faltan (aunque el backend ya los envía)
            if (newMsg.sender_id !== user.id && !newMsg.sender_name) {
                newMsg.sender_name = data.senderUsername || 'Desconocido';
            }

            setMessages(prev => {
                const updated = [...prev, newMsg];
                processMessages(updated);
                return updated;
            });
        };

        socket.on('new_message', handleNewMessage);
        return () => socket.off('new_message', handleNewMessage);
    }, [socket, user.id]);

    useEffect(() => {
        loadMessages();
    }, []);

    // Auto-scroll
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [selectedId, conversations]);

    // Marcar como leídos
    useEffect(() => {
        if (selectedId && conversations[selectedId]) {
            const msgs = conversations[selectedId].messages;
            const unreadIds = msgs
                .filter(m => !m.is_read && String(m.recipient_id) === String(user.id))
                .map(m => m.id);

            if (unreadIds.length > 0) {
                unreadIds.forEach(id => {
                    messageService.markAsRead(id).then(() => {
                        if (onMessageRead) onMessageRead();
                    });
                });

                // Optimistic update
                setConversations(prev => {
                    const newConvos = { ...prev };
                    if (newConvos[selectedId]) {
                        newConvos[selectedId].messages = newConvos[selectedId].messages.map(m => ({ ...m, is_read: true }));
                    }
                    return newConvos;
                });
            }
        }
    }, [selectedId, messages, user.id, conversations, onMessageRead]);

    const handleSend = async (e) => {
        e.preventDefault();
        if (!newMessage.trim()) return;

        // Determinar destinatario (username)
        let recipientUsername = null;
        if (selectedId && conversations[selectedId]) {
            recipientUsername = conversations[selectedId].username;
        } else {
            recipientUsername = newRecipientName;
        }

        if (!recipientUsername) return;

        setSending(true);
        try {
            await messageService.sendMessage(recipientUsername, newMessage);
            setNewMessage('');

            if (!selectedId) {
                // Si era nuevo chat, limpiamos input y recargamos para que aparezca la conversa
                setNewRecipientName('');
                await loadMessages();
                // Nota: Podríamos intentar predecir el ID pero mejor recargar o esperar el socket
                // Si el socket llega rápido, processMessages lo pondrá.
            } else {
                await loadMessages();
            }
        } catch (err) {
            alert(err.message);
        } finally {
            setSending(false);
        }
    };

    const conversationIds = Object.keys(conversations);

    return (
        <div className="h-full flex flex-col md:flex-row gap-4 p-4 md:p-6 overflow-hidden max-h-screen">
            {/* Lista */}
            <div className="w-full md:w-1/3 bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden flex flex-col">
                <div className="p-4 border-b border-slate-800 bg-black/20">
                    <h2 className="text-lg font-serif font-bold text-amber-500 flex items-center gap-2">
                        <User size={20} />
                        Mensajes
                    </h2>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    <button
                        onClick={() => setSelectedId(null)}
                        className={`w-full text-left p-3 rounded-lg transition-all border border-dashed border-slate-700 hover:border-amber-500/50 hover:bg-slate-800/50 ${selectedId === null ? 'bg-slate-800 border-amber-500/30' : ''}`}
                    >
                        <span className="text-sm font-bold text-amber-200">+ Nueva Conversación</span>
                    </button>

                    {conversationIds.map(id => {
                        const convo = conversations[id];
                        const lastMsg = convo.messages[convo.messages.length - 1];
                        const isActive = selectedId === id;
                        const isSystem = convo.username === 'Sistema';
                        const hasUnread = convo.messages.some(m => !m.is_read && String(m.recipient_id) === String(user.id));

                        return (
                            <button
                                key={id}
                                onClick={() => setSelectedId(id)}
                                className={`w-full text-left p-3 rounded-lg transition-all border relative ${isActive ? 'bg-amber-900/20 border-amber-500/50' : 'bg-slate-800/40 border-transparent hover:bg-slate-800'}`}
                            >
                                <div className="flex justify-between items-center mb-1">
                                    <span className={`font-bold text-sm ${isSystem ? 'text-amber-400' : 'text-slate-200'}`}>{convo.username}</span>
                                    <span className="text-[10px] text-slate-500">{new Date(lastMsg.created_at).toLocaleDateString()}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <p className={`text-xs truncate max-w-[80%] ${hasUnread ? 'text-slate-100 font-semibold' : 'text-slate-400 opacity-70'}`}>{lastMsg.content}</p>
                                    {hasUnread && <span className="h-2 w-2 rounded-full bg-red-500"></span>}
                                </div>
                            </button>
                        );
                    })}

                    {loading && <p className="text-center text-xs text-slate-500 py-4">Sincronizando...</p>}
                </div>
            </div>

            {/* Chat */}
            <div className="flex-1 bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden flex flex-col relative">
                <div className="p-4 border-b border-slate-800 bg-black/20 flex justify-between items-center">
                    <h3 className="font-bold text-slate-100 text-lg">
                        {selectedId && conversations[selectedId] ? conversations[selectedId].username : 'Nueva Conversación'}
                    </h3>
                    {selectedId && conversations[selectedId]?.username === 'Sistema' && <span className="text-xs text-amber-500 border border-amber-500/30 px-2 py-0.5 rounded">OFICIAL</span>}
                </div>

                <div
                    ref={scrollRef}
                    className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-slate-950/50 to-slate-900/50"
                >
                    {(!selectedId || !conversations[selectedId]) ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-500 opacity-60">
                            <Send size={48} className="mb-4" />
                            <p>Selecciona un chat o inicia uno nuevo</p>
                        </div>
                    ) : (
                        conversations[selectedId].messages.map(msg => (
                            <MessageBubble key={msg.id} message={msg} isMe={String(msg.sender_id) === String(user.id)} />
                        ))
                    )}
                </div>

                <div className="p-4 border-t border-slate-800 bg-black/20">
                    <form onSubmit={handleSend} className="flex flex-col gap-2">
                        {!selectedId && (
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Nombre de usuario del destinatario..."
                                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm text-slate-200 focus:border-amber-500 outline-none"
                                    value={newRecipientName}
                                    onChange={e => {
                                        const val = e.target.value;
                                        setNewRecipientName(val);
                                        if (val.length >= 4) {
                                            messageService.searchUsers(val).then(users => {
                                                setFilteredUsers(users);
                                                setShowSuggestions(true);
                                            });
                                        } else {
                                            setShowSuggestions(false);
                                        }
                                    }}
                                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                                />
                                {showSuggestions && filteredUsers.length > 0 && (
                                    <div className="absolute bottom-full left-0 w-full mb-1 bg-slate-800 border border-slate-700 rounded shadow-xl z-50 max-h-40 overflow-y-auto">
                                        {filteredUsers.map(u => (
                                            <button
                                                key={u.id}
                                                type="button"
                                                className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-amber-900/40 hover:text-amber-100"
                                                onClick={() => {
                                                    setNewRecipientName(u.username);
                                                    setShowSuggestions(false);
                                                }}
                                            >
                                                {u.username}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="flex gap-2">
                            <input
                                type="text"
                                placeholder={`Escribir mensaje...`}
                                className="flex-1 bg-slate-950 border border-slate-700 rounded p-2 text-sm text-slate-200 focus:border-amber-500 outline-none"
                                value={newMessage}
                                onChange={e => setNewMessage(e.target.value)}
                                disabled={selectedId && conversations[selectedId]?.username === 'Sistema'}
                            />
                            <button
                                type="submit"
                                disabled={sending || (selectedId && conversations[selectedId]?.username === 'Sistema')}
                                className="bg-amber-600 hover:bg-amber-500 text-black font-bold p-2 px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <Send size={18} />
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default MessagingPage;
