const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { PutCommand, DeleteCommand, ScanCommand, DynamoDBDocumentClient } = require("@aws-sdk/lib-dynamodb");
const { ApiGatewayManagementApiClient, PostToConnectionCommand } = require("@aws-sdk/client-apigatewaymanagementapi");

const dbClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: "us-west-2" }));

exports.handler = async (event) => {
    const connectionId = event.requestContext.connectionId;
    const routeKey = event.requestContext.routeKey;
    const domainName = event.requestContext.domainName;
    const stage = event.requestContext.stage;
    
    // Alamat endpoint untuk kirim balik pesan
    const callbackUrl = `https://${domainName}/${stage}`;
    const apiGwClient = new ApiGatewayManagementApiClient({ endpoint: callbackUrl });

    try {
        if (routeKey === "$connect") {
            await dbClient.send(new PutCommand({
                TableName: "connections",
                Item: { connectionId: connectionId, timestamp: Date.now() }
            }));
            return { statusCode: 200, body: 'Connected.' };

        } else if (routeKey === "$disconnect") {
            await dbClient.send(new DeleteCommand({
                TableName: "connections",
                Key: { connectionId: connectionId }
            }));
            return { statusCode: 200, body: 'Disconnected.' };

        } else if (routeKey === "broadcastMessage") {
            const body = JSON.parse(event.body || "{}");
            const message = body.message || "Pesan dari server!";
            
            const scanResponse = await dbClient.send(new ScanCommand({ TableName: "connections" }));
            
            const postCalls = (scanResponse.Items || []).map(async (item) => {
                const targetId = item.connectionId;
                try {
                    await apiGwClient.send(new PostToConnectionCommand({
                        ConnectionId: targetId,
                        Data: Buffer.from(JSON.stringify({ 
                            type: "broadcast", 
                            message: message,
                            sender: connectionId 
                        }))
                    }));
                } catch (e) {
                    if (e.$metadata && e.$metadata.httpStatusCode === 410) {
                        await dbClient.send(new DeleteCommand({ TableName: "connections", Key: { connectionId: targetId } }));
                    }
                }
            });
            await Promise.all(postCalls);
            return { statusCode: 200, body: 'Broadcast sent.' };
        } else if (routeKey === "getConnectionId") {
            await apiGwClient.send(new PostToConnectionCommand({
                ConnectionId: connectionId,
                Data: Buffer.from(JSON.stringify({ type: "connectionId", connectionId: connectionId }))
            }));
            return { statusCode: 200, body: 'ID Sent.' };
        } 
        
        return { statusCode: 200, body: 'Route handled.' };
    } catch (error) {
        console.error("WebSocket Handler Error:", error);
        return { statusCode: 500, body: error.message };
    }
};
