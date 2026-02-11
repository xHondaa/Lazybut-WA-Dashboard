import { NextResponse } from 'next/server';

export async function POST(request) {
    try {
        const { phone, templateName, variables, order_number } = await request.json();

        if (!phone || !templateName) {
            return NextResponse.json(
                { error: 'Phone and template name are required' },
                { status: 400 }
            );
        }

        const railwayUrl = process.env.RAILWAY_API_URL || 'https://wa-confirmation-automation-production.up.railway.app';
        const endpoint = `${railwayUrl}/api/send-template`;

        console.log('Sending template to Railway:', { phone, templateName });

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                phone: phone.replace('+', ''),
                templateName: templateName,
                variables: variables || {},
                order_number: order_number
            })
        });

        const responseText = await response.text();
        console.log('Railway response:', responseText);

        if (!response.ok) {
            return NextResponse.json(
                { error: `Railway API error: ${responseText}` },
                { status: response.status }
            );
        }

        const data = JSON.parse(responseText);
        return NextResponse.json({ success: true, data });
    } catch (error) {
        console.error('Error in send-template API:', error);
        return NextResponse.json(
            { error: error.message },
            { status: 500 }
        );
    }
}