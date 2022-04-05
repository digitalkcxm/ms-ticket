exports.up = async function (knex) {
  return await knex.schema.createTable("phase_sla_settings", (table) => {
    table.increments();
    table.uuid("id_phase").notNullable();
    table.integer("id_sla_type").notNullable();
    table.integer("id_unit_of_time").notNullable();
    table.integer("time");
    table.boolean("active").default(false);

    table.foreign("id_phase").references("phase.id");
    table.foreign("id_sla_type").references("sla_type.id");
    table.foreign("id_unit_of_time").references("unit_of_time.id");
  });
};

exports.down = function (knex) {};
