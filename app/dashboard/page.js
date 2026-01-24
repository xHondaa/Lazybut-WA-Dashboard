'use client';

import { useEffect, useMemo, useState } from 'react';
import { collection, query, orderBy, onSnapshot, where, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function Dashboard() {
    const [orders, setOrders] = useState([]);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [searchPhone, setSearchPhone] = useState('');
    const [searchOrder, setSearchOrder] = useState('');
    const [lastByOrder, setLastByOrder] = useState({});

    useEffect(() => {
        const q = query(
            collection(db, 'whatsappMessages'),
            orderBy('timestamp', 'desc'),
            limit(500)
        );
        const unsub = onSnapshot(q, (snapshot) => {
            const updates = {};
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'removed') return;
                const data = change.doc.data();
                const ord = data.order_number;
                if (!ord) return;
                const ts = data.created_at?.toDate ? data.created_at.toDate().getTime() : new Date(data.timestamp).getTime();
                if (!Number.isFinite(ts)) return;
                updates[ord] = Math.max(updates[ord] || 0, ts);
            });
            if (Object.keys(updates).length) {
                setLastByOrder((prev) => {
                    const next = { ...prev };
                    Object.entries(updates).forEach(([ord, ts]) => {
                        next[ord] = Math.max(prev[ord] || 0, ts);
                    });
                    return next;
                });
            }
        });
        return unsub;
    }, []);

    const displayOrders = useMemo(() => {
        const toMillis = (ts) => {
            if (!ts) return 0;
            if (ts.toDate) return ts.toDate().getTime();
            return new Date(ts).getTime() || 0;
        };
        return orders
            .filter((o) => {
                const phoneOk = !searchPhone || (o.phone_e164 || '').includes(searchPhone);
                const orderOk = !searchOrder || String(o.order_number || '').includes(searchOrder);
                return phoneOk && orderOk;
            })
            .sort((a, b) => {
                const aLast = lastByOrder[a.order_number] || toMillis(a.confirmation_sent_at);
                const bLast = lastByOrder[b.order_number] || toMillis(b.confirmation_sent_at);
                return bLast - aLast;
            });
    }, [orders, searchPhone, searchOrder, lastByOrder]);

    useEffect(() => {
        const q = query(
            collection(db, 'orders'),
            orderBy('confirmation_sent_at', 'desc'),
            limit(50)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const orderData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setOrders(orderData);
        });

        return () => unsubscribe();
    }, []);

    return (
        <div className="flex h-screen bg-gray-50">
            {/* Conversations list */}
            <div className="w-1/3 bg-white border-r border-gray-200 overflow-y-auto">
                <div className="p-4 border-b border-gray-200 bg-emerald-600">
                    <h1 className="text-xl font-bold text-white">Conversations</h1>
                    <div className="mt-3 flex gap-2">
                        <input
                            className="w-1/2 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                            placeholder="Search phone"
                            value={searchPhone}
                            onChange={(e) => setSearchPhone(e.target.value)}
                        />
                        <input
                            className="w-1/2 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                            placeholder="Search order"
                            value={searchOrder}
                            onChange={(e) => setSearchOrder(e.target.value)}
                        />
                    </div>
                </div>
                {displayOrders.map(order => (
                    <div
                        key={order.id}
                        onClick={() => setSelectedOrder({
                            id: order.id,
                            order_number: order.order_number,
                            phone_e164: order.phone_e164,
                        })}
                        className={`p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors ${
                            selectedOrder?.order_number === order.order_number ? 'bg-emerald-50' : ''
                        }`}
                    >
                        <div className="font-semibold text-gray-900">{order.phone_e164}</div>
                        <div className="text-sm text-gray-600">Order #{order.order_number}</div>
                        <div className="text-xs text-gray-500 mt-1">{order.status}</div>
                    </div>
                ))}
            </div>

            {/* Message thread */}
            <div className="w-2/3 flex flex-col bg-gray-50">
                {selectedOrder ? (
                    <MessageThread
                        key={selectedOrder.order_number}
                        orderId={selectedOrder.id}
                        orderNumber={selectedOrder.order_number}
                        phoneNumber={selectedOrder.phone_e164}
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

function MessageThread({ orderNumber, phoneNumber }) {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [sending, setSending] = useState(false);

    useEffect(() => {
        if (!orderNumber) return;

        const qNum = query(
            collection(db, 'whatsappMessages'),
            where('order_number', '==', Number(orderNumber)),
            orderBy('timestamp', 'asc')
        );

        const qStr = query(
            collection(db, 'whatsappMessages'),
            where('order_number', '==', String(orderNumber)),
            orderBy('timestamp', 'asc')
        );

        const unsubNum = onSnapshot(qNum, (snapshot) => {
            setMessages((prev) => {
                let next = [...prev];
                snapshot.docChanges().forEach((change) => {
                    const data = { id: change.doc.id, ...change.doc.data() };
                    if (change.type === 'added') {
                        const exists = next.some(m => m.id === data.id);
                        if (!exists) next.push(data);
                    } else if (change.type === 'modified') {
                        next = next.map((m) => (m.id === data.id ? data : m));
                    } else if (change.type === 'removed') {
                        next = next.filter((m) => m.id !== data.id);
                    }
                });
                return next.sort((a, b) => {
                    const aTime = new Date(a.timestamp).getTime();
                    const bTime = new Date(b.timestamp).getTime();
                    return aTime - bTime;
                });
            });
        });

        const unsubStr = onSnapshot(qStr, (snapshot) => {
            setMessages((prev) => {
                let next = [...prev];
                snapshot.docChanges().forEach((change) => {
                    const data = { id: change.doc.id, ...change.doc.data() };
                    if (change.type === 'added') {
                        const exists = next.some(m => m.id === data.id);
                        if (!exists) next.push(data);
                    } else if (change.type === 'modified') {
                        next = next.map((m) => (m.id === data.id ? data : m));
                    } else if (change.type === 'removed') {
                        next = next.filter((m) => m.id !== data.id);
                    }
                });
                return next.sort((a, b) => {
                    const aTime = new Date(a.timestamp).getTime();
                    const bTime = new Date(b.timestamp).getTime();
                    return aTime - bTime;
                });
            });
        });

        return () => {
            unsubNum();
            unsubStr();
        };
    }, [orderNumber]);

    const getMessageContent = (msg) => {
        // Handle images
        if (msg.message_type === 'image') {
            console.log('Image message:', msg);
            console.log('Image URL:', msg.raw?.image?.url);

            const imageUrl = msg.raw?.image?.url;

            if (imageUrl) {
                return (
                    <div>
                        <img
                            src={imageUrl}
                            alt="Received image"
                            className="rounded max-w-full"
                            onError={(e) => {
                                console.error('Image failed to load:', imageUrl);
                                e.target.style.display = 'none';
                                e.target.nextSibling.style.display = 'block';
                            }}
                            onLoad={() => console.log('Image loaded successfully')}
                        />
                        <div style={{display: 'none'}} className="text-sm text-gray-500">
                            Image unavailable
                        </div>
                    </div>
                );
            }

            return '📷 [Image - URL not available]';
        }

        // Handle button clicks
        if (msg.message_type === 'button' && msg.button_title) {
            return `🔘 ${msg.button_title}`;
        }

        // Handle template messages
        if (msg.message_type === 'template' && msg.template_name) {
            return `📋 Template: ${msg.template_name}`;
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
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    phone: phoneNumber,
                    message: newMessage,
                    order_number: orderNumber
                })
            });

            if (!response.ok) {
                throw new Error('Failed to send message');
            }

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
            <div className="p-4 bg-emerald-600 border-b border-emerald-700">
                <div className="font-semibold text-white">{phoneNumber}</div>
                <div className="text-sm text-emerald-100">Order #{orderNumber}</div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        className={`mb-3 flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div className={`max-w-xs px-4 py-2 rounded-lg shadow-sm ${
                            msg.direction === 'outbound'
                                ? 'bg-emerald-500 text-white'
                                : msg.message_type === 'button'
                                    ? 'bg-blue-50 text-gray-800 border border-blue-200'
                                    : 'bg-white text-gray-800 border border-gray-200'
                        }`}>
                            <div className="break-words">
                                {getMessageContent(msg)}
                            </div>
                            <div className={`text-xs mt-1 ${
                                msg.direction === 'outbound' ? 'text-emerald-100' : 'text-gray-500'
                            }`}>
                                {msg.created_at?.toDate
                                    ? msg.created_at.toDate().toLocaleTimeString()
                                    : new Date(msg.timestamp).toLocaleTimeString()}
                            </div>
                            {msg.direction === 'outbound' && msg.status && (
                                <div className="text-xs mt-1 text-emerald-100 capitalize">
                                    {msg.status}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
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