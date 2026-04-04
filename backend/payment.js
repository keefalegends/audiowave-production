/**
 * Kerangka AWS Lambda Function
 * Sesuaikan logika di dalam handler ini
 */

exports.handler = async (event) => {
    console.log("Event received:", JSON.stringify(event, null, 2));

    try {
        // [TODO] Implementasi logika bisnis Anda di sini
        
        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type,Authorization,Deviceid",
                "Access-Control-Allow-Methods": "OPTIONS,POST,GET,PUT,DELETE"
            },
            body: JSON.stringify({
                message: "Function executed successfully!",
                input: event,
            }),
        };
    } catch (error) {
        console.error("Error executing lambda:", error);
        return {
            statusCode: 500,
            headers: {
                "Access-Control-Allow-Origin": "*",
            },
            body: JSON.stringify({
                message: "Internal Server Error",
                error: error.message
            }),
        };
    }
};
