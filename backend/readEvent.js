const { Client } = require("pg");

let dbClient = null;

exports.handler = async (event, context) => {
    // FIX PROSES: Menghindari timeout di VPC
    context.callbackWaitsForEmptyEventLoop = false;

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

        const res = await dbClient.query('SELECT * FROM events ORDER BY date ASC');
        
        return {
            statusCode: 200,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify(res.rows)
        };
    } catch (error) {
        console.error("DB Event Query Error:", error);
        return {
            statusCode: 500,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ error: error.message })
        };
    }
};
