const TypeColumnModel = require("../models/TypeColumnModel");
const typeColumnModel = new TypeColumnModel();

module.exports = async function (columns) {
  let errors = [];
  for (let i = 0; i < columns.length; i++) {
    typeof columns[i].editable === "boolean"
      ? ""
      : errors.push(`item ${i}: o campo editable é um campo booleano`);
    columns[i].type || columns[i].type >= 0
      ? ""
      : errors.push(`item ${i}: type é um campo obrigatório`);
    columns[i].column
      ? ""
      : errors.push(`item ${i}: column é um campo obrigatório`);
    columns[i].label
      ? ""
      : errors.push(`item ${i}: label é um campo obrigatório`);
    typeof columns[i].required === "boolean"
      ? ""
      : errors.push(`item ${i}: required é um campo booleano`);

    let type = await typeColumnModel.getTypeByID(columns[i].type);
    if (type.length <= 0) errors.push(`item ${i}: Invalid type`);
  }
  return errors;
};
