'use client';

import { useEffect, useMemo, useState, useRef } from 'react';
import { collection, query, orderBy, onSnapshot, where, limit, getDocs, startAfter } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getTemplateContent } from '@/lib/templates';

export default function Dashboard() {
    const [conversations, setConversations] = useState([]); // Changed from orders to conversations
    const [selectedConversation, setSelectedConversation] = useState(null);
    const [search, setSearch] = useState('');
    const [lastByPhone, setLastByPhone] = useState({});
    const [lastMessageByPhone, setLastMessageByPhone] = useState({});
    const [loading, setLoading] = useState(false);

    // Request notification permission on load
    useEffect(() => {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }, []);

    // Track all messages and group by phone number
    useEffect(() => {
        const q = query(
            collection(db, 'whatsappMessages'),
            orderBy('timestamp', 'desc'),
            limit(200)
        );

        const unsub = onSnapshot(q, (snapshot) => {
            const phoneMap = {};

            // Process ALL docs, not just changes
            snapshot.docs.forEach((doc) => {
                const data = doc.data();
                const phone = data.customer;
                if (!phone) return;

                const ts = data.created_at?.toDate ? data.created_at.toDate().getTime() : new Date(data.timestamp).getTime();
                if (!Number.isFinite(ts)) return;

                if (!phoneMap[phone] || ts > phoneMap[phone].timestamp) {
                    phoneMap[phone] = {
                        timestamp: ts,
                        text: data.text || (data.message_type === 'button' ? `🔘 ${data.button_title}` : (data.message_type === 'template' ? `📋 ${data.template_name}` : (data.message_type === 'image' ? '📷 Image' : (data.message_type === 'video' ? '🎥 Video' : (data.message_type === 'audio' || data.message_type === 'voice' ? '🎤 Voice message' : `[${data.message_type}]`))))),
                        direction: data.direction,
                        order_number: data.order_number
                    };
                }
            });

            // Send browser notifications for NEW inbound messages only
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    const data = change.doc.data();

                    if (data.direction === 'inbound') {
                        if ('Notification' in window && Notification.permission === 'granted') {
                            const phone = data.customer;
                            const messageText = data.text ||
                                (data.message_type === 'button' ? `🔘 ${data.button_title}` :
                                    (data.message_type === 'image' ? '📷 Image' :
                                        (data.message_type === 'video' ? '🎥 Video' :
                                            (data.message_type === 'audio' || data.message_type === 'voice' ? '🎤 Voice message' :
                                                `[${data.message_type}]`))));

                            new Notification('New WhatsApp Message', {
                                body: `From +${phone}: ${messageText.substring(0, 100)}`,
                                icon: '/whatsapp-icon.png',
                                tag: phone,
                            });
                        }
                    }
                }
            });

            setLastByPhone(Object.fromEntries(
                Object.entries(phoneMap).map(([phone, data]) => [phone, data.timestamp])
            ));
            setLastMessageByPhone(phoneMap);
        });

        return unsub;
    }, []);

    // Load all orders and group by phone
    useEffect(() => {
        const loadOrders = async () => {
            setLoading(true);
            try {
                const q = query(
                    collection(db, 'orders'),
                    orderBy('confirmation_sent_at', 'desc'),
                    limit(500) // Load a lot to ensure we get all unique phones
                );

                const snapshot = await getDocs(q);
                const orders = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));

                // Group orders by phone number
                const phoneGroups = {};
                orders.forEach(order => {
                    const phone = order.phone_e164?.replace('+', '');
                    if (!phone) return;

                    if (!phoneGroups[phone]) {
                        phoneGroups[phone] = {
                            phone: phone,
                            phone_e164: order.phone_e164,
                            name: order.name,
                            orders: [],
                            latestOrder: order
                        };
                    }
                    phoneGroups[phone].orders.push(order);
                });

                setConversations(Object.values(phoneGroups));
            } catch (error) {
                console.error('Error loading orders:', error);
            } finally {
                setLoading(false);
            }
        };

        loadOrders();
    }, []);

    const displayConversations = useMemo(() => {
        const toMillis = (ts) => {
            if (!ts) return 0;
            if (ts.toDate) return ts.toDate().getTime();
            return new Date(ts).getTime() || 0;
        };

        return conversations
            .filter((conv) => {
                if (!search) return true;
                const searchLower = search.toLowerCase();
                return (
                    (conv.phone_e164 || '').includes(search) ||
                    (conv.name || '').toLowerCase().includes(searchLower) ||
                    conv.orders.some(o => String(o.order_number || '').includes(search))
                );
            })
            .sort((a, b) => {
                // Sort by last message time if exists, otherwise by latest order
                const aLast = lastByPhone[a.phone] || toMillis(a.latestOrder.confirmation_sent_at);
                const bLast = lastByPhone[b.phone] || toMillis(b.latestOrder.confirmation_sent_at);
                return bLast - aLast;
            });
    }, [conversations, search, lastByPhone]);

    return (
        <div className="flex h-screen bg-gray-50">
            {/* Conversations list */}
            <div className="w-1/3 bg-white border-r border-gray-200 overflow-y-auto">
                <div className="p-4 border-b border-gray-200 bg-emerald-600">
                    <h1 className="text-xl font-bold text-white">Conversations</h1>
                    <div className="mt-3">
                        <input
                            className="w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                            placeholder="Search by name, phone, or order..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="p-4 text-center text-gray-500">Loading conversations...</div>
                ) : (
                    displayConversations.map(conv => {
                        const lastMsg = lastMessageByPhone[conv.phone];
                        return (
                            <div
                                key={conv.phone}
                                onClick={() => setSelectedConversation(conv)}
                                className={`p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors ${
                                    selectedConversation?.phone === conv.phone ? 'bg-emerald-50' : ''
                                }`}
                            >
                                <div className="font-semibold text-gray-900">{conv.name || conv.phone_e164}</div>
                                <div className="text-sm text-gray-600">
                                    {conv.orders.length} order{conv.orders.length > 1 ? 's' : ''} • {conv.phone_e164}
                                </div>
                                {lastMsg && (
                                    <div className={`text-xs mt-1 truncate ${
                                        lastMsg.direction === 'outbound' ? 'text-gray-500' : 'text-gray-700 font-medium'
                                    }`}>
                                        {lastMsg.direction === 'outbound' && '✓ '}
                                        {lastMsg.text}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {/* Message thread */}
            <div className="w-2/3 flex flex-col bg-gray-50">
                {selectedConversation ? (
                    <MessageThread
                        key={selectedConversation.phone}
                        conversation={selectedConversation}
                    />
                ) : (
                    <div className="flex-1 flex items-center justify-center text-gray-400">
                        Select a conversation
                    </div>
                )}
            </div>
        </div>
    );
}

function MessageThread({ conversation }) {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [sending, setSending] = useState(false);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    // Load all messages for this phone number
    useEffect(() => {
        if (!conversation?.phone) return;

        // Query for messages with customer field (with or without +)
        const qWithoutPlus = query(
            collection(db, 'whatsappMessages'),
            where('customer', '==', conversation.phone),
            orderBy('timestamp', 'asc')
        );

        const qWithPlus = query(
            collection(db, 'whatsappMessages'),
            where('customer', '==', `+${conversation.phone}`),
            orderBy('timestamp', 'asc')
        );

        let allMessages = [];

        const unsubWithoutPlus = onSnapshot(qWithoutPlus, (snapshot) => {
            const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // Merge with existing messages, avoid duplicates
            allMessages = [...allMessages.filter(m => !messages.find(nm => nm.id === m.id)), ...messages];

            // Sort by timestamp
            allMessages.sort((a, b) => {
                const aTime = new Date(a.timestamp).getTime();
                const bTime = new Date(b.timestamp).getTime();
                return aTime - bTime;
            });

            setMessages([...allMessages]);
            setTimeout(() => scrollToBottom(), 200);
        });

        const unsubWithPlus = onSnapshot(qWithPlus, (snapshot) => {
            const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // Merge with existing messages, avoid duplicates
            allMessages = [...allMessages.filter(m => !messages.find(nm => nm.id === m.id)), ...messages];

            // Sort by timestamp
            allMessages.sort((a, b) => {
                const aTime = new Date(a.timestamp).getTime();
                const bTime = new Date(b.timestamp).getTime();
                return aTime - bTime;
            });

            setMessages([...allMessages]);
            setTimeout(() => scrollToBottom(), 200);
        });

        return () => {
            unsubWithoutPlus();
            unsubWithPlus();
        };
    }, [conversation?.phone]);

    useEffect(() => {
        if (messages.length > 0) {
            scrollToBottom();
        }
    }, [messages.length]);

    const getMessageContent = (msg) => {
        // Handle images
        if (msg.message_type === 'image') {
            const imageUrl = msg.raw?.image?.url;
            if (!imageUrl) return `📷 [Image - no URL found]`;

            const railwayUrl = process.env.NEXT_PUBLIC_RAILWAY_URL || 'https://wa-confirmation-automation-production.up.railway.app';
            const proxiedUrl = `${railwayUrl}/api/proxyImage?url=${encodeURIComponent(imageUrl)}`;

            return (
                <div>
                    <img
                        src={proxiedUrl}
                        alt="Received image"
                        className="rounded max-w-full"
                        onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'block';
                        }}
                    />
                    <div style={{display: 'none'}} className="text-sm text-gray-500">Image unavailable</div>
                </div>
            );
        }

        // Handle audio/voice
        if (msg.message_type === 'audio' || msg.message_type === 'voice') {
            const audioUrl = msg.raw?.audio?.url || msg.raw?.voice?.url;
            if (!audioUrl) return `🎤 [Voice message - no URL found]`;

            const railwayUrl = process.env.NEXT_PUBLIC_RAILWAY_URL || 'https://wa-confirmation-automation-production.up.railway.app';
            const proxiedUrl = `${railwayUrl}/api/proxyImage?url=${encodeURIComponent(audioUrl)}`;

            return (
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        🎤 <span className="text-xs">Voice message</span>
                    </div>
                    <audio controls className="max-w-full">
                        <source src={proxiedUrl} type="audio/ogg" />
                        <source src={proxiedUrl} type="audio/mpeg" />
                    </audio>
                </div>
            );
        }

        // Handle videos
        if (msg.message_type === 'video') {
            const videoUrl = msg.raw?.video?.url;
            if (!videoUrl) return `🎥 [Video - no URL found]`;

            const railwayUrl = process.env.NEXT_PUBLIC_RAILWAY_URL || 'https://wa-confirmation-automation-production.up.railway.app';
            const proxiedUrl = `${railwayUrl}/api/proxyImage?url=${encodeURIComponent(videoUrl)}`;

            return (
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        🎥 <span className="text-xs">Video</span>
                    </div>
                    <video controls className="rounded max-w-full" style={{ maxHeight: '400px' }}>
                        <source src={proxiedUrl} type="video/mp4" />
                    </video>
                </div>
            );
        }

        // Handle button clicks
        if (msg.message_type === 'button' && msg.button_title) {
            return `🔘 ${msg.button_title}`;
        }

        // Handle template messages
        if (msg.message_type === 'template' && msg.template_name) {
            return getTemplateContent(msg.template_name, msg.variables);
        }

        // Handle regular text
        if (msg.text) {
            return msg.text;
        }

        return `[${msg.message_type || 'Unknown message type'}]`;
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || sending) return;

        setSending(true);

        try {
            const response = await fetch('/api/send-message', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phone: conversation.phone_e164,
                    message: newMessage,
                    order_number: conversation.orders[0]?.order_number || null
                })
            });

            if (!response.ok) throw new Error('Failed to send message');
            setNewMessage('');
        } catch (error) {
            console.error('Error sending message:', error);
            alert('Failed to send message. Try again.');
        } finally {
            setSending(false);
        }
    };

    return (
        <>
            {/* Header */}
            <div className="p-4 bg-emerald-600 border-b border-emerald-700">
                <div className="font-semibold text-white">{conversation.name || conversation.phone_e164}</div>
                <div className="text-sm text-emerald-100">{conversation.phone_e164}</div>
                <div className="text-xs text-emerald-200 mt-1">
                    Orders: {conversation.orders.map(o => `#${o.order_number}`).join(', ')}
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
                {messages.map((msg) => (
                    <div key={msg.id} className={`mb-3 flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-xs px-4 py-2 rounded-lg shadow-sm ${
                            msg.direction === 'outbound'
                                ? 'bg-emerald-500 text-white'
                                : msg.message_type === 'button'
                                    ? 'bg-blue-50 text-gray-800 border border-blue-200'
                                    : 'bg-white text-gray-800 border border-gray-200'
                        }`}>
                            <div className="break-words">{getMessageContent(msg)}</div>
                            <div className={`text-xs mt-1 ${msg.direction === 'outbound' ? 'text-emerald-100' : 'text-gray-500'}`}>
                                {new Date(msg.timestamp).toLocaleTimeString('en-US')}
                            </div>
                            {msg.direction === 'outbound' && msg.status && (
                                <div className="text-xs mt-1 text-emerald-100 capitalize">{msg.status}</div>
                            )}
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            {/* Message input */}
            <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-gray-200">
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type a message..."
                        disabled={sending}
                        className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-gray-100"
                    />
                    <button
                        type="submit"
                        disabled={!newMessage.trim() || sending}
                        className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                    >
                        {sending ? 'Sending...' : 'Send'}
                    </button>
                </div>
            </form>
        </>
    );
}