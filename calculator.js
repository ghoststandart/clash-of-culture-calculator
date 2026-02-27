// Кубик d12: 12 граней, числа 1-6 (каждое по 2 раза)
// Каждая грань имеет число + картинку (бонус)
// Грань: [число, картинка]
const DICE_FACES = [
    [1, 'hero'],      // грань 1
    [1, 'hero'],      // грань 2
    [2, 'elephant'],   // грань 3
    [2, 'horse'],      // грань 4
    [3, 'elephant'],   // грань 5
    [3, 'warrior'],    // грань 6
    [4, 'horse'],      // грань 7
    [4, 'elephant'],   // грань 8
    [5, 'warrior'],    // грань 9
    [5, 'horse'],      // грань 10
    [6, 'warrior'],    // грань 11
    [6, 'warrior'],    // грань 12
];

// Сила юнитов (для определения кто погибает первым)
const UNIT_POWER = {
    ship: 0,
    warrior: 1,
    horse: 2,
    elephant: 3,
    hero: 4,
};

function rollDice() {
    return DICE_FACES[Math.floor(Math.random() * 12)];
}

// Подсчёт юнитов определённого типа в массиве
function countType(arr, type) {
    let c = 0;
    for (const u of arr) if (u === type) c++;
    return c;
}

// Один раунд с бонусами
function playRound(groupA, groupB, roundNum, bonusA, bonusB) {
    const isFirst = roundNum === 1;
    const extraDiceA = isFirst ? bonusA.extraDice : 0;
    const extraDiceB = isFirst ? bonusB.extraDice : 0;

    const sumA = resolveGroupRoll(groupA, extraDiceA);
    const sumB = resolveGroupRoll(groupB, extraDiceB);

    // Доп. урон
    if (isFirst) {
        sumA.damage += bonusA.extraDmgFirst;
        sumB.damage += bonusB.extraDmgFirst;
    }
    sumA.damage += bonusA.extraDmgEvery;
    sumB.damage += bonusB.extraDmgEvery;

    // Слоны дают щит: -5 урона противнику за каждый активированный слон
    let killsFromA = Math.max(0, Math.floor(sumA.damage / 5) - sumB.shields);
    let killsFromB = Math.max(0, Math.floor(sumB.damage / 5) - sumA.shields);

    // Скип урона в первом раунде
    if (isFirst) {
        killsFromA = Math.max(0, killsFromA - bonusB.skipDmg);
        killsFromB = Math.max(0, killsFromB - bonusA.skipDmg);
    }

    const newA = removeWeakest(groupA, killsFromB);
    const newB = removeWeakest(groupB, killsFromA);

    return { groupA: newA, groupB: newB };
}

// Бросок кубиков для группы с применением бонусов
function resolveGroupRoll(group, extraDice) {
    if (group.length === 0) return { damage: 0, shields: 0 };

    // Каждый юнит бросает кубик + доп. кубики
    let rolls = [];
    const totalDice = group.length + (extraDice || 0);
    for (let i = 0; i < totalDice; i++) {
        rolls.push(rollDice());
    }

    // Считаем выпавшие картинки
    const iconCounts = { hero: 0, warrior: 0, horse: 0, elephant: 0 };
    for (const [num, icon] of rolls) {
        iconCounts[icon]++;
    }

    // Считаем юнитов каждого типа в группе
    const unitCounts = { ship: 0, hero: 0, warrior: 0, horse: 0, elephant: 0 };
    for (const u of group) {
        unitCounts[u]++;
    }

    // Активированные бонусы = min(выпавших картинок, юнитов этого типа)
    const activated = {};
    for (const type of ['hero', 'warrior', 'horse', 'elephant']) {
        activated[type] = Math.min(iconCounts[type], unitCounts[type]);
    }

    // 1. Герой: перебросить один кубик (выбираем кубик с наименьшим числом)
    // Если на перебросе снова выпал герой (число 1) — перебрасываем ещё раз
    for (let h = 0; h < activated.hero; h++) {
        let minIdx = -1;
        let minVal = Infinity;
        for (let i = 0; i < rolls.length; i++) {
            if (rolls[i][0] < minVal) {
                minVal = rolls[i][0];
                minIdx = i;
            }
        }
        if (minIdx !== -1) {
            let newRoll = rollDice();
            while (newRoll[1] === 'hero') {
                newRoll = rollDice();
            }
            rolls[minIdx] = newRoll;
        }
    }

    // После переброса пересчитываем иконки (для слона и остальных)
    // Но бонусы уже активированы по первому броску — переброс не меняет активацию
    // (иначе было бы рекурсивно). Считаем только числовой урон.

    // 2. Слон: обнуляет число на кубике, но даёт щит (-5 урона от противника)
    // Применяем к кубикам где выпал слон (до activated.elephant штук)
    let elephantsApplied = 0;
    let shields = 0;
    for (let i = 0; i < rolls.length && elephantsApplied < activated.elephant; i++) {
        if (rolls[i][1] === 'elephant') {
            rolls[i] = [0, 'elephant']; // обнуляем число
            shields++;
            elephantsApplied++;
        }
    }

    // 3. Считаем базовую сумму
    let damage = 0;
    for (const [num] of rolls) {
        damage += num;
    }

    // 4. Воин: +1 за каждый активированный
    damage += activated.warrior * 1;

    // 5. Конь: +2 за каждый активированный
    damage += activated.horse * 2;

    return { damage, shields };
}

// Удаляет count самых слабых юнитов из группы
function removeWeakest(group, count) {
    if (count <= 0 || group.length === 0) return [...group];
    if (count >= group.length) return [];

    const sorted = [...group].sort((a, b) => UNIT_POWER[a] - UNIT_POWER[b]);
    sorted.splice(0, count);
    return sorted;
}

const UNIT_NAMES = {
    ship: 'Корабль',
    warrior: 'Воин',
    horse: 'Конь',
    elephant: 'Слон',
    hero: 'Герой',
};

// Превращает массив юнитов в отсортированный строковый ключ
function unitsToKey(units) {
    if (units.length === 0) return '';
    return [...units].sort((a, b) => UNIT_POWER[a] - UNIT_POWER[b]).join(',');
}

// Превращает ключ обратно в читаемую строку
function keyToLabel(key) {
    if (!key) return '';
    return key.split(',').map(u => UNIT_NAMES[u]).join(', ');
}

// Симуляция одного боя до победы
function simulateBattle(groupA, groupB, bonusA, bonusB) {
    let a = [...groupA];
    let b = [...groupB];
    let maxRounds = 1000;
    let roundNum = 0;

    while (a.length > 0 && b.length > 0 && maxRounds-- > 0) {
        roundNum++;
        const result = playRound(a, b, roundNum, bonusA, bonusB);
        a = result.groupA;
        b = result.groupB;
    }

    let winner;
    if (a.length > 0 && b.length === 0) winner = 'a';
    else if (b.length > 0 && a.length === 0) winner = 'b';
    else winner = 'draw';

    return { winner, unitsA: a, unitsB: b };
}

function readBonus(prefix) {
    return {
        extraDmgFirst: parseInt(document.getElementById(prefix + '-extra-dmg-first').value) || 0,
        extraDmgEvery: parseInt(document.getElementById(prefix + '-extra-dmg-every').value) || 0,
        extraDice: parseInt(document.getElementById(prefix + '-extra-dice').value) || 0,
        skipDmg: parseInt(document.getElementById(prefix + '-skip-dmg').value) || 0,
    };
}

// Считываем юнитов из селектов
function getGroups() {
    const columns = document.querySelectorAll('.column');
    const groupA = [];
    const groupB = [];

    columns[0].querySelectorAll('select').forEach(sel => {
        if (sel.value) groupA.push(sel.value);
    });
    columns[1].querySelectorAll('select').forEach(sel => {
        if (sel.value) groupB.push(sel.value);
    });

    const bonusA = readBonus('a');
    const bonusB = readBonus('b');

    return { groupA, groupB, bonusA, bonusB };
}

const SIMULATIONS = 100000;

document.getElementById('calc-btn').addEventListener('click', () => {
    const { groupA, groupB, bonusA, bonusB } = getGroups();
    const resultDiv = document.getElementById('result');

    if (groupA.length === 0 && groupB.length === 0) {
        resultDiv.style.display = 'block';
        resultDiv.innerHTML = 'Выберите хотя бы одного юнита в любой группе';
        return;
    }

    if (groupA.length === 0) {
        resultDiv.style.display = 'block';
        resultDiv.innerHTML = 'Группа A пуста — <span class="win-b">Группа B побеждает 100%</span>';
        return;
    }

    if (groupB.length === 0) {
        resultDiv.style.display = 'block';
        resultDiv.innerHTML = 'Группа B пуста — <span class="win-a">Группа A побеждает 100%</span>';
        return;
    }

    let winsA = 0;
    let winsB = 0;
    let draws = 0;

    // Собираем статистику: ключ "keyA|keyB" → count
    const outcomes = {};

    for (let i = 0; i < SIMULATIONS; i++) {
        const result = simulateBattle(groupA, groupB, bonusA, bonusB);
        if (result.winner === 'a') winsA++;
        else if (result.winner === 'b') winsB++;
        else draws++;

        const key = unitsToKey(result.unitsA) + '|' + unitsToKey(result.unitsB);
        outcomes[key] = (outcomes[key] || 0) + 1;
    }

    const pctA = (winsA / SIMULATIONS * 100).toFixed(1);
    const pctB = (winsB / SIMULATIONS * 100).toFixed(1);
    const pctD = (draws / SIMULATIONS * 100).toFixed(1);

    // Сортируем исходы по частоте (от большего к меньшему)
    const sortedOutcomes = Object.entries(outcomes)
        .map(([key, count]) => {
            const [kA, kB] = key.split('|');
            return { keyA: kA, keyB: kB, count };
        })
        .sort((a, b) => b.count - a.count);

    // Формируем таблицу исходов
    let outcomeRows = '';
    for (const o of sortedOutcomes) {
        const pct = (o.count / SIMULATIONS * 100).toFixed(1);
        let label;
        if (!o.keyA && !o.keyB) {
            label = 'Ничья';
        } else if (!o.keyB) {
            label = `<span class="win-a">A: ${keyToLabel(o.keyA)}</span>`;
        } else {
            label = `<span class="win-b">B: ${keyToLabel(o.keyB)}</span>`;
        }
        outcomeRows += `<tr><td>${label}</td><td>${pct}%</td></tr>`;
    }

    resultDiv.style.display = 'block';
    resultDiv.innerHTML =
        `<span class="win-a">Группа A: ${pctA}%</span><br>` +
        `<span class="win-b">Группа B: ${pctB}%</span><br>` +
        `Ничья: ${pctD}%<br>` +
        `<span style="font-size:12px;color:#999;">(${SIMULATIONS.toLocaleString()} симуляций)</span>` +
        `<details style="margin-top:12px;">` +
        `<summary style="cursor:pointer;font-weight:bold;font-size:14px;">Подробные исходы</summary>` +
        `<table class="outcomes-table">` +
        `<tr><th>Исход</th><th>Шанс</th></tr>` +
        outcomeRows +
        `</table>` +
        `</details>`;
});
