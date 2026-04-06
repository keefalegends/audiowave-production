const { Client } = require("pg");

let dbClient = null;

exports.handler = async (event, context) => {
    // FIX PROSES: Menghindari timeout di VPC
    context.callbackWaitsForEmptyEventLoop = false;

    console.log("Ticket Query Input:", event);
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

        const email = event.queryStringParameters ? event.queryStringParameters.email : null;

        if (!email) {
            return {
                statusCode: 400,
                headers: { "Access-Control-Allow-Origin": "*" },
                body: JSON.stringify({ error: "Missing required query string parameter: email" })
            };
        }

        // Ambil tiket beserta nama event dari tabel yang di-join dengan orders & events
        const query = `
            SELECT t.id as ticket_id, t.order_id, t.user_email, o.qty, o.category, e.name as event_name, e.date as event_date, e.venue 
            FROM tickets t
            INNER JOIN orders o ON t.order_id = o.id
            INNER JOIN events e ON o.event_id = e.id
            WHERE t.user_email = $1
            ORDER BY t.id DESC
        `;
        const res = await dbClient.query(query, [email]);

        return {
            statusCode: 200,
            headers: { "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify(res.rows)
        };
    } catch (error) {
        console.error("Ticket Fetch Error:", error);
        return {
            statusCode: 500,
            headers: { "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify({ error: error.message })
        };
    }
};
