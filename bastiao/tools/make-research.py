# Gera src/data/research.json a partir de uma descricao compacta.
# (ferramenta de desenvolvimento; o jogo le apenas o JSON gerado)
import json

FXTXT = {
  'dmg': '{:+.0f}% de dano', 'rate': '{:+.0f}% de cadência', 'range': '{:+.0f}% de alcance',
  'cost': '{:+.0f}% no custo de construção', 'upg': '{:+.0f}% no custo de melhorias', 'aoe': '{:+.0f}% de raio da explosão',
  'burn': '{:+.0f}% de queimadura', 'ramp': '{:+.0f}% no dano máximo acumulado', 'rampSpeed': '{:+.0f}% na velocidade de aquecimento',
  'crit': '{:+.0f}% de chance de tiro crítico (dano dobrado)', 'minRange': '{:+.0f}% no ponto cego', 'slow': '{:+.0f}% de lentidão aplicada',
  'aura': '{:+.0f}% no bônus de alcance dado às vizinhas', 'auraDmg': '+{:.0f} pontos % de dano para torres vizinhas', 'reveal': '{:+.0f}% de raio do radar',
  'vs.INF': '{:+.0f}% de dano contra Infantaria', 'vs.LEV': '{:+.0f}% de dano contra Blindagem leve', 'vs.PES': '{:+.0f}% de dano contra Blindagem pesada',
  'vs.AER': '{:+.0f}% de dano contra Aéreos', 'vs.ESC': '{:+.0f}% de dano contra Escudo de energia',
  'power': '{:+.0f}% de potência', 'radius': '{:+.0f}% de raio', 'duration': '{:+.0f}% de duração', 'cd': '{:+.0f}% no tempo de recarga',
}

def desc(fx):
  return '; '.join(FXTXT[k].format(v*100) for k,v in fx.items())

TOWER_SHAPE = [
  # id, row, col, cost, req(any), excl
  ('n1',0,1,1,[],[]), ('n2',1,0,1,['n1'],[]), ('n3',1,2,1,['n1'],[]),
  ('n4',2,0,2,['n2'],[]), ('n5',2,2,2,['n3'],[]), ('n6',3,1,2,['n4','n5'],[]),
  ('a1',4,0,2,['n6'],['b1']), ('a2',5,0,3,['a1'],[]), ('a3',6,0,3,['a2'],[]),
  ('b1',4,2,2,['n6'],['a1']), ('b2',5,2,3,['b1'],[]), ('b3',6,2,3,['b2'],[]),
]
ABIL_SHAPE = [
  ('n1',0,1,1,[],[]), ('n2',1,0,1,['n1'],[]), ('n3',1,2,1,['n1'],[]),
  ('x',2,0,2,['n2','n3'],['y']), ('y',2,2,2,['n2','n3'],['x']), ('n6',3,1,3,['x','y'],[]),
]

T = {
 'mg': ('Supressão', 'Antiaérea improvisada', [
   ('Canos reforçados',{'dmg':.05}),('Mira estabilizada',{'range':.05}),('Linha de montagem',{'cost':-.06}),
   ('Ferrolho leve',{'rate':.06}),('Manutenção de campo',{'upg':-.08}),('Munição de alta velocidade',{'dmg':.06}),
   ('Rajada contínua',{'rate':.08}),('Munição fragmentável',{'vs.INF':.10}),('Fogo de supressão',{'dmg':.08}),
   ('Mira antiaérea',{'vs.AER':.10}),('Munição traçante',{'range':.08}),('Núcleo de aço',{'vs.LEV':.10})]),
 'at': ('Matador de tanques', 'Caçador ágil', [
   ('Pólvora refinada',{'dmg':.05}),('Carregador automático',{'rate':.05}),('Logística',{'cost':-.06}),
   ('Ogiva HEAT',{'vs.PES':.08}),('Telêmetro',{'range':.05}),('Oficina móvel',{'upg':-.08}),
   ('Ogiva tandem',{'vs.PES':.10}),('Recarga hidráulica',{'rate':.08}),('Calibre ampliado',{'dmg':.08}),
   ('Rastreamento rápido',{'vs.LEV':.10}),('Munição sabot',{'dmg':.07}),('Torre giratória',{'range':.08})]),
 'mo': ('Barragem', 'Artilharia pesada', [
   ('Granadas carregadas',{'dmg':.05}),('Tubo reforçado',{'range':.05}),('Base leve',{'cost':-.06}),
   ('Estilhaços',{'aoe':.06}),('Cálculo balístico',{'minRange':-.10}),('Equipe treinada',{'rate':.06}),
   ('Fogo rápido',{'rate':.08}),('Granada de fragmentação',{'vs.INF':.10}),('Saturação',{'aoe':.08}),
   ('Carga dupla',{'dmg':.08}),('Projétil perfurante',{'vs.PES':.10}),('Longo alcance',{'range':.08})]),
 'aa': ('Defesa de área', 'Caça-helicópteros', [
   ('Ogivas melhoradas',{'dmg':.05}),('Radar de busca',{'range':.05}),('Lançador modular',{'cost':-.06}),
   ('Recarga rápida',{'rate':.06}),('Fragmentação',{'aoe':.08}),('Guiagem infravermelha',{'dmg':.06}),
   ('Espoleta de proximidade',{'aoe':.10}),('Salva rápida',{'rate':.08}),('Carga ampliada',{'dmg':.06}),
   ('Ogiva pesada',{'dmg':.08}),('Radar de longo alcance',{'range':.08}),('Míssil perfurante',{'vs.AER':.10})]),
 'sn': ('Caçador de blindados', 'Atirador de elite', [
   ('Luneta melhorada',{'range':.05}),('Cano longo',{'dmg':.06}),('Contrato militar',{'cost':-.06}),
   ('Pente estendido',{'rate':.06}),('Treinamento de tiro',{'rate':.05}),('Ponto vital',{'crit':.06}),
   ('Projétil de tungstênio',{'vs.PES':.10}),('Calibre .50',{'dmg':.08}),('Perfuração total',{'vs.LEV':.10}),
   ('Respiração controlada',{'crit':.08}),('Visão térmica',{'range':.08}),('Abate rápido',{'rate':.08})]),
 'fl': ('Inferno', 'Chama pesada', [
   ('Combustível denso',{'dmg':.05}),('Bocal largo',{'range':.05}),('Tanque econômico',{'cost':-.06}),
   ('Gel incendiário',{'burn':.08}),('Pressão extra',{'dmg':.06}),('Manutenção',{'upg':-.08}),
   ('Napalm líquido',{'burn':.10}),('Fogo branco',{'dmg':.08}),('Chama persistente',{'burn':.10}),
   ('Bico de longo alcance',{'range':.08}),('Termita',{'vs.LEV':.10}),('Pressão máxima',{'dmg':.08})]),
 'su': ('Guerra eletrônica', 'Inteligência', [
   ('Antena ampliada',{'reveal':.06}),('Interferência',{'slow':.08}),('Kit compacto',{'cost':-.06}),
   ('Rede de dados',{'aura':.08}),('Bateria extra',{'reveal':.06}),('Manutenção barata',{'upg':-.08}),
   ('Bloqueio de motores',{'slow':.10}),('Pulso contínuo',{'slow':.10}),('Sobrecarga de rede',{'aura':.10}),
   ('Varredura ampla',{'reveal':.08}),('Marcação de alvos',{'auraDmg':.05}),('Link de satélite',{'aura':.10})]),
 'la': ('Desintegrador', 'Feixe tático', [
   ('Lentes polidas',{'dmg':.05}),('Capacitores',{'ramp':.06}),('Produção em série',{'cost':-.06}),
   ('Foco estreito',{'range':.05}),('Refrigeração',{'dmg':.06}),('Sobrecarga',{'ramp':.08}),
   ('Frequência de escudo',{'vs.ESC':.10}),('Feixe contínuo',{'ramp':.10}),('Potência máxima',{'dmg':.08}),
   ('Aquisição rápida',{'rampSpeed':.10}),('Óptica adaptativa',{'range':.08}),('Feixe antiaéreo',{'vs.AER':.10})]),
}

A = {
 'aereo': ('Bombas pesadas','Bombardeio ágil', [('Carga extra',{'power':.08}),('Pilotos treinados',{'cd':-.08}),('Dispersão',{'radius':.08}),
           ('Bombas pesadas',{'power':.10}),('Bombardeio ágil',{'cd':-.10}),('Tapete de bombas',{'radius':.10})]),
 'minas': ('Antitanque','Fragmentação', [('Carga extra',{'power':.08}),('Detonador rápido',{'cd':-.08}),('Espoleta sensível',{'radius':.08}),
           ('Minas antitanque',{'power':.10}),('Minas de fragmentação',{'radius':.10}),('Estoque reserva',{'cd':-.10})]),
 'suprimentos': ('Logística','Rota curta', [('Caixa reforçada',{'power':.08}),('Rota rápida',{'cd':-.08}),('Contatos',{'power':.06}),
           ('Logística pesada',{'power':.10}),('Rota curta',{'cd':-.10}),('Contrabando',{'power':.10})]),
 'arame': ('Concertina','Emaranhado', [('Farpas afiadas',{'power':.08}),('Estacas',{'duration':.08}),('Equipe rápida',{'cd':-.08}),
           ('Concertina',{'radius':.10}),('Emaranhado',{'power':.10}),('Arame reforçado',{'duration':.10})]),
 'napalm': ('Área ampla','Gel concentrado', [('Mistura densa',{'power':.08}),('Queima longa',{'duration':.08}),('Recarga',{'cd':-.08}),
           ('Área ampla',{'radius':.10}),('Gel concentrado',{'power':.10}),('Esquadrilha',{'cd':-.10})]),
 'emp': ('Sobrecarga','Onda longa', [('Bobinas',{'radius':.08}),('Pulso estendido',{'duration':.08}),('Capacitor rápido',{'cd':-.08}),
           ('Sobrecarga',{'power':.10}),('Onda longa',{'radius':.10}),('Reator extra',{'cd':-.10})]),
 'reforcos': ('Atiradores','Veteranos', [('Munição extra',{'power':.08}),('Rações',{'duration':.08}),('Rádio',{'cd':-.08}),
           ('Atiradores',{'power':.10}),('Veteranos',{'duration':.10}),('Helicóptero de apoio',{'cd':-.10})]),
}

def build(shape, names):
  nodes=[]
  for (nid,row,col,cost,req,excl),(name,fx) in zip(shape, names):
    nodes.append({'id':nid,'name':name,'desc':desc(fx),'cost':cost,'row':row,'col':col,'req':req,'excl':excl,'fx':fx})
  return nodes

out={'towers':{}, 'abilities':{}}
for tid,(ba,bb,names) in T.items():
  out['towers'][tid]={'branchA':ba,'branchB':bb,'nodes':build(TOWER_SHAPE,names)}
for aid,(ba,bb,names) in A.items():
  out['abilities'][aid]={'branchA':ba,'branchB':bb,'nodes':build(ABIL_SHAPE,names)}
json.dump(out, open('src/data/research.json','w'), ensure_ascii=False, indent=1)
tot=sum(n['cost'] for t in out['towers'].values() for n in t['nodes'])+sum(n['cost'] for t in out['abilities'].values() for n in t['nodes'])
print('nos', sum(len(t['nodes']) for t in out['towers'].values()), sum(len(t['nodes']) for t in out['abilities'].values()), 'custo total', tot)
