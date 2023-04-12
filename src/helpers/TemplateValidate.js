import TypeColumnModel from "../models/TypeColumnModel.js";

export default async function (columns, database = {}, logger = {}) {
  const typeColumnModel = new TypeColumnModel(database, logger);

  let errors = [];
  for (const column of columns) {
    typeof column.editable === "boolean"
      ? ""
      : errors.push(`item ${column.label}: o campo editable é um campo booleano`);
    column.type || column.type >= 0
      ? ""
      : errors.push(`item ${column.label}: type é um campo obrigatório`);
    column.column
      ? ""
      : errors.push(`item ${column.label}: column é um campo obrigatório`);
    column.label
      ? ""
      : errors.push(`item ${column.label}: label é um campo obrigatório`);
    typeof column.required === "boolean"
      ? ""
      : errors.push(`item ${column.label}: required é um campo booleano`);
    !column.visible_on_card_ticket || typeof column.visible_on_card_ticket === "boolean"
      ? ""
      : errors.push(`item ${column.label}: visible_on_card_ticket é um campo booleano`)

    if (typeof column.calculable === "boolean") {
      if (column.type != "int" && column.type != "decimal") {
        errors.push(`item ${column.label}: O tipo ${column.type} não pode ser calculável`);
      }
    }

    let type = await typeColumnModel.getTypeByName(column.type);

    type.rows[0]?.id
      ? column.type = type.rows[0].id
      : errors.push(`coluna ${column.label}: tipo ${column.type} é inválido.`);
  }
  return errors;
}
