const TypeColumnModel = require("../models/TypeColumnModel");
const typeColumnModel = new TypeColumnModel();

module.exports = async function (columns) {
  let errors = [];
  for (const column of columns) {
    typeof column.editable === "boolean"
      ? ""
      : errors.push(`item ${i}: o campo editable é um campo booleano`);
    column.type || column.type >= 0
      ? ""
      : errors.push(`item ${i}: type é um campo obrigatório`);
    column.column
      ? ""
      : errors.push(`item ${i}: column é um campo obrigatório`);
    column.label ? "" : errors.push(`item ${i}: label é um campo obrigatório`);
    typeof column.required === "boolean"
      ? ""
      : errors.push(`item ${i}: required é um campo booleano`);

    let type = await typeColumnModel.getTypeByName(column.type);
    console.log("type ===>",type)
    column.type = type.rows[0].id;
    if (type.length <= 0) errors.push(`item ${i}: Invalid type`);
  }
  return errors;
};
