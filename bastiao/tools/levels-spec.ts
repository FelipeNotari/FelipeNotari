// Especificação compacta das 20 fases (ferramenta de desenvolvimento).
// O gerador (gen-levels.ts) transforma isto nos JSON de src/data/levels/.
// O jogo lê SOMENTE os JSON: para criar a fase 21 basta escrever fase-21.json.

export interface LevelSpec {
  id: number;
  name: string;
  biome: 'deserto' | 'cidade' | 'neve' | 'industrial';
  paths: number[][][];
  airPaths: number[][][];
  waves: number;
  towers: string[];
  abilities: string[];
  pool: Record<string, number>; // inimigo -> peso
  boss?: string;
  intro: string[]; // inimigos novos (ganham onda de apresentação)
  briefing: string;
  startMoney: number;
  hpMult: number;
  budget: number; // vida total da 1ª onda (antes do hpMult)
  growth: number; // crescimento linear do orçamento por onda
  blocked: number; // quantos dos melhores pontos começam bloqueados
}

const T = ['mg', 'at', 'aa', 'mo', 'sn', 'fl', 'su', 'la'];
const A = ['aereo', 'minas', 'suprimentos', 'arame', 'napalm', 'emp', 'reforcos'];
const towersUpTo = (n: number) => T.slice(0, n);
const abilUpTo = (lvl: number) =>
  A.filter((a) => ({ aereo: 1, minas: 1, suprimentos: 1, arame: 3, napalm: 6, emp: 9, reforcos: 12 } as any)[a] <= lvl);

export const SPECS: LevelSpec[] = [
  {
    id: 1, name: 'Posto Avançado', biome: 'deserto',
    paths: [[[-1, 2], [5, 2], [5, 7], [11, 7], [11, 3], [17, 3], [17, 10], [23, 10]]],
    airPaths: [], waves: 6, towers: towersUpTo(1), abilities: abilUpTo(1),
    pool: { soldado: 1 }, intro: ['soldado'],
    briefing: 'Primeiro contato com a Legião Cinza. Construa Metralhadoras perto das curvas e libere os melhores pontos derrubando obstáculos.',
    startMoney: 260, hpMult: 1, budget: 416, growth: 0.32, blocked: 6,
  },
  {
    id: 2, name: 'Dunas Vermelhas', biome: 'deserto',
    paths: [[[-1, 11], [4, 11], [4, 4], [10, 4], [10, 10], [16, 10], [16, 2], [21, 2], [21, 7], [23, 7]]],
    airPaths: [], waves: 8, towers: towersUpTo(2), abilities: abilUpTo(2),
    pool: { soldado: 3, moto: 1.5, jipe: 1.5 }, intro: ['moto', 'jipe'],
    briefing: 'Veículos leves à vista. Balas comuns rendem pouco contra blindagem: o Canhão Antitanque chegou.',
    startMoney: 320, hpMult: 1, budget: 512, growth: 0.3, blocked: 7,
  },
  {
    id: 3, name: 'Oásis Seco', biome: 'deserto',
    paths: [[[-1, 6], [3, 6], [3, 2], [8, 2], [8, 11], [13, 11], [13, 4], [18, 4], [18, 9], [23, 9]]],
    airPaths: [[[-1, 13], [10, 9], [23, 9]]], waves: 10, towers: towersUpTo(3), abilities: abilUpTo(3),
    pool: { soldado: 3, moto: 1, jipe: 1.2, tanque_leve: 1.3, drone: 1.4, heli: 1.1 }, intro: ['drone', 'heli', 'tanque_leve'],
    briefing: 'Ameaça aérea e o primeiro tanque! Balas comuns rendem pouco no ar: a Bateria Antiaérea chegou. Combine Metralhadora, Antitanque e Antiaérea.',
    startMoney: 380, hpMult: 1, budget: 608, growth: 0.28, blocked: 8,
  },
  {
    id: 4, name: 'Céu de Areia', biome: 'deserto',
    paths: [[[-1, 3], [6, 3], [6, 10], [12, 10], [12, 5], [18, 5], [18, 11], [23, 11]]],
    airPaths: [[[-1, 0], [9, 1], [23, 11]]], waves: 11, towers: towersUpTo(4), abilities: abilUpTo(4),
    pool: { soldado: 2.5, elite: 1.6, escudo: 1.4, moto: 1, jipe: 1, tanque_leve: 1, drone: 1.2, heli: 1 }, intro: ['elite', 'escudo'],
    briefing: 'Infantaria de elite e tropas com escudo balístico marcham em blocos. O Morteiro castiga grupos (mas não acerta o ar).',
    startMoney: 420, hpMult: 1, budget: 672, growth: 0.27, blocked: 8,
  },
  {
    id: 5, name: 'Toca do Escorpião', biome: 'deserto',
    paths: [[[-1, 10], [5, 10], [5, 3], [11, 3], [11, 9], [16, 9], [16, 2], [20, 2], [20, 7], [23, 7]]],
    airPaths: [[[0, -1], [12, 4], [23, 7]]], waves: 12, towers: towersUpTo(5), abilities: abilUpTo(5),
    pool: { soldado: 2, elite: 1.5, escudo: 1, moto: 1, jipe: 1, tanque_leve: 1.2, drone: 1.2, heli: 1, caminhao: 1.2 },
    intro: ['caminhao'], boss: 'boss_escorpiao',
    briefing: 'CHEFE: o Escorpião do Deserto. Sua fumaça impede a mira por alguns segundos — área e Sniper de longe são aliados.',
    startMoney: 460, hpMult: 1, budget: 736, growth: 0.26, blocked: 9,
  },
  {
    id: 6, name: 'Avenida Partida', biome: 'cidade',
    paths: [
      [[-1, 2], [7, 2], [7, 7], [14, 7], [14, 11], [23, 11]],
      [[-1, 12], [4, 12], [4, 9], [10, 9], [10, 7], [14, 7], [14, 11], [23, 11]],
    ],
    airPaths: [[[-1, 0], [23, 11]]], waves: 12, towers: towersUpTo(6), abilities: abilUpTo(6),
    pool: { soldado: 2.5, elite: 1.5, escudo: 1, moto: 1, jipe: 1, tanque_leve: 1, drone: 1, heli: 0.8, caminhao: 1, reparo: 1 },
    intro: ['reparo'],
    briefing: 'Duas entradas. Veículos de Reparo consertam os aliados: derrube-os primeiro. Lança-chamas assa infantaria em grupo.',
    startMoney: 500, hpMult: 1, budget: 800, growth: 0.26, blocked: 10,
  },
  {
    id: 7, name: 'Distrito Fantasma', biome: 'cidade',
    paths: [
      [[-1, 4], [6, 4], [6, 1], [13, 1], [13, 6], [23, 6]],
      [[6, 14], [6, 10], [13, 10], [13, 6], [23, 6]],
    ],
    airPaths: [[[-1, 13], [23, 6]]], waves: 13, towers: towersUpTo(7), abilities: abilUpTo(7),
    pool: { soldado: 2, elite: 1.5, escudo: 1, moto: 1, jipe: 1, tanque_leve: 1, drone: 1, heli: 0.8, caminhao: 0.8, reparo: 0.8, camuflado: 1.5 },
    intro: ['camuflado'],
    briefing: 'Unidades camufladas são invisíveis para as torres. O Radar de Suporte as revela e ainda reforça as vizinhas.',
    startMoney: 540, hpMult: 1, budget: 864, growth: 0.25, blocked: 10,
  },
  {
    id: 8, name: 'Praça do Relógio', biome: 'cidade',
    paths: [
      [[-1, 1], [9, 1], [9, 5], [4, 5], [4, 10], [12, 10], [12, 6], [18, 6], [18, 12], [23, 12]],
      [[15, -1], [15, 6], [18, 6], [18, 12], [23, 12]],
    ],
    airPaths: [[[-1, 13], [10, 13], [23, 12]]], waves: 13, towers: towersUpTo(8), abilities: abilUpTo(8),
    pool: { soldado: 2, elite: 1.5, escudo: 1, moto: 1, jipe: 1, tanque_leve: 1, drone: 1, heli: 0.8, caminhao: 0.8, reparo: 0.7, camuflado: 1, gerador: 1.3 },
    intro: ['gerador'],
    briefing: 'Geradores projetam escudos de energia: balas e explosivos ricocheteiam. O Laser derrete escudos.',
    startMoney: 580, hpMult: 1, budget: 928, growth: 0.25, blocked: 11,
  },
  {
    id: 9, name: 'Viaduto Caído', biome: 'cidade',
    paths: [
      [[-1, 3], [8, 3], [8, 8], [3, 8], [3, 12], [15, 12], [15, 7], [23, 7]],
      [[12, -1], [12, 4], [19, 4], [19, 7], [23, 7]],
    ],
    airPaths: [[[-1, 0], [23, 7]]], waves: 14, towers: towersUpTo(8), abilities: abilUpTo(9),
    pool: { soldado: 2, elite: 1.5, escudo: 1, moto: 1, jipe: 1, tanque_leve: 1, drone: 1, heli: 0.8, caminhao: 0.8, reparo: 0.7, camuflado: 1, gerador: 0.8, tanque_pesado: 1.2 },
    intro: ['tanque_pesado'],
    briefing: 'Tanques Pesados: só perfurante pesado faz efeito. Fogo e balas nem arranham.',
    startMoney: 620, hpMult: 1, budget: 992, growth: 0.25, blocked: 11,
  },
  {
    id: 10, name: 'Coração da Cidade', biome: 'cidade',
    paths: [
      [[-1, 6], [5, 6], [5, 2], [12, 2], [12, 11], [18, 11], [18, 5], [23, 5]],
      [[-1, 12], [8, 12], [8, 8], [12, 8], [12, 11], [18, 11], [18, 5], [23, 5]],
    ],
    airPaths: [[[-1, 0], [23, 5]]], waves: 15, towers: towersUpTo(8), abilities: abilUpTo(10),
    pool: { soldado: 2, elite: 1.5, escudo: 1, moto: 1, jipe: 1, tanque_leve: 1, drone: 1, heli: 0.8, caminhao: 0.8, reparo: 0.7, camuflado: 1, gerador: 0.8, tanque_pesado: 0.9 },
    intro: [], boss: 'boss_colosso',
    briefing: 'CHEFE: o Colosso Urbano. Com metade da vida ele larga a blindagem pesada, acelera e desembarca soldados de elite.',
    startMoney: 660, hpMult: 1, budget: 1056, growth: 0.25, blocked: 12,
  },
  {
    id: 11, name: 'Passo Gelado', biome: 'neve',
    paths: [[[-1, 2], [10, 2], [10, 6], [4, 6], [4, 11], [14, 11], [14, 5], [19, 5], [19, 9], [23, 9]]],
    airPaths: [[[-1, 13], [11, 8], [23, 9]], [[8, -1], [23, 9]]], waves: 15, towers: towersUpTo(8), abilities: abilUpTo(11),
    pool: { soldado: 2, elite: 1.5, escudo: 1, moto: 1, jipe: 1, tanque_leve: 1, drone: 1, heli: 0.8, caminhao: 0.8, reparo: 0.7, camuflado: 1, gerador: 0.8, tanque_pesado: 0.8, kamikaze: 1.3 },
    intro: ['kamikaze'],
    briefing: 'Drones Kamikaze mergulham nas torres e as desligam. Proteja a linha com antiaérea à frente.',
    startMoney: 700, hpMult: 1, budget: 1120, growth: 0.25, blocked: 12,
  },
  {
    id: 12, name: 'Floresta Branca', biome: 'neve',
    paths: [
      [[-1, 10], [6, 10], [6, 4], [14, 4], [14, 9], [23, 9]],
      [[8, -1], [8, 1], [17, 1], [17, 9], [23, 9]],
    ],
    airPaths: [[[-1, 0], [23, 9]]], waves: 16, towers: towersUpTo(8), abilities: abilUpTo(12),
    pool: { soldado: 2, elite: 1.5, escudo: 1, moto: 1, jipe: 1, tanque_leve: 1, drone: 1, heli: 0.8, caminhao: 0.8, reparo: 0.7, camuflado: 1, gerador: 0.8, tanque_pesado: 0.8, kamikaze: 1 },
    intro: [],
    briefing: 'Duas colunas inimigas atravessam a floresta. Cuidado com os camuflados entre as árvores.',
    startMoney: 740, hpMult: 1, budget: 1184, growth: 0.25, blocked: 13,
  },
  {
    id: 13, name: 'Lago Congelado', biome: 'neve',
    paths: [
      [[-1, 3], [5, 3], [5, 8], [11, 8], [11, 12], [23, 12]],
      [[-1, 13], [3, 13], [3, 11], [8, 11], [8, 8], [11, 8], [11, 12], [23, 12]],
      [[14, -1], [14, 5], [20, 5], [20, 12], [23, 12]],
    ],
    airPaths: [[[-1, 0], [12, 3], [23, 12]]], waves: 16, towers: towersUpTo(8), abilities: abilUpTo(13),
    pool: { soldado: 2, elite: 1.5, escudo: 1, moto: 1.2, jipe: 1, tanque_leve: 1, drone: 1, heli: 0.8, caminhao: 0.8, reparo: 0.7, camuflado: 1, gerador: 0.8, tanque_pesado: 0.8, kamikaze: 1 },
    intro: [],
    briefing: 'Três rotas convergem no lago. Espalhar a defesa custa caro: escolha bem os pontos de encontro.',
    startMoney: 780, hpMult: 1, budget: 1248, growth: 0.25, blocked: 13,
  },
  {
    id: 14, name: 'Estação Polar', biome: 'neve',
    paths: [
      [[-1, 7], [4, 7], [4, 2], [10, 2], [10, 11], [16, 11], [16, 4], [23, 4]],
      [[19, 14], [19, 8], [16, 8], [16, 4], [23, 4]],
    ],
    airPaths: [[[-1, 13], [23, 4]], [[-1, 0], [23, 4]]], waves: 17, towers: towersUpTo(8), abilities: abilUpTo(14),
    pool: { soldado: 2, elite: 1.5, escudo: 1, moto: 1, jipe: 1, tanque_leve: 1, drone: 1.2, heli: 1, caminhao: 0.8, reparo: 0.7, camuflado: 1, gerador: 0.9, tanque_pesado: 0.9, kamikaze: 1.1 },
    intro: [],
    briefing: 'Ataque por terra e por duas rotas aéreas. A estação precisa de cobertura antiaérea dupla.',
    startMoney: 820, hpMult: 1, budget: 1312, growth: 0.25, blocked: 14,
  },
  {
    id: 15, name: 'Muralha de Gelo', biome: 'neve',
    paths: [
      [[-1, 2], [7, 2], [7, 6], [2, 6], [2, 11], [12, 11], [12, 6], [17, 6], [17, 10], [23, 10]],
      [[12, -1], [12, 3], [17, 3], [17, 6]],
    ],
    airPaths: [[[-1, 13], [23, 10]]], waves: 18, towers: towersUpTo(8), abilities: abilUpTo(15),
    pool: { soldado: 2, elite: 1.5, escudo: 1, moto: 1, jipe: 1, tanque_leve: 1, drone: 1, heli: 0.8, caminhao: 0.8, reparo: 0.7, camuflado: 1, gerador: 1, tanque_pesado: 0.9, kamikaze: 1 },
    intro: [], boss: 'boss_fortaleza',
    briefing: 'CHEFE: a Fortaleza Polar. Escudo de energia gigante que se regenera: quebre-o com Lasers e castigue o casco com Antitanques.',
    startMoney: 860, hpMult: 1, budget: 1376, growth: 0.25, blocked: 14,
  },
  {
    id: 16, name: 'Pátio de Cargas', biome: 'industrial',
    paths: [
      [[-1, 4], [6, 4], [6, 10], [13, 10], [13, 3], [19, 3], [19, 8], [23, 8]],
      [[-1, 13], [9, 13], [9, 10], [13, 10]],
    ],
    airPaths: [[[-1, 0], [23, 8]]], waves: 18, towers: towersUpTo(8), abilities: abilUpTo(16),
    pool: { soldado: 2, elite: 1.6, escudo: 1.1, moto: 1, jipe: 1, tanque_leve: 1, drone: 1, heli: 0.9, caminhao: 0.9, reparo: 0.8, camuflado: 1, gerador: 1, tanque_pesado: 1, kamikaze: 1 },
    intro: [],
    briefing: 'O complexo industrial da Legião. Contêineres bloqueiam os melhores pontos — vale a pena abrir espaço?',
    startMoney: 900, hpMult: 1, budget: 1440, growth: 0.25, blocked: 15,
  },
  {
    id: 17, name: 'Refinaria', biome: 'industrial',
    paths: [
      [[-1, 1], [5, 1], [5, 6], [10, 6], [10, 1], [16, 1], [16, 12], [23, 12]],
      [[-1, 9], [7, 9], [7, 12], [16, 12]],
    ],
    airPaths: [[[-1, 4], [23, 12]], [[12, -1], [23, 12]]], waves: 19, towers: towersUpTo(8), abilities: abilUpTo(17),
    pool: { soldado: 2, elite: 1.6, escudo: 1.1, moto: 1, jipe: 1, tanque_leve: 1, drone: 1.1, heli: 1, caminhao: 0.9, reparo: 0.8, camuflado: 1, gerador: 1, tanque_pesado: 1, kamikaze: 1.1 },
    intro: [],
    briefing: 'Barris de combustível por toda parte: explodem quando destruídos e ferem quem estiver perto.',
    startMoney: 940, hpMult: 1, budget: 1504, growth: 0.25, blocked: 15,
  },
  {
    id: 18, name: 'Altos-Fornos', biome: 'industrial',
    paths: [
      [[-1, 6], [4, 6], [4, 1], [11, 1], [11, 6], [17, 6], [17, 1], [23, 1]],
      [[-1, 12], [11, 12], [11, 6]],
      [[20, 14], [20, 9], [17, 9], [17, 6]],
    ],
    airPaths: [[[-1, 13], [23, 1]]], waves: 19, towers: towersUpTo(8), abilities: abilUpTo(18),
    pool: { soldado: 2, elite: 1.6, escudo: 1.1, moto: 1, jipe: 1, tanque_leve: 1, drone: 1, heli: 0.9, caminhao: 0.9, reparo: 0.8, camuflado: 1, gerador: 1, tanque_pesado: 1.1, kamikaze: 1 },
    intro: [],
    briefing: 'Três frentes e calor infernal. Defina sua especialização e não desperdice nada.',
    startMoney: 980, hpMult: 1, budget: 1568, growth: 0.25, blocked: 16,
  },
  {
    id: 19, name: 'Usina Norte', biome: 'industrial',
    paths: [
      [[-1, 2], [8, 2], [8, 7], [3, 7], [3, 12], [14, 12], [14, 7], [23, 7]],
      [[11, -1], [11, 4], [18, 4], [18, 7]],
    ],
    airPaths: [[[-1, 13], [23, 7]], [[-1, 0], [14, 1], [23, 7]]], waves: 20, towers: towersUpTo(8), abilities: abilUpTo(19),
    pool: { soldado: 2, elite: 1.6, escudo: 1.1, moto: 1.1, jipe: 1, tanque_leve: 1, drone: 1.1, heli: 1, caminhao: 0.9, reparo: 0.8, camuflado: 1.1, gerador: 1.1, tanque_pesado: 1.1, kamikaze: 1.1 },
    intro: [],
    briefing: 'Última linha antes do ninho do Ciclope. Tudo o que a Legião tem virá por terra e ar.',
    startMoney: 1020, hpMult: 1, budget: 1632, growth: 0.25, blocked: 16,
  },
  {
    id: 20, name: 'Ninho do Ciclope', biome: 'industrial',
    paths: [
      [[-1, 3], [6, 3], [6, 8], [12, 8], [12, 3], [18, 3], [18, 11], [23, 11]],
      [[-1, 12], [9, 12], [9, 8], [12, 8]],
    ],
    airPaths: [[[-1, 0], [10, 6], [23, 11]], [[-1, 13], [23, 11]]], waves: 20, towers: towersUpTo(8), abilities: abilUpTo(20),
    pool: { soldado: 2, elite: 1.6, escudo: 1.1, moto: 1, jipe: 1, tanque_leve: 1, drone: 1.1, heli: 1, caminhao: 0.9, reparo: 0.8, camuflado: 1.1, gerador: 1.1, tanque_pesado: 1.1, kamikaze: 1.1 },
    intro: [], boss: 'boss_ciclope',
    briefing: 'CHEFE FINAL: o Ciclope, canhoneira aérea que desliga torres com EMP e lança enxames. Só torres antiaéreas o derrubam.',
    startMoney: 1060, hpMult: 1, budget: 1696, growth: 0.25, blocked: 17,
  },
];
