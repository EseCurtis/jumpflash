// Importing the required modules
const PORT = process.env.PORT || 8080;
const WebSocketServer = require('ws');
const fetch = require('node-fetch');
 
// Creating a new websocket server
const wss = new WebSocketServer.Server({ port: PORT })
 
// Creating connection using websocket
wss.on("connection", ws => {
    console.log("new client connected");
    // sending message
    ws.on("message", data => {
        let url = data
        let prevResp = ''
        setInterval(() => {
            fetch(url)
            .then(res => res.text())
            .then(text => {
                if(prevResp !== text) ws.send((text)), prevResp = text
            })
        }, 1000);
    });
    // handling what to do when clients disconnects from server
    ws.on("close", () => {
        console.log("the client has disconnected");
    });
    // handling client connection error
    ws.onerror = function () {
        console.log("Some Error occurred")
    }
});
console.log("The WebSocket server is running on port " + PORT);