// src/constants/races.js

// 1. IMÁGENES DE PERSONAJES
import humanoImg from '../assets/races/humano_base_lv1.png';
import elfoImg from '../assets/races/elfo_base_lv1.png';
import enanoImg from '../assets/races/enano_base_lv1.png';
import goblinImg from '../assets/races/goblin_base_lv1.png';
import orcoImg from '../assets/races/orco_base_lv1.png';
import felinoImg from '../assets/races/felino_base_lv1.png';

// 2. IMÁGENES DE FONDO
import bgHumano from '../assets/backgrounds/background_clase_humano.png';
import bgElfo from '../assets/backgrounds/background_clase_elfo.png';
import bgEnano from '../assets/backgrounds/background_clase_enano.png';
import bgGoblin from '../assets/backgrounds/background_clase_goblin.png';
import bgOrco from '../assets/backgrounds/background_clase_orco.png'; // <--- ¡Ahora sí cargará este archivo!
import bgFelino from '../assets/backgrounds/background_clase_felino.png';

export const RACES = [
  {
    id: 'human',
    name: 'Humano Vikingo',
    description: 'Mercaderes natos y guerreros versátiles. Ganan +5% de Oro.',
    image: humanoImg,
    bgImage: bgHumano,
    stats: { STR: 5, DEX: 5, CON: 5, INT: 5, CHA: 7, LUCK: 5 },
    evolutions: {
      path1: [
        { lv: 10, name: 'Maestro de Armas', aura: 'text-gray-400' },
        { lv: 50, name: 'Estratega de la Arena', aura: 'text-blue-400' },
        { lv: 100, name: 'Señor de la Guerra', aura: 'text-amber-500' }
      ],
      path2: [
        { lv: 10, name: 'Sabio de Batalla', aura: 'text-gray-400' },
        { lv: 50, name: 'Archimago de Combate', aura: 'text-purple-400' },
        { lv: 100, name: 'Oráculo de Guerra', aura: 'text-amber-500' }
      ]
    }
  },
  {
    id: 'elf',
    name: 'Elfo',
    description: 'Maestros de los bosques y la magia. +5% Creación de Pociones.',
    image: elfoImg,
    bgImage: bgElfo,
    stats: { STR: 4, DEX: 7, CON: 4, INT: 6, CHA: 5, LUCK: 5 },
    evolutions: {
      path1: [
        { lv: 10, name: 'Danzarín Sombrío', aura: 'text-gray-400' },
        { lv: 50, name: 'Espectro del Viento', aura: 'text-green-400' },
        { lv: 100, name: 'Fantasma del Vendaval', aura: 'text-amber-500' }
      ],
      path2: [
        { lv: 10, name: 'Vigía del Bosque', aura: 'text-gray-400' },
        { lv: 50, name: 'Susurro de la Muerte', aura: 'text-indigo-400' },
        { lv: 100, name: 'La Parca Silenciosa', aura: 'text-amber-500' }
      ]
    }
  },
  {
    id: 'dwarf',
    name: 'Enano',
    description: 'Robustos y tercos. +5% Creación de Armaduras.',
    image: enanoImg,
    bgImage: bgEnano,
    stats: { STR: 6, DEX: 3, CON: 8, INT: 4, CHA: 4, LUCK: 5 },
    evolutions: {
      path1: [
        { lv: 10, name: 'Verdugo de la Forja', aura: 'text-gray-400' },
        { lv: 50, name: 'Maestro Hacha Rúnica', aura: 'text-red-400' },
        { lv: 100, name: 'Señor de las Runas', aura: 'text-amber-500' }
      ],
      path2: [
        { lv: 10, name: 'Defensor de la Montaña', aura: 'text-gray-400' },
        { lv: 50, name: 'Baluarte Inquebrantable', aura: 'text-blue-400' },
        { lv: 100, name: 'Muralla de Mithril', aura: 'text-amber-500' }
      ]
    }
  },
  {
    id: 'goblin',
    name: 'Duende',
    description: 'Astutos y rápidos. +5% Encontrar Objetos.',
    image: goblinImg,
    bgImage: bgGoblin,
    stats: { STR: 3, DEX: 8, CON: 3, INT: 7, CHA: 3, LUCK: 8 },
    evolutions: {
      path1: [
        { lv: 10, name: 'Asesino de Alcantarilla', aura: 'text-gray-400' },
        { lv: 50, name: 'Sombra Caótica', aura: 'text-purple-400' },
        { lv: 100, name: 'Príncipe del Caos', aura: 'text-amber-500' }
      ],
      path2: [
        { lv: 10, name: 'Chatarrero Ingenioso', aura: 'text-gray-400' },
        { lv: 50, name: 'Tecnomante Siniestro', aura: 'text-green-400' },
        { lv: 100, name: 'Arquitecto de la Plaga', aura: 'text-amber-500' }
      ]
    }
  },
  {
    id: 'orc',
    name: 'Orco',
    description: 'Fuerza bruta desencadenada. +5% Creación de Armas.',
    image: orcoImg,
    bgImage: bgOrco,
    stats: { STR: 9, DEX: 4, CON: 6, INT: 2, CHA: 3, LUCK: 3 },
    evolutions: {
      path1: [
        { lv: 10, name: 'Berserker Piel de Sangre', aura: 'text-gray-400' },
        { lv: 50, name: 'Tormenta de Guerra', aura: 'text-red-600' },
        { lv: 100, name: 'Cataclismo Viviente', aura: 'text-amber-500' }
      ],
      path2: [
        { lv: 10, name: 'Piel de Hierro', aura: 'text-gray-400' },
        { lv: 50, name: 'El Inmortal', aura: 'text-slate-400' },
        { lv: 100, name: 'Titán Indestructible', aura: 'text-amber-500' }
      ]
    }
  },
  {
    id: 'feline',
    name: 'Felino',
    description: 'Instinto depredador. +5% Domar Bestias.',
    image: felinoImg,
    bgImage: bgFelino,
    stats: { STR: 5, DEX: 8, CON: 4, INT: 4, CHA: 4, LUCK: 5 },
    evolutions: {
      path1: [
        { lv: 10, name: 'Acechador Silencioso', aura: 'text-gray-400' },
        { lv: 50, name: 'Garras del Crepúsculo', aura: 'text-indigo-400' },
        { lv: 100, name: 'Pesadilla Nocturna', aura: 'text-amber-500' }
      ],
      path2: [
        { lv: 10, name: 'Furia Primitiva', aura: 'text-gray-400' },
        { lv: 50, name: 'Avatar de la Cacería', aura: 'text-green-500' },
        { lv: 100, name: 'Dios de la Presa', aura: 'text-amber-500' }
      ]
    }
  }
];