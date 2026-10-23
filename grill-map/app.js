/* 拷问导图 GrillMap —— 应用逻辑：状态、存储、API、界面。纯 vanilla JS。 */
'use strict';

/* ================= 工具 ================= */
const $ = (s, p) => (p || document).querySelector(s);
const $$ = (s, p) => Array.from((p || document).querySelectorAll(s));
const uid = () => 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
function relTime(ts) {
  const d = Date.now() - ts;
  if (d < 60000) return '刚刚';
  if (d < 3600000) return Math.floor(d / 60000) + ' 分钟前';
  if (d < 86400000) return Math.floor(d / 3600000) + ' 小时前';
  return new Date(ts).toLocaleDateString('zh-CN');
}
function countNodes(n) { return 1 + (n.children || []).reduce((s, c) => s + countNodes(c), 0); }
function findChain(root, id) {
  if (root.id === id) return [root];
  for (const c of root.children || []) { const ch = findChain(c, id); if (ch) return [root, ...ch]; }
  return null;
}
function removeNode(root, id) {
  for (const n of root.children || []) {
    const i = n.children ? n.children.findIndex((c) => c.id === id) : -1;
    if (i >= 0) { n.children.splice(i, 1); return true; }
    if (removeNode(n, id)) return true;
  }
  return false;
}

/* ================= 存储 ================= */
const LS_SETTINGS = 'grillmap.settings';
const LS_MAPS = 'grillmap.maps';
const PRESETS = {
  zhipu: { label: '智谱 GLM · 需反代', base: 'https://open.bigmodel.cn/api/paas/v4', models: ['glm-5.3', 'glm-4.7', 'glm-4.6', 'glm-4.5-flash'], proxy: true },
  zai: { label: '智谱国际 z.ai · 需反代', base: 'https://api.z.ai/api/paas/v4', models: ['glm-4.6', 'glm-4.5-air'], proxy: true },
  deepseek: { label: 'DeepSeek · 可直连', base: 'https://api.deepseek.com', models: ['deepseek-chat', 'deepseek-reasoner'] },
  openai: { label: 'OpenAI', base: 'https://api.openai.com/v1', models: ['gpt-4o-mini', 'gpt-4o'] },
  ollama: { label: '本地 Ollama', base: 'http://localhost:11434/v1', models: ['qwen3', 'llama3.1', 'deepseek-r1'] },
};
const PROXY_HOSTS = ['open.bigmodel.cn', 'api.z.ai'];

function loadSettings() {
  try { return Object.assign({ base: PRESETS.zhipu.base, key: '', model: 'glm-4.7' }, JSON.parse(localStorage.getItem(LS_SETTINGS) || '{}')); }
  catch { return { base: PRESETS.zhipu.base, key: '', model: 'glm-4.7' }; }
}
function saveSettings(s) { localStorage.setItem(LS_SETTINGS, JSON.stringify(s)); }
function loadMaps() {
  try { return JSON.parse(localStorage.getItem(LS_MAPS) || '{}'); } catch { return {}; }
}
const persistMaps = debounce(() => localStorage.setItem(LS_MAPS, JSON.stringify(maps)), 400);
function touch(map) { map.updatedAt = Date.now(); persistMaps(); }

let settings = loadSettings();
let maps = loadMaps();
// 内置示例各播种一次（标记进 localStorage：用户删除后不再复活）
['demo-harness', 'demo-audit'].forEach((id) => {
  const flag = 'grillmap.seeded.' + id;
  if (localStorage.getItem(flag)) {
    // 范例图内容升级：未编辑过的旧版静默替换（编辑过的保留用户版本）
    if (id === 'demo-audit' && maps['demo-audit'] && maps['demo-audit'].v !== 4 && maps['demo-audit'].updatedAt === maps['demo-audit'].createdAt) {
      maps['demo-audit'] = demoAuditMap();
      localStorage.setItem(LS_MAPS, JSON.stringify(maps));
    }
    return;
  }
  const d = id === 'demo-audit' ? demoAuditMap() : demoMap();
  if (!maps[d.id]) {
    maps[d.id] = d;
    localStorage.setItem(LS_MAPS, JSON.stringify(maps));
  }
  localStorage.setItem(flag, '1');
});

/* ================= Toast ================= */
function toast(msg, type = 'info', ms = 4200) {
  const box = $('#toasts');
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.innerHTML = esc(msg) + '<button class="tclose">×</button>';
  t.querySelector('.tclose').onclick = () => t.remove();
  box.appendChild(t);
  if (ms) setTimeout(() => t.remove(), ms);
  return t;
}

/* ================= API ================= */
function chat(messages, { maxTokens = 6000, temperature = 0.4 } = {}) {
  const base = (settings.base || '').replace(/\/+$/, '');
  if (!base) return Promise.reject(new Error('未配置 API 地址（设置里选一个服务商）'));
  if (!settings.key && !base.includes('localhost')) return Promise.reject(new Error('未配置 API Key'));
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 180000);
  appState.abort = ctrl;
  return fetch(base + '/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + settings.key },
    body: JSON.stringify({ model: settings.model, messages, temperature, max_tokens: maxTokens, stream: false }),
    signal: ctrl.signal,
  }).then(async (res) => {
    let body = null;
    try { body = await res.json(); } catch { /* ignore */ }
    if (!res.ok) {
      const m = (body && body.error && (body.error.message || body.error.code)) || (body && body.msg) || '';
      if (res.status === 401) throw new Error('API Key 无效或未授权（401）' + (m ? '：' + m : ''));
      if (res.status === 429) throw new Error('请求太频繁或额度不足（429）' + (m ? '：' + m : ''));
      throw new Error(`接口返回 ${res.status}${m ? '：' + m : ''}`);
    }
    const msg = body && body.choices && body.choices[0] && body.choices[0].message;
    const text = (msg && (msg.content || msg.reasoning_content)) || '';
    if (!text.trim()) throw new Error('模型返回了空内容' + (msg && msg.finish_reason === 'length' ? '（输出被 max_tokens 截断，可在设置里换模型或重试）' : ''));
    return text;
  }).catch((e) => {
    if (e.name === 'AbortError') throw new Error('请求超时或被取消');
    if (e instanceof TypeError) {
      if (PROXY_HOSTS.some((h) => base.includes(h))) throw new Error('智谱官方接口（bigmodel.cn / z.ai）未开放浏览器跨域直连：请把 API 地址换成你的反代地址（README 有 10 行 Cloudflare Worker 配方），或改用 DeepSeek Key 直连，或本地跑 Ollama');
      throw new Error('连不上 API：网络不通或浏览器跨域（CORS）被拦。自建反代需允许跨域；本地 Ollama 需设置 OLLAMA_ORIGINS=*');
    }
    throw e;
  }).finally(() => { clearTimeout(timer); appState.abort = null; });
}

function extractJSON(text) {
  let t = String(text).replace(/<think>[\s\S]*?<\/think>/gi, '');
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) t = fence[1];
  for (let i = t.indexOf('{'); i !== -1; i = t.indexOf('{', i + 1)) {
    let depth = 0, inStr = false, escp = false;
    for (let j = i; j < t.length; j++) {
      const c = t[j];
      if (inStr) { if (escp) escp = false; else if (c === '\\') escp = true; else if (c === '"') inStr = false; continue; }
      if (c === '"') inStr = true;
      else if (c === '{') depth++;
      else if (c === '}') { depth--; if (!depth) return JSON.parse(t.slice(i, j + 1)); }
    }
  }
  throw new Error('AI 没有返回合法 JSON，请重试（可换个模型）');
}

function sanitizeChildren(arr, depthLeft = 2, budget = { n: 0 }) {
  return (Array.isArray(arr) ? arr : [])
    .filter((x) => x && typeof x.title === 'string' && x.title.trim())
    .slice(0, 10)
    .map((x) => {
      budget.n++;
      return {
        id: uid(),
        title: x.title.trim().slice(0, 40),
        demand: String(x.demand || '').trim().slice(0, 90),
        note: String(x.note || '').trim().slice(0, 600),
        children: depthLeft > 0 && budget.n < 48 ? sanitizeChildren(x.children, depthLeft - 1, budget) : [],
      };
    });
}

/* ================= 应用状态与视图 ================= */
const appState = { view: 'home', mapId: null, selectedId: null, busy: false, abort: null };
let view = null; // MapView 实例

function currentMap() { return maps[appState.mapId] || null; }
function switchView(name) {
  appState.view = name;
  $('#view-home').classList.toggle('hidden', name !== 'home');
  $('#view-editor').classList.toggle('hidden', name !== 'editor');
}

/* ---------- 首页 ---------- */
function renderHome() {
  const list = Object.values(maps).sort((a, b) => b.updatedAt - a.updatedAt);
  const noKey = !settings.key;
  $('#keyBanner').classList.toggle('hidden', !noKey);
  const wrap = $('#mapList');
  wrap.innerHTML = list.length ? '' : '<p class="empty">还没有导图——输入一个主题试试。</p>';
  for (const m of list) {
    const card = document.createElement('div');
    card.className = 'map-card';
    card.innerHTML = `
      <div class="mc-main">
        <div class="mc-title">${esc(m.topic)}${m.demo ? ` <span class="badge demo">${esc(m.demoLabel || '示例')}</span>` : ''}</div>
        <div class="mc-meta">${typeLabel(m.type)} · ${countNodes(m.tree)} 节点 · ${relTime(m.updatedAt)}</div>
      </div>
      <div class="mc-actions">
        <button data-a="open" class="btn primary sm">打开</button>
        <button data-a="md" class="btn sm">MD</button>
        <button data-a="json" class="btn sm">JSON</button>
        <button data-a="rename" class="btn sm">重命名</button>
        <button data-a="del" class="btn sm danger">删除</button>
      </div>`;
    card.addEventListener('click', (e) => {
      const a = e.target.getAttribute('data-a');
      if (!a) return;
      if (a === 'open') openMap(m.id);
      else if (a === 'md') downloadFile(m.topic + '-拷问导图.md', toMarkdown(m), 'text/markdown');
      else if (a === 'json') downloadFile(m.topic + '-拷问导图.json', JSON.stringify(m, null, 2), 'application/json');
      else if (a === 'rename') {
        const t = prompt('新名字：', m.topic);
        if (t && t.trim()) { m.topic = t.trim(); m.tree.title = m.topic; touch(m); renderHome(); }
      } else if (a === 'del') {
        if (confirm(`删除「${m.topic}」？不可恢复。`)) { delete maps[m.id]; persistMaps(); renderHome(); }
      }
    });
    wrap.appendChild(card);
  }
}

function startGeneration() {
  const topic = $('#topicInput').value.trim();
  if (!topic) { toast('先输入一个主题', 'error'); $('#topicInput').focus(); return; }
  if (!settings.key) { openSettings(); toast('先配置 API Key（存在本浏览器里）', 'error'); return; }
  const audience = $('input[name=aud]:checked').value;
  const goal = $('#goalInput').value.trim();
  const aLabel = (AUDIENCES.find((x) => x.id === audience) || AUDIENCES[0]).label;

  const map = {
    id: uid(), topic, type: 'generic', audience, goal,
    tree: { id: uid(), title: topic, demand: '', note: '正在拷问这个主题…', children: [] },
    createdAt: Date.now(), updatedAt: Date.now(),
  };
  maps[map.id] = map;
  openMap(map.id);
  setBusy(true, map.tree.id);
  chat([
    { role: 'system', content: buildGenerateSystemPrompt(aLabel) },
    { role: 'user', content: buildGenerateUserMessage(topic, aLabel, goal) },
  ]).then((txt) => {
    const data = extractJSON(txt);
    const tree = sanitizeTree(data, topic);
    map.type = ['system', 'route', 'generic'].includes(data.type) ? data.type : 'generic';
    map.tree = tree;
    touch(map);
    setBusy(false);
    view.render(tree, { fit: true });
    renderEditorMeta();
    toast('拷问完成：' + countNodes(tree) + ' 个节点', 'success');
  }).catch((e) => {
    map.tree.note = '生成失败：' + e.message + '。可点本节点「追问」重试，或回首页重新生成。';
    setBusy(false);
    view.render(map.tree);
    renderEditorMeta();
    toast(e.message, 'error', 8000);
  });
}

function sanitizeTree(data, topic) {
  const t = data && data.tree && typeof data.tree.title === 'string' ? data.tree : { title: topic, note: '' };
  return {
    id: uid(),
    title: t.title.trim().slice(0, 40),
    demand: '',
    note: String(t.note || '').trim().slice(0, 600),
    children: sanitizeChildren(t.children, 3),
  };
}

/* ---------- 编辑器 ---------- */
function openMap(id) {
  appState.mapId = id;
  appState.selectedId = null;
  hidePopover();
  if (appState.abort) { try { appState.abort.abort(); } catch { } }
  switchView('editor');
  if (!view) view = MapView($('#canvas'), { onSelect: onNodeSelect, onToggle: onNodeToggle });
  view.render(currentMap().tree, { fit: true });
  renderEditorMeta();
  $('#mapTitle').value = currentMap().topic;
}

function renderEditorMeta() {
  const m = currentMap();
  if (!m) return;
  $('#mapTypeBadge').textContent = typeLabel(m.type);
  $('#mapMeta').textContent = countNodes(m.tree) + ' 节点 · 更新于 ' + relTime(m.updatedAt);
}

function onNodeToggle(id) {
  const chain = findChain(currentMap().tree, id);
  if (!chain) return;
  const n = chain[chain.length - 1];
  n.collapsed = !n.collapsed;
  touch(currentMap());
  view.render(currentMap().tree);
}

let _busyNode = null;
function setBusy(busy, nodeId) {
  if (nodeId) _busyNode = nodeId;
  const id = nodeId || (busy ? null : _busyNode);
  appState.busy = busy;
  if (id && view) view.setLoading(id, busy);
  $('#genStatus').classList.toggle('hidden', !busy);
}

/* ---------- 节点弹层 ---------- */
function onNodeSelect(id) {
  if (appState.busy) return;
  appState.selectedId = id;
  view.setSelected(id);
  showPopover(id);
}

function popoverEl() { return $('#popover'); }

function showPopover(id, mode = 'main') {
  const map = currentMap();
  const chain = findChain(map.tree, id);
  if (!chain) return;
  const node = chain[chain.length - 1];
  const pop = popoverEl();
  pop.dataset.nodeId = id;
  pop.dataset.mode = mode;

  const kind = node === map.tree ? '主题' : node.demand ? '步骤 · 需求句' : (node._depthLabel || '概念');
  let html = `
    <div class="pop-head">
      <div>
        <span class="pop-kind">${kind}${chain.length > 2 ? ' · 第 ' + (chain.length - 1) + ' 层' : ''}</span>
        <h4>${esc(node.title)}</h4>
      </div>
      <button class="pop-close">×</button>
    </div>
    ${node.demand ? `<div class="pop-demand">${esc(node.demand)}</div>` : ''}
    ${node.note ? `<p class="pop-note">${esc(node.note)}</p>` : ''}
    <div class="pop-actions">
      <button data-m="ask" class="btn sm ${mode === 'ask' ? 'primary' : ''}">🔍 追问拷问</button>
      <button data-m="edit" class="btn sm ${mode === 'edit' ? 'primary' : ''}">✏️ 编辑</button>
      <button data-m="add" class="btn sm ${mode === 'add' ? 'primary' : ''}">＋ 手动加</button>
      ${node === map.tree ? '' : '<button data-m="del" class="btn sm danger">🗑 删除</button>'}
    </div>
    <div class="pop-body"></div>`;
  pop.innerHTML = html;
  $('.pop-close', pop).onclick = hidePopover;
  $$('.pop-actions [data-m]', pop).forEach((b) => { b.onclick = () => showPopover(id, b.getAttribute('data-m')); });

  const body = $('.pop-body', pop);
  if (mode === 'ask') renderAskForm(body, map, chain, node);
  else if (mode === 'edit') renderEditForm(body, node);
  else if (mode === 'add') renderAddForm(body, node);
  else if (mode === 'del') renderDelConfirm(body, id);

  positionPopover(id);
  pop.classList.remove('hidden');
}

function positionPopover(id) {
  const pop = popoverEl();
  const pos = view.screenPosOf(id);
  const wrap = $('#canvasWrap');
  if (!pos) return;
  const pr = pop.getBoundingClientRect();
  const cw = wrap.clientWidth, chh = wrap.clientHeight;
  let left = pos.right + 14;
  if (left + pr.width > cw - 8) left = Math.max(8, pos.left - pr.width - 14);
  let top = Math.min(Math.max(8, pos.top - 6), chh - pr.height - 8);
  pop.style.left = left + 'px';
  pop.style.top = Math.max(8, top) + 'px';
}

function hidePopover() {
  const pop = popoverEl();
  pop.classList.add('hidden');
  pop.dataset.nodeId = '';
  if (appState.selectedId) { appState.selectedId = null; view && view.setSelected(null); }
}

function renderAskForm(body, map, chain, node) {
  const done = node.children && node.children.length;
  body.innerHTML = `
    <div class="chips">${QUICK_QUESTIONS.map((q) => `<button class="chip" type="button">${esc(q)}</button>`).join('')}</div>
    <textarea id="askInput" rows="2" placeholder="要拷问它什么？（留空 = AI 自己挑最该追问的方向）"></textarea>
    ${done ? `<label class="checkline"><input type="checkbox" id="askReplace"> 替换现有 ${done} 个子节点（默认追加）</label>` : ''}
    <button id="askGo" class="btn primary block">开始拷问</button>`;
  const input = $('#askInput', body);
  $$('.chip', body).forEach((c) => { c.onclick = () => { input.value = c.textContent; input.focus(); }; });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) $('#askGo', body).click(); });
  $('#askGo', body).onclick = () => runExpand(map, chain, node, input.value.trim(), $('#askReplace', body) ? $('#askReplace', body).checked : false);
}

function runExpand(map, chain, node, question, replace) {
  if (appState.busy) return;
  const body = $('.pop-body', popoverEl());
  body.innerHTML = `<div class="loading-line"><span class="spin"></span>AI 正在拷问${esc(question ? '「' + question.slice(0, 20) + '…' : '')}」…</div>`;
  $$('.pop-actions button', popoverEl()).forEach((b) => (b.disabled = true));
  setBusy(true, node.id);
  const { system, user } = buildExpandMessages(map, node, chain.map((n) => n.title), question);
  chat([{ role: 'system', content: system }, { role: 'user', content: user }], { maxTokens: 3000 })
    .then((txt) => {
      const kids = sanitizeChildren(extractJSON(txt).children, 2);
      if (!kids.length) throw new Error('AI 没有给出子节点，换个问法试试');
      if (replace) node.children = kids;
      else node.children = (node.children || []).concat(kids);
      node.collapsed = false;
      touch(map);
      setBusy(false);
      view.render(map.tree);
      view.focusNode(node.id);
      renderEditorMeta();
      showPopover(node.id, 'ask');
      const b2 = $('.pop-body', popoverEl());
      b2.insertAdjacentHTML('afterbegin', `<div class="ok-line">✅ ${replace ? '已替换为' : '已追加'} ${kids.length} 个子节点</div>`);
    })
    .catch((e) => {
      setBusy(false);
      if (currentMap() === map && popoverEl().dataset.nodeId === node.id) {
        showPopover(node.id, 'ask');
        $('.pop-body', popoverEl()).insertAdjacentHTML('afterbegin', `<div class="err-line">❌ ${esc(e.message)}</div>`);
        const inp = $('#askInput', popoverEl());
        if (inp && question) inp.value = question;
      }
      toast(e.message, 'error', 7000);
    });
}

function renderEditForm(body, node) {
  body.innerHTML = `
    <label>标题<textarea id="edTitle" rows="1">${esc(node.title)}</textarea></label>
    <label>需求句（仅步骤/主干节点，≤50字）<textarea id="edDemand" rows="2">${esc(node.demand)}</textarea></label>
    <label>说明（大白话，1-3句）<textarea id="edNote" rows="4">${esc(node.note)}</textarea></label>
    <button id="edSave" class="btn primary block">保存</button>`;
  $('#edSave', body).onclick = () => {
    const t = $('#edTitle', body).value.trim();
    if (!t) { toast('标题不能为空', 'error'); return; }
    node.title = t.slice(0, 40);
    node.demand = $('#edDemand', body).value.trim().slice(0, 90);
    node.note = $('#edNote', body).value.trim().slice(0, 600);
    touch(currentMap());
    view.render(currentMap().tree);
    showPopover(node.id);
    toast('已保存', 'success', 1800);
  };
}

function renderAddForm(body, node) {
  body.innerHTML = `
    <label>标题<textarea id="adTitle" rows="1" placeholder="新节点名"></textarea></label>
    <label>说明（可选）<textarea id="adNote" rows="2"></textarea></label>
    <button id="adGo" class="btn primary block">添加</button>`;
  $('#adGo', body).onclick = () => {
    const t = $('#adTitle', body).value.trim();
    if (!t) { toast('标题不能为空', 'error'); return; }
    const child = { id: uid(), title: t.slice(0, 40), demand: '', note: $('#adNote', body).value.trim().slice(0, 600), children: [] };
    node.children = (node.children || []).concat(child);
    node.collapsed = false;
    touch(currentMap());
    view.render(currentMap().tree);
    view.focusNode(node.id);
    showPopover(node.id);
  };
}

function renderDelConfirm(body, id) {
  const chain = findChain(currentMap().tree, id);
  const node = chain[chain.length - 1];
  const n = countNodes(node) - 1;
  body.innerHTML = `
    <p class="warn-line">删除「${esc(node.title)}」${n > 0 ? `及其 ${n} 个子孙节点` : ''}？不可恢复。</p>
    <div class="row2">
      <button id="delYes" class="btn danger block">确认删除</button>
      <button id="delNo" class="btn block">取消</button>
    </div>`;
  $('#delNo', body).onclick = () => showPopover(id);
  $('#delYes', body).onclick = () => {
    removeNode(currentMap().tree, id);
    touch(currentMap());
    hidePopover();
    view.render(currentMap().tree);
    renderEditorMeta();
  };
}

/* ---------- 导出 ---------- */
function downloadFile(name, content, mime) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type: mime + ';charset=utf-8' }));
  a.download = name.replace(/[\\/:*?"<>|]/g, '_');
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

function toMarkdown(map) {
  const out = [`# ${map.topic}`, '', `> ${typeLabel(map.type)} · 读者：${audienceLabelOf(map)}${map.goal ? ' · 目的：' + map.goal : ''} · 导出于 ${new Date().toLocaleString('zh-CN')}`, ''];
  (function walk(node, depth) {
    const kids = node.children || [];
    if (depth === 0) {
      if (node.note) out.push(`> ${node.note}`, '');
      kids.forEach((k) => walk(k, 1));
      return;
    }
    const self = `${node.demand ? `（${node.demand}）` : ''}${node.note ? ` — ${node.note}` : ''}`;
    if (depth === 1) {
      out.push(`## ${node.title}${node.demand ? `\n> **${node.demand}**` : ''}${node.note ? `\n\n${node.note}` : ''}`, '');
      kids.forEach((k) => walk(k, 2));
    } else {
      out.push(`${'  '.repeat(depth - 2)}- **${node.title}**${self}`);
      kids.forEach((k) => walk(k, depth + 1));
    }
  })(map.tree, 0);
  return out.join('\n') + '\n';
}

/* ---------- 设置 ---------- */
function openSettings() {
  $('#setBase').value = settings.base;
  $('#setKey').value = settings.key;
  $('#setModel').value = settings.model;
  $('#setModal').classList.remove('hidden');
  markPreset();
}
function markPreset() {
  const base = $('#setBase').value.replace(/\/+$/, '');
  $$('#presetRow .chip').forEach((c) => c.classList.toggle('on', c.dataset.base === base));
  const w = $('#corsWarn');
  w.classList.toggle('hidden', !PROXY_HOSTS.some((h) => base.includes(h)));
}
function applyPreset(p) {
  $('#setBase').value = p.base;
  const dl = $('#modelList');
  dl.innerHTML = p.models.map((m) => `<option value="${esc(m)}">`).join('');
  if (!p.models.includes($('#setModel').value)) $('#setModel').value = p.models[0];
  markPreset();
}
function saveSettingsFromModal() {
  settings = {
    base: $('#setBase').value.trim().replace(/\/+$/, ''),
    key: $('#setKey').value.trim(),
    model: $('#setModel').value.trim(),
  };
  saveSettings(settings);
  $('#setModal').classList.add('hidden');
  renderHome();
  toast('设置已保存（Key 只存在本浏览器）', 'success');
}

/* ---------- 初始化 ---------- */
function init() {
  // 首页
  $('#genBtn').addEventListener('click', startGeneration);
  $('#topicInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#genBtn').click(); });
  $('#keyBanner button').onclick = openSettings;

  // 编辑器顶栏
  $('#backHome').onclick = () => { if (appState.abort) try { appState.abort.abort(); } catch { } hidePopover(); renderHome(); switchView('home'); };
  $('#mapTitle').addEventListener('change', () => {
    const m = currentMap();
    if (m && $('#mapTitle').value.trim()) { m.topic = $('#mapTitle').value.trim(); m.tree.title = m.topic; touch(m); renderEditorMeta(); }
  });
  $('#expMd').onclick = () => currentMap() && downloadFile(currentMap().topic + '-拷问导图.md', toMarkdown(currentMap()), 'text/markdown');
  $('#expJson').onclick = () => currentMap() && downloadFile(currentMap().topic + '-拷问导图.json', JSON.stringify(currentMap(), null, 2), 'application/json');
  $('#expPng').onclick = () => {
    if (!currentMap()) return;
    toast('正在导出 PNG…', 'info', 2500);
    view.toPNG().then((url) => {
      const a = document.createElement('a');
      a.href = url; a.download = currentMap().topic.replace(/[\\/:*?"<>|]/g, '_') + '-拷问导图.png'; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 8000);
    }).catch((e) => toast('导出失败：' + e.message, 'error'));
  };
  $('#zoomIn').onclick = () => view && view.zoomIn();
  $('#zoomOut').onclick = () => view && view.zoomOut();
  $('#zoomFit').onclick = () => view && view.fit();
  $$('.js-help').forEach((b) => (b.onclick = () => $('#helpModal').classList.remove('hidden')));
  $$('.js-settings').forEach((b) => (b.onclick = openSettings));

  // 点击画布空白处关弹层
  $('#canvas').addEventListener('pointerdown', (e) => {
    if (e.target.closest('.mv-node')) return;
    hidePopover();
  });

  // 弹层跟随视图变化
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { hidePopover(); $$('.modal').forEach((m) => m.classList.add('hidden')); } });

  // 模态框通用关闭
  $$('.modal').forEach((m) => {
    m.addEventListener('click', (e) => {
      if (e.target === m || e.target.classList.contains('modal-close')) m.classList.add('hidden');
    });
  });

  // 设置
  $('#presetRow').innerHTML = Object.values(PRESETS).map((p) => `<button class="chip" type="button" data-base="${esc(p.base)}">${esc(p.label)}</button>`).join('');
  $$('#presetRow .chip').forEach((c) => { c.onclick = () => applyPreset(Object.values(PRESETS).find((p) => p.base === c.dataset.base)); });
  $('#setBase').addEventListener('input', markPreset);
  $('#setSave').onclick = saveSettingsFromModal;
  $('#setTest').onclick = () => {
    const backup = settings;
    settings = { base: $('#setBase').value.trim().replace(/\/+$/, ''), key: $('#setKey').value.trim(), model: $('#setModel').value.trim() };
    const t = toast('测试中…', 'info', 0);
    chat([{ role: 'user', content: '只回复两个字：正常' }], { maxTokens: 20, temperature: 0 })
      .then((r) => { t.remove(); toast('连接正常：' + String(r).trim().slice(0, 30), 'success'); })
      .catch((e) => { t.remove(); toast('失败：' + e.message, 'error', 8000); })
      .finally(() => { settings = backup; });
  };

  renderHome();
  switchView('home');
}

document.addEventListener('DOMContentLoaded', init);
