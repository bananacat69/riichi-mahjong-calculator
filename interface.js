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
  // 和牌者的自風牌編號，一開始不預設，還沒選是 null
  自風牌: null,
  連莊數: 0,
  是自摸: false,
  寶牌清單: [],
  加入目標: '手牌',
  副露種類: '吃',
  和牌狀況: {},
  // 榮和時的放銃者風牌編號，還沒選是 null
  放銃者風牌: null,
  // 東南西北各是誰，依位置模式的局況與四家名稱換算，打開計算側邊欄時更新；沒填名稱是空字串
  各風人名: ['', '', '', ''],
  // 東南西北各坐在位置模式的哪個座位（座位清單的序號），打開計算側邊欄時更新
  各風座位序: [0, 1, 2, 3],
  // 東南西北各家在位置模式有沒有按立直，打開計算側邊欄時更新
  各風已立直: [false, false, false, false],
  // 流局留下的立直棒點數，打開計算側邊欄時更新
  供託點數: 0,
  // 選了流局種類（荒牌流局或途中流局）就不必放牌也能計算；沒選是 null
  流局種類: null,
  // 荒牌流局時東南西北各家有沒有聽牌
  各風聽牌: [false, false, false, false]
};

// 荒牌流局的不聽罰符總額，由沒聽牌的人平分付給聽牌的人
const 不聽罰符總額 = 3000;

// 每根立直棒的點數
const 立直棒點數 = 1000;
// 流局留下的立直棒點數（供託）存在這裡，下一個和牌的人收走
const 供託點數儲存鍵 = '日麻計算.供託點數';

function 讀取供託點數() {
  try {
    const 點數 = Number(localStorage.getItem(供託點數儲存鍵));
    if (Number.isFinite(點數) && 點數 > 0) return 點數;
  } catch {
    // 讀不到就當作沒有供託
  }
  return 0;
}

/** 存下供託點數並更新桌面中央的顯示 */
function 記住供託點數(點數) {
  try {
    localStorage.setItem(供託點數儲存鍵, String(點數));
  } catch {
    // 存不了只影響重整後供託還在不在
  }
  渲染供託();
}

/** 桌面中央場風字下方顯示「供託 2000」，沒有供託時不顯示 */
function 渲染供託() {
  const 元素 = document.getElementById('供託點數');
  const 點數 = 讀取供託點數();
  元素.textContent = `供託 ${點數}`;
  元素.hidden = 點數 === 0;
}

/** 某家的點數變化加進清單：已有那家就累加，沒有就接在最後 */
function 加入點數變化(點數變化, 風牌, 變化) {
  const 既有 = 點數變化.find((項目) => 項目.風牌 === 風牌);
  if (既有) 既有.變化 += 變化;
  else 點數變化.push({ 風牌, 變化 });
}

/** 結果視窗的立直明細：每家立直扣點一列，和牌時再列和牌者收走的本局立直棒與上一局留下的供託 */
function 建立立直明細(和牌者風牌) {
  const 東 = 計算引擎.東風編號;
  const 立直風序清單 = [0, 1, 2, 3].filter((風序) => 畫面狀態.各風已立直[風序]);
  const 帶正負號 = (點數) => `${點數 > 0 ? '+' : '−'}${Math.abs(點數).toLocaleString('zh-TW')}`;
  const 清單 = document.createElement('ul');
  清單.className = '明細清單';
  for (const 風序 of 立直風序清單) {
    清單.appendChild(建立明細項目(`${風位顯示名稱(東 + 風序)} 立直扣點`, 帶正負號(-立直棒點數)));
  }
  if (和牌者風牌 !== null) {
    const 和牌者名稱 = 風位顯示名稱(和牌者風牌);
    if (立直風序清單.length > 0) {
      清單.appendChild(建立明細項目(
        `${和牌者名稱} 收走本局立直棒 ${立直風序清單.length} 根`,
        帶正負號(立直風序清單.length * 立直棒點數),
      ));
    }
    if (畫面狀態.供託點數 > 0) {
      清單.appendChild(建立明細項目(`${和牌者名稱} 收走上一局留下的立直（供託）`, 帶正負號(畫面狀態.供託點數)));
    }
  }
  return 清單;
}

// 結果視窗的確認鈕用來把點數移動加到桌面點數，初始化時由位置模式提供
let 套用點數到桌面 = null;
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
const 風名清單 = ['東', '南', '西', '北'];

/** 某個風牌的顯示名稱：有填人名用人名，沒填用「東家」這類稱呼 */
function 風位顯示名稱(風牌編號) {
  const 風序 = 風牌編號 - 計算引擎.東風編號;
  return 畫面狀態.各風人名[風序].trim() || `${風名清單[風序]}家`;
}

/** 填一個風位選單的選項：風（人名），沒填人名只顯示風 */
function 填入風位選單(選單, 風牌清單, 選取值, 第一項文字) {
  選單.textContent = '';
  if (第一項文字) {
    const 提示 = document.createElement('option');
    提示.value = '';
    提示.textContent = 第一項文字;
    選單.appendChild(提示);
  }
  for (const 風牌 of 風牌清單) {
    const 風序 = 風牌 - 計算引擎.東風編號;
    const 人名 = 畫面狀態.各風人名[風序].trim();
    const 選項 = document.createElement('option');
    選項.value = String(風牌);
    選項.textContent = 人名 ? `${風名清單[風序]}（${人名}）` : 風名清單[風序];
    選單.appendChild(選項);
  }
  選單.value = 選取值 === null ? '' : String(選取值);
}

/** 和牌者選單與放銃者選單：和牌者一開始沒選；選榮和才顯示放銃者，選項排除和牌者；換和牌者後放銃者跟和牌者重複就清掉 */
function 渲染風位選單() {
  const 全部風牌 = [0, 1, 2, 3].map((風序) => 計算引擎.東風編號 + 風序);
  填入風位選單(document.getElementById('自風選單'), 全部風牌, 畫面狀態.自風牌, '選擇和牌者');
  if (畫面狀態.放銃者風牌 === 畫面狀態.自風牌) 畫面狀態.放銃者風牌 = null;
  const 放銃者選單 = document.getElementById('放銃者選單');
  放銃者選單.hidden = 畫面狀態.是自摸;
  填入風位選單(
    放銃者選單,
    全部風牌.filter((風牌) => 風牌 !== 畫面狀態.自風牌),
    畫面狀態.放銃者風牌,
    '選擇放銃者',
  );
}

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

/** 和牌者在位置模式有立直時自動勾立直；已勾立直或雙立直就不動，和牌者沒立直也不取消手動勾的 */
function 依桌面立直勾選和牌者立直() {
  if (畫面狀態.自風牌 === null) return;
  if (!畫面狀態.各風已立直[畫面狀態.自風牌 - 計算引擎.東風編號]) return;
  if (畫面狀態.和牌狀況.是立直 || 畫面狀態.和牌狀況.是雙立直) return;
  畫面狀態.和牌狀況.是立直 = true;
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
  // 還沒選和牌者時不知道是莊家還是子家，限定莊家或子家的項目都先停用
  const 已選和牌者 = 畫面狀態.自風牌 !== null;

  for (const 定義 of 和牌狀況定義清單) {
    let 可用 = true;
    if (定義.需要門前 && !是門前) 可用 = false;
    if (定義.僅限自摸 && !畫面狀態.是自摸) 可用 = false;
    if (定義.僅限榮和 && 畫面狀態.是自摸) 可用 = false;
    if (定義.需要莊家 && !是莊家) 可用 = false;
    if (定義.需要子家 && (是莊家 || !已選和牌者)) 可用 = false;
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

/** 流局區塊：荒牌流局與途中流局兩顆鈕，點選中的那顆取消流局；
    選荒牌流局時鈕的右邊列出四家的聽牌勾選框，文字與和牌者選單相同：風（人名） */
function 渲染流局() {
  const 種類鈕組 = document.getElementById('流局種類鈕組');
  種類鈕組.textContent = '';
  for (const 種類 of ['荒牌流局', '途中流局']) {
    const 按鈕 = document.createElement('button');
    按鈕.type = 'button';
    按鈕.className = '和牌方式鈕' + (畫面狀態.流局種類 === 種類 ? ' 選取中' : '');
    按鈕.textContent = 種類;
    按鈕.setAttribute('aria-pressed', String(畫面狀態.流局種類 === 種類));
    按鈕.title = 種類 === '荒牌流局'
      ? '牌摸完沒人和牌：沒聽牌的人平分付 3000 點給聽牌的人，全員聽牌或全員沒聽牌不收不付'
      : '九種九牌、四風連打、四家立直、四槓散了：沒有罰符，點數不變';
    按鈕.addEventListener('click', () => {
      畫面狀態.流局種類 = 畫面狀態.流局種類 === 種類 ? null : 種類;
      重新渲染全部();
    });
    種類鈕組.appendChild(按鈕);
  }

  document.getElementById('聽牌者區').hidden = 畫面狀態.流局種類 !== '荒牌流局';
  const 聽牌者格 = document.getElementById('聽牌者格');
  聽牌者格.textContent = '';
  畫面狀態.各風聽牌.forEach((已聽牌, 風序) => {
    const 標籤 = document.createElement('label');
    標籤.className = '勾選項';
    const 勾選框 = document.createElement('input');
    勾選框.type = 'checkbox';
    勾選框.checked = 已聽牌;
    勾選框.addEventListener('change', () => {
      畫面狀態.各風聽牌[風序] = 勾選框.checked;
      重新渲染全部();
    });
    const 人名 = 畫面狀態.各風人名[風序].trim();
    標籤.append(勾選框, document.createTextNode(人名 ? `${風名清單[風序]}（${人名}）` : 風名清單[風序]));
    聽牌者格.appendChild(標籤);
  });
}

/** 流局結果確認後清掉流局的選擇，下一局回到算和牌 */
function 清除流局設定() {
  畫面狀態.流局種類 = null;
  畫面狀態.各風聽牌 = [false, false, false, false];
}

/** 牌沒湊滿就不能算，按鈕上直接說還差幾張；選了流局時不看牌，直接可以按 */
function 渲染計算鈕() {
  const 計算鈕 = document.getElementById('計算鈕');
  if (畫面狀態.流局種類 !== null) {
    計算鈕.disabled = false;
    計算鈕.textContent = '計算流局';
    return;
  }
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
  if (畫面狀態.自風牌 === null) {
    計算鈕.disabled = true;
    計算鈕.textContent = '還要選擇和牌者';
    return;
  }
  if (!畫面狀態.是自摸 && 畫面狀態.放銃者風牌 === null) {
    計算鈕.disabled = true;
    計算鈕.textContent = '還要選擇放銃者';
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

  if (畫面狀態.流局種類 !== null) {
    渲染流局結果(容器);
    return;
  }

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

  const 點數變化 = 計算點數變化(結果);
  本體.appendChild(建立點數移動清單(點數變化));

  if (畫面狀態.各風已立直.some(Boolean) || 畫面狀態.供託點數 > 0) {
    本體.appendChild(建立小標('立直明細'));
    本體.appendChild(建立立直明細(畫面狀態.自風牌));
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

  // 本局立直棒與供託都已經跟著點數結算，讓桌面清掉
  本體.appendChild(建立套用點數鈕(點數變化, () => {
    document.dispatchEvent(new CustomEvent('點數已結算'));
    記住供託點數(0);
  }));

  容器.appendChild(本體);
}

/** 流局的點數變化：荒牌流局的不聽罰符由沒聽牌的人平分付 3000 點給聽牌的人，聽牌的人排前面；
    途中流局、全員聽牌或全員沒聽牌沒有罰符。有立直的每家再扣一根立直棒，留作供託 */
function 計算流局點數變化() {
  const 東 = 計算引擎.東風編號;
  const 點數變化 = [];
  const 聽牌人數 = 畫面狀態.各風聽牌.filter(Boolean).length;
  if (畫面狀態.流局種類 === '荒牌流局' && 聽牌人數 > 0 && 聽牌人數 < 4) {
    畫面狀態.各風聽牌.forEach((已聽牌, 風序) => {
      if (已聽牌) 點數變化.push({ 風牌: 東 + 風序, 變化: 不聽罰符總額 / 聽牌人數 });
    });
    畫面狀態.各風聽牌.forEach((已聽牌, 風序) => {
      if (!已聽牌) 點數變化.push({ 風牌: 東 + 風序, 變化: -不聽罰符總額 / (4 - 聽牌人數) });
    });
  }
  畫面狀態.各風已立直.forEach((已立直, 風序) => {
    if (已立直) 加入點數變化(點數變化, 東 + 風序, -立直棒點數);
  });
  return 點數變化;
}

/** 流局結果：種類、聽牌人數、罰符收支、點數移動與立直扣點，下面提醒回桌面自己按連莊或換莊；
    按確認後立直的人扣點、桌上立直棒取消，扣的點數加進供託，留給下一個和牌的人 */
function 渲染流局結果(容器) {
  const 是荒牌流局 = 畫面狀態.流局種類 === '荒牌流局';
  const 聽牌人數 = 畫面狀態.各風聽牌.filter(Boolean).length;
  const 莊家聽牌 = 畫面狀態.各風聽牌[0];

  const 標頭 = document.createElement('div');
  標頭.className = '結果標頭';
  const 級別元素 = document.createElement('p');
  級別元素.className = '級別';
  級別元素.textContent = 畫面狀態.流局種類;
  標頭.appendChild(級別元素);
  if (是荒牌流局) {
    const 聽牌元素 = document.createElement('p');
    聽牌元素.className = '番符';
    聽牌元素.textContent = `聽牌 ${聽牌人數} 家`;
    標頭.appendChild(聽牌元素);
  }
  容器.appendChild(標頭);

  const 本體 = document.createElement('div');
  本體.className = '結果本體';

  const 點數變化 = 計算流局點數變化();
  const 收支元素 = document.createElement('p');
  收支元素.className = '收支說明';
  if (!是荒牌流局) {
    收支元素.textContent = '途中流局沒有罰符';
  } else if (聽牌人數 === 0) {
    收支元素.textContent = '全員沒聽牌，不收不付';
  } else if (聽牌人數 === 4) {
    收支元素.textContent = '全員聽牌，不收不付';
  } else {
    const 收 = (不聽罰符總額 / 聽牌人數).toLocaleString('zh-TW');
    const 付 = (不聽罰符總額 / (4 - 聽牌人數)).toLocaleString('zh-TW');
    收支元素.textContent = `聽牌的人各收 ${收} 點，沒聽牌的人各付 ${付} 點`;
  }
  本體.appendChild(收支元素);
  if (點數變化.length > 0) 本體.appendChild(建立點數移動清單(點數變化));

  const 局數提醒 = document.createElement('p');
  局數提醒.className = '區塊附註';
  if (!是荒牌流局 || 莊家聽牌) {
    局數提醒.textContent = '莊家連莊，本場加一：回桌面按一次連莊鈕。';
  } else {
    局數提醒.textContent = '莊家沒聽牌要換莊，本場加一：回桌面按換莊鈕後，換莊會把本場歸零，再按連莊鈕按到原本的本場數加一。';
  }
  const 立直棒數 = 畫面狀態.各風已立直.filter(Boolean).length;
  const 新供託點數 = 畫面狀態.供託點數 + 立直棒數 * 立直棒點數;
  if (立直棒數 > 0) {
    本體.appendChild(建立小標('立直明細'));
    本體.appendChild(建立立直明細(null));
    const 供託說明 = document.createElement('p');
    供託說明.className = '區塊附註';
    供託說明.textContent = `立直棒 ${立直棒數} 根留作供託，確認後桌面供託共 ${新供託點數.toLocaleString('zh-TW')} 點，下一個和牌的人一起收走。`;
    本體.appendChild(供託說明);
  }
  本體.appendChild(局數提醒);

  本體.appendChild(建立套用點數鈕(點數變化, () => {
    if (立直棒數 > 0) {
      記住供託點數(新供託點數);
      document.dispatchEvent(new CustomEvent('點數已結算'));
    }
    清除流局設定();
    重新渲染全部();
  }));
  容器.appendChild(本體);
}

/** 和牌後每家的點數變化，第一筆是和牌者（正數），其餘是付錢的人（負數）：
    榮和由放銃者一人付；自摸時莊家和牌三家各付同額，子家和牌莊家付較多。
    位置模式有立直的每家再扣一根立直棒，全部由和牌者收走；和牌者自己的那根等於拿回來。上一局留下的供託也由和牌者收走 */
function 計算點數變化(結果) {
  const 點數 = 結果.點數結果;
  const 和牌者 = 畫面狀態.自風牌;
  const 東 = 計算引擎.東風編號;
  let 支付清單;
  if (!結果.是自摸) {
    支付清單 = [{ 風牌: 畫面狀態.放銃者風牌, 點數: 點數.總點數 }];
  } else {
    支付清單 = [0, 1, 2, 3].map((風序) => 東 + 風序).filter((風牌) => 風牌 !== 和牌者).map((風牌) => ({
      風牌,
      點數: 結果.是莊家 ? 點數.明細.子家支付 : (風牌 === 東 ? 點數.明細.莊家支付 : 點數.明細.子家支付),
    }));
  }
  const 點數變化 = [{ 風牌: 和牌者, 變化: 點數.總點數 }, ...支付清單.map((支付) => ({ 風牌: 支付.風牌, 變化: -支付.點數 }))];
  畫面狀態.各風已立直.forEach((已立直, 風序) => {
    if (!已立直) return;
    加入點數變化(點數變化, 東 + 風序, -立直棒點數);
    加入點數變化(點數變化, 和牌者, 立直棒點數);
  });
  加入點數變化(點數變化, 和牌者, 畫面狀態.供託點數);
  return 點數變化;
}

/** 點數移動：用人名列出和牌者加多少、每個付錢的人扣多少 */
function 建立點數移動清單(點數變化) {
  const 清單 = document.createElement('ul');
  清單.className = '點數移動清單';
  const 加入一列 = (風牌, 文字, 類別) => {
    const 列 = document.createElement('li');
    const 名稱 = document.createElement('span');
    名稱.textContent = 風位顯示名稱(風牌);
    const 數字 = document.createElement('span');
    數字.className = 類別;
    數字.textContent = 文字;
    列.append(名稱, 數字);
    清單.appendChild(列);
  };
  for (const { 風牌, 變化 } of 點數變化) {
    加入一列(風牌, `${變化 > 0 ? '+' : '−'}${Math.abs(變化).toLocaleString('zh-TW')}`, 變化 > 0 ? '加點' : '扣點');
  }
  return 清單;
}

/** 結果視窗底部的確認鈕：按下後把點數移動換算成座位，加到位置模式的點數上，執行確認後動作，關掉結果視窗與計算側邊欄回到桌面 */
function 建立套用點數鈕(點數變化, 確認後動作) {
  const 按鈕 = document.createElement('button');
  按鈕.type = 'button';
  按鈕.className = '計算鈕 套用點數鈕';
  按鈕.textContent = '確認';
  按鈕.setAttribute('aria-label', '確認，把點數移動加到桌面的點數');
  按鈕.addEventListener('click', () => {
    const 座位變化 = 座位清單.map(() => 0);
    for (const { 風牌, 變化 } of 點數變化) {
      座位變化[畫面狀態.各風座位序[風牌 - 計算引擎.東風編號]] += 變化;
    }
    套用點數到桌面(座位變化);
    確認後動作();
    document.getElementById('結果視窗').close();
  });
  return 按鈕;
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
  渲染風位選單();
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
  渲染流局();
  渲染計算鈕();
}

/** 清空鈕：只清掉放進手牌、和牌張、副露、寶牌的牌；場風、和牌者、放銃者、連莊數、和牌方式與和牌狀況都保留 */
function 清空輸入的牌() {
  畫面狀態.手牌 = [];
  畫面狀態.和牌張 = null;
  畫面狀態.副露清單 = [];
  畫面狀態.寶牌清單 = [];
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

/** 位置模式的場風與連莊數帶到計算模式的場風、連莊數選單；連莊數選單最多十本場，超過時以十計。
    同時依目前莊家位置換算東南西北各是哪個座位，帶入那個座位的名稱與有沒有立直，以及桌面的供託點數 */
function 帶入位置模式局況(局況) {
  const 莊家座位序 = 局況.局序 % 4;
  const 四家名稱 = 讀取上次名稱();
  畫面狀態.各風座位序 = [0, 1, 2, 3].map((風序) => (莊家座位序 + 風序) % 4);
  畫面狀態.各風人名 = 畫面狀態.各風座位序.map((座位序) => 四家名稱[座位序]);
  const 立直座位 = 讀取上次立直座位();
  畫面狀態.各風已立直 = 畫面狀態.各風座位序.map((座位序) => 立直座位.has(座位清單[座位序]));
  畫面狀態.供託點數 = 讀取供託點數();
  依桌面立直勾選和牌者立直();
  const 場風索引 = Math.floor(局況.局序 / 4);
  const 連莊數選單 = document.getElementById('連莊數選單');
  const 連莊數上限 = Number(連莊數選單.options[連莊數選單.options.length - 1].value);
  畫面狀態.場風牌 = 計算引擎.東風編號 + 場風索引;
  畫面狀態.連莊數 = Math.min(局況.連莊數, 連莊數上限);
  document.getElementById('場風選單').value = String(畫面狀態.場風牌);
  連莊數選單.value = String(畫面狀態.連莊數);
  重新渲染全部();
}

/** 左邊的四個側邊欄（設定起始值、計算、規則說明、調整點數）：各自用左緣的標籤打開或收合，同時只開一個，打開時其他標籤先隱藏；
    打開計算時把位置模式的局況帶入計算。點遮罩、再按一次標籤或按 Esc（沒有其他視窗開著時）都會收合。
    回傳收合全部的函式 */
function 綁定側邊欄(取得目前局況) {
  const 遮罩 = document.getElementById('側邊欄遮罩');
  const 側邊欄清單 = [
    {
      側邊欄: document.getElementById('計算側邊欄'),
      標籤: document.getElementById('計算側邊欄標籤'),
      名稱: '計算',
      打開時: () => 帶入位置模式局況(取得目前局況()),
    },
    {
      側邊欄: document.getElementById('起始值側邊欄'),
      標籤: document.getElementById('起始值側邊欄標籤'),
      名稱: '設定起始值',
    },
    {
      側邊欄: document.getElementById('規則說明側邊欄'),
      標籤: document.getElementById('規則說明側邊欄標籤'),
      名稱: '採用的規則細節',
    },
    {
      側邊欄: document.getElementById('調整點數側邊欄'),
      標籤: document.getElementById('調整點數側邊欄標籤'),
      名稱: '調整點數',
      // 每次打開都從桌面目前的點數重新開始調整
      打開時: () => document.dispatchEvent(new CustomEvent('打開調整點數')),
    },
  ];
  let 目前打開 = null;

  /** 傳入要打開的側邊欄；傳 null 收合全部 */
  function 切換到(要打開的) {
    目前打開 = 要打開的;
    要打開的?.打開時?.();
    側邊欄清單.forEach((項目) => {
      const 是這個 = 項目 === 要打開的;
      項目.側邊欄.classList.toggle('打開', 是這個);
      // 收合時側邊欄裡的按鈕不能被 Tab 走到，也不讓螢幕閱讀器讀到
      項目.側邊欄.inert = !是這個;
      項目.標籤.hidden = 要打開的 !== null && !是這個;
      項目.標籤.setAttribute('aria-expanded', String(是這個));
      const 標籤說明 = `${是這個 ? '收合' : '打開'}${項目.名稱}`;
      項目.標籤.setAttribute('aria-label', 標籤說明);
      項目.標籤.title = 標籤說明;
    });
    遮罩.hidden = 要打開的 === null;
  }

  // 手機直放時側邊欄從上方滑下，標籤要貼在它的下緣，所以把打開那個側邊欄的高度寫進 CSS 變數；
  // 內容變動（例如計算側邊欄加牌）讓高度改變時也跟著更新
  const 更新側邊欄高度 = () => {
    if (目前打開 === null) return;
    document.documentElement.style.setProperty('--目前側邊欄高度', `${目前打開.側邊欄.offsetHeight}px`);
  };
  const 側邊欄高度觀察 = new ResizeObserver(更新側邊欄高度);
  側邊欄清單.forEach((項目) => {
    側邊欄高度觀察.observe(項目.側邊欄);
    項目.標籤.addEventListener('click', () => {
      切換到(目前打開 === 項目 ? null : 項目);
      更新側邊欄高度();
    });
  });
  遮罩.addEventListener('click', () => 切換到(null));
  document.addEventListener('keydown', (事件) => {
    if (事件.key !== 'Escape' || 目前打開 === null) return;
    // 結果、點數確認視窗開著時，Esc 只關視窗
    if (document.querySelector('dialog[open]')) return;
    const 標籤 = 目前打開.標籤;
    切換到(null);
    標籤.focus();
  });

  return () => 切換到(null);
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
    連莊鈕：點一下連莊數加一，長按減一。右上的重置鈕回到東一局、沒有連莊。回傳讀取目前局況的函式 */
function 綁定換莊() {
  const 換莊鈕 = document.getElementById('換莊鈕');
  const 連莊鈕 = document.getElementById('連莊鈕');
  const 自風字層 = document.getElementById('自風字層');
  const 桌面中央 = document.getElementById('桌面中央');
  const 局數重置鈕 = document.getElementById('局數重置鈕');
  const 骰子鈕 = document.getElementById('骰子鈕');
  let 局況 = 讀取上次局況();

  const 更新局況 = (新局況) => {
    const 換了一局 = 新局況.局序 !== 局況.局序 || 新局況.換莊前連莊數紀錄.length !== 局況.換莊前連莊數紀錄.length;
    局況 = 新局況;
    記住局況(局況);
    渲染桌面局況(局況);
    // 讓擲骰結果等跟著一局的資訊知道要清掉
    if (換了一局) document.dispatchEvent(new CustomEvent('換了一局'));
  };
  渲染桌面局況(局況);

  /** 前進傳 1、倒退傳 -1；前進逆時針轉，倒退順時針轉 */
  async function 換局(方向) {
    // 轉動途中的其他操作會被動畫結束後的換局蓋掉，所以一起停用
    [換莊鈕, 連莊鈕, 局數重置鈕, 骰子鈕].forEach((按鈕) => { 按鈕.disabled = true; });
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
    [換莊鈕, 連莊鈕, 局數重置鈕, 骰子鈕].forEach((按鈕) => { 按鈕.disabled = false; });
  }

  綁定點擊與長按(換莊鈕, () => 換局(1), () => 換局(-1));
  // 連莊也是新的一局，讓立直棒這類只維持一局的標示知道要清掉
  const 通知連莊數改變 = () => document.dispatchEvent(new CustomEvent('連莊數改變'));
  綁定點擊與長按(
    連莊鈕,
    () => {
      更新局況({ ...局況, 連莊數: 局況.連莊數 + 1 });
      通知連莊數改變();
    },
    () => {
      更新局況({ ...局況, 連莊數: Math.max(0, 局況.連莊數 - 1) });
      通知連莊數改變();
    },
  );

  局數重置鈕.addEventListener('click', () => {
    更新局況(建立初始局況());
    // 本來就在東一局時局況沒變，仍要清掉擲骰結果
    document.dispatchEvent(new CustomEvent('換了一局'));
  });

  return () => 局況;
}

/* ---------- 位置模式：四家點數 ---------- */
const 四家點數儲存鍵 = '日麻計算.四家點數';
const 四家名稱儲存鍵 = '日麻計算.四家名稱';
const 起始點數儲存鍵 = '日麻計算.起始點數';
const 預設起始點數 = 25000;
// 起始點數加減一次的量
const 起始點數級距 = 1000;

const 是合法起始點數 = (值) => Number.isInteger(值) && 值 >= 0 && 值 % 起始點數級距 === 0;

/** 讀出上次設定的起始點數；讀不到或內容不合法時用預設起始點數 */
function 讀取上次起始點數() {
  try {
    const 值 = JSON.parse(localStorage.getItem(起始點數儲存鍵));
    if (是合法起始點數(值)) return 值;
  } catch {
    // 讀不到就用預設起始點數
  }
  return 預設起始點數;
}

function 記住起始點數(起始點數) {
  try {
    localStorage.setItem(起始點數儲存鍵, JSON.stringify(起始點數));
  } catch {
    // 存不了只影響重整後的起始點數
  }
}

/** 讀出上次四家的點數，依座位清單的順序（下、右、上、左）；讀不到或內容不合法時四家都是起始點數 */
function 讀取上次點數(起始點數) {
  try {
    const 值 = JSON.parse(localStorage.getItem(四家點數儲存鍵));
    if (Array.isArray(值) && 值.length === 座位清單.length && 值.every(Number.isInteger)) return 值;
  } catch {
    // 讀不到就用起始點數
  }
  return 座位清單.map(() => 起始點數);
}

function 記住點數(四家點數) {
  try {
    localStorage.setItem(四家點數儲存鍵, JSON.stringify(四家點數));
  } catch {
    // 存不了只影響重整後的點數
  }
}

/** 讀出上次四家的名稱，依座位清單的順序；讀不到或內容不合法時四家都沒有名稱 */
function 讀取上次名稱() {
  try {
    const 值 = JSON.parse(localStorage.getItem(四家名稱儲存鍵));
    if (Array.isArray(值) && 值.length === 座位清單.length && 值.every((名稱) => typeof 名稱 === 'string')) return 值;
  } catch {
    // 讀不到就沒有名稱
  }
  return 座位清單.map(() => '');
}

function 記住名稱(四家名稱) {
  try {
    localStorage.setItem(四家名稱儲存鍵, JSON.stringify(四家名稱));
  } catch {
    // 存不了只影響重整後的名稱
  }
}

/** 桌面上的四家點數只顯示、不能直接修改，跟著座位（人），換莊時不動；右上的重置鈕讓四家回到起始點數，
    計算結果按確認後依座位加減。
    設定起始值側邊欄：加減一次 1000、不低於 0，按確認跳出確認視窗，按確定才把四家點數都改成起始點數；
    四家名稱邊打邊顯示在點數上方，前後空白不算，清空就不顯示 */
function 綁定點數(收合側邊欄) {
  let 起始點數 = 讀取上次起始點數();
  let 四家點數 = 讀取上次點數(起始點數);
  let 四家名稱 = 讀取上次名稱();
  const 點數位清單 = 座位清單.map((座位) => document.querySelector(`.點數位[data-座位="${座位}"]`));

  const 渲染點數 = () => {
    點數位清單.forEach((點數位, 座位序) => {
      const 點數數字 = 點數位.querySelector('.點數數字');
      點數數字.textContent = String(四家點數[座位序]);
      點數數字.classList.toggle('負數', 四家點數[座位序] < 0);
      const 名稱 = 四家名稱[座位序].trim();
      const 玩家名稱 = 點數位.querySelector('.玩家名稱');
      玩家名稱.textContent = 名稱;
      玩家名稱.style.setProperty('--名稱字數', String(Array.from(名稱).length));
      玩家名稱.hidden = 名稱 === '';
    });
  };
  // 計算結果確認後的增減量顯示這麼久，之後才把數字加到點數上
  const 增減顯示毫秒數 = 2000;
  const 點數增減清單 = 點數位清單.map((點數位) => 點數位.querySelector('.點數增減'));
  let 增減顯示計時 = null;
  const 收起增減 = () => {
    clearTimeout(增減顯示計時);
    增減顯示計時 = null;
    點數增減清單.forEach((元素) => { 元素.hidden = true; });
  };
  const 更新點數 = (新點數) => {
    // 增減量還在顯示時有其他更新（例如重置），直接收起，以新的點數為準
    收起增減();
    四家點數 = 新點數;
    記住點數(四家點數);
    渲染點數();
  };
  渲染點數();

  document.getElementById('局數重置鈕').addEventListener('click', () => {
    更新點數(座位清單.map(() => 起始點數));
  });

  // 計算結果的確認鈕：依座位清單順序傳入每家的點數變化，收合側邊欄回到桌面；
  // 有增減的那幾家在點數下方用紅字顯示增減量兩秒，之後才把數字加到點數上。
  // 新點數立刻存起來，兩秒內重整也不會漏加
  套用點數到桌面 = (座位變化) => {
    收起增減();
    渲染點數();
    四家點數 = 四家點數.map((點數, 座位序) => 點數 + 座位變化[座位序]);
    記住點數(四家點數);
    座位變化.forEach((變化, 座位序) => {
      const 元素 = 點數增減清單[座位序];
      元素.textContent = 變化 > 0 ? `+${變化}` : `−${-變化}`;
      元素.hidden = 變化 === 0;
    });
    收合側邊欄();
    增減顯示計時 = setTimeout(() => {
      收起增減();
      渲染點數();
    }, 增減顯示毫秒數);
  };

  document.querySelectorAll('.名稱輸入框').forEach((輸入框) => {
    const 座位序 = 座位清單.indexOf(輸入框.dataset.座位);
    輸入框.value = 四家名稱[座位序];
    輸入框.addEventListener('input', () => {
      四家名稱 = 四家名稱.map((名稱, 序) => (序 === 座位序 ? 輸入框.value : 名稱));
      記住名稱(四家名稱);
      渲染點數();
    });
  });

  const 起始點數數字 = document.getElementById('起始點數數字');
  const 起始點數減少鈕 = document.getElementById('起始點數減少鈕');
  const 渲染起始點數 = () => {
    起始點數數字.textContent = String(起始點數);
    起始點數減少鈕.disabled = 起始點數 === 0;
  };
  const 調整起始點數 = (變化量) => {
    起始點數 = Math.max(0, 起始點數 + 變化量);
    記住起始點數(起始點數);
    渲染起始點數();
  };
  渲染起始點數();
  起始點數減少鈕.addEventListener('click', () => 調整起始點數(-起始點數級距));
  document.getElementById('起始點數增加鈕').addEventListener('click', () => 調整起始點數(起始點數級距));

  // 設定起始值與調整點數共用一個確認視窗，打開前先放好按確定後要做的事
  const 確認視窗 = document.getElementById('點數確認視窗');
  let 確定後動作 = null;
  const 跳出確認 = (訊息, 動作) => {
    document.getElementById('點數確認訊息').textContent = 訊息;
    確定後動作 = 動作;
    確認視窗.showModal();
  };
  document.getElementById('起始點數確認鈕').addEventListener('click', () => {
    跳出確認(`要把四家點數都改成 ${起始點數} 嗎？`, () => 更新點數(座位清單.map(() => 起始點數)));
  });
  // 按確定、取消都會送出表單並關閉確認視窗，Esc 直接關閉不送出；
  // 按確定才執行，並收合側邊欄回到桌面，取消則留在側邊欄
  確認視窗.querySelector('form').addEventListener('submit', (事件) => {
    if (事件.submitter?.value !== '同意' || 確定後動作 === null) return;
    確定後動作();
    確定後動作 = null;
    收合側邊欄();
  });

  // 調整點數側邊欄：打開時以桌面目前的點數為底，按加減鈕只改這裡的暫存，按確認並確定後才寫回桌面
  const 起始稱呼清單 = ['起始東', '起始南', '起始西', '起始北'];
  const 加減量清單 = [-1000, -100, 100, 1000];
  const 調整點數確認鈕 = document.getElementById('調整點數確認鈕');
  let 調整中點數 = 四家點數.slice();
  const 調整列清單 = 座位清單.map((座位, 座位序) => {
    const 列 = document.createElement('div');
    列.className = '調整點數列';
    const 標頭 = document.createElement('div');
    標頭.className = '調整點數標頭';
    const 名稱 = document.createElement('span');
    名稱.className = '調整點數名稱';
    const 算式 = document.createElement('span');
    算式.className = '調整點數算式';
    算式.setAttribute('aria-live', 'polite');
    const 數字 = document.createElement('span');
    數字.className = '調整點數數字';
    標頭.append(名稱, 算式, 數字);
    const 按鈕列 = document.createElement('div');
    按鈕列.className = '調整點數按鈕列';
    for (const 加減量 of 加減量清單) {
      const 按鈕 = document.createElement('button');
      按鈕.type = 'button';
      按鈕.className = '一般按鈕';
      按鈕.textContent = 加減量 > 0 ? `+${加減量}` : `−${-加減量}`;
      按鈕.setAttribute('aria-label', `${起始稱呼清單[座位序]}${加減量 > 0 ? '加' : '減'} ${Math.abs(加減量)}`);
      按鈕.addEventListener('click', () => {
        調整中點數 = 調整中點數.map((點數, 序) => (序 === 座位序 ? 點數 + 加減量 : 點數));
        渲染調整點數();
      });
      按鈕列.appendChild(按鈕);
    }
    列.append(標頭, 按鈕列);
    return { 列, 名稱, 算式, 數字 };
  });
  document.getElementById('調整點數清單').append(...調整列清單.map((項目) => 項目.列));

  // 四家下面再一張供託卡片，一次加減一根立直棒，最低 0；同樣按確認並確定後才寫回桌面
  let 調整中供託 = 讀取供託點數();
  const 供託列 = (() => {
    const 列 = document.createElement('div');
    列.className = '調整點數列';
    const 標頭 = document.createElement('div');
    標頭.className = '調整點數標頭';
    const 名稱 = document.createElement('span');
    名稱.className = '調整點數名稱';
    名稱.textContent = '供託';
    const 算式 = document.createElement('span');
    算式.className = '調整點數算式';
    算式.setAttribute('aria-live', 'polite');
    const 數字 = document.createElement('span');
    數字.className = '調整點數數字';
    標頭.append(名稱, 算式, 數字);
    const 按鈕列 = document.createElement('div');
    按鈕列.className = '調整點數按鈕列 供託按鈕列';
    const 按鈕清單 = [-立直棒點數, 立直棒點數].map((加減量) => {
      const 按鈕 = document.createElement('button');
      按鈕.type = 'button';
      按鈕.className = '一般按鈕';
      按鈕.textContent = 加減量 > 0 ? `+${加減量}` : `−${-加減量}`;
      按鈕.setAttribute('aria-label', `供託${加減量 > 0 ? '加' : '減'} ${Math.abs(加減量)}`);
      按鈕.addEventListener('click', () => {
        調整中供託 = Math.max(0, 調整中供託 + 加減量);
        渲染調整點數();
      });
      按鈕列.appendChild(按鈕);
      return 按鈕;
    });
    列.append(標頭, 按鈕列);
    return { 列, 算式, 數字, 減少鈕: 按鈕清單[0] };
  })();
  document.getElementById('調整點數清單').append(供託列.列);

  const 帶正負號 = (數值) => (數值 > 0 ? `+${數值}` : 數值 < 0 ? `−${-數值}` : '±0');
  const 調整點數總差 = document.getElementById('調整點數總差');

  /** 卡片只顯示名稱，沒填就空白；改過的那家（含供託）在目前點數前面加上「原本±差額=」，等號右邊就是目前點數；
      標題旁顯示調整後四家總分加上調整後供託與開局總分（起始點數乘四）的差距；四家與供託都沒有變動時確認鈕停用 */
  function 渲染調整點數() {
    調整列清單.forEach((項目, 座位序) => {
      項目.名稱.textContent = 四家名稱[座位序].trim();
      項目.數字.textContent = String(調整中點數[座位序]);
      項目.數字.classList.toggle('負數', 調整中點數[座位序] < 0);
      const 差額 = 調整中點數[座位序] - 四家點數[座位序];
      項目.算式.textContent = 差額 === 0
        ? ''
        : `${四家點數[座位序]}${差額 > 0 ? '+' : '−'}${Math.abs(差額)}=`;
    });
    const 目前供託 = 讀取供託點數();
    const 供託差額 = 調整中供託 - 目前供託;
    供託列.數字.textContent = String(調整中供託);
    供託列.算式.textContent = 供託差額 === 0 ? '' : `${目前供託}${供託差額 > 0 ? '+' : '−'}${Math.abs(供託差額)}=`;
    供託列.減少鈕.disabled = 調整中供託 === 0;
    const 開局總分 = 起始點數 * 座位清單.length;
    // 供託是從四家點數扣出來暫放在桌上的，要加回來才對得上開局總分
    const 總差 = 調整中點數.reduce((合計, 點數) => 合計 + 點數, 0) + 調整中供託 - 開局總分;
    調整點數總差.textContent = 帶正負號(總差);
    調整點數總差.classList.toggle('有差距', 總差 !== 0);
    調整點數總差.title = `調整後四家總分加上供託，與開局總分 ${開局總分} 的差距`;
    調整點數總差.setAttribute('aria-label', `與開局總分 ${開局總分} 相差 ${帶正負號(總差)}`);
    調整點數確認鈕.disabled = 供託差額 === 0 && 調整中點數.every((點數, 座位序) => 點數 === 四家點數[座位序]);
  }
  document.addEventListener('打開調整點數', () => {
    調整中點數 = 四家點數.slice();
    調整中供託 = 讀取供託點數();
    渲染調整點數();
  });
  渲染調整點數();

  調整點數確認鈕.addEventListener('click', () => {
    const 變動說明 = 調整中點數
      .map((點數, 座位序) => (點數 === 四家點數[座位序]
        ? null
        : `${四家名稱[座位序].trim() || 起始稱呼清單[座位序]}：${四家點數[座位序]} → ${點數}`))
      .filter((說明) => 說明 !== null);
    const 目前供託 = 讀取供託點數();
    if (調整中供託 !== 目前供託) 變動說明.push(`供託：${目前供託} → ${調整中供託}`);
    const 新點數 = 調整中點數.slice();
    const 新供託 = 調整中供託;
    跳出確認(`要這樣調整點數嗎？\n${變動說明.join('\n')}`, () => {
      更新點數(新點數);
      記住供託點數(新供託);
    });
  });
}


/* ---------- 音效 ---------- */
// 音效用 Web Audio 即時合成，不另外載入音檔；瀏覽器規定要在使用者點擊後才能發聲，所以第一次播放時才建立
let 音效環境 = null;
let 白噪音緩衝 = null;
let 音效總輸出 = null;

function 取得音效環境() {
  if (!音效環境) {
    const 音效環境類別 = window.AudioContext || window.webkitAudioContext;
    if (!音效環境類別) return null;
    音效環境 = new 音效環境類別();
    // 一秒白噪音，每次撞擊聲從裡面截一小段
    白噪音緩衝 = 音效環境.createBuffer(1, 音效環境.sampleRate, 音效環境.sampleRate);
    const 取樣 = 白噪音緩衝.getChannelData(0);
    for (let 序 = 0; 序 < 取樣.length; 序 += 1) 取樣[序] = Math.random() * 2 - 1;
    // 多聲重疊時用壓縮器壓住，避免破音
    const 壓縮器 = 音效環境.createDynamicsCompressor();
    壓縮器.threshold.value = -12;
    壓縮器.ratio.value = 6;
    音效總輸出 = 音效環境.createGain();
    音效總輸出.gain.value = 0.9;
    音效總輸出.connect(壓縮器).connect(音效環境.destination);
  }
  if (音效環境.state === 'suspended') 音效環境.resume();
  return 音效環境;
}

/** 截一段白噪音，經濾波後依音量包絡播出 */
function 安排雜音(環境, 開始時間, 長度秒數, 濾波類型, 濾波頻率, 濾波品質, 音量) {
  const 雜音 = 環境.createBufferSource();
  雜音.buffer = 白噪音緩衝;
  const 濾波 = 環境.createBiquadFilter();
  濾波.type = 濾波類型;
  濾波.frequency.value = 濾波頻率;
  濾波.Q.value = 濾波品質;
  const 音量控制 = 環境.createGain();
  音量控制.gain.setValueAtTime(0.0001, 開始時間);
  音量控制.gain.exponentialRampToValueAtTime(音量, 開始時間 + 0.001);
  音量控制.gain.exponentialRampToValueAtTime(0.0001, 開始時間 + 長度秒數);
  雜音.connect(濾波).connect(音量控制).connect(音效總輸出);
  雜音.start(開始時間, Math.random() * 0.9, 長度秒數 + 0.01);
}

// 泛音表格式：[頻率, 相對音量, 餘音秒數]
// 木頭桌面被敲到時的泛音：木頭吸震，餘音都很短
const 木桌泛音表 = [[420, 0.45, 0.035], [880, 0.8, 0.045], [1750, 0.6, 0.035], [3100, 0.35, 0.025]];
// 骰子本身被撞到時的泛音：骰子小而硬，音高高、餘音極短，聽起來清脆
const 骰子泛音表 = [[4300, 1, 0.02], [6900, 0.6, 0.014], [9800, 0.3, 0.01]];

/** 依泛音表發出一下敲擊聲，頻率每次微幅偏移，避免每一下聽起來一模一樣 */
function 安排泛音(環境, 開始時間, 力道, 泛音表, 音量倍率) {
  泛音表.forEach(([頻率, 相對音量, 餘音秒數]) => {
    const 泛音 = 環境.createOscillator();
    泛音.frequency.value = 頻率 * (1 + (Math.random() - 0.5) * 0.06);
    const 音量控制 = 環境.createGain();
    音量控制.gain.setValueAtTime(0.0001, 開始時間);
    音量控制.gain.exponentialRampToValueAtTime(力道 * 相對音量 * 音量倍率, 開始時間 + 0.001);
    音量控制.gain.exponentialRampToValueAtTime(0.0001, 開始時間 + 餘音秒數 * (0.6 + 力道 * 0.6));
    泛音.connect(音量控制).connect(音效總輸出);
    泛音.start(開始時間);
    泛音.stop(開始時間 + 餘音秒數 * 1.2 + 0.02);
  });
}

/** 骰子撞一下桌面：骰角碰桌的清脆喀聲與骰子本身的高音，加上木頭桌面的叩聲 */
function 安排骰子撞擊(環境, 開始時間, 力道) {
  安排雜音(環境, 開始時間, 0.006, 'highpass', 4500, 0.7, 力道 * 0.6);
  安排泛音(環境, 開始時間, 力道, 骰子泛音表, 0.18);
  安排雜音(環境, 開始時間, 0.025, 'bandpass', 1800, 1.4, 力道 * 0.25);
  安排泛音(環境, 開始時間, 力道, 木桌泛音表, 0.22);
}

/** 一顆骰子在 [開始秒數, 結束秒數] 內的撞擊時間與力道：
    先大力彈跳幾下、間隔越來越短，接著在桌面翻滾輕碰，最後骰子在稜角上晃動、越晃越快直到停下 */
function 排出一顆骰子的撞擊(開始秒數, 結束秒數) {
  const 撞擊清單 = [];
  const 晃動間隔 = [0.045, 0.03, 0.021, 0.015, 0.011];
  const 晃動開始 = 結束秒數 - 晃動間隔.reduce((總和, 間隔) => 總和 + 間隔, 0);
  let 時間 = 開始秒數;
  let 間隔 = 0.17;
  let 力道 = 1;
  // 彈跳
  while (力道 > 0.25 && 時間 < 晃動開始) {
    撞擊清單.push([時間, 力道 * (0.85 + Math.random() * 0.15)]);
    時間 += 間隔 * (0.9 + Math.random() * 0.2);
    間隔 *= 0.65;
    力道 *= 0.62;
  }
  // 翻滾
  while (時間 < 晃動開始 - 0.04) {
    撞擊清單.push([時間, 0.12 + Math.random() * 0.1]);
    時間 += 0.04 + Math.random() * 0.05;
  }
  // 晃動到停下
  時間 = 晃動開始;
  晃動間隔.forEach((晃動間隔秒數, 序) => {
    撞擊清單.push([時間, 0.13 * (1 - 序 / 晃動間隔.length) + 0.02]);
    時間 += 晃動間隔秒數;
  });
  return 撞擊清單;
}

/** 木頭桌上擲骰聲：兩顆骰子前後落桌，各自彈跳、翻滾、晃動到停下；翻滾秒數為 0 時只播停下前的晃動 */
function 播放擲骰聲(翻滾秒數) {
  const 環境 = 取得音效環境();
  if (!環境) return;
  const 起點 = 環境.currentTime + 0.01;
  [0, 1].forEach((骰子序) => {
    // 晃動本身約 0.12 秒，結束時間至少要留這麼長，撞擊才不會排到現在之前
    const 結束秒數 = Math.max(翻滾秒數, 0.13) + 骰子序 * 0.05;
    const 開始秒數 = 翻滾秒數 > 0 ? 骰子序 * 0.04 : 結束秒數;
    排出一顆骰子的撞擊(開始秒數, 結束秒數).forEach(([時間, 力道]) => 安排骰子撞擊(環境, 起點 + 時間, 力道));
  });
}

// 立直喊聲是錄音檔，頁面載入時先抓好，按下立直才不會等下載
const 立直喊聲 = new Audio('sounds/riichi-voice.mp3?v=20261012-15');
立直喊聲.preload = 'auto';

/** 喊「リーチ」；連按時從頭重播 */
function 播放立直喊聲() {
  立直喊聲.currentTime = 0;
  // 瀏覽器擋下播放（例如沒有使用者操作）時不影響立直本身
  立直喊聲.play().catch(() => {});
}

/* ---------- 位置模式：擲骰 ---------- */
// 骰子各點數的點落在三乘三格子的哪幾格（由左上往右下編號 0 到 8）
const 骰子點位置表 = {
  1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8],
};

function 擲一顆骰子() {
  return Math.floor(Math.random() * 6) + 1;
}

function 畫骰子面(骰子面, 點數) {
  const 點位置 = 骰子點位置表[點數];
  骰子面.replaceChildren(...Array.from({ length: 9 }, (_, 格子序) => {
    const 格子 = document.createElement('span');
    if (點位置.includes(格子序)) 格子.className = 點數 === 1 ? '骰子點 紅色大點' : '骰子點';
    return 格子;
  }));
  骰子面.setAttribute('aria-label', `${點數}點`);
}

/** 骰子加總從莊家開始逆時針數，莊家算一：1、5、9 莊家，2、6、10 下家，3、7、11 對家，4、8、12 上家 */
function 開門座位序(莊家座位序, 加總) {
  return (莊家座位序 + 加總 - 1) % 4;
}

// 擲骰結果停留這麼久後自動收起
const 骰子結果停留毫秒數 = 3000;

/** 擲骰鈕：結果層蓋在場風字上播放兩顆骰子翻滾，停下後顯示加總，開門座位的長方形閃兩下；
    點結果層或停留三秒後收起，加總留在擲骰鈕上，換局或重置時清掉 */
function 綁定擲骰(取得目前局況) {
  const 骰子鈕 = document.getElementById('骰子鈕');
  const 結果層 = document.getElementById('骰子結果層');
  const 骰子面清單 = [document.getElementById('第一顆骰子'), document.getElementById('第二顆骰子')];
  const 加總 = document.getElementById('骰子加總');
  const 擲骰鈕加總 = document.getElementById('擲骰鈕加總');
  let 擲骰中 = false;
  let 自動收起計時 = null;
  const 收起結果 = () => {
    clearTimeout(自動收起計時);
    自動收起計時 = null;
    結果層.hidden = true;
  };

  骰子鈕.addEventListener('click', async () => {
    clearTimeout(自動收起計時);
    擲骰中 = true;
    骰子鈕.disabled = true;
    加總.textContent = '';
    結果層.hidden = false;
    const 減少動態 = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    播放擲骰聲(減少動態 ? 0 : 0.9);
    if (!減少動態) {
      // 翻滾期間每隔一小段時間換一次點數，同時晃動骰子
      骰子面清單.forEach((骰子面) => 骰子面.animate(
        [
          { transform: 'rotate(0deg) translateY(0)' },
          { transform: 'rotate(-25deg) translateY(-8%)' },
          { transform: 'rotate(20deg) translateY(4%)' },
          { transform: 'rotate(-10deg) translateY(-3%)' },
          { transform: 'rotate(0deg) translateY(0)' },
        ],
        { duration: 900, easing: 'ease-out' },
      ));
      const 翻滾結束時間 = performance.now() + 900;
      while (performance.now() < 翻滾結束時間) {
        骰子面清單.forEach((骰子面) => 畫骰子面(骰子面, 擲一顆骰子()));
        await new Promise((完成) => setTimeout(完成, 90));
      }
    }
    const 點數清單 = 骰子面清單.map(() => 擲一顆骰子());
    骰子面清單.forEach((骰子面, 序) => 畫骰子面(骰子面, 點數清單[序]));
    const 點數加總 = 點數清單[0] + 點數清單[1];
    加總.textContent = String(點數加總);
    擲骰鈕加總.textContent = String(點數加總);
    骰子鈕.classList.add('已擲骰');
    骰子鈕.setAttribute('aria-label', `擲骰子（上次加總${點數加總}）`);

    const 座位 = 座位清單[開門座位序(取得目前局況().局序 % 4, 點數加總)];
    const 開門長方形 = document.querySelector(`.桌邊長方形[data-座位="${座位}"]`);
    const 閃爍色 = 'rgba(176, 58, 46, .28)';
    const 底色 = getComputedStyle(開門長方形).backgroundColor;
    if (減少動態) {
      // 不播閃爍，改成短暫標色
      開門長方形.animate([{ backgroundColor: 閃爍色 }, { backgroundColor: 閃爍色 }], { duration: 1200 });
    } else {
      開門長方形.animate(
        [底色, 閃爍色, 底色, 閃爍色, 底色].map((顏色) => ({ backgroundColor: 顏色 })),
        { duration: 1200 },
      );
    }
    擲骰中 = false;
    骰子鈕.disabled = false;
    自動收起計時 = setTimeout(收起結果, 骰子結果停留毫秒數);
  });

  結果層.addEventListener('click', () => {
    if (擲骰中) return;
    收起結果();
  });

  document.addEventListener('換了一局', () => {
    擲骰鈕加總.textContent = '';
    骰子鈕.classList.remove('已擲骰');
    骰子鈕.setAttribute('aria-label', '擲骰子');
  });
}

/* ---------- 位置模式：立直 ---------- */
const 立直座位儲存鍵 = '日麻計算.立直座位';

function 讀取上次立直座位() {
  try {
    const 存檔 = JSON.parse(localStorage.getItem(立直座位儲存鍵));
    if (Array.isArray(存檔)) return new Set(存檔.filter((座位) => 座位清單.includes(座位)));
  } catch {
    // 讀不到就當作沒人立直
  }
  return new Set();
}

function 記住立直座位(立直座位) {
  try {
    localStorage.setItem(立直座位儲存鍵, JSON.stringify([...立直座位]));
  } catch {
    // 存不了只影響重整後立直棒還在不在
  }
}

/** 立直鈕：點一下該座位立直，自風字與桌面中央之間出現立直棒；長按取消。
    立直跟著座位（人），換莊、連莊、重置、計算結果確認後全部取消；按立直當下不扣點數，計算結果確認時才結算立直棒 */
// 長按取消立直後，這段時間內點立直鈕不會再立直
const 取消立直後不能再立直毫秒數 = 1000;

function 綁定立直() {
  const 立直座位 = 讀取上次立直座位();
  const 渲染立直 = () => {
    座位清單.forEach((座位) => {
      const 自風位 = document.querySelector(`.自風位[data-座位="${座位}"]`);
      const 已立直 = 立直座位.has(座位);
      自風位.querySelector('.立直棒').hidden = !已立直;
      const 立直鈕 = 自風位.querySelector('.立直鈕');
      立直鈕.setAttribute('aria-pressed', String(已立直));
      立直鈕.title = 已立直 ? '立直中（長按取消）' : '立直';
    });
  };
  const 更新立直 = (動作) => {
    動作();
    記住立直座位(立直座位);
    渲染立直();
  };

  // 各座位上次長按取消立直的時間，取消後一段時間內點一下不再立直，避免放開手指時誤觸
  const 取消立直時間 = new Map();
  座位清單.forEach((座位) => {
    綁定點擊與長按(
      document.querySelector(`.自風位[data-座位="${座位}"] .立直鈕`),
      () => {
        if (performance.now() - (取消立直時間.get(座位) ?? -Infinity) < 取消立直後不能再立直毫秒數) return;
        // 已經立直的座位再點一下不重喊
        if (!立直座位.has(座位)) 播放立直喊聲();
        更新立直(() => 立直座位.add(座位));
      },
      () => {
        取消立直時間.set(座位, performance.now());
        更新立直(() => 立直座位.delete(座位));
      },
    );
  });
  ['換了一局', '連莊數改變', '點數已結算'].forEach((事件名稱) => {
    document.addEventListener(事件名稱, () => 更新立直(() => 立直座位.clear()));
  });
  渲染立直();
}

/** 供託：桌面中央顯示重整前留下的供託；右上的重置把四家點數回到起始點數，供託一起歸零 */
function 綁定供託() {
  渲染供託();
  document.getElementById('局數重置鈕').addEventListener('click', () => 記住供託點數(0));
}

function 初始化畫面() {
  const 場風選單 = document.getElementById('場風選單');
  場風選單.addEventListener('change', () => {
    畫面狀態.場風牌 = Number(場風選單.value);
    重新渲染全部();
  });

  const 自風選單 = document.getElementById('自風選單');
  自風選單.addEventListener('change', () => {
    畫面狀態.自風牌 = 自風選單.value === '' ? null : Number(自風選單.value);
    依桌面立直勾選和牌者立直();
    重新渲染全部();
  });

  const 放銃者選單 = document.getElementById('放銃者選單');
  放銃者選單.addEventListener('change', () => {
    畫面狀態.放銃者風牌 = 放銃者選單.value === '' ? null : Number(放銃者選單.value);
    重新渲染全部();
  });

  const 連莊數選單 = document.getElementById('連莊數選單');
  連莊數選單.addEventListener('change', () => {
    畫面狀態.連莊數 = Number(連莊數選單.value);
    重新渲染全部();
  });

  document.getElementById('清空鈕').addEventListener('click', () => {
    清空輸入的牌();
    重新渲染全部();
  });

  綁定區塊選取();
  綁定結果視窗();
  // 計算側邊欄打開時要讀位置模式的局況，所以先綁定換莊
  const 取得目前局況 = 綁定換莊();
  const 收合側邊欄 = 綁定側邊欄(取得目前局況);
  綁定擲骰(取得目前局況);
  綁定立直();
  綁定供託();
  綁定點數(收合側邊欄);

  重新渲染全部();
}

document.addEventListener('DOMContentLoaded', 初始化畫面);
