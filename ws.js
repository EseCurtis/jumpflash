// Importing the required modules
const PORT =  process.env.PORT || 8080;
const WebSocketServer = require('ws');
const fetch = require('node-fetch');
const authKey = 'e5g7E7Y8w5'
 
// Creating a new websocket server
const wss = new WebSocketServer.Server({ port: PORT })
 
// Creating connection using websocket
wss.on("connection", ws => {
    console.log("the client has connected");
    let current_session_token = null;
    // sending message
    ws.on("message", async (session_token) => {
        session_token = session_token.toString('utf-8')
        current_session_token = session_token;

        const channel_data = await get_channel_data(session_token)
        if(channel_data.message){
            
            const channel_path = channel_data.message[0]
            console.log(channel_path)
            let data_fetched = ''
            let sent_error = false
    
            let updateCheck = setInterval(async () => {
                if(isValidURL(channel_path)){
                    let temp_fetch_process = await fetch(channel_path)
                    let temp_data_fetched = await temp_fetch_process.text()
        
                    if(temp_data_fetched != data_fetched) {
                        data_fetched = temp_data_fetched
                        ws.send(data_fetched)
                    }
                } else {
                    if(!sent_error){
                        ws.send(`${channel_path} is not a valid URL`)
                        sent_error = true
                        delete_session(current_session_token)
                        clearInterval(updateCheck)
                    }
                }
                
            }, 1)
        } else {
            ws.send(JSON.stringify(channel_data))
        }
        
    });

    // handling what to do when clients disconnects from server
    ws.on("close", () => {
        console.log("the client has disconnected");
        delete_session(current_session_token)
    });

    // handling client connection error
    ws.onerror = function () {
        console.log("Some Error occurred")
    }
});


const api_endpoint = (data, api_key) => {
    data._amvc_request_ = JSON.stringify({"command":"_interaction","data_1":`${api_key}`});
    data = JSON.parse(JSON.stringify(data));
    let getParams = ''

    for (var key in data) {
        if (getParams != "") {
            getParams += "&";
        }
        getParams += key + "=" + encodeURIComponent(data[key]);
    }

    return `http://localhost/zapwire/src/amvc.api?${getParams}`
}

const get_channel_data = async (session_token) => {
    const url = api_endpoint({"session_token": session_token}, 'session/get.php')
    
    const response = await fetch(url, {
        headers: {
            'authKey': authKey
        }
    });
    const data = await response.json();
    return data;
}

const delete_session= async (session_token) => {
    const url = api_endpoint({"session_token": session_token}, 'session/delete.php')
    
    const response = await fetch(url, {
        headers: {
            'authKey': authKey
        }
    });
    const data = await response.json();
    return data;
}

const isValidURL = (string) => {
    var res = string.match(/(http(s)?:\/\/.)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}([-a-zA-Z0-9@:%_\+.~#?&//=]*)/g);
    return (res !== null)
}

console.log('Server started on port ' + PORT);