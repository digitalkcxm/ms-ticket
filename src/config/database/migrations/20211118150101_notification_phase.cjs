exports.up = function (knex, Promise) {
  return knex.schema.alterTable("phase", (table) => {
    table.json("notification_customer");
    table.json("notification_admin");
    table.json("notification_separate");
  });
};

exports.down = function (knex, Promise) {
  return knex.schema.alterTable("phase", (table) => {
    table.dropColumn("notification_customer");
    table.dropColumn("notification_admin");
    table.dropColumn("notification_separate");
  });
};
