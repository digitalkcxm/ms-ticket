import DashModel from '../models/DashModel.js'

export default class DashController {
  constructor(database = {}) {
    this.database = database
    this.dashModel = new DashModel(database)
  }

  async dashGenerateV2(data) {
    if (!data.id) return false //@info data.id é o id do departamento.
    if (!data.authorization) return false //@info data.authorization é a company do cliente.

    //@info sem essas duas infos acima é impossivel montar o dash.
    const total_de_fases = await this.dashModel.total_phase(data.id, data.authorization)
    const total_tickets = await this.dashModel.total_tickets(data.id, data.authorization)
    const total_tickets_fechados = await this.dashModel.total_tickets_fechados(data.id, data.authorization)
    const total_tickets_nao_iniciado = await this.dashModel.total_tickets_nao_iniciado(data.id,data.authorization)

    const tickets_nao_iniciado = await this.dashModel.tickets_nao_iniciado(data.id,data.authorization)

    for
    
  }
}
