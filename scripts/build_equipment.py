# -*- coding: utf-8 -*-
"""Gera src/rules/data/equipment.json a partir de docs/amnia-export/Equipamento.md (export do Notion)
+ metadados curados abaixo (efeitos, RD máximo, mods embutidos…). Uso: python3 scripts/build_equipment.py"""
import json, re, unicodedata, sys

import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "docs", "amnia-export", "Equipamento.md")
OUT = os.path.join(ROOT, "src", "rules", "data", "equipment.json")

def slug(s):
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")

def zg(text):
    """Padroniza a sigla de moeda para 'Zg' (Zigs, zigs, Zig, zgs, zg)."""
    text = re.sub(r"(\d)\s*(?:Zigs|zigs|Zig|zig|zgs|zg|Zg)\b", r"\1 Zg", text)
    text = re.sub(r"\b(?:Zigs|zigs|Zig|zig|zgs|zg)\b", "Zg", text)
    return text

SECTIONS = {
    "Armas Corpo a Corpo": "arma-corpo",
    "Armas Á Distância": "arma-distancia",
    "Munições": "municao",
    "Armaduras": "armadura",
    "Equipamento": "equipamento",
    "Acessórios": "acessorio",
    "Poções": "pocao",
    "Itens Miscelâneos": "misc",
    "Aliados & Companheiros": "aliado",
    "Companheiros": "companheiro",
}

LINE = re.compile(
    r"^(?P<name>.+?)\s*[-–]\s*(?P<price>\d+)(?P<plus>\+)?\s*(?:Zigs|zigs|Zig|zig|zgs|zg|Zg)(?P<day>/dia)?\s*[;:]?\s*(?P<rest>.*)$"
)

raw = open(SRC, encoding="utf-8").read().splitlines()
section = None
items = []
seen = set()
skipped = []
for line in raw:
    m = re.match(r"^##\s+(.*)$", line)
    if m:
        title = m.group(1).replace("*", "").strip()
        section = SECTIONS.get(title)
        continue
    if section is None or not line.startswith("- "):
        continue
    body = line[2:].replace("**", "").strip()
    m = LINE.match(body)
    if not m:
        skipped.append(line)
        continue
    name = m.group("name").strip().rstrip("*").strip()
    rest = m.group("rest").strip()
    # lixo de exportação do Notion
    rest = rest.replace("Colar de Dente de Lobo", "").strip()
    if section == "acessorio" and re.match(r"Kit (de|Arcano)", name):
        continue  # kits ficam só em Itens Miscelâneos (o Notion os repete)
    key = (section, name)
    if key in seen:
        continue
    seen.add(key)

    stats = ""
    sm = re.search(r"\*?\((PV:[^)]*)\)\*?\.?", rest)
    if sm:
        stats = sm.group(1).strip()
        rest = (rest[: sm.start()] + rest[sm.end():]).strip()
    rest = re.sub(r"\s+", " ", rest).strip().rstrip(";").strip()
    rest = rest.replace("*Penalidade:*", "Penalidade:").replace("*", "")
    desc = zg(rest)

    builtin = []
    for mm in re.finditer(r"Cont[eé]m (?:o )?Mod (\w+)", rest):
        builtin.append(mm.group(1))

    items.append({
        "id": slug(name),
        "name": name,
        "category": section,
        "price": int(m.group("price")),
        "priceFrom": bool(m.group("plus")),
        "perDay": bool(m.group("day")),
        "description": desc,
        "_builtin": builtin,
        "stats": stats,
    })

# ids únicos
ids = {}
for it in items:
    ids[it["id"]] = ids.get(it["id"], 0) + 1
dups = [k for k, v in ids.items() if v > 1]
if dups:
    print("IDS DUPLICADOS:", dups); sys.exit(1)

# ---------------------------------------------------------------- metadados curados
def eff(kind, amount, unit=None, scales=None, condition=None, choice=None, **target):
    e = {"target": {"kind": kind, **target}, "amount": amount}
    if unit: e["unit"] = unit
    if scales is not None: e["scales"] = scales
    if condition: e["condition"] = condition
    if choice: e["choice"] = choice
    return e

def skill(ids, n, **kw):   return eff("skill", n, ids=ids if isinstance(ids, list) else [ids], **kw)
def attr(a, n, **kw):      return eff("attribute", n, id=a, **kw)
def derived(d, n, **kw):   return eff("derived", n, id=d, **kw)
def rd(t, n, **kw):        return eff("rd", n, type=t, **kw)
def test(label, n, **kw):  return eff("test", n, label=label, **kw)

PEN = dict(scales=False)  # penalidades nunca escalam com a qualidade

META = {
    # --- Armaduras (RD Máx padrão = 3; "RD Máxima 0" trava qualquer aumento de RD)
    "Traje de Escuro":  dict(rdMax=0, effects=[skill("furtividade", 1)]),
    "Gibão de Aventureiro": dict(rdMax=0, effects=[skill(["atletismo", "sobrevivencia"], 1, choice="pericia")]),
    "Traje de Nobre":   dict(rdMax=0, effects=[skill("etiqueta", 1)]),
    "Couro Batido Reforçado": dict(effects=[rd("fisico", 1), skill("furtividade", -1, **PEN)]),
    "Cota de Malha":    dict(effects=[rd("fisico", 1), skill("intimidacao", 1), skill("furtividade", -1, **PEN)]),
    "Colete de Couro Negro Corviano": dict(effects=[rd("fisico", 1), skill("furtividade", 1)]),
    "Cota de Malha Elfica": dict(effects=[rd("geral", 1)]),
    "Armadura de Placas": dict(effects=[rd("fisico", 2), attr("destreza", -2, **PEN), skill("atletismo", -2, **PEN), skill("furtividade", -2, **PEN)]),
    "Armadura de Escamas Tratadas": dict(effects=[rd("fisico", 2), attr("destreza", -2, **PEN), skill("atletismo", -2, **PEN), skill("furtividade", -2, **PEN)]),
    "Armadura de Ferro Negro": dict(effects=[rd("fisico", 2), attr("destreza", -2, **PEN), skill("atletismo", -2, **PEN), skill("furtividade", -2, **PEN)]),
    "Manto de Chumbo Rúnico": dict(effects=[rd("magico", 1)]),
    "Armadura de Placas Cerimoniais Redianas": dict(effects=[rd("geral", 1)]),
    # --- Equipamento
    "Capuz de Viajante": dict(effects=[skill("sobrevivencia", 1, condition="contra clima severo")]),
    "Escudo de Madeira": dict(effects=[test("Defesa", 1)]),
    "Botas de Escalada (com ganchos)": dict(effects=[skill("atletismo", 1, unit="sucesso", condition="para escalar")]),
    "Escudo de Aparagem": dict(effects=[rd("geral", 1, condition="ao usar a Ação de Aparar")]),
    "Cinto de Bolsos Ocultos": dict(effects=[skill("ladroagem", 1, condition="para ocultar objetos pequenos no corpo")]),
    "Chápeu do Escoteiro": dict(effects=[skill("percepcao", 1, condition="para notar emboscadas ou detalhes ocultos")]),
    "Manoplas de Agarrar": dict(effects=[test("Luta Agarrada", 1), skill("atletismo", 1, condition="para escalar")]),
    "Escudo Espinhado": dict(modKinds=["equipamento"], effects=[test("Defesa", 1)]),
    "Pavês (Escudo de Torre)": dict(effects=[test("Defesa", 2), rd("geral", 1, condition="contra ataques à distância vindos da frente"),
                                              derived("deslocamentoGrid", -1, **PEN), derived("deslocamentoMetros", -1.5, **PEN)]),
    "Cajado de Carvalho Arcano": dict(effects=[derived("limiar", 2)]),
    "Manopla de Guerra": dict(effects=[test("Dano Desarmado", 1, unit="flat")]),
    "Manopla Pesada": dict(modKinds=["equipamento", "armadura"], effects=[test("Dano Desarmado", 1, unit="flat")]),
    "Elmo de Guerra": dict(modKinds=["equipamento", "armadura"], effects=[skill(["lideranca", "intimidacao"], 1, choice=None)]),
    "Escudo Canhão Gorvnon": dict(effects=[test("Defesa", 2), rd("geral", 1, condition="contra ataques à distância vindos da frente"),
                                           derived("deslocamentoGrid", -1, **PEN), derived("deslocamentoMetros", -1.5, **PEN)]),
    "Cajado da Lua": dict(effects=[derived("limiar", 4)]),
    "Tiara de Cristal (Rara)": dict(effects=[derived("pm", 1)]),
    # --- Acessórios
    "Amuleto de Mente Focada": dict(effects=[test("Saves de Vontade (medo, pânico, encantamento)", 1)]),
    "Amuleto de Proteção Simples": dict(effects=[rd("tipo", 1, choice="tipo")]),
    "Colar de Pedras Coloridas": dict(effects=[skill("persuasao", 1), skill("empatia-animal", 1)]),
    "Cinto com Fivelas": dict(effects=[test("Dano de armas de arremesso", 1, unit="flat")]),
    "Pulseira de Contas de Osso": dict(effects=[test("Magias de Canalização Ritual", 1)]),
    "Brincos de Prata": dict(effects=[skill(["*"], 1, unit="flat", choice="pericia")]),
    "Cordão com Medalhão Lirizatl": dict(effects=[attr("carisma", 1)]),
    # --- Miscelâneos com bônus (podem ser equipados)
    "Kit de Ladrão": dict(effects=[skill("ladroagem", 1)]),
    "Kit de Curandeiro": dict(effects=[skill("medicina", 1)]),
    "Kit Arcano": dict(effects=[skill("arcanismo", 1)]),
    "Kit de Escalada": dict(effects=[skill("atletismo", 1, condition="para escalar")]),
    "Kit de Disfarce": dict(effects=[test("Disfarce / Lábia", 1)]),
}
# "Elmo de Guerra": +1d6 em Liderança E Intimidação (os dois, não escolha)
META["Elmo de Guerra"]["effects"] = [skill("lideranca", 1), skill("intimidacao", 1)]

# perícia relacionada das armas (qualidade "+Nd6 na perícia relacionada")
RANGED_SKILL, MELEE_SKILL = "precisao", "armas-brancas"
WEAPON_SKILL_OVERRIDE = {"Garras": "briga"}

MODKIND_BY_CATEGORY = {
    "arma-corpo": ["arma"], "arma-distancia": ["arma"],
    "armadura": ["armadura"], "equipamento": ["equipamento"], "acessorio": ["equipamento"],
}
QUALITYABLE = {"arma-corpo", "arma-distancia", "armadura", "equipamento", "acessorio"}
EQUIPPABLE = QUALITYABLE | {"misc"}

MODNAMES = {
    "arma": {"Perfurante": "perfurante", "Balanceada": "balanceada", "Marcial": "marcial", "Serrada": "serrada", "Leve": "leve"},
    "armadura": {"Ajustada": "ajustada", "Revestimento": "revestimento", "Espinhada": "espinhada", "Pesada": "pesada", "Bolsos": "bolsos-extras"},
    "equipamento": {"Confiável": "confiavel", "Lubrificado": "lubrificado", "Engenhado": "engenhado", "Especializado": "especializado", "Amigável": "amigavel"},
}

missing = [k for k in META if k not in {i["name"] for i in items}]
if missing:
    print("META SEM ITEM:", missing); sys.exit(1)

out_items = []
for it in items:
    meta = META.get(it["name"], {})
    cat = it["category"]
    kinds = list(MODKIND_BY_CATEGORY.get(cat, [])) if cat in QUALITYABLE else []
    for k in meta.get("modKinds", []):
        if k not in kinds: kinds.append(k)
    # "Pode receber Modificadores de Armadura" no texto
    if "Modificadores de Armadura" in it["description"] and "armadura" not in kinds:
        kinds.append("armadura")
    builtin = []
    for name in it["_builtin"]:
        found = None
        pref = kinds if kinds else list(MODNAMES)
        for kind in pref + [k for k in MODNAMES if k not in pref]:
            if name in MODNAMES[kind]:
                found = f"{kind}:{MODNAMES[kind][name]}"; break
        if not found:
            print("MOD EMBUTIDO NÃO RECONHECIDO:", it["name"], name); sys.exit(1)
        builtin.append(found)

    o = {
        "id": it["id"], "name": it["name"], "category": cat,
        "price": it["price"],
    }
    if it["priceFrom"]: o["priceFrom"] = True
    if it["perDay"]: o["perDay"] = True
    o["description"] = it["description"]
    if it["stats"]: o["stats"] = it["stats"]
    if cat in QUALITYABLE:
        o["qualityable"] = True
        o["modKinds"] = kinds
    if cat in ("arma-corpo", "arma-distancia"):
        o["weaponSkill"] = WEAPON_SKILL_OVERRIDE.get(it["name"], RANGED_SKILL if cat == "arma-distancia" else MELEE_SKILL)
    if builtin: o["builtinMods"] = builtin
    if "rdMax" in meta: o["rdMax"] = meta["rdMax"]
    effects = meta.get("effects", [])
    if effects: o["effects"] = effects
    if cat in EQUIPPABLE and (cat != "misc" or effects):
        o["equippable"] = True
    if cat in ("pocao", "municao", "misc") and not o.get("equippable"):
        o["stackable"] = True
    out_items.append(o)

data = {
    "currency": "Zg",
    "craftDc": "DC Base = 2 + (valor em Zg ÷ 50, arredondado para baixo); Teste prolongado de Int + Ofícios.",
    "rdMaxDefault": 3,
    "ammoRule": {"costZg": 5, "units": 3},
    "qualities": [
        {"id": "comum", "name": "Comum", "level": 0, "extraCost": 0, "slots": 0,
         "description": "Preço base. 0 Slots de Modificação."},
        {"id": "boa", "name": "Boa Qualidade +1", "level": 1, "extraCost": 25, "slots": 1,
         "description": "+25 Zg. +1d6 na perícia relacionada OU +1 de Dano. 1 Slot de Modificação."},
        {"id": "obra-prima", "name": "Obra-Prima +2", "level": 2, "extraCost": 75, "slots": 2,
         "description": "+75 Zg (total). +2d6 na perícia OU +2 de Dano. 2 Slots de Modificação."},
        {"id": "lendaria", "name": "Lendária +3", "level": 3, "extraCost": 250, "slots": 3,
         "description": "+250 Zg (total). +3d6 na perícia OU +3 de Dano. 3 Slots de Modificação."},
    ],
    "modifiers": {
        "arma": {"label": "Modificação de Arma", "cost": 20, "mods": [
            {"id": "perfurante", "name": "Perfurante", "description": "Ignora RD de um alvo."},
            {"id": "balanceada", "name": "Balanceada", "description": "+1 dado de Defesa.",
             "effects": [test("Defesa", 1)]},
            {"id": "marcial", "name": "Marcial", "description": "+1 SAVE DC para ataques dessa arma.",
             "effects": [test("SAVE DC dos ataques com a arma", 1, unit="flat")]},
            {"id": "serrada", "name": "Serrada", "description": "Acertar um ataque com uma Margem de +3 causa sangramento caso o alvo falhe num SAVE DC."},
            {"id": "leve", "name": "Leve", "description": "+1 dado para reações com essa arma.",
             "effects": [test("Reações com a arma", 1)]},
        ]},
        "armadura": {"label": "Modificação de Armadura", "cost": 18, "mods": [
            {"id": "ajustada", "name": "Ajustada", "description": "Reduz em -1 dado a desvantagem a Destreza e Atletismo da Armadura.",
             "offsets": [{"kind": "attribute", "id": "destreza"}, {"kind": "skill", "id": "atletismo"}]},
            {"id": "revestimento", "name": "Revestimento", "description": "+1 RD contra um tipo de dano não-físico.",
             "effects": [rd("tipo", 1, choice="revestimento")]},
            {"id": "espinhada", "name": "Espinhada", "description": "Causa dano equivalente a RD durante ações de agarrar e investidas diretas."},
            {"id": "pesada", "name": "Pesada", "description": "+1 RD Físico mas Diminui -1 testes de DES e Atletismo.",
             "effects": [rd("fisico", 1), attr("destreza", -1, scales=False), skill("atletismo", -1, scales=False)]},
            {"id": "bolsos-extras", "name": "Bolsos Extras", "description": "Bolsos extras que carregam itens pequenos que podem ser usados com uma ação menor."},
        ]},
        "equipamento": {"label": "Modificação de Equipamento", "cost": 15, "mods": [
            {"id": "confiavel", "name": "Confiável", "description": "Permite re-rolar 1 dado falho da perícia."},
            {"id": "lubrificado", "name": "Lubrificado", "description": "A primeira rolagem de uma cena com esse item recebe +1 dado."},
            {"id": "engenhado", "name": "Engenhado", "description": "Caso seja usado em um teste de ofícios recebe 1 sucesso automático."},
            {"id": "especializado", "name": "Especializado", "description": "Caso seja algo no qual você é especializado recebe +1 dado na rolagem."},
            {"id": "amigavel", "name": "Amigável", "description": "Quando usa esse item para ajudar um aliado recebe +1 dado."},
        ]},
    },
    "enchantCosts": {"arma": 125, "armadura": 125, "equipamento": 100, "acessorio": 85},
    "enchantments": [
        {"id": "afiamento", "name": "Afiamento", "description": "Concede 1 Sucesso Automático ao atacar com esse item."},
        {"id": "leveza", "name": "Leveza", "description": "Permite realizar um ataque com -2 dados usando uma ação menor."},
        {"id": "impactante", "name": "Impactante", "description": "Ao acertar por uma margem de +4, deixa o alvo Prejudicado."},
        {"id": "durabilidade-aumentada", "name": "Durabilidade Aumentada", "description": "O item recebe a Runa de Resistência equivalente à Qualidade do Item."},
        {"id": "claridade-de-visao", "name": "Claridade de Visão", "description": "A Ação de Mirar concede +1 dado extra."},
        {"id": "resistencia-a-elementos", "name": "Resistência a Elementos", "description": "Reduz o dano de 2 elementos pela metade."},
        {"id": "equilibrio-perfeito", "name": "Equilíbrio Perfeito", "description": "-1 dado adicional para o inimigo ao usar a Ação de Desvio."},
        {"id": "eco-sutil", "name": "Eco Sutil", "description": "Aumenta sua percepção em +2.",
         "effects": [skill("percepcao", 2, unit="flat", scales=False)]},
        {"id": "espinhado", "name": "Espinhado", "description": "Ao negar completamente um dano por meio de RD, causa o dano negado de volta ao atacante."},
        {"id": "gravura-arcana", "name": "Gravura Arcana", "description": "Aumenta seu Limiar em 2 + Qualidade do Item.",
         "effects": [derived("limiar", 2, scales=True)]},
        {"id": "lamina-do-veu", "name": "Lâmina do Véu", "description": "Causa +1 de dano por condição sob um alvo."},
        {"id": "veneno-corrosivo", "name": "Veneno Corrosivo", "description": "Cada ataque que acerta o inimigo diminui seu dado de defesa em -2."},
        {"id": "leveza-sobrenatural", "name": "Leveza Sobrenatural", "description": "Diminui a desvantagem a Destreza de armadura em -1."},
        {"id": "elemento-natural", "name": "Elemento Natural", "description": "Sua arma ganha uma runa elemental equivalente à Qualidade."},
        {"id": "gargalhada", "name": "Gargalhada", "description": "Acertar um ataque de Margem +4 faz com que seu inimigo caia na risada por 1 turno ao falhar num SAVE DC de Carisma + Vontade."},
        {"id": "runa-mortal", "name": "Runa Mortal", "description": "Ao passar em um teste de ataque por 5 ou mais pode ativar uma magia única sua sem usar PA."},
        {"id": "medo", "name": "Medo", "description": "Acertar um ataque por Margem +4 causa a condição de Medo no inimigo ao falhar no SAVE DC."},
        {"id": "absorcao-de-vitalidade", "name": "Absorção de Vitalidade", "description": "Cada vez que acerta um ataque de margem +2 recupera 1 de vida."},
        {"id": "roubo-de-mana", "name": "Roubo de Mana", "description": "Cada ataque ao inimigo resfria 1 de seu Limiar e aumenta +1 para a carga arcana no inimigo."},
        {"id": "aura-de-sombra", "name": "Aura de Sombra", "description": "Caso não esteja sendo visto, ativa a runa de Ocultar Nível 5. Usos diários equivalentes à qualidade do Item."},
        {"id": "luz-purificadora", "name": "Luz Purificadora", "description": "Adiciona sua Vontade para um teste de resistência."},
        {"id": "eco-de-outrora", "name": "Eco de Outrora", "description": "Seu equipamento se lembra de combates e situações passadas, recebendo um bônus de +1 equivalente ao que foi lembrado, como a força de um inimigo, velocidade de um animal etc."},
    ],
    "items": out_items,
}
json.dump(data, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print("itens:", len(out_items), "| ignorados (sem preço):", len(skipped))
for s in skipped: print("  IGNORADO:", s[:100])
from collections import Counter
print(Counter(i["category"] for i in out_items))
