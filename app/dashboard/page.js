'use client';

import { useEffect, useMemo, useState, useRef } from 'react';
import { collection, query, orderBy, onSnapshot, where, limit, getDocs, startAfter } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getTemplateContent } from '@/lib/templates';

export default function Dashboard() {
    const [orders, setOrders] = useState([]);
    const [unassignedCustomers, setUnassignedCustomers] = useState([]); // Add this
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [search, setSearch] = useState('');
    const [lastByOrder, setLastByOrder] = useState({});
    const [lastMessageByOrder, setLastMessageByOrder] = useState({});
    const [lastVisible, setLastVisible] = useState(null);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);

    // Track unassigned messages (no order_number)
    useEffect(() => {
        const q = query(
            collection(db, 'whatsappMessages'),
            where('order_number', '==', null),
            orderBy('timestamp', 'desc'),
            limit(50)
        );

        const unsub = onSnapshot(q, (snapshot) => {
            const customerMap = {};

            snapshot.docs.forEach(doc => {
                const data = doc.data();
                const customer = data.customer;
                if (!customer) return;

                const ts = data.created_at?.toDate ? data.created_at.toDate().getTime() : new Date(data.timestamp).getTime();

                if (!customerMap[customer] || ts > customerMap[customer].timestamp) {
                    customerMap[customer] = {
                        customer: customer,
                        phone_e164: `+${customer}`,
                        lastMessage: data.text || (data.message_type === 'button' ? `🔘 ${data.button_title}` : (data.message_type === 'template' ? `📋 ${data.template_name}` : `[${data.message_type}]`)),
                        timestamp: ts,
                        direction: data.direction
                    };
                }
            });

            setUnassignedCustomers(Object.values(customerMap).sort((a, b) => b.timestamp - a.timestamp));
        });

        return unsub;
    }, []);

    // Load orders function
    const loadOrders = async (loadMore = false) => {
        if (loading) return;
        setLoading(true);

        try {
            // Load all orders, sorted by last_message_at if it exists, otherwise by confirmation_sent_at
            let q;
            if (loadMore && lastVisible) {
                q = query(
                    collection(db, 'orders'),
                    orderBy('confirmation_sent_at', 'desc'),
                    startAfter(lastVisible),
                    limit(20)
                );
            } else {
                q = query(
                    collection(db, 'orders'),
                    orderBy('confirmation_sent_at', 'desc'),
                    limit(20)
                );
            }

            const snapshot = await getDocs(q);

            if (snapshot.empty) {
                setHasMore(false);
                setLoading(false);
                return;
            }

            const newOrders = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
            setOrders(prev => loadMore ? [...prev, ...newOrders] : newOrders);
            setHasMore(snapshot.docs.length === 20);
        } catch (error) {
            console.error('Error loading orders:', error);
        } finally {
            setLoading(false);
        }
    };

    // Load initial orders
    useEffect(() => {
        loadOrders();
    }, []);

    const displayOrders = useMemo(() => {
        const toMillis = (ts) => {
            if (!ts) return 0;
            if (ts.toDate) return ts.toDate().getTime();
            return new Date(ts).getTime() || 0;
        };

        return orders
            .filter((o) => {
                if (!search) return true;
                const searchLower = search.toLowerCase();
                return (
                    (o.phone_e164 || '').includes(search) ||
                    String(o.order_number || '').includes(search) ||
                    (o.name || '').toLowerCase().includes(searchLower) ||
                    (o.status || '').toLowerCase().includes(searchLower)
                );
            })
            .sort((a, b) => {
                // Sort by last_message_at if it exists, otherwise by confirmation_sent_at
                const aLast = toMillis(a.last_message_at) || toMillis(a.confirmation_sent_at);
                const bLast = toMillis(b.last_message_at) || toMillis(b.confirmation_sent_at);
                return bLast - aLast;
            });
    }, [orders, search]);

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

                {/* Unassigned Messages Section */}
                {!search && unassignedCustomers.length > 0 && (
                    <>
                        <div className="p-2 bg-amber-50 border-b border-amber-200">
                            <div className="text-xs font-semibold text-amber-800 px-2">Unassigned Messages</div>
                        </div>
                        {unassignedCustomers.map(customer => (
                            <div
                                key={customer.customer}
                                onClick={() => setSelectedOrder({
                                    id: null,
                                    order_id: null,
                                    order_number: null,
                                    phone_e164: customer.phone_e164,
                                    customer: customer.customer,
                                })}
                                className={`p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors ${
                                    selectedOrder?.customer === customer.customer ? 'bg-emerald-50' : ''
                                }`}
                            >
                                <div className="font-semibold text-gray-900">{customer.phone_e164}</div>
                                <div className="text-sm text-amber-600">No order assigned</div>
                                <div className={`text-xs mt-1 truncate ${
                                    customer.direction === 'outbound' ? 'text-gray-500' : 'text-gray-700 font-medium'
                                }`}>
                                    {customer.direction === 'outbound' && '✓ '}
                                    {customer.lastMessage}
                                </div>
                            </div>
                        ))}
                        <div className="p-2 bg-gray-100 border-b border-gray-200">
                            <div className="text-xs font-semibold text-gray-600 px-2">Orders</div>
                        </div>
                    </>
                )}

                {loading && orders.length === 0 ? (
                    <div className="p-4 text-center text-gray-500">Loading conversations...</div>
                ) : (
                    displayOrders.map(order => {
                        const lastMsg = lastMessageByOrder[order.order_number];
                        return (
                            <div
                                key={order.id}
                                onClick={() => setSelectedOrder({
                                    id: order.id,
                                    order_id: order.order_id,
                                    order_number: order.order_number,
                                    phone_e164: order.phone_e164,
                                    customer: null,
                                })}
                                className={`p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors ${
                                    selectedOrder?.order_number === order.order_number ? 'bg-emerald-50' : ''
                                }`}
                            >
                                <div className="font-semibold text-gray-900">{order.name || order.phone_e164}</div>
                                <div className="text-sm text-gray-600">Order #{order.order_number}</div>
                                {lastMsg && (
                                    <div className={`text-xs mt-1 truncate ${
                                        lastMsg.direction === 'outbound' ? 'text-gray-500' : 'text-gray-700 font-medium'
                                    }`}>
                                        {lastMsg.direction === 'outbound' && '✓ '}
                                        {lastMsg.text}
                                    </div>
                                )}
                                <div className="text-xs text-gray-500 mt-1">{order.status}</div>
                            </div>
                        );
                    })
                )}

                {/* Load More Button */}
                {hasMore && !search && (
                    <div className="p-4">
                        <button
                            onClick={() => loadOrders(true)}
                            disabled={loading}
                            className="w-full py-2 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 disabled:bg-gray-100 disabled:text-gray-400 transition-colors"
                        >
                            {loading ? 'Loading...' : 'Load More'}
                        </button>
                    </div>
                )}
            </div>

            {/* Message thread */}
            <div className="w-2/3 flex flex-col bg-gray-50">
                {selectedOrder ? (
                    <MessageThread
                        key={selectedOrder.order_number || selectedOrder.customer}
                        orderId={selectedOrder.id}
                        shopifyId={selectedOrder.order_id}
                        orderNumber={selectedOrder.order_number}
                        phoneNumber={selectedOrder.phone_e164}
                        customer={selectedOrder.customer}
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

function MessageThread({orderId, shopifyId, orderNumber, phoneNumber, customer }) {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [sending, setSending] = useState(false);
    const messagesEndRef = useRef(null);
    const messagesContainerRef = useRef(null);
    const [loadingOlder, setLoadingOlder] = useState(false);
    const [hasMoreMessages, setHasMoreMessages] = useState(true);
    const [oldestMessage, setOldestMessage] = useState(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    // Load initial messages (most recent 50)
    useEffect(() => {

        if (customer && !orderNumber) {
            const q = query(
                collection(db, 'whatsappMessages'),
                where('customer', '==', customer),
                where('order_number', '==', null),
                orderBy('timestamp', 'desc'),
                limit(50)
            );

            const unsub = onSnapshot(q, (snapshot) => {
                const messageData = snapshot.docs
                    .map(doc => ({ id: doc.id, ...doc.data() }))
                    .reverse();

                setMessages(messageData);
                setTimeout(scrollToBottom, 100);
            });

            return () => unsub();
        }

        if (!orderNumber) return;

        const qNum = query(
            collection(db, 'whatsappMessages'),
            where('order_number', '==', Number(orderNumber)),
            orderBy('timestamp', 'desc'),
            limit(50)
        );

        const qStr = query(
            collection(db, 'whatsappMessages'),
            where('order_number', '==', String(orderNumber)),
            orderBy('timestamp', 'desc'),
            limit(50)
        );

        let allMessages = [];

        const unsubNum = onSnapshot(qNum, (snapshot) => {
            const numMessages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            allMessages = [...allMessages.filter(m => !numMessages.find(nm => nm.id === m.id)), ...numMessages];

            const sorted = allMessages.sort((a, b) => {
                const aTime = new Date(a.timestamp).getTime();
                const bTime = new Date(b.timestamp).getTime();
                return aTime - bTime;
            });

            setMessages(sorted);
            if (snapshot.docs.length > 0) {
                setOldestMessage(snapshot.docs[snapshot.docs.length - 1]);
            }
            setHasMoreMessages(snapshot.docs.length === 50);

            setTimeout(scrollToBottom, 100);
        });

        const unsubStr = onSnapshot(qStr, (snapshot) => {
            const strMessages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            allMessages = [...allMessages.filter(m => !strMessages.find(sm => sm.id === m.id)), ...strMessages];

            const sorted = allMessages.sort((a, b) => {
                const aTime = new Date(a.timestamp).getTime();
                const bTime = new Date(b.timestamp).getTime();
                return aTime - bTime;
            });

            setMessages(sorted);
        });

        return () => {
            unsubNum();
            unsubStr();
        };
    }, [orderNumber, customer]);

    // Load older messages when scrolling to top
    const loadOlderMessages = async () => {
        if (!oldestMessage || loadingOlder || !hasMoreMessages) return;

        setLoadingOlder(true);

        try {
            const q = query(
                collection(db, 'whatsappMessages'),
                where('order_number', '==', Number(orderNumber)),
                orderBy('timestamp', 'desc'),
                startAfter(oldestMessage),
                limit(30)
            );

            const snapshot = await getDocs(q);

            if (snapshot.empty) {
                setHasMoreMessages(false);
                setLoadingOlder(false);
                return;
            }

            const olderMessages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            setMessages(prev => {
                const combined = [...olderMessages, ...prev];
                return combined.sort((a, b) => {
                    const aTime = new Date(a.timestamp).getTime();
                    const bTime = new Date(b.timestamp).getTime();
                    return aTime - bTime;
                });
            });

            setOldestMessage(snapshot.docs[snapshot.docs.length - 1]);
            setHasMoreMessages(snapshot.docs.length === 30);
        } catch (error) {
            console.error('Error loading older messages:', error);
        } finally {
            setLoadingOlder(false);
        }
    };

    // Detect scroll to top
    const handleScroll = (e) => {
        const container = e.target;
        if (container.scrollTop === 0 && hasMoreMessages) {
            loadOlderMessages();
        }
    };

    const getMessageContent = (msg) => {
        // Handle images
        if (msg.message_type === 'image') {
            const imageUrl = msg.raw?.image?.url;

            if (!imageUrl) {
                return `📷 [Image - no URL found]`;
            }

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
                    <div style={{display: 'none'}} className="text-sm text-gray-500">
                        Image unavailable
                    </div>
                </div>
            );
        }
        // Handle audio/voice messages
        if (msg.message_type === 'audio' || msg.message_type === 'voice') {
            const audioUrl = msg.raw?.audio?.url || msg.raw?.voice?.url;

            if (!audioUrl) {
                return `🎤 [Voice message - no URL found]`;
            }

            const railwayUrl = process.env.NEXT_PUBLIC_RAILWAY_URL || 'https://wa-confirmation-automation-production.up.railway.app';
            const proxiedUrl = `${railwayUrl}/api/proxyImage?url=${encodeURIComponent(audioUrl)}`;

            return (
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        🎤 <span className="text-xs">Voice message</span>
                    </div>
                    <audio
                        controls
                        className="max-w-full"
                        onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'block';
                        }}
                    >
                        <source src={proxiedUrl} type="audio/ogg" />
                        <source src={proxiedUrl} type="audio/mpeg" />
                        Your browser does not support audio playback.
                    </audio>
                    <div style={{display: 'none'}} className="text-sm text-gray-500">
                        Audio unavailable
                    </div>
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

        // Fallback
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
            {/* Header */}
            <div className="p-4 bg-emerald-600 border-b border-emerald-700 flex justify-between items-center">
                <div>
                    <div className="font-semibold text-white">{phoneNumber}</div>
                    {orderNumber ? (
                        <div className="text-sm text-emerald-100">
                            Order #{orderNumber}
                        </div>
                    ) : (
                        <div className="text-sm text-amber-200">
                            No order assigned
                        </div>
                    )}
                </div>

                {shopifyId && (
                    <a
                        href={`https://admin.shopify.com/store/lazybut/orders/${shopifyId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-emerald-100 hover:text-white underline"
                    >
                        View in Shopify →
                    </a>
                )}
            </div>


            {/* Messages */}
            <div
                ref={messagesContainerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto p-4 bg-gray-50"
            >
                {loadingOlder && (
                    <div className="text-center py-2 text-gray-500 text-sm">
                        Loading older messages...
                    </div>
                )}

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
                            <div className="break-words">{getMessageContent(msg)}</div>
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