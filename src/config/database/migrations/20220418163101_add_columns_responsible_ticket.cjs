exports.up = function (knex, Promise) {
  return knex.schema.alterTable("responsible_ticket", (table) => {
    table.boolean("active");
    table.integer("id_user_add");
    table.integer("id_user_remove");
    table.timestamps(true, true);

    table.foreign("id_user_add").references("users.id");
    table.foreign("id_user_remove").references("users.id");
  });
};

exports.down = function (knex, Promise) {
  return knex.schema.alterTable("responsible_ticket", (table) => {
    table.dropColumn("id_tab");
    table.dropColumn("created_at");
    table.dropColumn("updated_at");
    table.dropColumn("id_user_add");
    table.dropColumn("id_user_remove");
  });
};
