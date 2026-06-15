// Puntos finales de la API centralizados
export const ENDPOINTS = {
  // Autenticación
  AUTH: {
    LOGIN: '/api/auth/login',
    REGISTER: '/api/auth/register',
    LOGOUT: '/api/auth/logout',
    REFRESH: '/api/auth/refresh',
    VERIFY: '/api/auth/verify'
  },
  
  // Usuario
  USER: {
    PROFILE: '/api/user/profile',
    UPDATE: '/api/user/update',
    DELETE: '/api/user/delete'
  },
  
  // Jugador
  PLAYER: {
    GET: '/api/player',
    UPDATE: '/api/player/update',
    STATS: '/api/player/stats',
    LEVEL_UP: '/api/player/level-up'
  },
  
  // Inventario
  INVENTORY: {
    GET: '/api/inventory',
    ADD_ITEM: '/api/inventory/add-item',
    REMOVE_ITEM: '/api/inventory/remove-item',
    USE_ITEM: '/api/inventory/use-item'
  },
  
  // Misiones
  QUESTS: {
    GET: '/api/quests',
    START: '/api/quests/start',
    COMPLETE: '/api/quests/complete',
    ABANDON: '/api/quests/abandon'
  },
  
  // Expediciones
  EXPEDITIONS: {
    LIST: '/api/expeditions',
    START: '/api/expeditions/start',
    GET_RESULT: '/api/expeditions/result',
    FINISH: '/api/expeditions/finish'
  },
  
  // Tienda
  SHOP: {
    LIST: '/api/shop',
    BUY: '/api/shop/buy',
    SELL: '/api/shop/sell'
  },
  
  // Banco
  BANK: {
    GET: '/api/bank',
    DEPOSIT: '/api/bank/deposit',
    WITHDRAW: '/api/bank/withdraw'
  },
  
  // Mensajes
  MESSAGES: {
    LIST: '/api/messages',
    SEND: '/api/messages/send',
    READ: '/api/messages/read'
  }
};