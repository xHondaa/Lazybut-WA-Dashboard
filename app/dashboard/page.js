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

  // Track latest message per order to sort conversations like WhatsApp
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
    // Limit initial orders for performance; add pagination later if needed
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
    <div className="flex h-screen">
      {/* Conversations list */}
      <div className="w-1/3 border-r overflow-y-auto">
        <div className="p-4 border-b bg-gray-50">
          <h1 className="text-xl font-bold">Conversations</h1>
          <div className="mt-3 flex gap-2">
            <input
              className="w-1/2 rounded border px-2 py-1 text-sm"
              placeholder="Search phone"
              value={searchPhone}
              onChange={(e) => setSearchPhone(e.target.value)}
            />
            <input
              className="w-1/2 rounded border px-2 py-1 text-sm"
              placeholder="Search order #"
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
            className="p-4 border-b hover:bg-gray-50 cursor-pointer"
          >
            <div className="font-semibold">{order.phone_e164}</div>
            <div className="text-sm text-gray-600">Order #{order.order_number}</div>
            <div className="text-xs text-gray-400">{order.status}</div>
          </div>
        ))}
      </div>

      {/* Message thread */}
      <div className="w-2/3 flex flex-col">
          {selectedOrder ? (
              <MessageThread
                  key={selectedOrder.order_number}
                  orderId={selectedOrder.id}
                  orderNumber={selectedOrder.order_number}
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

function MessageThread({ orderNumber }) {
    const [messages, setMessages] = useState([]);

    useEffect(() => {
        if (!orderNumber) return;

        const q = query(
            collection(db, 'whatsappMessages'),
            where('order_number', '==', orderNumber),
            orderBy('timestamp', 'asc')
        );

        // Use incremental updates to avoid rebuilding large arrays
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setMessages((prev) => {
                let next = [...prev];
                snapshot.docChanges().forEach((change) => {
                    const data = { id: change.doc.id, ...change.doc.data() };
                    if (change.type === 'added') {
                        next.push(data);
                    } else if (change.type === 'modified') {
                        next = next.map((m) => (m.id === data.id ? data : m));
                    } else if (change.type === 'removed') {
                        next = next.filter((m) => m.id !== data.id);
                    }
                });
                return next;
            });
        });

        return () => unsubscribe();
    }, [orderNumber]);

    return (
        <div className="flex-1 overflow-y-auto p-4">
            {messages.map((msg) => (
                <div
                    key={msg.id}
                    className={`mb-4 flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                >
                    <div className={`max-w-xs p-3 rounded-lg ${
                        msg.direction === 'outbound'
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-200'
                    }`}>
                        <div>{msg.text}</div>
                        <div className="text-xs mt-1 opacity-70">
                            {msg.created_at?.toDate
                                ? msg.created_at.toDate().toLocaleTimeString()
                                : new Date(msg.timestamp).toLocaleTimeString()}
                        </div>
                        {msg.direction === 'outbound' && msg.status && (
                            <div className="text-xs mt-1">{msg.status}</div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}
