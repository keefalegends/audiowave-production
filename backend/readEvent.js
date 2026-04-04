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
