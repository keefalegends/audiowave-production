const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { GetCommand, DynamoDBDocumentClient } = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({ region: "us-west-2" });
const docClient = DynamoDBDocumentClient.from(client);

// Fungsi pembantu untuk membuat response IAM Policy Authorizer
const generatePolicy = (principalId, effect, resource) => {
    const authResponse = { principalId: principalId };
    if (effect && resource) {
        const policyDocument = {
            Version: '2012-10-17',
            Statement: [{ Action: 'execute-api:Invoke', Effect: effect, Resource: resource }]
        };
        authResponse.policyDocument = policyDocument;
    }
    return authResponse;
};

exports.handler = async (event) => {
    // API Gateway Authorizer format
    const token = event.authorizationToken?.replace('Bearer ', '') || '';
    const deviceId = event.headers?.Deviceid || event.headers?.deviceid || '';
    
    if (!token) return generatePolicy('user', 'Deny', event.methodArn);

    try {
        const command = new GetCommand({
            TableName: "tokens",
            Key: { token: token, deviceid: deviceId }
        });

        const response = await docClient.send(command);

        if (response.Item) {
            // Token valid, izinkan akses API
            return generatePolicy(response.Item.userId, 'Allow', event.methodArn);
        } else {
            // Token tidak ditemukan / tidak cocok
            return generatePolicy('user', 'Deny', event.methodArn);
        }
    } catch (error) {
        console.error("Auth error:", error);
        return generatePolicy('user', 'Deny', event.methodArn);
    }
};
