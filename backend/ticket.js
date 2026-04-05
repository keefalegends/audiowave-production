const { SSMClient, GetParameterCommand } = require("@aws-sdk/client-ssm");
const { Client } = require("pg");

const ssm = new SSMClient({ region: "us-west-2" });
let dbClient = null;

async function getDbConfig() {
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
    console.log("Ticket Query Input:", event);
    try {
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
