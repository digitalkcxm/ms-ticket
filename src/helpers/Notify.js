const axios = require("axios")
module.exports = (notify_token, obj) => {
    return axios({
        "method": "post",
        "url": "https://581e4c7665a7.ngrok.io/api/v1/notification/ticket",
        "headers": {
            "Authorization": notify_token
        },
        "data": obj
    })
}