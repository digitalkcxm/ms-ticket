const axios = require("axios");
module.exports = async (obj, callback) => {
  try {
    return await axios({
      method: "post",
      url: `${callback}`,
      data: obj,
    });
  } catch (err) {
    console.log("err", err);
    return err;
  }
};
