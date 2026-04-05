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
    console.log("Payment Input:", event);
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
