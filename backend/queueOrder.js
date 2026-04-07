const { SQSClient, SendMessageCommand } = require("@aws-sdk/client-sqs");

const sqsClient = new SQSClient({ region: "us-west-2" });
const SQS_QUEUE_URL = process.env.SQS_QUEUE_URL;

exports.handler = async (event, context) => {
    // FIX PROSES: Menghindari timeout
    if (context) context.callbackWaitsForEmptyEventLoop = false;
    try {
        const body = JSON.parse(event.body || "{}");
        const orderId = 'ORD-' + Math.random().toString(36).substr(2,9).toUpperCase();
        
        // Membentuk payload untuk antrian
        const messageBody = {
            id: orderId,
            eventId: body.eventId,
            eventName: body.eventName,
            name: body.name,
            email: body.email,
            phone: body.phone,
            qty: body.qty,
            category: body.category,
            total: body.total,
            connectionId: body.connectionId, // Tambahan untuk notifikasi real-time
            ts: new Date().toISOString()
        };

        const command = new SendMessageCommand({
            QueueUrl: SQS_QUEUE_URL,
            MessageBody: JSON.stringify(messageBody),
            MessageGroupId: "order-queue-group", // Wajib untuk tipe SQS FIFO
            MessageDeduplicationId: orderId      // Mencegah duplikasi order
        });

        await sqsClient.send(command);

        return {
            statusCode: 202,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ 
                message: "Order Accepted. Menunggu dalam antrean...", 
                orderId: orderId 
            })
        };
    } catch (error) {
        console.error("Gagal mengirim ke SQS:", error);
        return {
            statusCode: 500,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ error: error.message })
        };
    }
};
