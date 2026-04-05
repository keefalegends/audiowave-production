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
    console.log("WriteEvent Input:", event);
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
