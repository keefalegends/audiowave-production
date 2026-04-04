const { SSMClient, GetParameterCommand } = require("@aws-sdk/client-ssm");
// Package "pg" perlu Anda install nanti (npm install pg) saat menyiapkan zip lks-write-order
const { Client } = require("pg"); 

const ssm = new SSMClient({ region: "us-west-2" });

// Cache koneksi DB agar tidak perlu connect ulang tiap eksekusi Lambda jika kontainer masih hangat (warm)
let dbClient = null;

async function getDbConfig() {
    // Di dunia nyata direkomendasikan menggunakan GetParameters / SecretsManager untuk keamanan
    const keys = ["endpoint", "dbname", "username", "password"];
    const config = {};
    for (const key of keys) {
        const cmd = new GetParameterCommand({ Name: `/lks/database/${key}`, WithDecryption: key === 'password' });
        const res = await ssm.send(cmd);
        config[key] = res.Parameter.Value;
    }
    return config;
}

exports.handler = async (event) => {
    // Event ini berasal dari trigger SQS, BUKAN dari web API (body bentuknya berbeda)
    if (!dbClient) {
        const config = await getDbConfig();
        dbClient = new Client({
            host: config.endpoint,
            database: config.dbname,
            user: config.username,
            password: config.password,
            port: 5432,
            ssl: { rejectUnauthorized: false }
        });
        await dbClient.connect();
    }

    try {
        // Karena ini SQS, kita proses Records (bisa lebih dari 1 jika batch size > 1)
        for (const record of event.Records) {
            const body = JSON.parse(record.body);
            console.log("Processing Order ID:", body.id);

            // 1. Simpan ke tabel orders
            const qOrder = `INSERT INTO orders (id, event_id, name, email, phone, qty, category, total) 
                            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`;
            await dbClient.query(qOrder, [body.id, body.eventId, body.name, body.email, body.phone, body.qty, body.category, body.total]);

            // 2. Simpan tiket (sederhananya generate ID di sini)
            const ticketId = 'TIX-' + Math.random().toString(36).substr(2,9).toUpperCase();
            const qTicket = `INSERT INTO tickets (id, order_id, user_email) VALUES ($1, $2, $3)`;
            await dbClient.query(qTicket, [ticketId, body.id, body.email]);

            // 3. [TODO] Anda bisa menambahkan logika notifikasi WebSocket di sini 
            //    dengan memanggil ApiGatewayManagementApi
        }
        return "Berhasil proses SQS batch";
    } catch (error) {
        console.error("Database error:", error);
        throw error; // Melempar error akan membuat SQS mengembalikan pesan ke antrian / mendelegasikan ke DLQ
    }
};
