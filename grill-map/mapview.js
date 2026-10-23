/* 思维导图 SVG 渲染器：零依赖，CJK 换行、tidy 布局、缩放平移、折叠、加载态。 */
'use strict';

const MapView = (() => {
  const NS = 'http://www.w3.org/2000/svg';
  const BOX_W = 190, V_GAP = 16, X_GAP = 268;
  const TITLE_FS = 13.5, DEMAND_FS = 11, PAD_X = 12, PAD_Y = 9;
  const LINE_T = 20, LINE_D = 15;
  const PALETTE = [
    ['#c2410c', '#fff7ed'], ['#047857', '#ecfdf5'], ['#1d4ed8', '#eff6ff'], ['#7e22ce', '#faf5ff'],
    ['#be185d', '#fdf2f8'], ['#0e7490', '#ecfeff'], ['#4d7c0f', '#f7fee7'], ['#b45309', '#fffbeb'],
    ['#9333ea', '#faf5ff'], ['#0f766e', '#f0fdfa'],
  ];
  const ROOT_COLORS = ['#334155', '#1e293b']; // [描边/开关色, 底色]——根节点深底白字

  function el(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) {
      if (k === 'text') e.textContent = attrs[k];
      else e.setAttribute(k, attrs[k]);
    }
    if (parent) parent.appendChild(e);
    return e;
  }

  function charW(ch, fs) {
    const c = ch.codePointAt(0);
    if (c >= 0x2e80 || (c >= 0xf900 && c <= 0xfaff)) return fs;         // CJK 全宽
    if (c >= 65 && c <= 90) return fs * 0.66;                            // 大写
    if (ch >= '0' && ch <= '9') return fs * 0.56;
    return fs * 0.52;
  }

  function wrapText(text, fs, maxW) {
    const lines = [];
    let line = '', w = 0;
    for (const ch of String(text || '')) {
      const cw = charW(ch, fs);
      if (w + cw > maxW && line) { lines.push(line); line = ch; w = cw; }
      else { line += ch; w += cw; }
      if (lines.length >= 8) break;
    }
    if (line) lines.push(line);
    return lines;
  }

  function clipLines(lines, max) {
    if (lines.length <= max) return lines;
    const out = lines.slice(0, max);
    out[max - 1] = out[max - 1].replace(/.{1}$/u, '') + '…';
    return out;
  }

  function measure(node) {
    const tLines = clipLines(wrapText(node.title, TITLE_FS, BOX_W - PAD_X * 2), 3);
    const dLines = node.demand ? clipLines(wrapText(node.demand, DEMAND_FS, BOX_W - PAD_X * 2), 2) : [];
    const h = Math.max(42, PAD_Y * 2 + tLines.length * LINE_T + (dLines.length ? dLines.length * LINE_D + 5 : 0));
    node._m = { tLines, dLines, h };
    return node._m;
  }

  function create(container, callbacks) {
    const cb = Object.assign({ onSelect() {}, onToggle() {} }, callbacks);
    const svg = el('svg', { class: 'mv-svg' });
    const world = el('g', { class: 'mv-world' });
    svg.appendChild(world);
    container.appendChild(svg);

    let view = { k: 1, x: 0, y: 0 };
    let root = null;
    let selectedId = null;
    let loadings = new Set();

    function applyView() {
      world.setAttribute('transform', `translate(${view.x},${view.y}) scale(${view.k})`);
      svg.dispatchEvent(new CustomEvent('viewchange'));
    }

    function resize() {
      const r = container.getBoundingClientRect();
      svg.setAttribute('width', Math.max(50, r.width));
      svg.setAttribute('height', Math.max(50, r.height));
    }
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(resize).observe(container);
    resize();

    /* ---------- 布局 ---------- */
    function layout() {
      let cursor = 0;
      (function walk(node, depth) {
        const m = measure(node);
        const kids = node.collapsed ? [] : (node.children || []);
        node._depth = depth;
        node._x = depth * X_GAP;
        node._h = m.h;
        if (!kids.length) {
          node._y = cursor + m.h / 2;
          cursor += m.h + V_GAP;
        } else {
          kids.forEach((k) => walk(k, depth + 1));
          node._y = (kids[0]._y + kids[kids.length - 1]._y) / 2;
          if (node._y + m.h / 2 + V_GAP > cursor) cursor = node._y + m.h / 2 + V_GAP;
        }
        node._col = depth >= 1 ? PALETTE[node._ci % PALETTE.length] : null;
      })(root, 0);
    }

    function assignColors() {
      (function walk(node, ci, depth) {
        node._ci = ci;
        (node.children || []).forEach((k, i) => walk(k, depth === 0 ? i : ci, depth + 1));
      })(root, -1, 0);
    }

    /* ---------- 渲染 ---------- */
    function render(tree, opts) {
      root = tree;
      assignColors();
      layout();
      world.textContent = '';
      const frag = document.createDocumentFragment();
      (function edges(node) {
        const kids = node.collapsed ? [] : (node.children || []);
        kids.forEach((k) => {
          const [c] = k._col || PALETTE[0];
          const x1 = node._x + BOX_W, y1 = node._y, x2 = k._x, y2 = k._y;
          const mx = (x1 + x2) / 2;
          el('path', {
            d: `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`,
            stroke: c, 'stroke-width': 2, fill: 'none', opacity: 0.5,
          }, frag);
          edges(k);
        });
      })(root);
      (function nodes(node) {
        drawNode(node, frag);
        const kids = node.collapsed ? [] : (node.children || []);
        kids.forEach(nodes);
      })(root);
      world.appendChild(frag);
      if (opts && opts.fit) fit();
      else applyView();
    }

    function drawNode(node, frag) {
      const m = node._m;
      const isRoot = node._depth === 0;
      const [fg, bg] = isRoot ? ROOT_COLORS : node._col;
      const g = el('g', {
        class: 'mv-node' + (node.id === selectedId ? ' selected' : '') + (loadings.has(node.id) ? ' loading' : ''),
        transform: `translate(${node._x},${node._y - m.h / 2})`,
        'data-id': node.id,
      }, frag);

      const rect = el('rect', {
        x: 0, y: 0, width: BOX_W, height: m.h, rx: isRoot ? 12 : 9,
        fill: bg, stroke: fg, 'stroke-width': node.id === selectedId ? 2.5 : 1.3,
        'stroke-opacity': node.id === selectedId ? 1 : 0.55,
      }, g);

      const tt = el('title', {}, g);
      tt.textContent = node.title + (node.demand ? `\n需求：${node.demand}` : '') + (node.note ? `\n${node.note}` : '');

      const tx = el('text', { x: PAD_X, y: PAD_Y + TITLE_FS * 0.85, 'font-size': TITLE_FS, class: 'mv-title' }, g);
      tx.setAttribute('fill', isRoot ? '#f8fafc' : '#0f172a');
      tx.setAttribute('font-weight', isRoot ? 700 : 600);
      m.tLines.forEach((ln, i) => el('tspan', { x: PAD_X, dy: i === 0 ? 0 : LINE_T, text: ln }, tx));

      if (m.dLines.length) {
        let dy = PAD_Y + m.tLines.length * LINE_T + 8 + DEMAND_FS * 0.85;
        const dt = el('text', { x: PAD_X, y: dy, 'font-size': DEMAND_FS, class: 'mv-demand' }, g);
        m.dLines.forEach((ln, i) => el('tspan', { x: PAD_X, dy: i === 0 ? 0 : LINE_D, text: ln, fill: fg, 'fill-opacity': 0.95 }, dt));
      }

      /* 折叠开关 */
      const kids = node.children || [];
      if (kids.length) {
        const cx = BOX_W + 11, cy = m.h / 2;
        const tog = el('g', { class: 'mv-toggle', transform: `translate(${cx},${cy})`, 'data-toggle': node.id }, g);
        el('circle', { r: 9, fill: '#fff', stroke: fg, 'stroke-width': 1.4 }, tog);
        el('text', { y: 3.5, 'text-anchor': 'middle', 'font-size': 10, 'font-weight': 700, fill: fg, text: node.collapsed ? String(kids.length) : '−' }, tog);
      }

      /* 加载态 */
      if (loadings.has(node.id)) {
        const sp = el('g', { class: 'mv-spin', transform: `translate(${BOX_W + (kids.length ? 30 : 11)},${m.h / 2})` }, g);
        el('circle', { r: 7.5, fill: 'none', stroke: fg, 'stroke-width': 2.4, 'stroke-dasharray': '12 24', 'stroke-linecap': 'round' }, sp);
      }
      return g;
    }

    /* ---------- 视图操作 ---------- */
    function contentBBox() {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      (function walk(node) {
        x0 = Math.min(x0, node._x); x1 = Math.max(x1, node._x + BOX_W + 22);
        y0 = Math.min(y0, node._y - node._h / 2); y1 = Math.max(y1, node._y + node._h / 2);
        const kids = node.collapsed ? [] : (node.children || []);
        kids.forEach(walk);
      })(root);
      return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
    }

    function fit() {
      if (!root) return;
      const r = container.getBoundingClientRect();
      const b = contentBBox();
      // 宽度优先适配（上限 1 倍）；高度只做参考下限——高树垂直方向允许溢出，用户平移浏览
      const k = Math.min(1, (r.width - 50) / b.w, Math.max(0.55, (r.height - 40) / b.h));
      view.k = Math.max(0.06, k);
      view.x = Math.max(10, (r.width - b.w * view.k) / 2 - b.x0 * view.k);
      view.y = r.height / 2 - root._y * view.k;
      applyView();
    }

    function focusNode(id) {
      const n = findNode(root, id);
      if (!n) return;
      const r = container.getBoundingClientRect();
      view.k = Math.max(view.k, 0.9);
      view.x = r.width * 0.3 - n._x * view.k;
      view.y = r.height / 2 - n._y * view.k;
      applyView();
    }

    function findNode(node, id) {
      if (node.id === id) return node;
      for (const k of node.children || []) { const f = findNode(k, id); if (f) return f; }
      return null;
    }

    function screenPosOf(id) {
      const g = world.querySelector(`[data-id="${id}"]`);
      if (!g) return null;
      const r = g.getBoundingClientRect(), c = container.getBoundingClientRect();
      return { left: r.left - c.left, top: r.top - c.top, right: r.right - c.left, bottom: r.bottom - c.top, width: r.width, height: r.height };
    }

    function zoomAt(px, py, factor) {
      const k2 = Math.min(2.5, Math.max(0.06, view.k * factor));
      view.x = px - (px - view.x) * (k2 / view.k);
      view.y = py - (py - view.y) * (k2 / view.k);
      view.k = k2;
      applyView();
    }

    /* ---------- 交互 ---------- */
    // 平移拖动用 pointer 事件；节点选择双保险：pointerup（按 downTarget 判定）为主，
    // 原生 click 委托兜底（down/up 目标不同时 click 落在共同祖先，此时靠 downTarget）。
    let drag = null;
    let suppressClick = false;
    let lastPointerAct = 0;

    function act(hit) {
      const tog = hit.closest('[data-toggle]');
      if (tog) { cb.onToggle(tog.getAttribute('data-toggle')); return; }
      const g = hit.closest('[data-id]');
      if (g) cb.onSelect(g.getAttribute('data-id'));
    }

    svg.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      drag = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, moved: false, downTarget: e.target };
      suppressClick = false;
    });
    svg.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
      if (drag.moved) { view.x = drag.vx + dx; view.y = drag.vy + dy; applyView(); }
    });
    const endDrag = () => {
      if (!drag) return;
      if (drag.moved) suppressClick = true;             // 拖动后吞掉紧随的 click
      else if (drag.downTarget && drag.downTarget.closest && (drag.downTarget.closest('[data-id]'))) {
        act(drag.downTarget);
        lastPointerAct = Date.now();                    // click 委托稍后会再次命中同一节点，去重
      }
      drag = null;
    };
    svg.addEventListener('pointerup', endDrag);
    svg.addEventListener('pointercancel', () => { drag = null; suppressClick = false; });
    window.addEventListener('pointerup', endDrag);      // 拖出画布松手时兜底
    svg.addEventListener('click', (e) => {
      if (suppressClick) { suppressClick = false; return; }
      if (Date.now() - lastPointerAct < 500) return;    // pointerup 已处理，防双触发
      if (e.target.closest && e.target.closest('[data-id]')) act(e.target);
    });
    svg.addEventListener('wheel', (e) => {
      e.preventDefault();
      const r = container.getBoundingClientRect();
      zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0016));
    }, { passive: false });
    svg.addEventListener('dblclick', (e) => {
      if (e.target === svg) fit();
    });

    /* ---------- PNG 导出 ---------- */
    function toPNG(scale = 2) {
      return new Promise((resolve, reject) => {
        try {
          if (!root) throw new Error('画布为空');
          const b = contentBBox();
          const pad = 30;
          const k = Math.min(scale, 12000 / (b.w + pad * 2), 12000 / (b.h + pad * 2));
          const W = Math.round((b.w + pad * 2) * k), H = Math.round((b.h + pad * 2) * k);
          const clone = svg.cloneNode(true);
          clone.setAttribute('width', W);
          clone.setAttribute('height', H);
          const w = clone.querySelector('.mv-world');
          w.setAttribute('transform', `translate(${(pad - b.x0) * k},${(pad - b.y0) * k}) scale(${k})`);
          clone.querySelectorAll('.mv-toggle').forEach((t) => t.remove());
          const st = document.createElementNS(NS, 'style');
          st.textContent = 'text{font-family:"PingFang SC","Microsoft YaHei","Noto Sans SC",sans-serif}';
          clone.insertBefore(st, clone.firstChild);
          const xml = new XMLSerializer().serializeToString(clone);
          const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }));
          const img = new Image();
          img.onload = () => {
            const cv = document.createElement('canvas');
            cv.width = W; cv.height = H;
            const ctx = cv.getContext('2d');
            ctx.fillStyle = '#f7f8fa';
            ctx.fillRect(0, 0, W, H);
            ctx.drawImage(img, 0, 0);
            URL.revokeObjectURL(url);
            resolve(cv.toDataURL('image/png'));
          };
          img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('SVG 光栅化失败')); };
          img.src = url;
        } catch (e) { reject(e); }
      });
    }

    return {
      render, fit, focusNode, screenPosOf, toPNG,
      get scale() { return view.k; },
      zoomIn() { const r = container.getBoundingClientRect(); zoomAt(r.width / 2, r.height / 2, 1.25); },
      zoomOut() { const r = container.getBoundingClientRect(); zoomAt(r.width / 2, r.height / 2, 0.8); },
      setSelected(id) {
        selectedId = id;
        world.querySelectorAll('.mv-node').forEach((g) => {
          const on = g.getAttribute('data-id') === id;
          g.classList.toggle('selected', on);
          const rect = g.querySelector('rect');
          if (rect) {
            rect.setAttribute('stroke-width', on ? 2.5 : 1.3);
            rect.setAttribute('stroke-opacity', on ? 1 : 0.55);
          }
        });
      },
      setLoading(id, on) {
        on ? loadings.add(id) : loadings.delete(id);
        const n = root && findNode(root, id);
        if (n) { render(root); }   // 重画以显示/移除 spinner
      },
      nodeEl(id) { return world.querySelector(`[data-id="${id}"]`); },
    };
  }

  return create;
})();

if (typeof module !== 'undefined') module.exports = { MapView };
