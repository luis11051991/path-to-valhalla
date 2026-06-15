// Servicio de autenticación - contiene reglas de negocio
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../../../config/db');

class AuthService {
  static async login(email, password) {
    if (!email || !password) {
      throw new Error('Email and password are required');
    }

    // Obtener usuario por email
    const usersSnap = await db.collection('players')
      .where('email', '==', email.toLowerCase())
      .limit(1)
      .get();
    
    if (usersSnap.empty) {
      throw new Error('User not found');
    }

    const playerDoc = usersSnap.docs[0];
    const user = { ...playerDoc.data(), id: playerDoc.id };
    
    // Verificar contraseña
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      throw new Error('Invalid credentials');
    }

    // Generar token JWT
    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return {
      user,
      token
    };
  }

  static async register(username, email, password) {
    if (!username || !email || !password) {
      throw new Error('All fields are required');
    }

    // Validar duplicados
    const usersSnap = await db.collection('players')
      .where('email', '==', email.toLowerCase())
      .where('username', '==', username)
      .get();
    
    if (!usersSnap.empty) {
      throw new Error('Username or email already exists');
    }

    // Hash contraseña
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    // Datos por defecto del jugador
    const defaultRace = 'human';
    const defaultGender = 'male';
    const defaultClassId = 1;
    const defaultBgId = 1;
    const defaultStats = JSON.stringify({ 
      strength: 5, dexterity: 5, constitution: 5, 
      intelligence: 5, luck: 5, charisma: 5 
    });

    // Crear jugador en Firestore
    const newPlayerRef = db.collection('players').doc();
    await newPlayerRef.set({
      username,
      email: email.toLowerCase(),
      password_hash: hash,
      race: defaultRace,
      gender: defaultGender,
      class_id: defaultClassId,
      tier: 0,
      level: 1,
      experience: 0,
      stat_points: 0,
      stats: JSON.parse(defaultStats),
      gold: 10,
      silver: 50,
      copper: 100,
      onix: 0,
      current_hp: 100,
      energy: 100,
      valor: 5,
      last_regen_at: new Date(),
      active_background_id: defaultBgId,
      last_hall_action_at: new Date(),
      evolution_quest_status: 'locked',
      starter_kit_claimed: false,
      shop_refreshes_used: 0,
      current_shop_stock: [],
      created_at: new Date(),
    });

    const userId = newPlayerRef.id;
    
    // Registrar fondo inicial
    await db.collection('player_backgrounds').doc().set({
      player_id: userId,
      background_id: defaultBgId,
    });

    // Generar token JWT
    const token = jwt.sign(
      { id: userId, email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return {
      user: { ...user, id: userId },
      token
    };
  }

  static async getProfile(userId) {
    if (!userId) {
      throw new Error('User ID is required');
    }

    const playerDoc = await db.collection('players').doc(userId).get();
    if (!playerDoc.exists) {
      throw new Error('User not found');
    }
    
    const userData = { ...playerDoc.data(), id: playerDoc.id };
    return userData;
  }

  static async updateProfile(userId, profileData) {
    if (!userId) {
      throw new Error('User ID is required');
    }

    // Actualizar datos del usuario
    await db.collection('players').doc(userId).update(profileData);
    
    // Obtener los datos actualizados
    const playerDoc = await db.collection('players').doc(userId).get();
    const userData = { ...playerDoc.data(), id: playerDoc.id };
    
    return userData;
  }

  static async logout(userId) {
    if (!userId) {
      throw new Error('User ID is required');
    }
    // Para implementar invalidación de tokens en producción
    // sería necesario mantener una lista negra (blacklist) de tokens
    return true;
  }
}

module.exports = AuthService;