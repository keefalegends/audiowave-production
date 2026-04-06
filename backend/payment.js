const { Client } = require("pg");

let dbClient = null;

exports.handler = async (event, context) => {
    // FIX PROSES: Menghindari timeout di VPC
    context.callbackWaitsForEmptyEventLoop = false;

    console.log("Payment Input:", event);
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
        const { order_id, amount } = body;

        if (!order_id || !amount) {
            return {
                statusCode: 400,
                headers: { "Access-Control-Allow-Origin": "*" },
                body: JSON.stringify({ error: "Missing required fields: order_id, amount" })
            };
        }

        const query = `UPDATE orders SET status = 'PAID', total = $2 WHERE id = $1`;
        const res = await dbClient.query(query, [order_id, amount]);

        if (res.rowCount === 0) {
            return {
                statusCode: 404,
                headers: { "Access-Control-Allow-Origin": "*" },
                body: JSON.stringify({ error: "Order not found" })
            };
        }

        return {
            statusCode: 200,
            headers: { "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify({ message: "Payment recorded successfully", order_id: order_id })
        };
    } catch (error) {
        console.error("Payment Error:", error);
        return {
            statusCode: 500,
            headers: { "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify({ error: error.message })
        };
    }
};
