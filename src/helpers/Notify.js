const axios = require("axios")
module.exports = async (notify_token, obj) => {
    try {
        return await axios({
            "method": "post",
            "url": `${process.env.MSNOTIFICATION}`,
            "headers": {
                "Authorization": notify_token
            },
            "data": obj
        })
    } catch (err) {
        console.log("err", err)
        return err
    }

}

