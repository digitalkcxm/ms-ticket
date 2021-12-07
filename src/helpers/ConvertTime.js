const UnitOfTimeModel = require("../models/UnitOfTimeModel");
const unitOfTimeModel = new UnitOfTimeModel();

const moment = require("moment");

async function  newTime(time, id_unit) {
  const unitOfTime = await unitOfTimeModel.checkUnitOfTime(id_unit);
  return moment().add(time, unitOfTime);
};

module.exports = { newTime };
