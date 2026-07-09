const rankingService = require('../services/rankingService');

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function parsePagination(query) {
  let page = Math.max(1, parseInt(query.page, 10) || 1);
  let limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(query.limit, 10) || DEFAULT_LIMIT));
  return { page, limit };
}

exports.getHeroes = async (req, res) => {
  try {
    const { page, limit } = parsePagination(req.query);
    const search = (req.query.search || '').trim();
    const result = await rankingService.getHeroRankings({ page, limit, search });
    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error al obtener ranking de héroes:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener el ranking.' });
  }
};

exports.getAlliances = async (req, res) => {
  try {
    const { page, limit } = parsePagination(req.query);
    const search = (req.query.search || '').trim();
    const result = await rankingService.getAllianceRankings({ page, limit, search });
    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error al obtener ranking de alianzas:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener el ranking.' });
  }
};
