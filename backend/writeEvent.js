const { Client } = require("pg");

let dbClient = null;

exports.handler = async (event, context) => {
    // FIX PROSES: Menghindari timeout di VPC
    context.callbackWaitsForEmptyEventLoop = false;

    console.log("WriteEvent Input:", event);
    try {
        if (!dbClient) {
            dbClient = new Client({
                host: process.env.DB_HOST,
                database: process.env.DB_NAME,
                user: process.env.DB_USER,
                password: process.env.DB_PASS,
                port: 5432,
                ssl: { rejectUnauthorized: false }
            });
            await dbClient.connect();
        }

        const body = JSON.parse(event.body || "{}");
        const { id, name, date, venue, price, quota } = body;

        if (!id || !name || !date) {
            return {
                statusCode: 400,
                headers: { "Access-Control-Allow-Origin": "*" },
                body: JSON.stringify({ error: "Missing required fields: id, name, date" })
            };
        }

        const query = `
            INSERT INTO events (id, name, date, venue, ticket_price, total_quota, available_quota)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        `;
        await dbClient.query(query, [id, name, date, venue || '-', price || 0, quota || 100, quota || 100]);

        return {
            statusCode: 201,
            headers: { "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify({ message: "Event berhasil dibuat", eventId: id })
        };
    } catch (error) {
        console.error("WriteEvent Error:", error);
        return {
            statusCode: 500,
            headers: { "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify({ error: error.message })
        };
    }
};
