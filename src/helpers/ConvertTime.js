import UnitOfTimeModel from "../models/UnitOfTimeModel.js";
const unitOfTimeModel = new UnitOfTimeModel();

import moment from "moment";

export async function  newTime(time, id_unit) {
  const unitOfTime = await unitOfTimeModel.checkUnitOfTime(id_unit);
  return moment().add(time, unitOfTime[0]);
};


