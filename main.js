// === 战队指挥部 主逻辑 ===

const STORAGE_KEY = 'dn_dashboard_v1';

// === 云同步配置(GitHub Gist) ===
const CLOUD = {
  gistId: 'eb73a6cc7a76c6987c51a66a32f83f93',
  filename: 'dashboard-data.json',
  // Token 由用户在页面上输入，不硬编码在代码里
  get token() { return localStorage.getItem('dn_gist_token') || ''; },
};

async function cloudPull() {
  if (!CLOUD.token) return { ok: false, notReady: true };
  try {
    const res = await fetch(`https://api.github.com/gists/${CLOUD.gistId}`, {
      headers: {
        'Authorization': `token ${CLOUD.token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const gist = await res.json();
    const content = gist.files[CLOUD.filename]?.content;
    if (!content || content === '{}') return { ok: false, empty: true };
    const parsed = JSON.parse(content);
    State.data = parsed;
    State.data.lastSyncTime = new Date().toLocaleString('zh-CN');
    State.save();
    return { ok: true, time: State.data.lastSyncTime };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function cloudPush() {
  if (!CLOUD.token) return { ok: false, notReady: true };
  try {
    const payload = JSON.stringify(State.data, null, 2);
    const res = await fetch(`https://api.github.com/gists/${CLOUD.gistId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `token ${CLOUD.token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        files: { [CLOUD.filename]: { content: payload } }
      })
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    State.data.lastSyncTime = new Date().toLocaleString('zh-CN');
    State.save();
    return { ok: true, time: State.data.lastSyncTime };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// 默认团队成员(可在团队页编辑)
const DEFAULT_MEMBERS = [
  { name: '马仕瑾', studentId: '', role: '', isLeader: false, contact: '', workspace: { duty: '', tasks: [], uploads: [], notes: '' } },
  { name: '韩明珠', studentId: '', role: '', isLeader: false, contact: '', workspace: { duty: '', tasks: [], uploads: [], notes: '' } },
  { name: '颜纤蕴', studentId: '', role: '', isLeader: false, contact: '', workspace: { duty: '', tasks: [], uploads: [], notes: '' } },
  { name: '陈祎洋', studentId: '', role: '', isLeader: false, contact: '', workspace: { duty: '', tasks: [], uploads: [], notes: '' } }
];

// === 状态管理 ===
const State = {
  data: null,
  load() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try { this.data = JSON.parse(saved); }
      catch { this.data = this.defaults(); }
    } else {
      this.data = this.defaults();
    }
    if (!this.data.tasks) this.data.tasks = JSON.parse(JSON.stringify(DEFAULT_TASKS));
    if (!this.data.members || this.data.members.length === 0) this.data.members = JSON.parse(JSON.stringify(DEFAULT_MEMBERS));
    if (!this.data.votes) this.data.votes = [];
    if (!this.data.uploads) this.data.uploads = [];
    if (!this.data.chatHistory) this.data.chatHistory = [];
    if (!this.data.apiKey) this.data.apiKey = '';
    if (!this.data.workTopic) this.data.workTopic = '';
    if (!this.data.workForm) this.data.workForm = '';
    return this.data;
  },
  save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data)); },
  defaults() {
    return {
      tasks: JSON.parse(JSON.stringify(DEFAULT_TASKS)),
      members: JSON.parse(JSON.stringify(DEFAULT_MEMBERS)),
      votes: [],
      uploads: [],
      chatHistory: [],
      apiKey: '',
      workTopic: '',
      workForm: ''
    };
  }
};

// === 工具函数 ===
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function daysBetween(d1, d2) {
  return Math.round((new Date(d2) - new Date(d1)) / 86400000);
}

function todayStr() {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`;
}

// 把"出处"文本中提到的资料映射到 LEARN_RESOURCES 的 url
// 一段 from 文本可能提到多个资料,如"《新手村闯关》实训手记 + 《主流媒体潮汐表》"
const LEARN_SOURCE_MAP = [
  { id: 'rookie-village',       keywords: ['新手村', '实训手记', '新嗅探'] },
  { id: 'zhai-governance',      keywords: ['社会治理议题', '网易数读', '吴怡璇'] },
  { id: 'zhai-crisis',          keywords: ['公共危机', '事实洞察', '情绪缓释'] },
  { id: 'aigc-attention',       keywords: ['AIGC', '注意力经济', '王书麒', '陈功'] },
  { id: 'innovation-research',  keywords: ['新闻研究导刊', '创新应用'] },
  { id: 'lan-tech',             keywords: ['蓝星宇', '智能技术', '专业规约', '复旦'] },
  { id: 'visual-three-keys',    keywords: ['袁波', '浙江在线', '可视化创新', '量化', '深挖'] },
  { id: 'mainstream-path',      keywords: ['潮汐表', '朱研', '主流媒体'] },
  { id: 'ten-years-observation',keywords: ['十年观察', '大赛十年'] },
  { id: 'anderson-genealogy',   keywords: ['Anderson', '谱系'] }
];
function findLearnSource(fromText) {
  if (!fromText || typeof fromText !== 'string') return [];
  const matched = [];
  LEARN_SOURCE_MAP.forEach(m => {
    if (m.keywords.some(k => fromText.includes(k))) {
      const r = (typeof LEARN_RESOURCES !== 'undefined') ? LEARN_RESOURCES.find(x => x.id === m.id) : null;
      if (r) matched.push(r);
    }
  });
  return matched;
}


// === 路由 ===
function router() {
  const hash = location.hash.slice(1) || 'home';
  $$('.page').forEach(p => p.classList.add('hidden'));
  const target = $('#' + hash);
  if (target) target.classList.remove('hidden');
  $$('.nav-link').forEach(a => {
    a.classList.toggle('active', a.getAttribute('href') === '#' + hash);
  });
  const renderer = Pages[hash];
  if (renderer) renderer(target);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// === 各页面渲染 ===
const Pages = {};

// --- 首页 ---
Pages.home = (root) => {
  const today = todayStr();
  const next = MILESTONES.find(m => m.date >= today) || MILESTONES[MILESTONES.length-1];
  const dDay = daysBetween(today, next.date);
  const submitDeadline = '2026-07-07';
  const dSubmit = daysBetween(today, submitDeadline);

  const tasks = State.data.tasks;
  const done = tasks.filter(t => t.done).length;
  const pct = Math.round(done / tasks.length * 100);

  root.innerHTML = `
    <div class="card mb-4" style="background: linear-gradient(90deg, #f0f9ff 0%, #fff 100%); border-color: #bae6fd;">
      <div class="flex items-center justify-between flex-wrap gap-2">
        <div class="flex items-center gap-3 text-sm">
          <span class="text-base">☁️</span>
          <div>
            <div class="font-medium text-slate-700">团队云同步 <span class="text-xs text-slate-500 ml-2">${State.data.lastSyncTime ? '上次同步: ' + escapeHtml(State.data.lastSyncTime) : '尚未同步'}</span></div>
            <div class="text-xs text-slate-500 mt-0.5">点 ⬆️ 推送将本地数据共享给队员 · 点 ⬇️ 拉取看队员最新版</div>
          </div>
        </div>
        <div class="flex gap-2">
          <button id="cloudPushBtn" class="btn btn-primary text-xs">⬆️ 推送到云</button>
          <button id="cloudPullBtn" class="btn btn-secondary text-xs">⬇️ 从云拉取</button>
        </div>
      </div>
      <div class="mt-3 flex items-center gap-2">
        <label class="text-xs text-slate-500 whitespace-nowrap">🔑 GitHub Token:</label>
        <input id="gistTokenInput" type="password"
          class="field text-xs flex-1"
          placeholder="首次使用请输入 GitHub Token（ghp_xxx...），保存在本地不上传"
          value="${escapeHtml(CLOUD.token)}" />
        <button id="saveTokenBtn" class="btn btn-secondary text-xs whitespace-nowrap">保存</button>
      </div>
    </div>

    <div class="grid md:grid-cols-3 gap-4 mb-6">
      <div class="card card-hover">
        <div class="text-xs text-slate-500 mb-2">距离作品提交</div>
        <div class="text-4xl font-bold text-red-600">${dSubmit > 0 ? dSubmit : 0}<span class="text-lg font-normal text-slate-400 ml-1">天</span></div>
        <div class="text-xs text-slate-400 mt-1">截止 2026-07-07</div>
      </div>
      <div class="card card-hover">
        <div class="text-xs text-slate-500 mb-2">下一个节点</div>
        <div class="text-2xl font-bold text-blue-700">${escapeHtml(next.title)}</div>
        <div class="text-xs text-slate-400 mt-1">${next.date} · 还剩 ${dDay} 天</div>
      </div>
      <div class="card card-hover">
        <div class="text-xs text-slate-500 mb-2">任务完成度</div>
        <div class="text-3xl font-bold text-green-600">${pct}%</div>
        <div class="vote-bar mt-2"><div class="vote-bar-fill" style="width:${pct}%"></div></div>
        <div class="text-xs text-slate-400 mt-2">${done} / ${tasks.length} 已完成</div>
      </div>
    </div>

    <div class="grid md:grid-cols-2 gap-4 mb-6">
      <div class="card">
        <h3 class="font-bold text-lg mb-3">📋 我们的项目</h3>
        <div class="space-y-2 text-sm">
          <div><span class="text-slate-500">选题主题:</span><input class="field inline-block w-auto ml-2" id="topicInput" value="${escapeHtml(State.data.workTopic)}" placeholder="如:长江禁渔5年观察"/></div>
          <div><span class="text-slate-500">作品形式:</span>
            <select class="field inline-block w-auto ml-2" id="formInput">
              <option value="">未选定</option>
              ${WORK_FORMS.map(w => `<option ${(State.data.workForm || '网页专题') === w.name ? 'selected' : ''}>${w.name}</option>`).join('')}
            </select>
          </div>
          <div class="text-xs text-purple-700 bg-purple-50 rounded p-2 mt-2">
            🎯 <strong>我们的方向:Vibe Coding 交互网页</strong> · 类似罗小雅团队作品 · 用 Cursor/Trae 配 ECharts 做滚动叙事
          </div>
        </div>
      </div>

      <div class="card">
        <h3 class="font-bold text-lg mb-3">⚡ 快捷入口</h3>
        <div class="grid grid-cols-2 gap-2">
          <a href="#requirements" class="btn btn-secondary text-center">📜 比赛要求</a>
          <a href="#works" class="btn btn-secondary text-center">🏆 往期作品</a>
          <a href="#progress" class="btn btn-secondary text-center">✅ 任务进度</a>
          <a href="#team" class="btn btn-secondary text-center">👥 团队</a>
          <a href="#ai" class="btn btn-secondary text-center">🤖 AI 工作台</a>
          <a href="#resources" class="btn btn-secondary text-center">📚 资源中心</a>
        </div>
      </div>
    </div>

    <div class="card">
      <h3 class="font-bold text-lg mb-4">🗓 关键节点时间轴</h3>
      <div>
        ${MILESTONES.map(m => {
          const passed = m.date < today;
          const isCurrent = m === next;
          return `
            <div class="timeline-item ${passed ? 'passed' : ''} ${isCurrent ? 'current' : ''}">
              <div class="timeline-dot"></div>
              <div class="text-xs text-slate-500">${m.date} ${passed ? '· 已过' : isCurrent ? '· 即将到来' : ''}</div>
              <div class="font-medium ${passed ? 'text-slate-400' : ''}">${escapeHtml(m.title)}</div>
              <div class="text-xs text-slate-500">${escapeHtml(m.desc)}</div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;

  $('#topicInput').addEventListener('change', e => { State.data.workTopic = e.target.value; State.save(); });
  $('#formInput').addEventListener('change', e => { State.data.workForm = e.target.value; State.save(); });

  $('#saveTokenBtn')?.addEventListener('click', () => {
    const t = $('#gistTokenInput').value.trim();
    if (t) { localStorage.setItem('dn_gist_token', t); alert('✅ Token 已保存到本地'); }
    else { localStorage.removeItem('dn_gist_token'); alert('已清除 Token'); }
  });

  $('#cloudPushBtn')?.addEventListener('click', async () => {
    if (!CLOUD.token) { alert('☁️ 请先输入 GitHub Token 并点保存'); return; }
    if (!confirm('推送会覆盖云端数据，所有队员下次拉取会看到你的版本。继续?')) return;
    const btn = $('#cloudPushBtn');
    const old = btn.textContent;
    btn.textContent = '⏳ 推送中...';
    btn.disabled = true;
    const r = await cloudPush();
    btn.disabled = false;
    if (r.ok) { alert('✅ 已推送到云\n时间:' + r.time); Pages.home(root); }
    else { btn.textContent = old; alert('❌ 推送失败:' + (r.error || '未知错误')); }
  });

  $('#cloudPullBtn')?.addEventListener('click', async () => {
    if (!CLOUD.token) { alert('☁️ 请先输入 GitHub Token 并点保存'); return; }
    if (!confirm('拉取会覆盖你本地的所有数据。继续?')) return;
    const btn = $('#cloudPullBtn');
    const old = btn.textContent;
    btn.textContent = '⏳ 拉取中...';
    btn.disabled = true;
    const r = await cloudPull();
    btn.disabled = false;
    if (r.ok) { alert('✅ 已拉取最新数据\n时间:' + r.time); location.reload(); }
    else if (r.empty) { btn.textContent = old; alert('⚠️ 云端暂无数据 · 请先让某位队员"推送到云"'); }
    else { btn.textContent = old; alert('❌ 拉取失败:' + (r.error || '未知错误')); }
  });
};

// --- 比赛要求 ---
Pages.requirements = (root) => {
  root.innerHTML = `
    <h2 class="text-2xl font-bold mb-4">📜 比赛要求速查</h2>

    <div class="grid md:grid-cols-2 gap-4 mb-6">
      <div class="card">
        <h3 class="font-bold mb-3">基本规则</h3>
        <ul class="text-sm space-y-2 text-slate-700">
          <li>👥 团队人数：<strong>3–6人</strong>，每人最多2队，仅可在1队任队长</li>
          <li>🎓 指导老师：每队 ≤5 人，同专业门类 ≤3 人</li>
          <li>📍 赛区归属：以队长所在单位为准</li>
          <li>💰 报名费：100元/人 · 支付宝扫码 · 备注"数据-姓名-手机号"</li>
          <li>📅 报名截止：2026-06-10</li>
          <li>📅 提交截止：2026-07-07</li>
        </ul>
      </div>

      <div class="card">
        <h3 class="font-bold mb-3">提交清单（9项）</h3>
        <ol class="text-sm space-y-1 text-slate-700 list-decimal pl-5">
          ${SUBMIT_CHECKLIST.map(s => `<li>${escapeHtml(s)}</li>`).join('')}
        </ol>
      </div>
    </div>

    <div class="card mb-6">
      <h3 class="font-bold mb-3">6 项评分维度</h3>
      <div class="grid md:grid-cols-2 gap-3">
        ${SCORING.map((s, i) => `
          <div class="border border-slate-200 rounded-lg p-3">
            <div class="font-medium text-blue-700">${i+1}. ${escapeHtml(s.name)}</div>
            <div class="text-xs text-slate-600 mt-1">${escapeHtml(s.desc)}</div>
          </div>
        `).join('')}
      </div>
    </div>

    <div class="card mb-6">
      <h3 class="font-bold mb-3">5 种作品形式</h3>
      <table class="w-full text-sm">
        <thead class="bg-slate-100 text-slate-600 text-xs">
          <tr><th class="p-2 text-left">形式</th><th class="p-2 text-left">难度</th><th class="p-2 text-left">适合主题</th><th class="p-2 text-left">工具推荐</th></tr>
        </thead>
        <tbody>
          ${WORK_FORMS.map(w => `
            <tr class="border-t border-slate-100">
              <td class="p-2 font-medium">${escapeHtml(w.name)}</td>
              <td class="p-2">${'⭐'.repeat(w.diff)}</td>
              <td class="p-2 text-slate-600">${escapeHtml(w.fit)}</td>
              <td class="p-2 text-slate-500 text-xs">${escapeHtml(w.tools)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <div class="card bg-amber-50 border-amber-200">
      <h3 class="font-bold mb-2 text-amber-900">⚠️ 易错提醒</h3>
      <ul class="text-sm space-y-1 text-amber-900">
        <li>• 电子封面必须 4:3 比例 · ≤200K · PDF 格式</li>
        <li>• 视频类作品要把<strong>所有数据图表</strong>放进PDF</li>
        <li>• 网页/H5链接需自测，提交后失效组委会不补救</li>
        <li>• 提交后任何修改一律取消资格</li>
        <li>• 原创声明必须盖章（学院或单位）</li>
        <li>• AI使用必须标注：环节 + 工具 + 提示词</li>
      </ul>
    </div>
  `;
};

// --- 往期作品 ---
Pages.works = (root) => {
  const topics = ['全部', ...new Set(PAST_WORKS.map(w => w.topic))];
  const currentTopic = State.data.workFilter || '全部';
  const filtered = currentTopic === '全部' ? PAST_WORKS : PAST_WORKS.filter(w => w.topic === currentTopic);

  root.innerHTML = `
    <h2 class="text-2xl font-bold mb-2">🏆 往期一等奖作品库</h2>
    <p class="text-sm text-slate-500 mb-4">第十届一等奖 · 共 ${PAST_WORKS.length} 件 · 点击卡片可直达原作品</p>

    <div class="card mb-4">
      <div class="flex flex-wrap gap-2">
        ${topics.map(t => `
          <button class="topic-filter btn ${t === currentTopic ? 'btn-primary' : 'btn-secondary'}" data-topic="${escapeHtml(t)}">${escapeHtml(t)}<span class="ml-1 text-xs opacity-75">${t === '全部' ? PAST_WORKS.length : PAST_WORKS.filter(w => w.topic === t).length}</span></button>
        `).join('')}
      </div>
    </div>

    <div class="grid md:grid-cols-2 gap-3">
      ${filtered.map(w => `
        <a href="${escapeHtml(w.url || '#')}" target="_blank" rel="noopener" class="card card-hover block no-underline" style="text-decoration:none;color:inherit;">
          <div class="flex items-start justify-between gap-2 mb-2">
            <span class="tag bg-blue-100 text-blue-700">${escapeHtml(w.topic)}</span>
            ${w.url ? `<span class="text-xs text-blue-600">🔗 打开作品 →</span>` : ''}
          </div>
          <div class="font-medium text-sm leading-relaxed mb-2">${escapeHtml(w.title)}</div>
          ${w.summary ? `<div class="text-xs text-slate-600 leading-relaxed mb-2 line-clamp-3">${escapeHtml(w.summary)}</div>` : ''}
          <div class="text-xs text-slate-500 pt-2 border-t border-slate-100 mt-2">
            🏫 ${escapeHtml(w.school)}${w.team ? ' · ' + escapeHtml(w.team) : ''}
          </div>
        </a>
      `).join('')}
    </div>

    <div class="card mt-6 bg-blue-50 border-blue-200">
      <h3 class="font-bold mb-2 text-blue-900">💡 选题模式总结（看完24件一等奖作品的规律）</h3>
      <ul class="text-sm space-y-1 text-blue-900">
        <li>• <strong>小切口大纵深</strong>：一座桥（重庆）、一片樱花、一根针、一座书房、一只验证码</li>
        <li>• <strong>建设性叙事</strong>：海葬、治沙、女性健康、非遗活化——讲"如何更好"，不是"多么糟"</li>
        <li>• <strong>把数据打回到具体的人</strong>：5.8万标注师、1731万视障者、4亿女性、1091条针灸数据</li>
        <li>• <strong>跨界组合</strong>：糖尿病×医保、樱花×气候、AI×非遗、桥梁×城市</li>
        <li>• <strong>主流载体</strong>：${(() => {
          const platforms = {};
          PAST_WORKS.forEach(w => {
            if (!w.url) return;
            const m = w.url.match(/https?:\/\/([^\/]+)/);
            const host = m ? m[1].replace(/^www\./,'') : '其他';
            const key = host.includes('readymag') ? 'Readymag' : host.includes('mp.weixin') ? '微信公众号' : host.includes('pan.baidu') ? '百度网盘' : host.includes('framer') ? 'Framer' : host.includes('wixstudio') ? 'Wix' : host.includes('canvasite') ? 'Canva' : host.includes('xiumi') ? '秀米' : host.includes('dycharts') ? 'DYCharts' : host.includes('mysxl') ? 'MySXL' : '自建域名';
            platforms[key] = (platforms[key]||0) + 1;
          });
          return Object.entries(platforms).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${k}(${v})`).join('、');
        })()}</li>
      </ul>
    </div>
  `;

  $$('.topic-filter').forEach(btn => {
    btn.addEventListener('click', e => {
      e.preventDefault();
      State.data.workFilter = btn.dataset.topic;
      State.save();
      Pages.works(root);
    });
  });
};

// --- 任务进度 ---
Pages.progress = (root) => {
  const tasks = State.data.tasks;
  const weeks = [...new Set(tasks.map(t => t.week))];
  const done = tasks.filter(t => t.done).length;
  const pct = Math.round(done / tasks.length * 100);

  root.innerHTML = `
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-2xl font-bold">✅ 任务进度</h2>
      <button id="addTaskBtn" class="btn btn-primary">+ 新增任务</button>
    </div>

    <div class="card mb-4">
      <div class="flex items-center justify-between mb-2">
        <span class="text-sm font-medium">总进度 ${done}/${tasks.length}</span>
        <span class="text-sm text-slate-500">${pct}%</span>
      </div>
      <div class="vote-bar"><div class="vote-bar-fill" style="width:${pct}%"></div></div>
    </div>

    ${weeks.map(week => {
      const weekTasks = tasks.filter(t => t.week === week);
      const wDone = weekTasks.filter(t => t.done).length;
      return `
        <div class="card mb-4">
          <div class="flex items-center justify-between mb-3">
            <h3 class="font-bold text-blue-800">${escapeHtml(week)}</h3>
            <span class="text-xs text-slate-500">${wDone}/${weekTasks.length}</span>
          </div>
          <div class="space-y-1">
            ${weekTasks.map(t => `
              <div class="checkbox-task ${t.done ? 'done' : ''}" data-id="${t.id}">
                <input type="checkbox" class="task-check mt-1" ${t.done ? 'checked' : ''}>
                <div class="flex-1">
                  <div class="task-title text-sm font-medium">${escapeHtml(t.title)}</div>
                  ${t.owner ? `<div class="text-xs text-slate-500 mt-1">👤 ${escapeHtml(t.owner)}</div>` : ''}
                </div>
                <button class="task-edit text-xs text-slate-400 hover:text-blue-600">编辑</button>
                <button class="task-del text-xs text-slate-400 hover:text-red-600">删除</button>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }).join('')}
  `;

  $$('.task-check').forEach(cb => {
    cb.addEventListener('change', e => {
      const id = parseInt(e.target.closest('.checkbox-task').dataset.id);
      const task = State.data.tasks.find(t => t.id === id);
      task.done = e.target.checked;
      State.save();
      Pages.progress(root);
    });
  });

  $$('.task-edit').forEach(btn => {
    btn.addEventListener('click', e => {
      const id = parseInt(e.target.closest('.checkbox-task').dataset.id);
      const task = State.data.tasks.find(t => t.id === id);
      const newTitle = prompt('修改任务标题：', task.title);
      if (newTitle && newTitle.trim()) task.title = newTitle.trim();
      const owner = prompt('指派给谁？（成员名，留空=未指派）', task.owner || '');
      task.owner = (owner || '').trim();
      State.save();
      Pages.progress(root);
    });
  });

  $$('.task-del').forEach(btn => {
    btn.addEventListener('click', e => {
      const id = parseInt(e.target.closest('.checkbox-task').dataset.id);
      if (confirm('确定删除？')) {
        State.data.tasks = State.data.tasks.filter(t => t.id !== id);
        State.save();
        Pages.progress(root);
      }
    });
  });

  $('#addTaskBtn').addEventListener('click', () => {
    const week = prompt('归属周次（例：Week 3 (6/11-6/17)）：');
    if (!week) return;
    const title = prompt('任务标题：');
    if (!title) return;
    const owner = prompt('指派给（可留空）：') || '';
    const newId = Math.max(0, ...State.data.tasks.map(t => t.id)) + 1;
    State.data.tasks.push({ id: newId, week, title, owner, done: false });
    State.save();
    Pages.progress(root);
  });
};

// --- 团队 ---
Pages.team = (root) => {
  // 兼容老数据:确保每个成员都有 workspace 字段
  State.data.members.forEach(m => {
    if (!m.workspace) m.workspace = { duty: '', tasks: [], uploads: [], notes: '' };
    if (m.studentId === undefined) m.studentId = '';
  });

  const members = State.data.members;
  const votes = State.data.votes;
  const expandedMember = State.data.teamExpand;

  root.innerHTML = `
    <div class="flex items-center justify-between mb-4 flex-wrap gap-2">
      <h2 class="text-2xl font-bold">👥 团队</h2>
      <div class="flex gap-2">
        <button id="addMemberBtn" class="btn btn-secondary text-xs">+ 新增成员</button>
        <button id="addVoteBtn" class="btn btn-secondary text-xs">+ 发起投票</button>
      </div>
    </div>

    <div class="card mb-4 bg-blue-50 border-blue-200">
      <p class="text-xs text-blue-900">点击成员卡片右上角"展开工作区"打开个人空间 · 每人有专属的分工/任务/成果上传/笔记区域</p>
    </div>

    <div class="space-y-3 mb-6">
      ${members.length === 0 ? `<div class="card text-center text-slate-400 py-6">还没有成员</div>` : members.map((m, i) => {
        const isExpanded = expandedMember === i;
        const ws = m.workspace || {};
        const taskTotal = (ws.tasks||[]).length;
        const taskDone = (ws.tasks||[]).filter(t=>t.done).length;
        return `
          <div class="card ${isExpanded ? 'ring-2 ring-blue-400' : ''}">
            <div class="flex items-start gap-3">
              <div class="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 text-white flex items-center justify-center font-bold flex-shrink-0">${escapeHtml(m.name.slice(0,1))}</div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <div class="font-bold">${escapeHtml(m.name)} ${m.isLeader ? '<span class="tag bg-yellow-100 text-yellow-700 ml-1">队长</span>' : ''}</div>
                    <div class="text-xs text-slate-500">学号: ${escapeHtml(m.studentId || '(待填)')} ${m.role ? '· ' + escapeHtml(m.role) : ''}</div>
                  </div>
                  <div class="flex gap-2 text-xs">
                    <button class="member-edit text-slate-500 hover:text-blue-600" data-i="${i}">编辑</button>
                    <button class="member-toggle text-blue-600 hover:text-blue-800" data-i="${i}">${isExpanded ? '▲ 收起' : '▼ 展开工作区'}</button>
                    <button class="member-del text-slate-400 hover:text-red-600" data-i="${i}">删除</button>
                  </div>
                </div>

                ${ws.duty ? `<div class="text-xs text-slate-600 mt-2">📋 分工: ${escapeHtml(ws.duty)}</div>` : ''}
                <div class="text-xs text-slate-400 mt-1">📊 任务 ${taskDone}/${taskTotal} · 📎 成果 ${(ws.uploads||[]).length}</div>
              </div>
            </div>

            ${isExpanded ? `
              <div class="mt-4 pt-4 border-t space-y-4">
                <!-- 个人分工 -->
                <div>
                  <label class="text-xs font-bold text-slate-600 mb-1 block">📋 我的分工</label>
                  <textarea class="field text-sm member-duty" rows="2" data-i="${i}" placeholder="例:负责数据采集和清洗,产出xlsx格式数据集">${escapeHtml(ws.duty || '')}</textarea>
                </div>

                <!-- 个人任务清单 -->
                <div>
                  <div class="flex items-center justify-between mb-2">
                    <label class="text-xs font-bold text-slate-600">✅ 我的任务清单</label>
                    <button class="add-mem-task text-xs text-blue-600" data-i="${i}">+ 新增任务</button>
                  </div>
                  ${(ws.tasks||[]).length === 0 ? `<div class="text-xs text-slate-400 py-2 text-center">还没有任务</div>` : `
                    <div class="space-y-1">
                      ${(ws.tasks||[]).map((t, ti) => `
                        <div class="checkbox-task ${t.done ? 'done' : ''}" data-i="${i}" data-ti="${ti}">
                          <input type="checkbox" class="mem-task-check mt-1" ${t.done ? 'checked' : ''}>
                          <div class="flex-1">
                            <div class="task-title text-sm">${escapeHtml(t.title)}</div>
                            ${t.due ? `<div class="text-xs text-slate-500 mt-0.5">📅 ${escapeHtml(t.due)}</div>` : ''}
                          </div>
                          <button class="mem-task-del text-xs text-slate-400 hover:text-red-600" data-i="${i}" data-ti="${ti}">×</button>
                        </div>
                      `).join('')}
                    </div>
                  `}
                </div>

                <!-- 个人成果上传 -->
                <div>
                  <div class="flex items-center justify-between mb-2">
                    <label class="text-xs font-bold text-slate-600">📎 我的成果</label>
                    <button class="add-mem-upload text-xs text-blue-600" data-i="${i}">+ 添加成果链接</button>
                  </div>
                  ${(ws.uploads||[]).length === 0 ? `<div class="text-xs text-slate-400 py-2 text-center">把网盘/腾讯文档/Figma链接放这里</div>` : `
                    <ul class="space-y-1 text-sm">
                      ${(ws.uploads||[]).map((u, ui) => `
                        <li class="flex items-center gap-2 p-2 bg-slate-50 rounded">
                          <span class="text-base">${u.type === 'doc' ? '📄' : u.type === 'image' ? '🖼' : u.type === 'video' ? '🎬' : '🔗'}</span>
                          <a href="${escapeHtml(u.url)}" target="_blank" class="text-blue-600 hover:underline flex-1 text-xs truncate">${escapeHtml(u.name)}</a>
                          <span class="text-xs text-slate-400">${escapeHtml(u.time||'')}</span>
                          <button class="mem-upload-del text-xs text-slate-400 hover:text-red-600" data-i="${i}" data-ui="${ui}">×</button>
                        </li>
                      `).join('')}
                    </ul>
                  `}
                </div>

                <!-- 个人笔记 -->
                <div>
                  <label class="text-xs font-bold text-slate-600 mb-1 block">📝 我的笔记 / 想法</label>
                  <textarea class="field text-sm member-notes" rows="3" data-i="${i}" placeholder="选题想法、可视化灵感、问题记录...">${escapeHtml(ws.notes || '')}</textarea>
                </div>
              </div>
            ` : ''}
          </div>
        `;
      }).join('')}
    </div>

    <!-- 团队公告板 -->
    <div class="card mb-4">
      <div class="flex items-center justify-between mb-3">
        <h3 class="font-bold text-lg">📢 团队公告</h3>
        <button id="addAnnouncementBtn" class="btn btn-primary text-xs">+ 发布公告</button>
      </div>
      ${(() => {
        const anns = State.data.announcements || [];
        if (anns.length === 0) return `<p class="text-sm text-slate-400 text-center py-4">还没有公告 · 重要决定/截止日期/通知放这里</p>`;
        return `
          <div class="space-y-2">
            ${anns.map((a, ai) => `
              <div class="border-l-4 border-blue-500 bg-blue-50 rounded-r p-3 flex items-start gap-2">
                <div class="flex-1">
                  <div class="text-xs text-slate-500 mb-1">${escapeHtml(a.author || '')} · ${escapeHtml(a.time || '')}</div>
                  <div class="text-sm whitespace-pre-wrap">${escapeHtml(a.text)}</div>
                </div>
                <button class="ann-del text-xs text-slate-400 hover:text-red-600" data-i="${ai}">×</button>
              </div>
            `).join('')}
          </div>
        `;
      })()}
    </div>

    <!-- 团队会议 -->
    <div class="card mb-4">
      <div class="flex items-center justify-between mb-3">
        <h3 class="font-bold text-lg">🗓 会议安排</h3>
        <button id="addMeetingBtn" class="btn btn-primary text-xs">+ 安排会议</button>
      </div>
      ${(() => {
        const ms = State.data.meetings || [];
        if (ms.length === 0) return `<p class="text-sm text-slate-400 text-center py-4">还没有会议 · 在线/线下都可以记</p>`;
        return `
          <div class="space-y-2">
            ${ms.map((m, mi) => `
              <div class="border border-slate-200 rounded p-3">
                <div class="flex items-center justify-between gap-2 mb-2 flex-wrap">
                  <div class="font-medium text-sm">${escapeHtml(m.title)}</div>
                  <button class="meeting-del text-xs text-slate-400 hover:text-red-600" data-i="${mi}">×</button>
                </div>
                <div class="text-xs text-slate-500 space-y-0.5">
                  <div>📅 ${escapeHtml(m.time || '待定')}</div>
                  <div>📍 ${escapeHtml(m.place || '待定')}</div>
                  ${m.agenda ? `<div class="mt-2 text-slate-700 whitespace-pre-wrap">📋 ${escapeHtml(m.agenda)}</div>` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        `;
      })()}
    </div>

    <!-- 共享白板 -->
    <div class="card mb-4">
      <div class="flex items-center justify-between mb-3">
        <h3 class="font-bold text-lg">📋 共享白板</h3>
        <span class="text-xs text-slate-400" id="whiteboardStatus">自动保存</span>
      </div>
      <p class="text-xs text-slate-500 mb-2">头脑风暴/灵感记录/待办备忘 · 所有团队成员共享 · 通过"导出数据"同步</p>
      <textarea id="whiteboard" class="field" rows="8" placeholder="今天的灵感:&#10;- xxx&#10;- yyy&#10;&#10;待办:&#10;- aaa&#10;- bbb">${escapeHtml(State.data.whiteboard || '')}</textarea>
    </div>

    <!-- 团队投票区 -->
    <div class="mb-2 flex items-center justify-between">
      <h3 class="font-bold text-lg">🗳 团队投票</h3>
      <span class="text-xs text-slate-500">${votes.length} 个进行中</span>
    </div>
    ${votes.length === 0 ? `<div class="card text-center text-slate-400 py-6 text-sm">还没有投票 · 点右上角"+ 发起投票"</div>` : `
      <div class="space-y-3">
        ${votes.map((v, vi) => {
          const total = v.options.reduce((s,o) => s + o.votes.length, 0);
          return `
            <div class="card">
              <div class="flex items-center justify-between mb-2">
                <div class="font-medium text-sm">${escapeHtml(v.title)}</div>
                <button class="vote-del text-xs text-slate-400 hover:text-red-600" data-vi="${vi}">×</button>
              </div>
              <div class="space-y-2">
                ${v.options.map((o, oi) => {
                  const pct = total ? Math.round(o.votes.length / total * 100) : 0;
                  return `
                    <div>
                      <div class="flex items-center justify-between text-xs mb-1">
                        <button class="vote-opt text-left flex-1 hover:text-blue-700" data-vi="${vi}" data-oi="${oi}">${escapeHtml(o.text)}</button>
                        <span class="text-slate-500 ml-2">${o.votes.length} 票 ${pct}%</span>
                      </div>
                      <div class="vote-bar"><div class="vote-bar-fill" style="width:${pct}%"></div></div>
                      ${o.votes.length ? `<div class="text-xs text-slate-400 mt-1">${o.votes.map(escapeHtml).join('、')}</div>` : ''}
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `}
  `;

  // 顶部按钮
  $('#addMemberBtn').addEventListener('click', () => {
    const name = prompt('姓名:'); if (!name) return;
    const studentId = prompt('学号(可空):') || '';
    const role = prompt('在团队中的角色(如:选题/可视化/前端/文案):') || '';
    const isLeader = confirm('是队长吗?(确定=是)');
    State.data.members.push({ name, studentId, role, contact: '', isLeader, workspace: { duty: '', tasks: [], uploads: [], notes: '' } });
    State.save();
    Pages.team(root);
  });

  $('#addVoteBtn').addEventListener('click', () => {
    const title = prompt('投票标题(如:选哪个选题方向):'); if (!title) return;
    const optsStr = prompt('选项(用 / 分隔,如:长江禁渔/国家公园/沙漠光伏):'); if (!optsStr) return;
    const options = optsStr.split('/').map(s => ({ text: s.trim(), votes: [] })).filter(o => o.text);
    State.data.votes.push({ title, options });
    State.save();
    Pages.team(root);
  });

  // 成员操作
  $$('.member-toggle').forEach(b => b.addEventListener('click', e => {
    const i = parseInt(b.dataset.i);
    State.data.teamExpand = (expandedMember === i) ? null : i;
    State.save();
    Pages.team(root);
  }));

  $$('.member-edit').forEach(b => b.addEventListener('click', () => {
    const i = parseInt(b.dataset.i);
    const m = State.data.members[i];
    const name = prompt('姓名:', m.name); if (name === null) return;
    const studentId = prompt('学号:', m.studentId || '') ?? m.studentId;
    const role = prompt('角色:', m.role || '') ?? m.role;
    const contact = prompt('联系方式(QQ/微信/手机):', m.contact || '') ?? m.contact;
    const isLeader = confirm('是队长吗?(确定=是)');
    Object.assign(m, { name: name.trim(), studentId: studentId.trim(), role: role.trim(), contact: contact.trim(), isLeader });
    State.save();
    Pages.team(root);
  }));

  $$('.member-del').forEach(b => b.addEventListener('click', () => {
    const i = parseInt(b.dataset.i);
    if (confirm(`删除成员 ${State.data.members[i].name}?`)) {
      State.data.members.splice(i, 1);
      if (State.data.teamExpand === i) State.data.teamExpand = null;
      State.save();
      Pages.team(root);
    }
  }));

  // 个人分工
  $$('.member-duty').forEach(t => {
    let timer = null;
    t.addEventListener('input', e => {
      const i = parseInt(e.target.dataset.i);
      clearTimeout(timer);
      timer = setTimeout(() => {
        State.data.members[i].workspace.duty = e.target.value;
        State.save();
      }, 400);
    });
  });

  // 个人笔记
  $$('.member-notes').forEach(t => {
    let timer = null;
    t.addEventListener('input', e => {
      const i = parseInt(e.target.dataset.i);
      clearTimeout(timer);
      timer = setTimeout(() => {
        State.data.members[i].workspace.notes = e.target.value;
        State.save();
      }, 400);
    });
  });

  // 个人任务
  $$('.add-mem-task').forEach(b => b.addEventListener('click', () => {
    const i = parseInt(b.dataset.i);
    const title = prompt('任务标题:'); if (!title) return;
    const due = prompt('截止日期(可空,如 2026-06-15):') || '';
    State.data.members[i].workspace.tasks.push({ title, due, done: false });
    State.save();
    Pages.team(root);
  }));
  $$('.mem-task-check').forEach(c => c.addEventListener('change', e => {
    const wrap = e.target.closest('.checkbox-task');
    const i = parseInt(wrap.dataset.i);
    const ti = parseInt(wrap.dataset.ti);
    State.data.members[i].workspace.tasks[ti].done = e.target.checked;
    State.save();
    Pages.team(root);
  }));
  $$('.mem-task-del').forEach(b => b.addEventListener('click', e => {
    const i = parseInt(b.dataset.i);
    const ti = parseInt(b.dataset.ti);
    if (confirm('删除任务?')) {
      State.data.members[i].workspace.tasks.splice(ti, 1);
      State.save();
      Pages.team(root);
    }
  }));

  // 个人成果上传
  $$('.add-mem-upload').forEach(b => b.addEventListener('click', () => {
    const i = parseInt(b.dataset.i);
    const name = prompt('成果名称(如:数据初稿/作品阐述/可视化草图):'); if (!name) return;
    const url = prompt('链接URL(网盘/腾讯文档/Figma/任何URL):'); if (!url) return;
    const typeMap = { '1': 'doc', '2': 'image', '3': 'video', '4': 'link' };
    const t = prompt('类型: 1=文档 2=图片 3=视频 4=其他链接', '4');
    State.data.members[i].workspace.uploads.push({
      name, url, type: typeMap[t] || 'link',
      time: todayStr()
    });
    State.save();
    Pages.team(root);
  }));
  $$('.mem-upload-del').forEach(b => b.addEventListener('click', e => {
    const i = parseInt(b.dataset.i);
    const ui = parseInt(b.dataset.ui);
    if (confirm('删除此成果链接?')) {
      State.data.members[i].workspace.uploads.splice(ui, 1);
      State.save();
      Pages.team(root);
    }
  }));

  // 公告/会议/白板
  $('#addAnnouncementBtn')?.addEventListener('click', () => {
    const text = prompt('公告内容(支持多行):'); if (!text) return;
    const author = prompt('发布人(可空):') || '';
    if (!State.data.announcements) State.data.announcements = [];
    State.data.announcements.unshift({ text, author, time: new Date().toLocaleString('zh-CN') });
    State.save();
    Pages.team(root);
  });

  $$('.ann-del').forEach(b => b.addEventListener('click', e => {
    const i = parseInt(b.dataset.i);
    if (confirm('删除此公告?')) {
      State.data.announcements.splice(i, 1);
      State.save();
      Pages.team(root);
    }
  }));

  $('#addMeetingBtn')?.addEventListener('click', () => {
    const title = prompt('会议主题:'); if (!title) return;
    const time = prompt('时间(如 2026-06-15 19:00):') || '';
    const place = prompt('地点(如 腾讯会议/图书馆 305):') || '';
    const agenda = prompt('议程(可空,支持多行):') || '';
    if (!State.data.meetings) State.data.meetings = [];
    State.data.meetings.push({ title, time, place, agenda });
    State.save();
    Pages.team(root);
  });

  $$('.meeting-del').forEach(b => b.addEventListener('click', e => {
    const i = parseInt(b.dataset.i);
    if (confirm('删除此会议?')) {
      State.data.meetings.splice(i, 1);
      State.save();
      Pages.team(root);
    }
  }));

  const wb = $('#whiteboard');
  if (wb) {
    let wbTimer = null;
    wb.addEventListener('input', e => {
      $('#whiteboardStatus').textContent = '⏳ 保存中...';
      clearTimeout(wbTimer);
      wbTimer = setTimeout(() => {
        State.data.whiteboard = e.target.value;
        State.save();
        $('#whiteboardStatus').textContent = '✓ 已保存 ' + new Date().toLocaleTimeString();
      }, 400);
    });
  }

  // 投票操作
  $$('.vote-del').forEach(b => b.addEventListener('click', e => {
    const vi = parseInt(b.dataset.vi);
    if (confirm('删除此投票?')) {
      State.data.votes.splice(vi, 1);
      State.save();
      Pages.team(root);
    }
  }));
  $$('.vote-opt').forEach(b => b.addEventListener('click', e => {
    const vi = parseInt(e.currentTarget.dataset.vi);
    const oi = parseInt(e.currentTarget.dataset.oi);
    const voter = prompt('你的名字:'); if (!voter) return;
    State.data.votes[vi].options.forEach(o => {
      o.votes = o.votes.filter(n => n !== voter);
    });
    State.data.votes[vi].options[oi].votes.push(voter);
    State.save();
    Pages.team(root);
  }));
};

// --- AI 工作台(数据新闻智能体) ---
Pages.ai = (root) => {
  const view = State.data.aiView || 'workflow'; // workflow | tools | prompts
  const expandedStep = State.data.aiStepExpand;
  const expandedPrompt = State.data.aiPromptExpand;
  const stepProgress = State.data.aiStepProgress || {}; // {step1:{done:[true,false,...]}}

  root.innerHTML = `
    <div class="flex items-center justify-between mb-4 flex-wrap gap-2">
      <div>
        <h2 class="text-2xl font-bold">🤖 AI 数据新闻工作台</h2>
        <p class="text-xs text-slate-500 mt-1">专为数据新闻大赛设计的 AI 工作流 · 不直接接 API · 把提示词带去任意 AI 工具</p>
      </div>
      <div class="flex gap-1 bg-slate-200 p-1 rounded-lg text-xs">
        <button class="ai-tab px-3 py-2 rounded ${view==='workflow'?'bg-white shadow font-medium':''}" data-view="workflow">🛠 7步工作流</button>
        <button class="ai-tab px-3 py-2 rounded ${view==='prompts'?'bg-white shadow font-medium':''}" data-view="prompts">📝 提示词库</button>
        <button class="ai-tab px-3 py-2 rounded ${view==='quotes'?'bg-white shadow font-medium':''}" data-view="quotes">💡 知识金句</button>
        <button class="ai-tab px-3 py-2 rounded ${view==='tools'?'bg-white shadow font-medium':''}" data-view="tools">🌐 AI工具站</button>
      </div>
    </div>
    <div id="aiContent"></div>
  `;

  $$('.ai-tab').forEach(b => b.addEventListener('click', () => {
    State.data.aiView = b.dataset.view;
    State.save();
    Pages.ai(root);
  }));

  const c = $('#aiContent');

  // ===== 视图1: 7 步工作流 =====
  if (view === 'workflow') {
    const totalSteps = WORKFLOW_STEPS.length;
    const finishedSteps = WORKFLOW_STEPS.filter(s => {
      const p = stepProgress[s.id];
      return p && p.done && p.done.length === s.deliverables.length && p.done.every(Boolean);
    }).length;

    c.innerHTML = `
      <div class="card mb-4 bg-blue-50 border-blue-200">
        <div class="flex items-center justify-between mb-2">
          <h3 class="font-bold text-blue-900 text-sm">🚀 完整作品工作流</h3>
          <span class="text-xs text-blue-900">${finishedSteps}/${totalSteps} 阶段完成</span>
        </div>
        <p class="text-xs text-blue-900">从选题到发布的 7 个阶段 · 每阶段都是一个"AI 智能体"角色 · 点击展开看提示词模板和推荐工具</p>
        <div class="vote-bar mt-3"><div class="vote-bar-fill" style="width:${Math.round(finishedSteps/totalSteps*100)}%"></div></div>
      </div>

      <div class="space-y-3">
        ${WORKFLOW_STEPS.map((s, idx) => {
          const isExpanded = expandedStep === s.id;
          const prog = stepProgress[s.id] || { done: s.deliverables.map(()=>false) };
          const doneCount = (prog.done||[]).filter(Boolean).length;
          const allDone = doneCount === s.deliverables.length;
          return `
            <div class="card ${isExpanded ? 'ring-2 ring-blue-400' : ''} ${allDone ? 'bg-green-50' : ''}">
              <div class="flex items-center gap-3 cursor-pointer step-header" data-id="${s.id}">
                <div class="text-3xl flex-shrink-0">${s.icon}</div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="font-bold text-base">${escapeHtml(s.phase)}</span>
                    <span class="tag bg-purple-100 text-purple-700">${escapeHtml(s.aiRole)}</span>
                    ${allDone ? '<span class="tag bg-green-100 text-green-700">✓ 已完成</span>' : ''}
                  </div>
                  <div class="text-xs text-slate-600 mt-1">${escapeHtml(s.desc)}</div>
                  <div class="text-xs text-slate-400 mt-1">📦 交付物 ${doneCount}/${s.deliverables.length}</div>
                </div>
                <div class="text-slate-400 text-lg flex-shrink-0">${isExpanded ? '▲' : '▼'}</div>
              </div>

              ${isExpanded ? `
                <div class="mt-4 pt-4 border-t space-y-4">
                  <!-- 这一步要懂的(嵌入学习内容) -->
                  ${s.learnPoints && s.learnPoints.length ? `
                    <div>
                      <label class="text-xs font-bold text-slate-600 mb-2 block">📖 这一步要懂的</label>
                      <ol class="space-y-2 list-none pl-0">
                        ${s.learnPoints.map((p, pi) => {
                          const sources = findLearnSource(p.from);
                          const sourceHtml = sources.length
                            ? sources.map(r => `<a href="${escapeHtml(r.url)}" target="_blank" rel="noopener" class="learn-source-link" title="点击跳转原文">${escapeHtml(r.title)} ↗</a>`).join(' · ')
                            : `<span class="text-amber-700">${escapeHtml(p.from)}</span>`;
                          return `
                          <li class="bg-amber-50 border-l-4 border-amber-400 rounded-r p-3">
                            <div class="flex items-start gap-3">
                              <span class="text-amber-700 font-serif font-bold text-base flex-shrink-0" style="font-style:italic;">${['i','ii','iii','iv','v','vi','vii','viii'][pi] || (pi+1)}.</span>
                              <div class="flex-1 min-w-0">
                                <div class="font-bold text-sm text-slate-800 mb-1">${escapeHtml(p.title)}</div>
                                <div class="text-xs text-slate-700 leading-relaxed mb-1">${escapeHtml(p.body)}</div>
                                <div class="text-xs font-mono mt-2" style="line-height:1.6;">📄 ${sourceHtml}</div>
                              </div>
                            </div>
                          </li>
                          `;
                        }).join('')}
                      </ol>
                    </div>
                  ` : ''}

                  <!-- 提示词模板 -->
                  <div>
                    <div class="flex items-center justify-between mb-2">
                      <label class="text-xs font-bold text-slate-600">📝 提示词模板(粘贴到任意 AI 工具)</label>
                      <button class="copy-prompt btn btn-primary text-xs" data-id="${s.id}">📋 一键复制</button>
                    </div>
                    <textarea id="prompt-${s.id}" class="field text-xs font-mono" rows="10" readonly>${escapeHtml(s.promptTemplate)}</textarea>
                  </div>

                  <!-- 推荐工具(快速跳转) -->
                  <div>
                    <label class="text-xs font-bold text-slate-600 mb-1 block">🌐 推荐 AI 工具(点击复制提示词后跳转)</label>
                    <div class="flex flex-wrap gap-2">
                      ${s.tools.map(t => {
                        const tool = AI_TOOLS.find(x => x.name === t || x.name.startsWith(t.split('(')[0]));
                        return tool
                          ? `<a href="${escapeHtml(tool.url)}" target="_blank" rel="noopener" class="tool-jump btn btn-secondary text-xs no-underline" data-id="${s.id}" style="text-decoration:none;">🚀 ${escapeHtml(tool.name)} ↗</a>`
                          : `<span class="btn btn-secondary text-xs opacity-60">${escapeHtml(t)}</span>`;
                      }).join('')}
                    </div>
                  </div>

                  <!-- 交付物清单 -->
                  <div>
                    <label class="text-xs font-bold text-slate-600 mb-1 block">📦 本阶段交付物清单</label>
                    <div class="space-y-1">
                      ${s.deliverables.map((d, di) => `
                        <label class="flex items-center gap-2 p-2 rounded hover:bg-slate-50 cursor-pointer">
                          <input type="checkbox" class="step-deliverable" data-id="${s.id}" data-di="${di}" ${prog.done[di] ? 'checked' : ''}>
                          <span class="text-sm ${prog.done[di] ? 'line-through text-slate-400' : ''}">${escapeHtml(d)}</span>
                        </label>
                      `).join('')}
                    </div>
                  </div>
                </div>
              ` : ''}
            </div>
          `;
        }).join('')}
      </div>
    `;

    $$('.step-header').forEach(h => h.addEventListener('click', e => {
      if (e.target.tagName === 'BUTTON' || e.target.tagName === 'A' || e.target.tagName === 'INPUT') return;
      const id = h.dataset.id;
      State.data.aiStepExpand = (expandedStep === id) ? null : id;
      State.save();
      Pages.ai(root);
    }));

    $$('.copy-prompt').forEach(b => b.addEventListener('click', e => {
      e.stopPropagation();
      const id = b.dataset.id;
      const step = WORKFLOW_STEPS.find(s => s.id === id);
      navigator.clipboard.writeText(step.promptTemplate).then(() => {
        const old = b.textContent;
        b.textContent = '✅ 已复制!';
        b.classList.add('btn-secondary');
        b.classList.remove('btn-primary');
        setTimeout(() => {
          b.textContent = old;
          b.classList.remove('btn-secondary');
          b.classList.add('btn-primary');
        }, 1500);
      });
    }));

    $$('.tool-jump').forEach(a => a.addEventListener('click', e => {
      const id = a.dataset.id;
      const step = WORKFLOW_STEPS.find(s => s.id === id);
      if (step) navigator.clipboard.writeText(step.promptTemplate).catch(()=>{});
    }));

    $$('.step-deliverable').forEach(cb => cb.addEventListener('change', e => {
      e.stopPropagation();
      const id = cb.dataset.id;
      const di = parseInt(cb.dataset.di);
      const step = WORKFLOW_STEPS.find(s => s.id === id);
      if (!stepProgress[id]) stepProgress[id] = { done: step.deliverables.map(()=>false) };
      stepProgress[id].done[di] = cb.checked;
      State.data.aiStepProgress = stepProgress;
      State.save();
      Pages.ai(root);
    }));

    return;
  }

  // ===== 视图2: 提示词库 =====
  if (view === 'prompts') {
    const cats = [...new Set(PROMPT_LIBRARY.map(p => p.cat))];
    const currentCat = State.data.aiPromptFilter || '全部';
    const filtered = currentCat === '全部' ? PROMPT_LIBRARY : PROMPT_LIBRARY.filter(p => p.cat === currentCat);

    c.innerHTML = `
      <div class="card mb-4 bg-purple-50 border-purple-200">
        <h3 class="font-bold text-purple-900 text-sm mb-1">📝 数据新闻提示词资产库</h3>
        <p class="text-xs text-purple-900">${PROMPT_LIBRARY.length} 个精心打磨的提示词模板 · 点"复制"即可粘贴到任意 AI 工具</p>
      </div>

      <div class="card mb-4">
        <div class="flex flex-wrap gap-2">
          <button class="prompt-cat btn ${currentCat==='全部'?'btn-primary':'btn-secondary'}" data-cat="全部">全部 ${PROMPT_LIBRARY.length}</button>
          ${cats.map(cat => `
            <button class="prompt-cat btn ${currentCat===cat?'btn-primary':'btn-secondary'}" data-cat="${escapeHtml(cat)}">${escapeHtml(cat)} ${PROMPT_LIBRARY.filter(p=>p.cat===cat).length}</button>
          `).join('')}
        </div>
      </div>

      <div class="space-y-3">
        ${filtered.map((p, i) => {
          const id = `${p.cat}-${i}`;
          const isExpanded = expandedPrompt === id;
          return `
            <div class="card ${isExpanded?'ring-2 ring-purple-400':''}">
              <div class="flex items-start justify-between gap-2 mb-2 cursor-pointer prompt-header" data-id="${id}">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 flex-wrap mb-1">
                    <span class="tag bg-purple-100 text-purple-700">${escapeHtml(p.cat)}</span>
                    <span class="font-bold text-sm">${escapeHtml(p.name)}</span>
                  </div>
                  <div class="text-xs text-slate-500">${escapeHtml(p.desc)}</div>
                </div>
                <div class="text-slate-400 flex-shrink-0">${isExpanded?'▲':'▼'}</div>
              </div>

              ${isExpanded ? `
                <div class="mt-3 pt-3 border-t space-y-3">
                  <textarea id="lib-${id}" class="field text-xs font-mono" rows="${Math.min(15, p.body.split(String.fromCharCode(10)).length+1)}">${escapeHtml(p.body)}</textarea>
                  <div class="flex gap-2 flex-wrap">
                    <button class="lib-copy btn btn-primary text-xs" data-id="${id}">📋 复制提示词</button>
                    <a href="https://chat.deepseek.com/" target="_blank" rel="noopener" class="btn btn-secondary text-xs" style="text-decoration:none;">→ 去 DeepSeek</a>
                    <a href="https://kimi.moonshot.cn/" target="_blank" rel="noopener" class="btn btn-secondary text-xs" style="text-decoration:none;">→ 去 Kimi</a>
                    <a href="https://tongyi.aliyun.com/" target="_blank" rel="noopener" class="btn btn-secondary text-xs" style="text-decoration:none;">→ 去 通义</a>
                  </div>
                  <p class="text-xs text-slate-400">💡 你可以直接在上面框里改提示词,改完点"复制"再粘贴到 AI 工具</p>
                </div>
              ` : ''}
            </div>
          `;
        }).join('')}
      </div>

      <div class="card mt-4 bg-amber-50 border-amber-200">
        <h3 class="font-bold text-amber-900 text-sm mb-2">✏️ 添加自定义提示词</h3>
        <p class="text-xs text-amber-900 mb-2">用得顺手的提示词可以加进来,跟队友共享(通过导出 JSON)</p>
        <button id="addCustomPrompt" class="btn btn-primary text-xs">+ 添加我的提示词</button>
      </div>

      <div id="customPromptsArea"></div>
    `;

    $$('.prompt-cat').forEach(b => b.addEventListener('click', () => {
      State.data.aiPromptFilter = b.dataset.cat;
      State.save();
      Pages.ai(root);
    }));

    $$('.prompt-header').forEach(h => h.addEventListener('click', () => {
      const id = h.dataset.id;
      State.data.aiPromptExpand = (expandedPrompt === id) ? null : id;
      State.save();
      Pages.ai(root);
    }));

    $$('.lib-copy').forEach(b => b.addEventListener('click', () => {
      const id = b.dataset.id;
      const ta = $(`#lib-${id}`);
      navigator.clipboard.writeText(ta.value).then(() => {
        const old = b.textContent;
        b.textContent = '✅ 已复制';
        setTimeout(() => b.textContent = old, 1500);
      });
    }));

    // 自定义提示词管理
    const customPrompts = State.data.customPrompts || [];
    const customArea = $('#customPromptsArea');
    if (customPrompts.length > 0) {
      customArea.innerHTML = `
        <h3 class="font-bold text-sm mt-4 mb-2">⭐ 我的自定义提示词 (${customPrompts.length})</h3>
        <div class="space-y-2">
          ${customPrompts.map((cp, i) => `
            <div class="card">
              <div class="flex items-center justify-between gap-2 mb-2">
                <span class="font-bold text-sm">${escapeHtml(cp.name)}</span>
                <div class="flex gap-2">
                  <button class="custom-copy btn btn-primary text-xs" data-i="${i}">📋 复制</button>
                  <button class="custom-del text-xs text-slate-400 hover:text-red-600" data-i="${i}">删除</button>
                </div>
              </div>
              <textarea class="field text-xs font-mono" rows="6" readonly id="custom-${i}">${escapeHtml(cp.body)}</textarea>
            </div>
          `).join('')}
        </div>
      `;
      $$('.custom-copy').forEach(b => b.addEventListener('click', e => {
        const i = parseInt(b.dataset.i);
        navigator.clipboard.writeText(customPrompts[i].body).then(() => {
          const old = b.textContent;
          b.textContent = '✅';
          setTimeout(() => b.textContent = old, 1200);
        });
      }));
      $$('.custom-del').forEach(b => b.addEventListener('click', () => {
        const i = parseInt(b.dataset.i);
        if (confirm('删除这条自定义提示词?')) {
          State.data.customPrompts.splice(i, 1);
          State.save();
          Pages.ai(root);
        }
      }));
    }

    $('#addCustomPrompt').addEventListener('click', () => {
      const name = prompt('提示词名称(简短描述用途):');
      if (!name) return;
      const body = prompt('提示词正文:');
      if (!body) return;
      if (!State.data.customPrompts) State.data.customPrompts = [];
      State.data.customPrompts.push({ name: name.trim(), body: body.trim() });
      State.save();
      Pages.ai(root);
    });

    return;
  }

  // ===== 视图: 知识金句墙 =====
  if (view === 'quotes') {
    c.innerHTML = `
      <div class="card mb-4 bg-amber-50 border-amber-200">
        <h3 class="font-bold text-amber-900 text-sm mb-1">💡 写阐述书随时取用的金句</h3>
        <p class="text-xs text-amber-900">${QUOTE_WALL.length} 条精选金句 · 点任一卡片复制到剪贴板</p>
      </div>
      <div class="grid md:grid-cols-2 gap-3">
        ${QUOTE_WALL.map((q, i) => `
          <div class="card card-hover quote-card cursor-pointer" data-i="${i}">
            <div class="text-base text-slate-800 leading-relaxed italic" style="font-family:'Noto Serif SC',serif;">"${escapeHtml(q.text)}"</div>
            <div class="text-xs text-slate-500 mt-3 text-right">— ${escapeHtml(q.from)}</div>
          </div>
        `).join('')}
      </div>
    `;
    $$('.quote-card').forEach(c2 => c2.addEventListener('click', () => {
      const i = parseInt(c2.dataset.i);
      const text = `"${QUOTE_WALL[i].text}" —— ${QUOTE_WALL[i].from}`;
      navigator.clipboard.writeText(text).then(() => {
        const old = c2.style.background;
        c2.style.background = '#dcfce7';
        setTimeout(() => c2.style.background = old, 800);
      });
    }));
    return;
  }

  // ===== 视图3: AI 工具站点矩阵 =====
  if (view === 'tools') {
    const cats = [...new Set(AI_TOOLS.map(t => t.cat))];
    c.innerHTML = `
      <div class="card mb-4 bg-green-50 border-green-200">
        <h3 class="font-bold text-green-900 text-sm mb-1">🌐 数据新闻 AI 工具矩阵</h3>
        <p class="text-xs text-green-900">${AI_TOOLS.length} 个精选工具 · 按用途分类 · 优先国产可用 · 点击直达官网</p>
      </div>
      ${cats.map(cat => {
        const items = AI_TOOLS.filter(t => t.cat === cat);
        return `
          <div class="mb-4">
            <h3 class="font-bold mb-2 text-sm">📂 ${escapeHtml(cat)} <span class="text-xs text-slate-400 font-normal">${items.length} 个</span></h3>
            <div class="grid md:grid-cols-2 gap-3">
              ${items.map(t => `
                <a href="${escapeHtml(t.url)}" target="_blank" rel="noopener" class="card card-hover block no-underline" style="text-decoration:none;color:inherit;">
                  <div class="font-bold text-sm mb-1">${escapeHtml(t.name)}</div>
                  <div class="text-xs text-slate-600 mb-2">${escapeHtml(t.desc)}</div>
                  <div class="text-xs text-blue-600">🎯 ${escapeHtml(t.use)}  <span class="text-slate-400">↗</span></div>
                </a>
              `).join('')}
            </div>
          </div>
        `;
      }).join('')}
    `;
    return;
  }
};

// --- 资源链接 ---
Pages.resources = (root) => {
  const uploads = State.data.uploads;
  const cats = [...new Set(LEARN_TOOLS.map(t => t.cat))];
  const currentCat = State.data.resFilter || '全部';
  const filteredTools = currentCat === '全部' ? LEARN_TOOLS : LEARN_TOOLS.filter(t => t.cat === currentCat);
  const catColors = {
    '推荐工具': 'bg-blue-100 text-blue-700',
    '国家宏观数据': 'bg-red-100 text-red-700',
    '行业垂直数据': 'bg-orange-100 text-orange-700',
    '热点与舆情': 'bg-purple-100 text-purple-700',
    '国际数据': 'bg-emerald-100 text-emerald-700',
    '学术与导航': 'bg-slate-200 text-slate-700'
  };

  root.innerHTML = `
    <h2 class="text-2xl font-bold mb-2">📚 资源中心</h2>
    <p class="text-sm text-slate-500 mb-4">${LEARN_TOOLS.length} 个精选数据源 + 工具 · 按类型筛选 · 点击直达官网</p>

    <div class="grid md:grid-cols-2 gap-4 mb-4">
      <div class="card">
        <h3 class="font-bold mb-3">📌 大赛官方</h3>
        <ul class="space-y-2 text-sm">
          <li>📝 <a href="https://www.smartsowo.com/competition/detail?id=16" target="_blank" class="text-blue-600 hover:underline">数据新闻大赛报名系统</a></li>
          <li>🤖 <a href="https://www.smartsowo.com/competition/detail?id=18" target="_blank" class="text-blue-600 hover:underline">AIGC应用大赛报名系统</a></li>
          <li>📧 官方邮箱:cdjc_xj@163.com</li>
          <li>📧 缴费问题:fanxuefan_ng@163.com</li>
        </ul>
      </div>

      <div class="card">
        <div class="flex items-center justify-between mb-3">
          <h3 class="font-bold">📦 团队共享链接</h3>
          <button id="addUploadBtn" class="btn btn-primary text-xs">+ 添加</button>
        </div>
        ${uploads.length === 0 ? `<p class="text-sm text-slate-400 text-center py-4">把网盘/腾讯文档/Figma链接放这里</p>` : `
          <ul class="space-y-2 text-sm">
            ${uploads.map((u, i) => `
              <li class="flex items-center gap-2">
                <a href="${escapeHtml(u.url)}" target="_blank" class="text-blue-600 hover:underline flex-1 truncate">${escapeHtml(u.name)}</a>
                <span class="text-xs text-slate-400 flex-shrink-0">${escapeHtml(u.uploader || '')}</span>
                <button class="upload-del text-xs text-slate-400 hover:text-red-600 flex-shrink-0" data-i="${i}">×</button>
              </li>
            `).join('')}
          </ul>
        `}
      </div>
    </div>

    <div class="card mb-4">
      <h3 class="font-bold text-sm mb-3">🔎 按类型筛选</h3>
      <div class="flex flex-wrap gap-2">
        <button class="res-filter btn ${currentCat==='全部'?'btn-primary':'btn-secondary'}" data-cat="全部">全部 ${LEARN_TOOLS.length}</button>
        ${cats.map(cat => `
          <button class="res-filter btn ${currentCat===cat?'btn-primary':'btn-secondary'}" data-cat="${escapeHtml(cat)}">${escapeHtml(cat)} ${LEARN_TOOLS.filter(t=>t.cat===cat).length}</button>
        `).join('')}
      </div>
    </div>

    <div class="grid md:grid-cols-2 gap-3">
      ${filteredTools.map(t => `
        <a href="${escapeHtml(t.url)}" target="_blank" rel="noopener" class="card card-hover block no-underline" style="text-decoration:none;color:inherit;">
          <div class="flex items-start justify-between gap-2 mb-2">
            <span class="tag ${catColors[t.cat] || 'bg-slate-100 text-slate-700'}">${escapeHtml(t.cat)}</span>
            <span class="text-xs text-blue-600">↗</span>
          </div>
          <div class="font-bold text-sm mb-1">${escapeHtml(t.title)}</div>
          <div class="text-xs text-slate-600 mb-2">${escapeHtml(t.summary)}</div>
          ${t.why ? `<div class="text-xs text-blue-700 bg-blue-50 rounded px-2 py-1">💡 ${escapeHtml(t.why)}</div>` : ''}
        </a>
      `).join('')}
    </div>
  `;

  $$('.res-filter').forEach(b => b.addEventListener('click', () => {
    State.data.resFilter = b.dataset.cat;
    State.save();
    Pages.resources(root);
  }));

  $('#addUploadBtn').addEventListener('click', () => {
    const name = prompt('链接名称(如:数据初稿/作品阐述):'); if (!name) return;
    const url = prompt('链接URL:'); if (!url) return;
    const uploader = prompt('上传人(可空):') || '';
    State.data.uploads.push({ name, url, uploader, time: todayStr() });
    State.save();
    Pages.resources(root);
  });

  $$('.upload-del').forEach(b => b.addEventListener('click', e => {
    const i = parseInt(e.target.dataset.i);
    if (confirm('删除此链接?')) {
      State.data.uploads.splice(i, 1);
      State.save();
      Pages.resources(root);
    }
  }));
};

// === 导入/导出 ===
function exportData() {
  const blob = new Blob([JSON.stringify(State.data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `dn-dashboard-${todayStr()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function importData() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json';
  input.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!confirm('导入将覆盖当前所有数据，确定？')) return;
        State.data = data;
        State.save();
        location.reload();
      } catch {
        alert('文件解析失败');
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

// === 启动 ===
async function init() {
  State.load();

  // 启动时若已配置云,尝试从云端拉一次最新数据(静默失败)
  if (CLOUD.appId) {
    const auto = await cloudPull();
    if (auto.ok) console.log('[云同步] 启动自动拉取成功:', auto.time);
  }

  router();
  window.addEventListener('hashchange', router);

  $('#exportBtn').addEventListener('click', async () => {
    const last = State.data.lastSyncTime || '从未同步';
    const choice = prompt(
      '云同步操作:\n\n' +
      '1 = ⬆️ 推送到云(覆盖云端)\n' +
      '2 = ⬇️ 从云拉取(覆盖本地)\n' +
      '3 = 📥 导出 JSON 到本地文件\n' +
      '4 = 📤 从 JSON 文件导入\n\n' +
      '上次同步:' + last + '\n' +
      '取消 = 关闭',
      '2'
    );
    if (choice === '1') {
      if (!CLOUD.appId) { alert('云同步未配置'); return; }
      if (!confirm('推送会覆盖云端数据,所有队员下次刷新会看到你的版本。继续?')) return;
      const r = await cloudPush();
      if (r.ok) alert('✅ 已推送到云\n时间:' + r.time);
      else alert('❌ 推送失败:' + (r.error || '未知错误'));
    } else if (choice === '2') {
      if (!CLOUD.appId) { alert('云同步未配置'); return; }
      if (!confirm('拉取会覆盖你本地的所有数据。继续?')) return;
      const r = await cloudPull();
      if (r.ok) { alert('✅ 已拉取最新数据\n时间:' + r.time); location.reload(); }
      else if (r.empty) alert('⚠️ 云端暂无数据 · 请先让某位队员"推送到云"');
      else alert('❌ 拉取失败:' + (r.error || '未知错误'));
    } else if (choice === '3') exportData();
    else if (choice === '4') importData();
  });
}

init();



