
exports.up = function(knex) {
  const sql = `
  drop view if exists vw_dash_tickets;

  create or replace view vw_dash_tickets as
    select
    tk.id_company,
    (select count(t.id) from ticket t where t.closed = false and tk.id_company = t.id_company) as tickets_abertos,
    coalesce((select
    case
    	when uot.name = 'Segundo' then (select count(t.id) from ticket t
    inner join activities_ticket atk on t.id = atk.id_ticket
    inner join phase_ticket pht on t.id = pht.id_ticket
    inner join phase ph on pht.id_phase = ph.id
    inner join unit_of_time uot on ph.id_unit_of_time = uot.id
    where trunc(extract(epoch from age(atk.created_at, t.created_at))) >= ph.sla_time and tk.id_company = t.id_company
    group by uot.name)
    	when uot.name = 'Minuto' then (select count(t.id) from ticket t
    inner join activities_ticket atk on t.id = atk.id_ticket
    inner join phase_ticket pht on t.id = pht.id_ticket
    inner join phase ph on pht.id_phase = ph.id
    inner join unit_of_time uot on ph.id_unit_of_time = uot.id
    where trunc(extract(epoch from age(atk.created_at, t.created_at))/60) >= ph.sla_time and tk.id_company = t.id_company
    group by uot.name)
    	when uot.name = 'Hora' then (select count(t.id) from ticket t
    inner join activities_ticket atk on t.id = atk.id_ticket
    inner join phase_ticket pht on t.id = pht.id_ticket
    inner join phase ph on pht.id_phase = ph.id
    inner join unit_of_time uot on ph.id_unit_of_time = uot.id
    where trunc(extract(epoch from age(atk.created_at, t.created_at))/3600) >= ph.sla_time and tk.id_company = t.id_company
    group by uot.name)
    	when uot.name = 'Dia' then (select count(t.id) from ticket t
    inner join activities_ticket atk on t.id = atk.id_ticket
    inner join phase_ticket pht on t.id = pht.id_ticket
    inner join phase ph on pht.id_phase = ph.id
    inner join unit_of_time uot on ph.id_unit_of_time = uot.id
    where trunc(extract(epoch from age(atk.created_at, t.created_at))/86400) >= ph.sla_time and tk.id_company = t.id_company
    group by uot.name)
    end
    from ticket t
    inner join activities_ticket atk on t.id = atk.id_ticket
    inner join phase_ticket pht on t.id = pht.id_ticket
    inner join phase ph on pht.id_phase = ph.id
    inner join unit_of_time uot on ph.id_unit_of_time = uot.id
    where tk.id_company = t.id_company
    group by uot.name), 0) as tickets_atrasados,
    coalesce((select
    case
    	when uot.name = 'Segundo' then (select count(t.id) from ticket t
    inner join activities_ticket atk on t.id = atk.id_ticket
    inner join phase_ticket pht on t.id = pht.id_ticket
    inner join phase ph on pht.id_phase = ph.id
    inner join unit_of_time uot on ph.id_unit_of_time = uot.id
    where trunc(extract(epoch from age(atk.created_at, t.created_at))) < ph.sla_time and tk.id_company = t.id_company
    group by uot.name)
    	when uot.name = 'Minuto' then (select count(t.id) from ticket t
    inner join activities_ticket atk on t.id = atk.id_ticket
    inner join phase_ticket pht on t.id = pht.id_ticket
    inner join phase ph on pht.id_phase = ph.id
    inner join unit_of_time uot on ph.id_unit_of_time = uot.id
    where trunc(extract(epoch from age(atk.created_at, t.created_at))/60) < ph.sla_time and tk.id_company = t.id_company
    group by uot.name)
    	when uot.name = 'Hora' then (select count(t.id) from ticket t
    inner join activities_ticket atk on t.id = atk.id_ticket
    inner join phase_ticket pht on t.id = pht.id_ticket
    inner join phase ph on pht.id_phase = ph.id
    inner join unit_of_time uot on ph.id_unit_of_time = uot.id
    where trunc(extract(epoch from age(atk.created_at, t.created_at))/3600) < ph.sla_time and tk.id_company = t.id_company
    group by uot.name)
    	when uot.name = 'Dia' then (select count(t.id) from ticket t
    inner join activities_ticket atk on t.id = atk.id_ticket
    inner join phase_ticket pht on t.id = pht.id_ticket
    inner join phase ph on pht.id_phase = ph.id
    inner join unit_of_time uot on ph.id_unit_of_time = uot.id
    where trunc(extract(epoch from age(atk.created_at, t.created_at))/86400) < ph.sla_time and tk.id_company = t.id_company
    group by uot.name)
    end
    from ticket t
    inner join activities_ticket atk on t.id = atk.id_ticket
    inner join phase_ticket pht on t.id = pht.id_ticket
    inner join phase ph on pht.id_phase = ph.id
    inner join unit_of_time uot on ph.id_unit_of_time = uot.id
    where tk.id_company = t.id_company
    group by uot.name), 0) as tickets_respondidos
  from ticket tk
  group by tk.id_company;`

  return knex.raw(sql)

};

exports.down = function(knex) {

};
