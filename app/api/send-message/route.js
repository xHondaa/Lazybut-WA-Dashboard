import { NextResponse } from 'next/server';

export async function POST(request) {
    try {
        const { phone, message, order_number } = await request.json();

        if (!phone || !message) {
            return NextResponse.json(
                { error: 'Phone and message are required' },
                { status: 400 }
            );
        }

        // Call your Railway WhatsApp API endpoint
        const response = await fetch('https://wa-confirmation-automation-production.up.railway.app/api/sendTextMessage', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // Add any auth headers your Railway app needs
            },
            body: JSON.stringify({
                phone: phone.replace('+', ''),
                message: message,
                order_number: order_number
            })
        });

        if (!response.ok) {
            throw new Error('Railway API request failed');
        }

        const data = await response.json();

        return NextResponse.json({ success: true, data });
    } catch (error) {
        console.error('Error sending message:', error);
        return NextResponse.json(
            { error: 'Failed to send message' },
            { status: 500 }
        );
    }
}