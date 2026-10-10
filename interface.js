/*
 * 畫面互動：組手牌、設定和牌狀況，並即時呼叫計算引擎顯示結果。
 */

const 花色名稱表 = ['萬', '筒', '索'];
const 字牌顯示表 = { 27: '東', 28: '南', 29: '西', 30: '北', 31: '白', 32: '發', 33: '中' };

/* 右邊三個框就是加入目標：點哪一框，接下來點的牌就加到那裡 */
const 加入目標說明表 = {
  手牌: '目前要加到手牌。最後加入的一張會自動當成和牌張。',
  吃: '目前要吃。點順子裡最小的那張牌，例如點三筒就是吃成三四五筒。',
  碰: '目前要碰。點要碰的那張牌，組成明刻。',
  明槓: '目前要明槓。大明槓與加槓都算明槓。',
  暗槓: '目前要暗槓。暗槓不破壞門前，立直後仍可保有門前役。',
  寶牌: '目前要加到寶牌。直接點寶牌本身，有幾張就點幾張，每張各算一番。'
};

const 副露種類清單 = ['吃', '碰', '明槓', '暗槓'];

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
  for (const 區塊編號 of ['寶牌區塊', '手牌區塊', '副露區塊']) {
    const 區塊 = document.getElementById(區塊編號);
    區塊.addEventListener('click', () => {
      const 目標 = 區塊.dataset['加入目標'];
      畫面狀態.加入目標 = 目標 === '副露' ? 畫面狀態.副露種類 : 目標;
      重新渲染全部();
    });
  }
}

/** 牌庫整片不能點時，說清楚是為什麼 */
function 取得牌庫停用原因() {
  const 目標 = 畫面狀態.加入目標;
  const 應有手牌張數 = 14 - 畫面狀態.副露清單.length * 3;
  if (目標 === '手牌' && 畫面狀態.手牌.length >= 應有手牌張數) {
    return `　目前手牌已經是 ${應有手牌張數} 張，要換牌請先點手牌右上角的 × 移除。`;
  }
  if (副露種類清單.includes(目標) && 畫面狀態.副露清單.length >= 4) {
    return '　副露已經四組，不能再加。';
  }
  if (目標 === '寶牌' && 畫面狀態.寶牌清單.length >= 5) return '　已經五張，連同槓寶牌最多就是這些。';
  return '';
}

/** 從十四張倒數還缺幾張。一組副露算三張，所以起點恆為十四 */
function 渲染剩餘張數() {
  const 已決定張數 = 畫面狀態.手牌.length + 畫面狀態.副露清單.length * 3;
  const 還要張數 = 14 - 已決定張數;
  const 容器 = document.getElementById('剩餘張數顯示');
  容器.textContent = '';
  if (還要張數 <= 0) {
    容器.className = '剩餘張數 已湊齊';
    容器.textContent = '十四張已湊齊';
    return;
  }
  容器.className = '剩餘張數';
  const 前綴 = document.createElement('span');
  前綴.textContent = '還要';
  const 張數元素 = document.createElement('span');
  張數元素.className = '張數';
  張數元素.textContent = 還要張數;
  const 後綴 = document.createElement('span');
  後綴.textContent = '張';
  容器.appendChild(前綴);
  容器.appendChild(張數元素);
  容器.appendChild(後綴);
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
    if (牌.是和牌張) 牌元素.classList.add('和牌張');
    牌元素.title = 計算引擎.牌名稱表[牌.牌編號] + '：點一下設為和牌張';
    牌元素.addEventListener('click', (事件) => { 事件.stopPropagation(); 指定和牌張(索引); });
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
      ? `寶牌 ${計算引擎.牌名稱表[牌編號]}，填了 ${重複次數} 次，手牌裡每張算 ${重複次數} 番`
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
    + 畫面狀態.副露清單.filter((副露) => 副露.含赤寶牌).length;
  return {
    手牌: 畫面狀態.手牌.map((牌) => 牌.牌編號),
    副露清單: 畫面狀態.副露清單.map((副露) => ({ 種類: 副露.種類, 起始牌: 副露.起始牌 })),
    和牌張: 取得和牌張編號(),
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
  const 應有手牌張數 = 14 - 畫面狀態.副露清單.length * 3;
  const 還要張數 = 應有手牌張數 - 畫面狀態.手牌.length;
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
  渲染寶牌();
  渲染寶牌說明();
  渲染和牌狀況();
  渲染計算鈕();
}

function 全部重設() {
  畫面狀態.場風牌 = 計算引擎.東風編號;
  畫面狀態.自風牌 = 計算引擎.南風編號;
  畫面狀態.是自摸 = false;
  畫面狀態.連莊數 = 0;
  document.getElementById('連莊數輸入').value = '0';
  document.getElementById('場風選單').value = String(計算引擎.東風編號);
  document.getElementById('自風選單').value = String(計算引擎.南風編號);
  document.getElementById('和牌方式選單').value = '榮和';
  畫面狀態.手牌 = [];
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

  const 和牌方式選單 = document.getElementById('和牌方式選單');
  和牌方式選單.addEventListener('change', () => {
    畫面狀態.是自摸 = 和牌方式選單.value === '自摸';
    重新渲染全部();
  });

  const 連莊數輸入 = document.getElementById('連莊數輸入');
  連莊數輸入.addEventListener('input', () => {
    const 輸入值 = Math.floor(Number(連莊數輸入.value));
    畫面狀態.連莊數 = Number.isFinite(輸入值) && 輸入值 > 0 ? Math.min(輸入值, 99) : 0;
    重新渲染全部();
  });
  // 離開欄位時把負數、小數、空白這些寫不出來的值收斂成實際採用的數字
  連莊數輸入.addEventListener('change', () => {
    連莊數輸入.value = String(畫面狀態.連莊數);
  });

  document.getElementById('全部重設鈕').addEventListener('click', () => {
    全部重設();
    重新渲染全部();
  });

  綁定區塊選取();
  綁定規則說明視窗();
  綁定結果視窗();

  重新渲染全部();
}

document.addEventListener('DOMContentLoaded', 初始化畫面);
