import axios from  "axios";
export default async (obj, callback) => {
  console.log(obj)
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
