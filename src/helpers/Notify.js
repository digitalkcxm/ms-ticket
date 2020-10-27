const axios = require("axios")
module.exports = async (notify_token, obj) => {
    return await axios({
        "method": "post",
        "url": process.env.msnotification,
        "headers": {
            "Authorization": notify_token
        },
        "data": obj
    })
}

