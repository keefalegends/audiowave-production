const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { PutCommand, DynamoDBDocumentClient } = require("@aws-sdk/lib-dynamodb");
const crypto = require("crypto");

const client = new DynamoDBClient({ region: "us-west-2" });
const docClient = DynamoDBDocumentClient.from(client);

exports.handler = async (event) => {
    try {
        const body = JSON.parse(event.body);
        const userEmail = body.userEmail || "admin@soundwave.id";
        const deviceId = body.deviceId || "dev-01";

        const rawTokenStr = userEmail + ":" + deviceId + ":" + Date.now().toString();
        const generatedToken = "lks." + crypto.createHash('sha256').update(rawTokenStr).digest('hex').substring(0, 40);

        const command = new PutCommand({
            TableName: "tokens",
            Item: {
                token: generatedToken,
                deviceid: deviceId,
                userId: userEmail,
                createdAt: new Date().toISOString()
            }
        });

        await docClient.send(command);

        return {
            statusCode: 200,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ 
                message: "Token berhasil dibuat", 
                token: generatedToken,
                deviceid: deviceId
            })
        };

    } catch (error) {
        return {
            statusCode: 500,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ error: error.message })
        };
    }
};
