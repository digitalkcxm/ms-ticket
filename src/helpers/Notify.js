const axios = require("axios")
module.exports = (notify_token, obj) => {
    return axios({
        "method": "post",
        "url": process.env.msnotification,
        "headers": {
            "Authorization": notify_token
        },
        "data": obj
    })
}

