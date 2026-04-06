const { DynamoDBClient, PutItemCommand } = require("./node_modules/@aws-sdk/client-dynamodb");
const { marshall } = require("./node_modules/@aws-sdk/util-dynamodb");
const moment = require("./node_modules/moment");
const crypto = require("crypto");

const config = { region: "us-west-2" };
const client = new DynamoDBClient(config);
const TableName = "tokens";

module.exports.handler = async (event) => {
   try {
      const body = JSON.parse(event.body || "{}");
      const { username, password, deviceId } = body;

      if (!username || !password || !deviceId) {
         return {
            statusCode: 400,
            headers: { "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify({ message: "Username, password, and deviceId are required!" })
         };
      }

      if (username !== "lks" || password !== "juara1") {
         return {
            statusCode: 401,
            headers: { "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify({ message: "Invalid username or password" })
         };
      }

      const token = crypto.randomBytes(32).toString("hex");
      const expiredDate = moment().add(3, 'hours').toISOString();

      const params = {
         TableName,
         Item: marshall({
            token: token,
            deviceId: deviceId,
            expiredDate: expiredDate,
            username: username
         }),
      };

      await client.send(new PutItemCommand(params));

      return {
         statusCode: 200,
         headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
         },
         body: JSON.stringify({
            message: "Login successful",
            token: token,
            deviceId: deviceId,
            expires_at: expiredDate
         }),
      };

   } catch (error) {
      console.error("Kesalahan System Login:", error);
      return {
         statusCode: 500,
         headers: { "Access-Control-Allow-Origin": "*" },
         body: JSON.stringify({ message: "Internal Server Error", error: error.message })
      };
   }
};
