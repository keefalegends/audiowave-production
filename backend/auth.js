const {
   GetItemCommand,
   DynamoDBClient,
} = require("./node_modules/@aws-sdk/client-dynamodb");
const {
   marshall,
   unmarshall,
} = require("./node_modules/@aws-sdk/util-dynamodb");
const moment = require("./node_modules/moment");

const config = { region: "us-west-2" };
const client = new DynamoDBClient(config);
const TableName = "tokens";

const generatePolicy = (id, permission, resource) => {
   return {
      principalId: `${id}`,
      policyDocument: {
         Version: "2012-10-17",
         Statement: [
            {
               Effect: `${permission}`,
               Action: "execute-api:Invoke",
               Resource: `${resource}`,
            },
         ],
      },
      context: {
         scope: null,
      },
   };
};

module.exports.handler = async (event, context, callback) => {
   try {
      // Mengambil headers, menghindari error jika undefined
      const headers = event.headers || {};
      const token = headers.Authorization || headers.authorization || "";
      const deviceId = headers.Deviceid || headers.deviceid || headers.deviceId || "";
      const resource = event.methodArn;

      const params = {
         TableName,
         Key: marshall({
            token
         }),
      };

      const getCommand = new GetItemCommand(params);
      const response = await client.send(getCommand);

      if (response.Item) {
         const validToken = unmarshall(response.Item);
         const currentDate = moment();
         const hasPassed = moment(currentDate).isBefore(validToken.expiredDate);

         if (hasPassed && validToken.deviceId === deviceId) {
            return generatePolicy("authId", "Allow", resource);
         } else {
            console.error("Token expired or Device ID mismatch!");
            return generatePolicy("authId", "Deny", resource);
         }
      } else {
         console.error("Invalid Token!");
         return generatePolicy("authId", "Deny", resource);
      }
   } catch (e) {
      console.error("Auth error : " + e);
      return generatePolicy("authId", "Deny", event.methodArn);
   }
};
