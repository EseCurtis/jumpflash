// Importing the required modules
const PORT =  process.env.PORT || 8080;
const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const io = require("socket.io")(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
      credentials: true
    }
});

const fetch = require('node-fetch');
const axios = require('axios').default;
const authKey = 'e5g7E7Y8w5'

const amvc_api = `http://localhost/zapwire/src/amvc.api`

app.get('/', (req, res) => {
    res.send('Hello wrld');
});
  
io.on("connection", ws => {
    console.log("the client has connected");
    let current_session_token = null;
    let zapwire_config = {
        refreshRate : 1000
    }

    ws.on('set_config', (data) => {
        let temp_config = JSON.parse(data)

        if (temp_config.refreshRate) zapwire_config.refreshRate = temp_config.refreshRate
    })

    ws.on('create_session', async (channel_key) => {
        let session_token = await create_session(channel_key)

        if(session_token.message[0] == false){
            ws.emit('error', 'Channel with this key does not exist')
            ws.disconnect()
        } else {
            ws.emit('session_created', session_token.message[0])
        }
    })

    
    ws.on("wire", async (session_token) => {
        current_session_token = session_token
        let checkForUpdateInterval = zapwire_config.refreshRate
        let channel_data = await get_channel_data(session_token);
        let channel_headers = convertToObject(channel_data.message[0].headers)

        send_log(channel_data.message[0].id, ws.handshake.headers.host, channel_data.message[0].ref_id)

        let accepted_hostnames = convertToArray(channel_data.message[0].authorized_hostnames)
        let all_hosts_allowed = false
        if(channel_data.message[0].authorized_hostnames == '*'){
            all_hosts_allowed = true
        }
        let axios_config = {
            headers : channel_headers
        }
        let channel_path = channel_data.message[0].path
        
        if(accepted_hostnames.includes(ws.handshake.headers.host) !== true && all_hosts_allowed === false) {
            ws.emit('error', 'Not authorized')
            console.log(ws.handshake.headers.host, '- Was Not authorized', accepted_hostnames)
            ws.disconnect()
            delete_session(session_token)
            return 0
        }

        if(channel_path !== false && isValidURL(channel_path)) {
            let channel_path_fetch;

            try {
                channel_path_fetch = await axios.get(channel_path, axios_config)
                
            } catch (err) {
                // Handle error
                console.log(err)
            }

            let channel_path_data = channel_path_fetch.data
            let temp_channel_path_data = ''

            ws.emit('channel_data', channel_path_data)
            
            let checkForUpdate = setInterval(async () => {
                let is_emitted = false
                let temp_channel_path_fetch;
                try {
                    temp_channel_path_fetch = await axios.get(channel_path, axios_config)
                } catch (err) {
                    // Handle error
                    console.log(err)
                    clearInterval(checkForUpdate)
                }
                temp_channel_path_data = temp_channel_path_fetch.data
                
                if(temp_channel_path_data !== channel_path_data && !is_emitted){
                    channel_path_data = temp_channel_path_data
                    ws.emit('channel_data', channel_path_data)
                    is_emitted = true
                    console.log('sent_update')
                }

            }, checkForUpdateInterval)

        } else {
            delete_session(session_token)
            ws.emit('error', 'Channel not found')
            ws.disconnect()
        }
        
    })

    // handling what to do when clients disconnects from server
    ws.on("disconnect", () => {
        console.log("the client has disconnected");
        delete_session(current_session_token)
    })

    // handling what to do when clients disconnects from server
    ws.on("error", () => {
        console.log("error detected")
        delete_session(current_session_token)
    });
});
  
server.listen(PORT, () => {
    console.log('listening on ', PORT);
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

    return `${amvc_api}?${getParams}`
}

const get_channel_data = async (session_token) => {
    const url = api_endpoint({"session_token": session_token}, 'session/get.php')
    
    const data = await jsonCheckFetch(url)
    //const data = await response.json();
    return data;
}

const create_session = async (channel_key) => {
    const url = api_endpoint({"ch_key": channel_key}, 'session/create.php')
    
    const data = await jsonCheckFetch(url)
    //const data = await response.json();
    return data;
}

const delete_session = async (session_token) => {
    const url = api_endpoint({"session_token": session_token}, 'session/delete.php')
    
    const data = await jsonCheckFetch(url)
    //const data = await response.json()
    return data;
}

const send_log = async (channel_id, host, user_id, status = 1) => {
    const url = api_endpoint({"ch_id": channel_id, "req_from": host, "user_id": user_id, "status": status}, 'log/create.php')
    
    const data = await jsonCheckFetch(url)
    //const data = await response.json()

    console.log(data)
    return data;
}

const isValidURL = (string) => {
    var res = string?.match(/(http(s)?:\/\/.)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}([-a-zA-Z0-9@:%_\+.~#?&//=]*)/g);
    return (res !== null)
}

const convertToObject = (string) => {
    let obj = {}
    let arr = string.split(',')
    arr.forEach(item => {
        let temp = item.split('=')
        if(temp[0] && temp[1] && temp[0] !== '' && temp[1] !== ''){
            obj[(temp[0].trim())] = (temp[1].trim())
        }
    })
    return obj
}

const convertToArray = (string) => {
    let arr = string.split(',')
    return arr
}

function arrayContains(needle, arrhaystack)
{
    return (arrhaystack.indexOf(needle) > -1);
}

const jsonCheckFetch = async (url) => {
    try {  
        const response = await fetch(url, {
            headers: {
                'authKey': authKey
            }
        });  
        const text = await response.text();  
        const data = JSON.parse(text);  

        return data
    } catch (err) {  
        console.log(err)  
    } 
}
console.log('Server started on port ' + PORT);