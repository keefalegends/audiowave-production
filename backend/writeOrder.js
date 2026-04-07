const { ApiGatewayManagementApiClient, PostToConnectionCommand } = require("@aws-sdk/client-apigatewaymanagementapi");

const dbClient = new Client({
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    port: 5432,
    ssl: { rejectUnauthorized: false }
});

// Endpoint WebSocket (Wajib diisi di Environment Variables)
const wsEndpoint = process.env.WS_ENDPOINT; 
const apiGwClient = new ApiGatewayManagementApiClient({ endpoint: wsEndpoint });

exports.handler = async (event, context) => {
    context.callbackWaitsForEmptyEventLoop = false;
    await dbClient.connect();

    try {
        for (const record of event.Records) {
            const body = JSON.parse(record.body);
            console.log("Processing Order ID:", body.id);

            // 1. Simpan ke tabel orders
            const qOrder = `INSERT INTO orders (id, event_id, name, email, phone, qty, category, total) 
                            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`;
            await dbClient.query(qOrder, [body.id, body.eventId, body.name, body.email, body.phone, body.qty, body.category, body.total]);

            // 2. Simpan tiket
            const ticketId = 'TIX-' + Math.random().toString(36).substr(2,9).toUpperCase();
            const qTicket = `INSERT INTO tickets (id, order_id, user_email) VALUES ($1, $2, $3)`;
            await dbClient.query(qTicket, [ticketId, body.id, body.email]);

            // 3. Notifikasi WebSocket (Real-Time)
            if (body.connectionId && wsEndpoint) {
                try {
                    await apiGwClient.send(new PostToConnectionCommand({
                        ConnectionId: body.connectionId,
                        Data: Buffer.from(JSON.stringify({ 
                            type: "order_confirmed", 
                            message: `Order #${body.id} Berhasil! Tiket Anda sudah terbit.`,
                            orderId: body.id,
                            ticketId: ticketId
                        }))
                    }));
                } catch (e) { console.log("Gagal kirim WS:", e.message); }
            }
        }
        return "Berhasil proses SQS batch";
    } catch (error) {
        console.error("Database error:", error);
        throw error; // Melempar error akan membuat SQS mengembalikan pesan ke antrian / mendelegasikan ke DLQ
    }
};
