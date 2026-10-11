/*
 * 畫面互動：組手牌、設定和牌狀況，並即時呼叫計算引擎顯示結果。
 */

const 花色名稱表 = ['萬', '筒', '索'];
const 字牌顯示表 = { 27: '東', 28: '南', 29: '西', 30: '北', 31: '白', 32: '發', 33: '中' };

/* 右邊三個框就是加入目標：點哪一框，接下來點的牌就加到那裡 */
const 加入目標說明表 = {
  手牌: '目前要加到手牌。和牌的那一張請放在和牌張框，這裡放其餘的牌。',
  吃: '目前要吃。點順子裡最小的那張牌，例如點三筒就是吃成三四五筒。',
  碰: '目前要碰。點要碰的那張牌，組成明刻。',
  明槓: '目前要明槓。大明槓與加槓都算明槓。',
  暗槓: '目前要暗槓。暗槓不破壞門前，立直後仍可保有門前役。',
  寶牌: '目前要加到寶牌。直接點寶牌本身，有幾張就點幾張，每張各算一番。',
  和牌張: '目前要指定和牌張。和牌的那一張單獨放在和牌張框，只能放一張。'
};

const 副露種類清單 = ['吃', '碰', '明槓', '暗槓'];

/*
 * 寶牌張數上限十張：嶺上牌只有四張，一局最多槓四次，
 * 所以表寶牌指示牌最多是原本那張加上四張槓寶牌共五張，裏寶牌同樣五張。
 * 這個欄位表裏一起填，上限就是兩者相加。
 */
const 寶牌張數上限 = 10;

/*
 * 同一種牌最多被指四次：要讓五筒當寶牌，指示牌得是四筒，而四筒總共只有四張，
 * 表層與裏層的指示牌都是從這四張裡出的。
 */
const 同種寶牌次數上限 = 4;


const 和牌狀況定義清單 = [
  { 代號: '是立直', 顯示名稱: '立直', 需要門前: true },
  { 代號: '是雙立直', 顯示名稱: '雙立直', 需要門前: true },
  { 代號: '是一發', 顯示名稱: '一發', 需要門前: true, 需要立直: true },
  { 代號: '是嶺上開花', 顯示名稱: '嶺上開花', 僅限自摸: true },
  { 代號: '是搶槓', 顯示名稱: '搶槓', 僅限榮和: true },
  { 代號: '是海底摸月', 顯示名稱: '海底摸月', 僅限自摸: true },
  { 代號: '是河底撈魚', 顯示名稱: '河底撈魚', 僅限榮和: true },
  { 代號: '是天和', 顯示名稱: '天和', 補充說明: '莊家配牌後第一次自摸就和牌', 僅限自摸: true, 需要莊家: true, 需要門前: true },
  { 代號: '是地和', 顯示名稱: '地和', 補充說明: '子家第一巡自摸和牌，期間沒有任何人副露', 僅限自摸: true, 需要子家: true, 需要門前: true }
];

const 畫面狀態 = {
  手牌: [],
  和牌張: null,
  副露清單: [],
  場風牌: 27,
  自風牌: 28,
  連莊數: 0,
  是自摸: false,
  寶牌清單: [],
  加入目標: '手牌',
  副露種類: '吃',
  和牌狀況: {}
};
和牌狀況定義清單.forEach((定義) => { 畫面狀態.和牌狀況[定義.代號] = false; });

/* ------------------------------------------------------------------ */
/* 牌面元素                                                            */
/* ------------------------------------------------------------------ */

function 建立牌元素(牌編號, 是赤寶牌, 選項 = {}) {
  const 牌元素 = document.createElement('button');
  牌元素.type = 'button';
  牌元素.className = '麻將牌';
  if (選項.尺寸小) 牌元素.classList.add('小');
  if (是赤寶牌) 牌元素.classList.add('赤寶牌');

  if (計算引擎.是字牌(牌編號)) {
    牌元素.classList.add('字牌');
    const 字元素 = document.createElement('span');
    字元素.className = '牌面字';
    字元素.textContent = 字牌顯示表[牌編號];
    牌元素.appendChild(字元素);
  } else {
    const 花色 = 計算引擎.取得花色(牌編號);
    牌元素.classList.add(['萬子', '筒子', '索子'][花色]);
    const 數字元素 = document.createElement('span');
    數字元素.className = '牌面數字';
    數字元素.textContent = 計算引擎.取得牌面數字(牌編號);
    const 花色元素 = document.createElement('span');
    花色元素.className = '牌面花色';
    花色元素.textContent = 花色名稱表[花色];
    牌元素.appendChild(數字元素);
    牌元素.appendChild(花色元素);
  }

  牌元素.title = 計算引擎.牌名稱表[牌編號] + (是赤寶牌 ? '（赤寶牌）' : '');
  return 牌元素;
}

/* ------------------------------------------------------------------ */
/* 牌張數量限制                                                        */
/* ------------------------------------------------------------------ */

/** 統計某張牌目前已經被用掉幾張。寶牌欄填的是「哪種牌算寶牌」，不佔牌山的四張額度 */
function 計算已使用張數(牌編號) {
  let 張數 = 畫面狀態.手牌.filter((牌) => 牌.牌編號 === 牌編號).length;
  if (畫面狀態.和牌張 && 畫面狀態.和牌張.牌編號 === 牌編號) 張數++;
  for (const 副露 of 畫面狀態.副露清單) {
    if (副露.種類 === '吃') {
      if (牌編號 >= 副露.起始牌 && 牌編號 <= 副露.起始牌 + 2) 張數++;
    } else if (副露.種類 === '碰') {
      if (副露.起始牌 === 牌編號) 張數 += 3;
    } else if (副露.起始牌 === 牌編號) {
      張數 += 4;
    }
  }
  return 張數;
}

/** 赤五每種花色只有一張，這裡檢查是否已經用掉 */
function 赤五是否已使用(牌編號) {
  if (畫面狀態.手牌.some((牌) => 牌.牌編號 === 牌編號 && 牌.是赤寶牌)) return true;
  if (畫面狀態.和牌張 && 畫面狀態.和牌張.牌編號 === 牌編號 && 畫面狀態.和牌張.是赤寶牌) return true;
  return 畫面狀態.副露清單.some((副露) => 副露.含赤寶牌 && 副露面子包含此牌(副露, 牌編號));
}

function 副露面子包含此牌(副露, 牌編號) {
  if (副露.種類 === '吃') return 牌編號 >= 副露.起始牌 && 牌編號 <= 副露.起始牌 + 2;
  return 副露.起始牌 === 牌編號;
}

/** 這次點擊需要佔用幾張牌 */
function 取得本次需要張數(牌編號) {
  const 目標 = 畫面狀態.加入目標;
  if (目標 === '碰') return 3;
  if (目標 === '明槓' || 目標 === '暗槓') return 4;
  return 1;
}

function 判斷牌庫按鈕是否可用(牌編號, 是赤五按鈕) {
  const 目標 = 畫面狀態.加入目標;
  const 是副露目標 = 副露種類清單.includes(目標);
  if (是副露目標 && 畫面狀態.副露清單.length >= 4) return false;
  if (目標 === '吃') {
    if (計算引擎.是字牌(牌編號) || 計算引擎.取得牌面數字(牌編號) > 7) return false;
    return [0, 1, 2].every((位移) => 計算已使用張數(牌編號 + 位移) < 4);
  }
  if (計算已使用張數(牌編號) + 取得本次需要張數(牌編號) > 4) return false;
  if (是赤五按鈕 && 赤五是否已使用(牌編號)) return false;
  if (目標 === '手牌' && 畫面狀態.手牌.length >= 取得應有手牌張數()) return false;
  if (目標 === '寶牌') {
    const 同種次數 = 畫面狀態.寶牌清單.filter((寶牌) => 寶牌 === 牌編號).length;
    return 畫面狀態.寶牌清單.length < 寶牌張數上限 && 同種次數 < 同種寶牌次數上限;
  }
  if (目標 === '和牌張') return 畫面狀態.和牌張 === null;
  return true;
}

/* ------------------------------------------------------------------ */
/* 點牌行為                                                            */
/* ------------------------------------------------------------------ */

function 處理牌庫點擊(牌編號, 是赤五按鈕) {
  const 目標 = 畫面狀態.加入目標;
  if (目標 === '手牌') {
    畫面狀態.手牌.push({ 牌編號, 是赤寶牌: 是赤五按鈕 });
    排序手牌();
  } else if (目標 === '和牌張') {
    畫面狀態.和牌張 = { 牌編號, 是赤寶牌: 是赤五按鈕 };
  } else if (目標 === '寶牌') {
    畫面狀態.寶牌清單.push(牌編號);
  } else {
    畫面狀態.副露清單.push({ 種類: 目標, 起始牌: 牌編號, 含赤寶牌: false });
  }
  重新渲染全部();
}

/** 手牌依牌編號排序。和牌的那一張另外放在和牌張格，不在這裡 */
function 排序手牌() {
  畫面狀態.手牌.sort((甲, 乙) => 甲.牌編號 - 乙.牌編號 || (甲.是赤寶牌 ? 1 : 0) - (乙.是赤寶牌 ? 1 : 0));
}

function 移除手牌(索引) {
  畫面狀態.手牌.splice(索引, 1);
  重新渲染全部();
}

/** 手牌格要放幾張：十四張扣掉和牌的那一張，再扣掉每組副露的三張 */
function 取得應有手牌張數() {
  return 13 - 畫面狀態.副露清單.length * 3;
}

/** 已經決定的張數：手牌格、和牌張、副露各三張 */
function 取得已決定張數() {
  return 畫面狀態.手牌.length
    + (畫面狀態.和牌張 ? 1 : 0)
    + 畫面狀態.副露清單.length * 3;
}

/* ------------------------------------------------------------------ */
/* 渲染                                                                */
/* ------------------------------------------------------------------ */

/** 點右邊的寶牌、手牌、副露框就是在選加入目標，這裡只負責把選到的那一框標出來 */
function 渲染區塊選取狀態() {
  const 目前是副露 = 副露種類清單.includes(畫面狀態.加入目標);
  const 對應區塊編號 = {
    寶牌: '寶牌區塊',
    和牌張: '和牌張區塊',
    手牌: '手牌區塊',
    副露: '副露區塊'
  };
  for (const [目標, 區塊編號] of Object.entries(對應區塊編號)) {
    const 區塊 = document.getElementById(區塊編號);
    const 被選中 = 目標 === '副露' ? 目前是副露 : 畫面狀態.加入目標 === 目標;
    區塊.classList.toggle('選取中', 被選中);
  }
  渲染副露種類列();
  渲染目標快捷列();
  document.getElementById('加入目標提示').textContent =
    加入目標說明表[畫面狀態.加入目標] + 取得牌庫停用原因();
}

/**
 * 牌庫標題旁的快捷切換，動作與點右邊那四個框一模一樣。
 * 手機是上下單欄，有這排就不必捲到下面去換目標。
 */
function 渲染目標快捷列() {
  const 容器 = document.getElementById('目標快捷列');
  容器.textContent = '';
  const 目前是副露 = 副露種類清單.includes(畫面狀態.加入目標);

  for (const 目標 of [{ 代號: '寶牌', 名稱: '寶牌' }, { 代號: '和牌張', 名稱: '和牌張' }, { 代號: '手牌', 名稱: '手牌' }]) {
    const 按鈕 = document.createElement('button');
    按鈕.type = 'button';
    按鈕.className = '目標快捷鈕' + (畫面狀態.加入目標 === 目標.代號 ? ' 選取中' : '');
    按鈕.textContent = 目標.名稱;
    按鈕.title = `接下來點的牌加到${目標.名稱}`;
    按鈕.addEventListener('click', () => {
      畫面狀態.加入目標 = 目標.代號;
      重新渲染全部();
    });
    容器.appendChild(按鈕);
  }

  const 副露選單 = document.createElement('select');
  副露選單.className = '目標快捷選單' + (目前是副露 ? ' 選取中' : '');
  副露選單.title = '副露：選吃、碰、明槓或暗槓';
  if (!目前是副露) {
    副露選單.add(new Option('副露', ''));
  }
  for (const 種類 of 副露種類清單) {
    副露選單.add(new Option(種類, 種類));
  }
  副露選單.value = 目前是副露 ? 畫面狀態.加入目標 : '';
  副露選單.addEventListener('change', () => {
    if (副露選單.value === '') return;
    畫面狀態.副露種類 = 副露選單.value;
    畫面狀態.加入目標 = 副露選單.value;
    重新渲染全部();
  });
  容器.appendChild(副露選單);
}

/** 副露框裡再選吃、碰、明槓、暗槓 */
function 渲染副露種類列() {
  const 容器 = document.getElementById('副露種類列');
  容器.textContent = '';
  for (const 種類 of 副露種類清單) {
    const 按鈕 = document.createElement('button');
    按鈕.type = 'button';
    按鈕.className = '副露種類鈕' + (畫面狀態.加入目標 === 種類 ? ' 選取中' : '');
    按鈕.textContent = 種類;
    按鈕.addEventListener('click', (事件) => {
      事件.stopPropagation();
      畫面狀態.副露種類 = 種類;
      畫面狀態.加入目標 = 種類;
      重新渲染全部();
    });
    容器.appendChild(按鈕);
  }
}

/** 三個框各自可以點選成為加入目標，框內的牌與按鈕不觸發切換 */
function 綁定區塊選取() {
  for (const 區塊編號 of ['寶牌區塊', '和牌張區塊', '手牌區塊', '副露區塊']) {
    const 區塊 = document.getElementById(區塊編號);
    區塊.addEventListener('click', (事件) => {
      事件.stopPropagation();
      const 目標 = 區塊.dataset['加入目標'];
      畫面狀態.加入目標 = 目標 === '副露' ? 畫面狀態.副露種類 : 目標;
      重新渲染全部();
    });
  }
}

/** 牌庫整片不能點時，說清楚是為什麼 */
function 取得牌庫停用原因() {
  const 目標 = 畫面狀態.加入目標;
  const 應有手牌張數 = 取得應有手牌張數();
  if (目標 === '手牌' && 畫面狀態.手牌.length >= 應有手牌張數) {
    return `　手牌格已經是 ${應有手牌張數} 張，要換牌請先點手牌右上角的 × 移除。`;
  }
  if (目標 === '和牌張' && 畫面狀態.和牌張 !== null) {
    return '　和牌張只能有一張，要換請先點它右上角的 × 移除。';
  }
  if (副露種類清單.includes(目標) && 畫面狀態.副露清單.length >= 4) {
    return '　副露已經四組，不能再加。';
  }
  if (目標 === '寶牌' && 畫面狀態.寶牌清單.length >= 寶牌張數上限) {
    return `　已經 ${寶牌張數上限} 張，表裏寶牌各自最多五張，加起來就是這個數。`;
  }
  if (目標 === '寶牌') {
    // 這句是常態提醒，不是停用原因：某一種牌填滿四次只會停用那一張，其他牌還能點
    return `　同一種牌最多填 ${同種寶牌次數上限} 次，指到它的那種指示牌總共只有四張。`;
  }
  return '';
}

/** 從十四張倒數還缺幾張。一組副露算三張，所以起點恆為十四 */
function 渲染剩餘張數() {
  const 已決定張數 = 取得已決定張數();
  const 還要張數 = 14 - 已決定張數;
  const 容器 = document.getElementById('剩餘張數顯示');
  容器.textContent = '';
  const 湊齊了 = 還要張數 <= 0;
  容器.className = 湊齊了 ? '剩餘張數 已湊齊' : '剩餘張數';
  容器.title = 湊齊了 ? '十四張已經湊齊' : `還要 ${還要張數} 張`;
  const 張數元素 = document.createElement('span');
  張數元素.className = '張數';
  張數元素.textContent = 湊齊了 ? 0 : 還要張數;
  容器.appendChild(張數元素);
}

function 渲染牌庫() {
  const 容器 = document.getElementById('牌庫區');
  容器.textContent = '';

  const 牌列定義 = [
    { 標籤: '萬子', 起始: 0, 赤五牌編號: 4 },
    { 標籤: '筒子', 起始: 9, 赤五牌編號: 13 },
    { 標籤: '索子', 起始: 18, 赤五牌編號: 22 },
    { 標籤: '字牌', 起始: 27, 張數: 7 }
  ];

  for (const 列定義 of 牌列定義) {
    const 列元素 = document.createElement('div');
    列元素.className = '牌庫花色列';
    const 標籤元素 = document.createElement('span');
    標籤元素.className = '花色標籤';
    標籤元素.textContent = 列定義.標籤;
    列元素.appendChild(標籤元素);

    const 張數 = 列定義.張數 || 9;
    for (let 位移 = 0; 位移 < 張數; 位移++) {
      const 牌編號 = 列定義.起始 + 位移;
      列元素.appendChild(建立牌庫按鈕(牌編號, false));
    }
    if (列定義.赤五牌編號 !== undefined) {
      列元素.appendChild(建立牌庫按鈕(列定義.赤五牌編號, true));
    }
    容器.appendChild(列元素);
  }
}

function 建立牌庫按鈕(牌編號, 是赤五按鈕) {
  const 牌元素 = 建立牌元素(牌編號, 是赤五按鈕);
  const 可用 = 判斷牌庫按鈕是否可用(牌編號, 是赤五按鈕);
  if (!可用) {
    牌元素.classList.add('停用');
    牌元素.disabled = true;
  } else {
    牌元素.addEventListener('click', () => 處理牌庫點擊(牌編號, 是赤五按鈕));
  }
  return 牌元素;
}

function 渲染手牌() {
  const 容器 = document.getElementById('手牌列');
  容器.textContent = '';
  if (畫面狀態.手牌.length === 0) {
    const 提示 = document.createElement('span');
    提示.className = '手牌空白提示';
    提示.textContent = '尚未加入任何手牌。';
    容器.appendChild(提示);
    return;
  }
  畫面狀態.手牌.forEach((牌, 索引) => {
    const 包裝 = document.createElement('span');
    包裝.className = '牌與操作';
    const 牌元素 = 建立牌元素(牌.牌編號, 牌.是赤寶牌);
    牌元素.title = 計算引擎.牌名稱表[牌.牌編號];
    牌元素.disabled = true;
    牌元素.style.cursor = 'default';
    const 移除鈕 = document.createElement('button');
    移除鈕.type = 'button';
    移除鈕.className = '移除鈕';
    移除鈕.textContent = '×';
    移除鈕.title = '把這張牌移除';
    移除鈕.addEventListener('click', (事件) => { 事件.stopPropagation(); 移除手牌(索引); });
    包裝.appendChild(牌元素);
    包裝.appendChild(移除鈕);
    容器.appendChild(包裝);
  });
}

function 渲染副露() {
  const 容器 = document.getElementById('副露列');
  容器.textContent = '';
  if (畫面狀態.副露清單.length === 0) {
    const 提示 = document.createElement('p');
    提示.className = '手牌空白提示';
    提示.style.padding = '0';
    提示.textContent = '沒有副露，目前是門前狀態。';
    容器.appendChild(提示);
    return;
  }
  畫面狀態.副露清單.forEach((副露, 索引) => {
    const 卡片 = document.createElement('div');
    卡片.className = '副露卡片';

    const 標題列 = document.createElement('div');
    標題列.className = '副露標題';
    const 標題文字 = document.createElement('span');
    標題文字.textContent = 副露.種類;
    標題列.appendChild(標題文字);

    if (副露面子可帶赤寶牌(副露)) {
      const 赤切換鈕 = document.createElement('button');
      赤切換鈕.type = 'button';
      赤切換鈕.className = '小型鈕' + (副露.含赤寶牌 ? ' 啟用中' : '');
      赤切換鈕.textContent = '赤五';
      赤切換鈕.title = '這組副露裡的五是赤寶牌';
      赤切換鈕.addEventListener('click', (事件) => {
        事件.stopPropagation();
        副露.含赤寶牌 = !副露.含赤寶牌;
        重新渲染全部();
      });
      標題列.appendChild(赤切換鈕);
    }

    const 移除鈕 = document.createElement('button');
    移除鈕.type = 'button';
    移除鈕.className = '小型鈕';
    移除鈕.textContent = '移除';
    移除鈕.addEventListener('click', (事件) => {
      事件.stopPropagation();
      畫面狀態.副露清單.splice(索引, 1);
      重新渲染全部();
    });
    標題列.appendChild(移除鈕);

    const 牌列 = document.createElement('div');
    牌列.className = '副露牌列';
    let 已標出赤五 = false;
    for (const 牌編號 of 展開副露牌(副露)) {
      const 是赤 = 副露.含赤寶牌 && !已標出赤五
        && !計算引擎.是字牌(牌編號) && 計算引擎.取得牌面數字(牌編號) === 5;
      if (是赤) 已標出赤五 = true;
      const 牌元素 = 建立牌元素(牌編號, 是赤, { 尺寸小: true });
      牌元素.disabled = true;
      牌元素.style.cursor = 'default';
      牌列.appendChild(牌元素);
    }

    卡片.appendChild(標題列);
    卡片.appendChild(牌列);
    容器.appendChild(卡片);
  });
}

function 展開副露牌(副露) {
  if (副露.種類 === '吃') return [副露.起始牌, 副露.起始牌 + 1, 副露.起始牌 + 2];
  if (副露.種類 === '碰') return [副露.起始牌, 副露.起始牌, 副露.起始牌];
  return [副露.起始牌, 副露.起始牌, 副露.起始牌, 副露.起始牌];
}

function 副露面子可帶赤寶牌(副露) {
  return 展開副露牌(副露).some((牌編號) => !計算引擎.是字牌(牌編號) && 計算引擎.取得牌面數字(牌編號) === 5);
}

/** 寶牌右邊那一格，只放和牌的那一張 */
function 渲染和牌張() {
  const 容器 = document.getElementById('和牌張列');
  容器.textContent = '';
  if (畫面狀態.和牌張 === null) {
    const 提示 = document.createElement('span');
    提示.className = '手牌空白提示';
    提示.textContent = '尚未指定和牌張。';
    容器.appendChild(提示);
    return;
  }
  const 包裝 = document.createElement('span');
  包裝.className = '牌與操作';
  const 牌元素 = 建立牌元素(畫面狀態.和牌張.牌編號, 畫面狀態.和牌張.是赤寶牌);
  牌元素.classList.add('和牌張');
  牌元素.title = 計算引擎.牌名稱表[畫面狀態.和牌張.牌編號] + '：和牌的那一張';
  牌元素.disabled = true;
  牌元素.style.cursor = 'default';
  const 移除鈕 = document.createElement('button');
  移除鈕.type = 'button';
  移除鈕.className = '移除鈕';
  移除鈕.textContent = '×';
  移除鈕.addEventListener('click', (事件) => {
    事件.stopPropagation();
    畫面狀態.和牌張 = null;
    重新渲染全部();
  });
  包裝.appendChild(牌元素);
  包裝.appendChild(移除鈕);
  容器.appendChild(包裝);
}

/** 和牌方式用兩顆按鈕切換 */
function 渲染和牌方式鈕組() {
  const 容器 = document.getElementById('和牌方式鈕組');
  容器.textContent = '';
  for (const 方式 of [{ 名稱: '自摸', 是自摸: true }, { 名稱: '榮和', 是自摸: false }]) {
    const 按鈕 = document.createElement('button');
    按鈕.type = 'button';
    按鈕.className = '和牌方式鈕' + (畫面狀態.是自摸 === 方式.是自摸 ? ' 選取中' : '');
    按鈕.textContent = 方式.名稱;
    按鈕.addEventListener('click', () => {
      畫面狀態.是自摸 = 方式.是自摸;
      重新渲染全部();
    });
    容器.appendChild(按鈕);
  }
}

/** 裏寶牌只有門前立直和牌才會翻開，說明文字跟著目前的狀態走 */
function 渲染寶牌說明() {
  const 是門前 = 畫面狀態.副露清單.every((副露) => 副露.種類 === '暗槓');
  const 有立直 = 畫面狀態.和牌狀況.是立直 || 畫面狀態.和牌狀況.是雙立直;
  const 說明元素 = document.getElementById('寶牌說明');
  if (有立直 && 是門前) {
    說明元素.textContent = '已經立直：裏寶牌也會翻開，把翻到的裏寶牌一起填進來，每張各算一番。';
    說明元素.className = '區塊附註 裏寶牌生效';
    return;
  }
  // 沒立直時不另外提示，標題旁已經寫明有立直才填裏寶牌
  說明元素.textContent = '';
  說明元素.className = '區塊附註';
}

function 渲染寶牌() {
  const 寶牌清單 = 畫面狀態.寶牌清單;
  const 容器 = document.getElementById('寶牌列');
  容器.textContent = '';
  if (寶牌清單.length === 0) {
    const 提示 = document.createElement('span');
    提示.className = '手牌空白提示';
    提示.textContent = '沒有寶牌。';
    容器.appendChild(提示);
    return;
  }
  寶牌清單.forEach((牌編號, 索引) => {
    const 包裝 = document.createElement('span');
    包裝.className = '牌與操作';
    const 牌元素 = 建立牌元素(牌編號, false, { 尺寸小: true });
    const 重複次數 = 寶牌清單.filter((牌) => 牌 === 牌編號).length;
    牌元素.title = 重複次數 > 1
      ? `寶牌 ${計算引擎.牌名稱表[牌編號]}，填了 ${重複次數} 次，手牌裡每張算 ${重複次數} 番（最多 ${同種寶牌次數上限} 次）`
      : `寶牌 ${計算引擎.牌名稱表[牌編號]}，手牌裡每張算 1 番`;
    牌元素.disabled = true;
    牌元素.style.cursor = 'default';
    const 移除鈕 = document.createElement('button');
    移除鈕.type = 'button';
    移除鈕.className = '移除鈕';
    移除鈕.textContent = '×';
    移除鈕.addEventListener('click', (事件) => {
      事件.stopPropagation();
      寶牌清單.splice(索引, 1);
      重新渲染全部();
    });
    包裝.appendChild(牌元素);
    包裝.appendChild(移除鈕);
    容器.appendChild(包裝);
  });
}

function 渲染和牌狀況() {
  const 容器 = document.getElementById('和牌狀況格');
  容器.textContent = '';
  const 是門前 = 畫面狀態.副露清單.every((副露) => 副露.種類 === '暗槓');
  const 是莊家 = 畫面狀態.自風牌 === 計算引擎.東風編號;

  for (const 定義 of 和牌狀況定義清單) {
    let 可用 = true;
    if (定義.需要門前 && !是門前) 可用 = false;
    if (定義.僅限自摸 && !畫面狀態.是自摸) 可用 = false;
    if (定義.僅限榮和 && 畫面狀態.是自摸) 可用 = false;
    if (定義.需要莊家 && !是莊家) 可用 = false;
    if (定義.需要子家 && 是莊家) 可用 = false;
    if (定義.需要立直 && !(畫面狀態.和牌狀況.是立直 || 畫面狀態.和牌狀況.是雙立直)) 可用 = false;
    if (!可用) 畫面狀態.和牌狀況[定義.代號] = false;

    const 標籤 = document.createElement('label');
    標籤.className = '勾選項' + (可用 ? '' : ' 不可用');
    const 勾選框 = document.createElement('input');
    勾選框.type = 'checkbox';
    勾選框.checked = 畫面狀態.和牌狀況[定義.代號];
    勾選框.disabled = !可用;
    勾選框.addEventListener('change', () => {
      畫面狀態.和牌狀況[定義.代號] = 勾選框.checked;
      // 立直與雙立直互斥
      if (勾選框.checked && 定義.代號 === '是立直') 畫面狀態.和牌狀況.是雙立直 = false;
      if (勾選框.checked && 定義.代號 === '是雙立直') 畫面狀態.和牌狀況.是立直 = false;
      重新渲染全部();
    });
    if (定義.補充說明) 標籤.title = 定義.補充說明;
    標籤.appendChild(勾選框);
    標籤.appendChild(document.createTextNode(定義.顯示名稱));
    容器.appendChild(標籤);
  }
}

/* ------------------------------------------------------------------ */
/* 結果                                                                */
/* ------------------------------------------------------------------ */

function 組出計算用的和牌條件() {
  const 赤寶牌張數 = 畫面狀態.手牌.filter((牌) => 牌.是赤寶牌).length
    + (畫面狀態.和牌張 && 畫面狀態.和牌張.是赤寶牌 ? 1 : 0)
    + 畫面狀態.副露清單.filter((副露) => 副露.含赤寶牌).length;
  return {
    手牌: 畫面狀態.手牌.map((牌) => 牌.牌編號).concat(畫面狀態.和牌張 ? [畫面狀態.和牌張.牌編號] : []),
    副露清單: 畫面狀態.副露清單.map((副露) => ({ 種類: 副露.種類, 起始牌: 副露.起始牌 })),
    和牌張: 畫面狀態.和牌張 ? 畫面狀態.和牌張.牌編號 : -1,
    是自摸: 畫面狀態.是自摸,
    場風牌: 畫面狀態.場風牌,
    自風牌: 畫面狀態.自風牌,
    連莊數: 畫面狀態.連莊數,
    寶牌清單: 畫面狀態.寶牌清單.slice(),
    赤寶牌張數,
    是立直: 畫面狀態.和牌狀況.是立直,
    是一發: 畫面狀態.和牌狀況.是一發,
    是雙立直: 畫面狀態.和牌狀況.是雙立直,
    是海底摸月: 畫面狀態.和牌狀況.是海底摸月,
    是河底撈魚: 畫面狀態.和牌狀況.是河底撈魚,
    是嶺上開花: 畫面狀態.和牌狀況.是嶺上開花,
    是搶槓: 畫面狀態.和牌狀況.是搶槓,
    是天和: 畫面狀態.和牌狀況.是天和,
    是地和: 畫面狀態.和牌狀況.是地和
  };
}

/** 牌沒湊滿就不能算，按鈕上直接說還差幾張 */
function 渲染計算鈕() {
  const 計算鈕 = document.getElementById('計算鈕');
  const 還要張數 = 14 - 取得已決定張數();
  if (畫面狀態.和牌張 === null) {
    計算鈕.disabled = true;
    計算鈕.textContent = 還要張數 > 1 ? `還要 ${還要張數} 張，含和牌張` : '還要指定和牌張';
    return;
  }
  if (還要張數 > 0) {
    計算鈕.disabled = true;
    計算鈕.textContent = `還要 ${還要張數} 張才能計算`;
    return;
  }
  計算鈕.disabled = false;
  計算鈕.textContent = '確定計算';
}

/** 按下確定才計算，結果用彈出視窗顯示 */
function 計算並顯示結果() {
  渲染結果內容();
  const 視窗 = document.getElementById('結果視窗');
  視窗.showModal();
  document.getElementById('結果內容').focus();
}

function 渲染結果內容() {
  const 容器 = document.getElementById('結果內容');
  容器.textContent = '';

  const 結果 = 計算引擎.計算和牌結果(組出計算用的和牌條件());
  if (!結果.成功) {
    容器.appendChild(建立不能和牌方塊(結果));
    return;
  }

  const 是役滿 = 結果.役滿清單.length > 0;

  const 標頭 = document.createElement('div');
  標頭.className = '結果標頭';
  const 級別元素 = document.createElement('p');
  級別元素.className = '級別';
  級別元素.textContent = 結果.點數結果.級別名稱 || `${結果.總番數} 番`;
  標頭.appendChild(級別元素);
  const 番符元素 = document.createElement('p');
  番符元素.className = '番符';
  番符元素.textContent = 是役滿
    ? `${結果.是莊家 ? '莊家' : '子家'}　${結果.是自摸 ? '自摸' : '榮和'}`
    : `${結果.總番數} 番 ${結果.符數} 符　${結果.是莊家 ? '莊家' : '子家'}　${結果.是自摸 ? '自摸' : '榮和'}`;
  標頭.appendChild(番符元素);
  容器.appendChild(標頭);

  const 本體 = document.createElement('div');
  本體.className = '結果本體';

  const 點數元素 = document.createElement('p');
  點數元素.className = '點數文字';
  點數元素.textContent = `${結果.點數結果.總點數.toLocaleString('zh-TW')} 點`;
  本體.appendChild(點數元素);

  const 收支元素 = document.createElement('p');
  收支元素.className = '收支說明';
  收支元素.textContent = 結果.點數結果.收支說明;
  本體.appendChild(收支元素);

  if (結果.點數結果.本場數 > 0) {
    const 本場元素 = document.createElement('p');
    本場元素.className = '本場說明';
    const 和牌點 = 結果.點數結果.和牌點數.toLocaleString('zh-TW');
    const 加成 = 結果.點數結果.本場加成.toLocaleString('zh-TW');
    本場元素.textContent = 結果.是自摸
      ? `和牌 ${和牌點} 點 ＋ ${結果.點數結果.本場數} 本場（每家各多付 ${結果.點數結果.本場數 * 100} 點）共 ${加成} 點`
      : `和牌 ${和牌點} 點 ＋ ${結果.點數結果.本場數} 本場 ${加成} 點`;
    本體.appendChild(本場元素);
  }

  const 役清單元素 = document.createElement('ul');
  役清單元素.className = '役清單';
  for (const 役滿 of 結果.役滿清單) {
    役清單元素.appendChild(建立役項目(役滿.名稱, '役滿', true));
  }
  for (const 役 of 結果.普通役清單) {
    役清單元素.appendChild(建立役項目(役.名稱, `${役.番數} 番`, false));
  }
  if (!是役滿) {
    const 寶牌 = 結果.寶牌結果;
    if (寶牌.寶牌數 > 0) 役清單元素.appendChild(建立役項目('寶牌', `${寶牌.寶牌數} 番`, false));
    if (寶牌.赤寶牌數 > 0) 役清單元素.appendChild(建立役項目('赤寶牌', `${寶牌.赤寶牌數} 番`, false));
  }
  本體.appendChild(役清單元素);

  if (!是役滿) {
    本體.appendChild(建立小標('符數明細'));
    const 符明細元素 = document.createElement('ul');
    符明細元素.className = '明細清單';
    for (const 明細 of 結果.符數明細) {
      符明細元素.appendChild(建立明細項目(明細.項目, `${明細.符} 符`));
    }
    符明細元素.appendChild(建立明細項目('合計', `${結果.符數} 符`));
    本體.appendChild(符明細元素);
  }

  本體.appendChild(建立小標('牌型拆解'));
  const 拆解元素 = document.createElement('ul');
  拆解元素.className = '明細清單';
  for (const 描述 of 結果.面子描述清單) {
    拆解元素.appendChild(建立明細項目(描述, ''));
  }
  拆解元素.appendChild(建立明細項目('聽牌形', 結果.待牌形));
  本體.appendChild(拆解元素);

  容器.appendChild(本體);
}

/** 不能和牌時的畫面：錯誤原因，加上已經倒牌就得付的詐和罰符 */
function 建立不能和牌方塊(結果) {
  const 方塊 = document.createElement('div');
  方塊.className = '錯誤訊息';

  const 原因 = document.createElement('p');
  原因.className = '錯誤原因';
  原因.textContent = 結果.錯誤訊息;
  方塊.appendChild(原因);

  if (!結果.是詐和) return 方塊;

  const 罰符區 = document.createElement('div');
  罰符區.className = '詐和罰符';

  const 標題 = document.createElement('p');
  標題.className = '罰符標題';
  標題.textContent = '手牌已經倒下的話，這就是詐和，要付滿貫罰符';
  罰符區.appendChild(標題);

  const 點數 = document.createElement('p');
  點數.className = '罰符點數';
  點數.textContent = `賠出 ${結果.詐和罰符.總點數.toLocaleString('zh-TW')} 點`;
  罰符區.appendChild(點數);

  const 收支 = document.createElement('p');
  收支.className = '罰符收支';
  收支.textContent = 結果.詐和罰符.收支說明;
  罰符區.appendChild(收支);

  const 附註 = document.createElement('p');
  附註.className = '罰符附註';
  附註.textContent = '牌還沒倒就發現的話，一般只判和牌放棄：該局不能再和也不能再鳴，但繼續打完。';
  罰符區.appendChild(附註);

  方塊.appendChild(罰符區);
  return 方塊;
}

function 建立役項目(名稱, 數值文字, 是役滿項) {
  const 項目 = document.createElement('li');
  if (是役滿項) 項目.className = '役滿項';
  const 名稱元素 = document.createElement('span');
  名稱元素.textContent = 名稱;
  const 數值元素 = document.createElement('span');
  數值元素.className = '番值';
  數值元素.textContent = 數值文字;
  項目.appendChild(名稱元素);
  項目.appendChild(數值元素);
  return 項目;
}

function 建立明細項目(左側文字, 右側文字) {
  const 項目 = document.createElement('li');
  const 左 = document.createElement('span');
  左.textContent = 左側文字;
  const 右 = document.createElement('span');
  右.textContent = 右側文字;
  項目.appendChild(左);
  項目.appendChild(右);
  return 項目;
}

function 建立小標(文字) {
  const 小標 = document.createElement('p');
  小標.className = '小標';
  小標.textContent = 文字;
  return 小標;
}

/* ------------------------------------------------------------------ */
/* 初始化                                                              */
/* ------------------------------------------------------------------ */

function 重新渲染全部() {
  渲染區塊選取狀態();
  渲染剩餘張數();
  渲染牌庫();
  渲染手牌();
  渲染副露();
  渲染和牌方式鈕組();
  渲染寶牌();
  渲染和牌張();
  渲染寶牌說明();
  渲染和牌狀況();
  渲染計算鈕();
}

function 全部重設() {
  畫面狀態.場風牌 = 計算引擎.東風編號;
  畫面狀態.自風牌 = 計算引擎.南風編號;
  畫面狀態.是自摸 = false;
  畫面狀態.連莊數 = 0;
  document.getElementById('連莊數選單').value = '0';
  document.getElementById('場風選單').value = String(計算引擎.東風編號);
  document.getElementById('自風選單').value = String(計算引擎.南風編號);
  畫面狀態.手牌 = [];
  畫面狀態.和牌張 = null;
  畫面狀態.副露清單 = [];
  畫面狀態.寶牌清單 = [];
  畫面狀態.加入目標 = '手牌';
  畫面狀態.副露種類 = '吃';
  和牌狀況定義清單.forEach((定義) => { 畫面狀態.和牌狀況[定義.代號] = false; });
}

/** 確定按鈕開啟結果視窗；點視窗外側或按 Esc 都會關閉 */
function 綁定結果視窗() {
  const 視窗 = document.getElementById('結果視窗');
  document.getElementById('計算鈕').addEventListener('click', 計算並顯示結果);
  document.getElementById('關閉結果鈕').addEventListener('click', () => 視窗.close());
  視窗.addEventListener('click', (事件) => {
    if (事件.target === 視窗) 視窗.close();
  });
}

/** 標題旁的問號圈鈕開關規則說明視窗；點視窗外側或按 Esc 都會關閉 */
function 綁定規則說明視窗() {
  const 視窗 = document.getElementById('規則說明視窗');
  document.getElementById('開啟規則說明鈕').addEventListener('click', () => {
    視窗.showModal();
    // 預設焦點會停在關閉鈕上，在深色標頭留下一圈白框，改成把焦點放在內容區
    document.getElementById('規則說明內容').focus();
  });
  document.getElementById('關閉規則說明鈕').addEventListener('click', () => 視窗.close());
  視窗.addEventListener('click', (事件) => {
    // 點到視窗本身（也就是遮罩範圍）才關閉，點內容不關
    if (事件.target === 視窗) 視窗.close();
  });
}

const 目前模式儲存鍵 = '日麻計算.目前模式';

/** 讀出上次所在的模式；私密瀏覽或封鎖網站資料時讀不到，一律回到計算模式 */
function 讀取上次模式() {
  try {
    return localStorage.getItem(目前模式儲存鍵) === '位置' ? '位置' : '計算';
  } catch {
    return '計算';
  }
}

function 記住目前模式(模式) {
  try {
    localStorage.setItem(目前模式儲存鍵, 模式);
  } catch {
    // 存不了就只影響重整後回到哪個模式，不影響操作
  }
}

/** 標題旁的模式切換鈕：在計算與位置兩個畫面之間切換，按鈕文字顯示要切過去的模式；重整後回到上次所在的模式 */
function 綁定模式切換() {
  const 切換鈕 = document.getElementById('模式切換鈕');
  const 計算模式畫面 = document.getElementById('計算模式畫面');
  const 位置模式畫面 = document.getElementById('位置模式畫面');
  const 全部重設鈕 = document.getElementById('全部重設鈕');
  const 整體容器 = document.getElementById('整體容器');
  const 局數重置鈕 = document.getElementById('局數重置鈕');

  function 顯示模式(模式) {
    const 是位置模式 = 模式 === '位置';
    位置模式畫面.hidden = !是位置模式;
    計算模式畫面.hidden = 是位置模式;
    // 全部重設只作用在計算畫面，位置畫面下隱藏避免誤清
    全部重設鈕.hidden = 是位置模式;
    局數重置鈕.hidden = !是位置模式;
    整體容器.classList.toggle('位置模式中', 是位置模式);
    切換鈕.textContent = 是位置模式 ? '切換到計算' : '切換到位置';
  }

  切換鈕.addEventListener('click', () => {
    const 新模式 = 位置模式畫面.hidden ? '位置' : '計算';
    顯示模式(新模式);
    記住目前模式(新模式);
  });

  顯示模式(讀取上次模式());
}

/* ---------- 位置模式：場風、局數與換莊 ---------- */
const 風位字清單 = ['東', '南', '西', '北'];
// 逆時針順序，與出牌順序一致
const 座位清單 = ['下', '右', '上', '左'];
const 桌面局況儲存鍵 = '日麻計算.桌面局況';
// 東一局到北四局共十六局，北四局之後回到東一局
const 總局數 = 16;

/** 東一局、莊家沒有連莊 */
function 建立初始局況() {
  return { 局序: 0, 連莊數: 0, 換莊前連莊數紀錄: [] };
}

const 是非負整數 = (值) => Number.isInteger(值) && 值 >= 0;

/** 讀出上次的局況：局序（0 是東一局、15 是北四局）、目前連莊數、每次換莊前的連莊數（倒退時還原用）；
    讀不到或內容不合法時回到東一局 */
function 讀取上次局況() {
  try {
    const 值 = JSON.parse(localStorage.getItem(桌面局況儲存鍵));
    if (是非負整數(值?.局序) && 值.局序 < 總局數 && 是非負整數(值.連莊數)
        && Array.isArray(值.換莊前連莊數紀錄) && 值.換莊前連莊數紀錄.every(是非負整數)) {
      return 值;
    }
  } catch {
    // 讀不到就用初始局況
  }
  return 建立初始局況();
}

function 記住局況(局況) {
  try {
    localStorage.setItem(桌面局況儲存鍵, JSON.stringify(局況));
  } catch {
    // 存不了只影響重整後回到哪一局
  }
}

/** 莊家坐在某個座位時，中央區要逆時針轉的角度（下方 0 度、右邊 -90 度，依此類推） */
function 中央區朝向莊家角度(莊家座位序) {
  return 莊家座位序 * -90;
}

/** 依局況畫出場風字、局數紅點、四邊自風字、莊家紅框與連莊數，中央區轉向莊家；莊家座位從下方開始，每換一次莊逆時針移一格 */
function 渲染桌面局況(局況) {
  const 莊家座位序 = 局況.局序 % 4;
  document.getElementById('場風字').textContent = 風位字清單[Math.floor(局況.局序 / 4)];
  const 局數點點 = document.getElementById('局數點點');
  局數點點.replaceChildren(...Array.from({ length: 莊家座位序 + 1 }, () => {
    const 點 = document.createElement('span');
    點.className = '局數點';
    return 點;
  }));
  局數點點.setAttribute('aria-label', `第${莊家座位序 + 1}局`);
  document.getElementById('桌面中央').style.transform = `rotate(${中央區朝向莊家角度(莊家座位序)}deg)`;
  座位清單.forEach((座位, 座位序) => {
    const 自風字 = 風位字清單[(座位序 - 莊家座位序 + 4) % 4];
    document.querySelector(`.自風位[data-座位="${座位}"] .自風字`).textContent = 自風字;
    document.querySelector(`.桌邊長方形[data-座位="${座位}"]`).classList.toggle('莊家', 座位序 === 莊家座位序);
  });
  const 連莊數字 = document.getElementById('連莊數字');
  連莊數字.textContent = String(局況.連莊數);
  // 沒有連莊時不顯示
  連莊數字.hidden = 局況.連莊數 === 0;
  document.querySelector(`.自風位[data-座位="${座位清單[莊家座位序]}"]`)
    .append(連莊數字, document.getElementById('連莊鈕'));
}

// 按住超過這個時間算長按，用來倒退或減一
const 長按毫秒數 = 500;

/** 同一顆按鈕分辨點一下與長按：按住滿時間就執行長按動作，放開後那次點擊不再執行點一下的動作 */
function 綁定點擊與長按(按鈕, 點一下動作, 長按動作) {
  let 長按計時 = null;
  let 長按已觸發 = false;
  const 取消長按計時 = () => {
    clearTimeout(長按計時);
    長按計時 = null;
  };

  按鈕.addEventListener('pointerdown', () => {
    長按已觸發 = false;
    取消長按計時();
    長按計時 = setTimeout(() => {
      長按計時 = null;
      長按已觸發 = true;
      長按動作();
    }, 長按毫秒數);
  });
  按鈕.addEventListener('pointerup', () => {
    取消長按計時();
    // 點擊事件緊接在放開之後送出，處理完再清掉旗標，避免殘留影響之後的鍵盤操作
    setTimeout(() => { 長按已觸發 = false; }, 0);
  });
  按鈕.addEventListener('pointerleave', 取消長按計時);
  按鈕.addEventListener('pointercancel', 取消長按計時);
  // 手機長按會跳出選單，擋掉
  按鈕.addEventListener('contextmenu', (事件) => 事件.preventDefault());

  按鈕.addEventListener('click', () => {
    if (長按已觸發) {
      長按已觸發 = false;
      return;
    }
    點一下動作();
  });
}

/** 換莊鈕：點一下前進一局，四個自風字整層與中央區同時逆時針轉一格，新莊家連莊數歸零；
    長按倒退一局，順時針轉回一格，連莊數還原成換莊前的數字。動畫結束後再換成新一局的畫面。
    連莊鈕：點一下連莊數加一，長按減一。左上的重置鈕回到東一局、沒有連莊 */
function 綁定換莊() {
  const 換莊鈕 = document.getElementById('換莊鈕');
  const 連莊鈕 = document.getElementById('連莊鈕');
  const 自風字層 = document.getElementById('自風字層');
  const 桌面中央 = document.getElementById('桌面中央');
  const 局數重置鈕 = document.getElementById('局數重置鈕');
  let 局況 = 讀取上次局況();

  const 更新局況 = (新局況) => {
    局況 = 新局況;
    記住局況(局況);
    渲染桌面局況(局況);
  };
  渲染桌面局況(局況);

  /** 前進傳 1、倒退傳 -1；前進逆時針轉，倒退順時針轉 */
  async function 換局(方向) {
    // 轉動途中的其他操作會被動畫結束後的換局蓋掉，所以一起停用
    [換莊鈕, 連莊鈕, 局數重置鈕].forEach((按鈕) => { 按鈕.disabled = true; });
    const 減少動態 = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let 轉動清單 = [];
    if (!減少動態) {
      // 停在轉完的角度，等字換好再取消，避免轉回原位的那一格閃一下
      const 動畫設定 = { duration: 600, easing: 'ease-in-out', fill: 'forwards' };
      const 轉動角度 = 方向 * -90;
      const 中央起始角度 = 中央區朝向莊家角度(局況.局序 % 4);
      轉動清單 = [
        自風字層.animate([{ transform: 'rotate(0deg)' }, { transform: `rotate(${轉動角度}deg)` }], 動畫設定),
        桌面中央.animate(
          [{ transform: `rotate(${中央起始角度}deg)` }, { transform: `rotate(${中央起始角度 + 轉動角度}deg)` }],
          動畫設定,
        ),
      ];
      await Promise.all(轉動清單.map((轉動) => 轉動.finished));
    }
    const 新局序 = (局況.局序 + 方向 + 總局數) % 總局數;
    if (方向 === 1) {
      更新局況({ 局序: 新局序, 連莊數: 0, 換莊前連莊數紀錄: [...局況.換莊前連莊數紀錄, 局況.連莊數] });
    } else {
      // 沒有紀錄（例如從東一局退回北四局）時連莊數為 0
      const 紀錄 = 局況.換莊前連莊數紀錄.slice(0, -1);
      const 還原連莊數 = 局況.換莊前連莊數紀錄.at(-1) ?? 0;
      更新局況({ 局序: 新局序, 連莊數: 還原連莊數, 換莊前連莊數紀錄: 紀錄 });
    }
    轉動清單.forEach((轉動) => 轉動.cancel());
    [換莊鈕, 連莊鈕, 局數重置鈕].forEach((按鈕) => { 按鈕.disabled = false; });
  }

  綁定點擊與長按(換莊鈕, () => 換局(1), () => 換局(-1));
  綁定點擊與長按(
    連莊鈕,
    () => 更新局況({ ...局況, 連莊數: 局況.連莊數 + 1 }),
    () => 更新局況({ ...局況, 連莊數: Math.max(0, 局況.連莊數 - 1) }),
  );

  局數重置鈕.addEventListener('click', () => 更新局況(建立初始局況()));
}

function 初始化畫面() {
  const 場風選單 = document.getElementById('場風選單');
  場風選單.addEventListener('change', () => {
    畫面狀態.場風牌 = Number(場風選單.value);
    重新渲染全部();
  });

  const 自風選單 = document.getElementById('自風選單');
  自風選單.addEventListener('change', () => {
    畫面狀態.自風牌 = Number(自風選單.value);
    重新渲染全部();
  });

  const 連莊數選單 = document.getElementById('連莊數選單');
  連莊數選單.addEventListener('change', () => {
    畫面狀態.連莊數 = Number(連莊數選單.value);
    重新渲染全部();
  });

  document.getElementById('全部重設鈕').addEventListener('click', () => {
    全部重設();
    重新渲染全部();
  });

  綁定區塊選取();
  綁定規則說明視窗();
  綁定結果視窗();
  綁定模式切換();
  綁定換莊();

  重新渲染全部();
}

document.addEventListener('DOMContentLoaded', 初始化畫面);
