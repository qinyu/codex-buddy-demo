(() => {
  const STAGES = [
    ['clarify', '问题澄清', 'clarify.md'],
    ['project-wiki', 'Project Wiki', 'project-wiki.md'],
    ['prd', 'PRD', 'prd.md'],
    ['prototype', '原型', 'prototype.html', 'stitch-prototype.md'],
    ['test-cases', '测试用例', 'test-cases.md'],
    ['test-automation', '自动化测试计划', 'automation-test-plan.md'],
    ['technical-solution', '技术方案', 'technical-solution.md'],
    ['development-plan', '开发计划', 'development-plan.md'],
    ['start-implement', '开工', 'start-implement.md'],
    ['develop', '开发执行', 'develop.md'],
  ];

  const escapeHtml = (value) =>
    String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const inline = (value) =>
    escapeHtml(value)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  const renderTable = (lines) => {
    const rows = lines
      .filter((line) => /^\|.*\|$/.test(line.trim()))
      .map((line) => line.trim().slice(1, -1).split('|').map((cell) => inline(cell.trim())));
    if (rows.length < 2) return '';
    const head = rows[0].map((cell) => `<th>${cell}</th>`).join('');
    const body = rows.slice(2).map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`).join('');
    return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
  };

  const markdownToHtml = (md) => {
    const lines = String(md || '').split(/\r?\n/);
    const out = [];
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (!line.trim()) {
        i += 1;
        continue;
      }
      if (line.startsWith('```')) {
        const lang = line.slice(3).trim();
        const code = [];
        i += 1;
        while (i < lines.length && !lines[i].startsWith('```')) {
          code.push(lines[i]);
          i += 1;
        }
        i += 1;
        if (lang.toLowerCase() === 'mermaid') {
          out.push(`<div class="diagram mermaid-live"><pre class="mermaid">${escapeHtml(code.join('\n'))}</pre></div>`);
        } else {
          out.push(`<pre><code data-lang="${escapeHtml(lang)}">${escapeHtml(code.join('\n'))}</code></pre>`);
        }
        continue;
      }
      if (/^\|.*\|$/.test(line.trim()) && i + 1 < lines.length && /^\|\s*-/.test(lines[i + 1].trim())) {
        const table = [];
        while (i < lines.length && /^\|.*\|$/.test(lines[i].trim())) {
          table.push(lines[i]);
          i += 1;
        }
        out.push(renderTable(table));
        continue;
      }
      const heading = line.match(/^(#{1,4})\s+(.+)$/);
      if (heading) {
        const level = Math.min(heading[1].length + 1, 5);
        out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
        i += 1;
        continue;
      }
      if (/^-\s+/.test(line)) {
        const items = [];
        while (i < lines.length && /^-\s+/.test(lines[i])) {
          items.push(`<li>${inline(lines[i].replace(/^-\s+/, ''))}</li>`);
          i += 1;
        }
        out.push(`<ul>${items.join('')}</ul>`);
        continue;
      }
      if (/^\d+\.\s+/.test(line)) {
        const items = [];
        while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
          items.push(`<li>${inline(lines[i].replace(/^\d+\.\s+/, ''))}</li>`);
          i += 1;
        }
        out.push(`<ol>${items.join('')}</ol>`);
        continue;
      }
      const paragraph = [];
      while (
        i < lines.length &&
        lines[i].trim() &&
        !lines[i].startsWith('```') &&
        !/^(#{1,4})\s+/.test(lines[i]) &&
        !/^\|.*\|$/.test(lines[i].trim()) &&
        !/^- /.test(lines[i]) &&
        !/^\d+\.\s+/.test(lines[i])
      ) {
        paragraph.push(lines[i]);
        i += 1;
      }
      out.push(`<p>${inline(paragraph.join(' '))}</p>`);
    }
    return out.join('\n');
  };

  const STATUS_MAP = {
    reviewed: '已评审',
    approved: '已评审',
    done: '已评审',
    draft: '草稿',
    blocked: '阻断',
    empty: '未生成',
    missing: '未生成',
    'not generated': '未生成',
    'not-generated': '未生成',
    not_applicable: '不适用',
    'not-applicable': '不适用',
    'not applicable': '不适用',
    na: '不适用',
    'n/a': '不适用',
    已评审: '已评审',
    草稿: '草稿',
    阻断: '阻断',
    未生成: '未生成',
    不适用: '不适用',
  };

  const normalizeStatus = (value) => {
    const raw = typeof value === 'object' && value ? value.status : value;
    const normalized = String(raw || '').trim().toLowerCase();
    return STATUS_MAP[normalized] || STATUS_MAP[String(raw || '').trim()] || '';
  };

  const statusClass = (status) => {
    if (status === '已评审') return 'reviewed';
    if (status === '未生成' || status === '不适用') return 'empty';
    if (status === '阻断') return 'blocked';
    return 'draft';
  };

  const fetchText = async (name) => {
    const res = await fetch(`./${name}?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return '';
    return res.text();
  };

  const fetchJson = async (name) => {
    try {
      const text = await fetchText(name);
      return text ? JSON.parse(text) : {};
    } catch {
      return {};
    }
  };

  const runMermaid = () => {
    if (!window.mermaid) return;
    window.mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'loose',
      theme: 'base',
      themeVariables: {
        primaryColor: '#f8fbff',
        primaryBorderColor: '#146b5f',
        primaryTextColor: '#17212b',
        lineColor: '#667085',
        fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
      },
    });
    window.mermaid.run({ querySelector: '.mermaid' }).catch((error) => console.error(error));
  };

  const activate = (id) => {
    const tabs = [...document.querySelectorAll('.tab')];
    const panels = [...document.querySelectorAll('.panel')];
    const ids = new Set(tabs.map((tab) => tab.dataset.tab));
    const next = ids.has(id) ? id : tabs[0]?.dataset.tab;
    tabs.forEach((tab) => tab.setAttribute('aria-selected', String(tab.dataset.tab === next)));
    panels.forEach((panel) => panel.classList.toggle('active', panel.id === next));
    const label = STAGES.find(([stageId]) => stageId === next)?.[1] || next;
    const title = document.querySelector('main')?.dataset.productTitle || '产品工作流需求';
    document.title = `${title} - ${label}`;
    const current = document.getElementById('current-stage-label');
    if (current) current.textContent = `当前阶段：${label}`;
  };

  const bindChrome = () => {
    document.querySelectorAll('.tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        history.replaceState(null, '', `#${tab.dataset.tab}`);
        activate(tab.dataset.tab);
      });
    });
    document.querySelectorAll('.panel').forEach((panel) => {
      const buttons = [...panel.querySelectorAll('.view-button')];
      const panes = [...panel.querySelectorAll('.view-pane')];
      buttons.forEach((button) => {
        button.addEventListener('click', () => {
          const view = button.dataset.view;
          buttons.forEach((item) => item.setAttribute('aria-selected', String(item === button)));
          panes.forEach((pane) => {
            pane.hidden = pane.dataset.viewPane !== view;
          });
        });
      });
    });
    window.addEventListener('hashchange', () => activate(location.hash.slice(1)));
  };

  const loadBoard = async () => {
    if (location.protocol !== 'file:') {
      const state = await fetchJson('.workflow-state.json');
      const files = {};
      const names = STAGES.flatMap(([, , file, fallback]) => (fallback ? [file, fallback] : [file]));
      await Promise.all(names.map(async (file) => {
        files[file] = await fetchText(file);
      }));
      return { state, files };
    }
    if (window.__BOARD_DATA__ && window.__BOARD_DATA__.files) return window.__BOARD_DATA__;
    throw new Error('当前 HTML 没有内嵌看板数据。请重新生成 .review-board/index.html 后再双击打开。');
  };

  const render = async () => {
    const banner = document.getElementById('live-banner');
    const packed = await loadBoard();
    banner.hidden = true;
    const state = packed.state || {};
    const files = packed.files || {};
    const stages = state.stages || state.phases || {};

    // 徽章与生成器同源：revising 挂在阶段对象上，waivers[] 挂在 state 顶层。
    const revisingBadge = (id) => {
      const value = stages[id];
      return value && typeof value === 'object' && value.revising
        ? '<span class="status draft">已回改待复审</span>'
        : '';
    };
    const WAIVER_DEFAULT_STAGES = ['start-implement', 'develop'];
    const waiverBadges = (id) => (Array.isArray(state.waivers) ? state.waivers : [])
      .filter((w) => w && (w.stage ? w.stage === id : WAIVER_DEFAULT_STAGES.includes(id)))
      .map((w) => `<span class="status waived" title="${escapeHtml(w.reason || '')}">已豁免 · 未完成 · ${escapeHtml(w.task || '')} · 责任人 ${escapeHtml(w.owner || '未记录')}${w.waived_at ? ` · ${escapeHtml(w.waived_at)}` : ''}</span>`)
      .join('');

    const prd = files['prd.md'] || '';
    const title = state.title || prd.match(/^#\s+PRD:\s*(.+)$/m)?.[1]?.trim() || prd.match(/^#\s+(.+)$/m)?.[1]?.trim() || '产品工作流需求';
    const defaultStage = state.currentStage || state.current_stage || 'clarify';
    document.querySelector('main').dataset.productTitle = title;
    document.querySelector('main').dataset.defaultStage = defaultStage;
    document.querySelector('header h1').textContent = `${title} - 产品工作流评审看板`;

    const nav = document.querySelector('.tabs');
    const main = document.querySelector('main');
    [...main.querySelectorAll('.panel')].forEach((panel) => panel.remove());
    nav.innerHTML = STAGES.map(([id, label]) =>
      `<button class="tab" data-tab="${id}" aria-selected="false">${label}</button>`
    ).join('');

    STAGES.forEach(([id, label, primary, fallback]) => {
      const primaryRaw = files[primary] || '';
      const fallbackRaw = fallback ? (files[fallback] || '') : '';
      const file = primaryRaw.trim() || !fallbackRaw.trim() ? primary : fallback;
      const raw = file === primary ? primaryRaw : fallbackRaw;
      const status = normalizeStatus(stages[id]) || (raw.trim() ? '草稿' : '未生成');
      const body = file.endsWith('.html')
        ? (raw.trim()
          ? `<iframe class="prototype-frame" title="${escapeHtml(label)}" sandbox="allow-scripts allow-forms" srcdoc="${escapeHtml(raw).replace(/"/g, '&quot;')}"></iframe>`
          : '<p>未生成</p>')
        : (raw.trim() ? markdownToHtml(raw) : '<p>未生成</p>');
      const section = document.createElement('section');
      section.id = id;
      section.className = 'panel';
      section.innerHTML = `
        <span class="status ${statusClass(status)}">${status}</span>${revisingBadge(id)}${waiverBadges(id)}
        <h2>${label}</h2>
        <div class="view-switch" role="tablist" aria-label="${label} 视图切换">
          <button class="view-button" data-view="human" aria-selected="true">给人看的评审视图</button>
          <button class="view-button" data-view="ai" aria-selected="false">给 AI 看的 Markdown 源码</button>
        </div>
        <div class="view-pane human-view" data-view-pane="human">
          <p class="live-hint">源头：<code>${file}</code> 与 <code>.workflow-state.json</code>。改文件后刷新本页，不必重建 HTML。</p>
          <div class="artifact-body">${body}</div>
        </div>
        <div class="view-pane ai-view" data-view-pane="ai" hidden>
          <div class="review-box"><strong>源码</strong><p>${escapeHtml(file)}</p></div>
          <pre><code>${escapeHtml(raw || '当前阶段没有独立源内容。')}</code></pre>
        </div>`;
      main.appendChild(section);
    });

    bindChrome();
    activate(location.hash.slice(1) || defaultStage);
    runMermaid();
  };

  render().catch((error) => {
    const banner = document.getElementById('live-banner');
    banner.hidden = false;
    banner.textContent = `看板读取失败：${error.message || String(error)}`;
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') render().catch(() => {});
  });
})();
