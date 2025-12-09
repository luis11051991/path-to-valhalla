// IMPORTACIÓN DE IMÁGENES (Desde src/assets/races)
// Humanos
import humanoMale from '../assets/races/humano_base_lv1.png';
import humanoFemale from '../assets/races/humana_base_lv1.png';
// Elfos
import elfoMale from '../assets/races/elfo_base_lv1.png';
import elfaFemale from '../assets/races/elfa_base_lv1.png';
// Enanos
import enanoMale from '../assets/races/enano_base_lv1.png';
import enanaFemale from '../assets/races/enana_base_lv1.png';
// Orcos
import orcoMale from '../assets/races/orco_base_lv1.png';
import orcaFemale from '../assets/races/orca_base_lv1.png';
// Felinos
import felinoMale from '../assets/races/felino_base_lv1.png';
import felinaFemale from '../assets/races/felina_base_lv1.png';
// Goblins
import goblinMale from '../assets/races/goblin_base_lv1.png';
import goblinaFemale from '../assets/races/goblina_base_lv1.png';

// NOTA: Los fondos siguen usando rutas públicas (strings) porque esos sí están en 'public/backgrounds'
// Si los fondos también estuvieran en src/assets, tendrías que importarlos igual que los personajes.

export const RACES = [
    {
        id: 'human',
        name: 'Humano Vikingo',
        description: 'Mercaderes natos y guerreros versátiles. Ganan +5% de Oro.',
        images: {
            male: humanoMale,
            female: humanoFemale
        },
        bgImage: '/backgrounds/background_base_humano.png',
        stats: { strength: 5, dexterity: 5, constitution: 5, intelligence: 5, charisma: 7, luck: 5 },
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
        images: {
            male: elfoMale,
            female: elfaFemale
        },
        bgImage: '/backgrounds/background_base_elfo.png',
        stats: { strength: 4, dexterity: 7, constitution: 4, intelligence: 6, charisma: 5, luck: 5 },
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
        images: {
            male: enanoMale,
            female: enanaFemale
        },
        bgImage: '/backgrounds/background_base_enano.png',
        stats: { strength: 6, dexterity: 3, constitution: 8, intelligence: 4, charisma: 4, luck: 5 },
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
        id: 'orc',
        name: 'Orco',
        description: 'Fuerza bruta desencadenada. +5% Creación de Armas.',
        images: {
            male: orcoMale,
            female: orcaFemale
        },
        bgImage: '/backgrounds/background_base_orco.png',
        stats: { strength: 9, dexterity: 4, constitution: 6, intelligence: 2, charisma: 3, luck: 3 },
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
        images: {
            male: felinoMale,
            female: felinaFemale
        },
        bgImage: '/backgrounds/background_base_felino.png',
        stats: { strength: 5, dexterity: 8, constitution: 4, intelligence: 4, charisma: 4, luck: 5 },
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
    },
    {
        id: 'goblin',
        name: 'Duende',
        description: 'Astutos y rápidos. +5% Encontrar Objetos.',
        images: {
            male: goblinMale,
            female: goblinaFemale
        },
        bgImage: '/backgrounds/background_base_goblin.png',
        stats: { strength: 3, dexterity: 8, constitution: 3, intelligence: 7, charisma: 3, luck: 8 },
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
    }
];