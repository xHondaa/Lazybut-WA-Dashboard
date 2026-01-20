'use client';

import { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function Dashboard() {
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);

  useEffect(() => {
    const q = query(collection(db, 'confirmations'), orderBy('confirmation_sent_at', 'desc'));
    
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
        </div>
        {orders.map(order => (
          <div 
            key={order.id}
            onClick={() => setSelectedOrder(order)}
            className="p-4 border-b hover:bg-gray-50 cursor-pointer"
          >
            <div className="font-semibold">{order.phone_e164}</div>
            <div className="text-sm text-gray-600">Order #{order.order_number}</div>
            <div className="text-xs text-gray-400">{order.order_status}</div>
          </div>
        ))}
      </div>

      {/* Message thread */}
      <div className="w-2/3 flex flex-col">
          {selectedOrder ? (
              <MessageThread
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

function MessageThread({ orderId, orderNumber }) {
    const [messages, setMessages] = useState([]);

    useEffect(() => {
        const q = query(
            collection(db, 'whatsappMessages'),
            orderBy('timestamp', 'asc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const messageData = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .filter(msg => msg.order_number === orderNumber);
            setMessages(messageData);
        });

        return () => unsubscribe();
    }, [orderNumber]);

    return (
        <div className="flex-1 overflow-y-auto p-4">
            {messages.map(msg => (
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
                            {new Date(msg.timestamp).toLocaleTimeString()}
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
