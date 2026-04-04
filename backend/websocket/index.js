const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { PutCommand, DeleteCommand, ScanCommand, DynamoDBDocumentClient } = require("@aws-sdk/lib-dynamodb");
const { ApiGatewayManagementApiClient, PostToConnectionCommand } = require("@aws-sdk/client-apigatewaymanagementapi");

const dbClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: "us-west-2" }));

exports.handler = async (event) => {
    // Context berisi info tentang rute websocket yg dipanggil
    const connectionId = event.requestContext.connectionId;
    const routeKey = event.requestContext.routeKey;
    
    // Sesuaikan dengan domain URL API WebSocket Anda
    const endpoint = event.requestContext.domainName + '/' + event.requestContext.stage;
    const apiGwClient = new ApiGatewayManagementApiClient({ endpoint: 'https://' + endpoint });

    try {
        if (routeKey === "$connect") {
            // Simpan connection ID saat user connect
            await dbClient.send(new PutCommand({
                TableName: "connections",
                Item: { connectionId: connectionId, timestamp: Date.now() }
            }));
            return { statusCode: 200, body: 'Connected.' };

        } else if (routeKey === "$disconnect") {
            // Hapus dari tabel saat terputus
            await dbClient.send(new DeleteCommand({
                TableName: "connections",
                Key: { connectionId: connectionId }
            }));
            return { statusCode: 200, body: 'Disconnected.' };

        } else if (routeKey === "broadcastMessage") {
            // Mengirim pesan ke SEMUA koneksi yang sedang aktif
            const body = JSON.parse(event.body);
            const scanResponse = await dbClient.send(new ScanCommand({ TableName: "connections" }));
            
            // Loop semua koneksi dan jalankan PostToConnection (pararel)
            const postCalls = scanResponse.Items.map(async ({ connectionId }) => {
                try {
                    await apiGwClient.send(new PostToConnectionCommand({
                        ConnectionId: connectionId,
                        Data: Buffer.from(JSON.stringify({ type: "broadcast", message: body.message }))
                    }));
                } catch (e) {
                    if (e.$metadata.httpStatusCode === 410) {
                        // 410 Gone berarti koneksi sudah mati/stale, kita hapus
                        console.log(`Menghapus stale connection: ${connectionId}`);
                        await dbClient.send(new DeleteCommand({ TableName: "connections", Key: { connectionId } }));
                    } else { throw e; }
                }
            });
            await Promise.all(postCalls);
            return { statusCode: 200, body: 'Broadcast berhasil.' };
            
        } else {
            return { statusCode: 200, body: 'Rute tidak dikenali.' };
        }
    } catch (error) {
        console.error(error);
        return { statusCode: 500, body: error.message };
    }
};
