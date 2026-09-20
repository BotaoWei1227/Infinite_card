const $ = (s) => document.querySelector(s);
const state = { cards: JSON.parse(localStorage.getItem('mythic-cards') || '[]'), selected: JSON.parse(localStorage.getItem('mythic-deck') || '[]') };
const fallbackImages = ['https://images.unsplash.com/photo-1531058020387-3be344556be6?auto=format&fit=crop&w=800&q=80','https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=800&q=80'];

function save() { localStorage.setItem('mythic-cards', JSON.stringify(state.cards)); localStorage.setItem('mythic-deck', JSON.stringify(state.selected)); }
function escapeHTML(text='') { const n=document.createElement('span');n.textContent=text;return n.innerHTML; }
function typeFor(stats) { const max = Object.entries(stats).sort((a,b)=>b[1]-a[1])[0][0]; return ({attack:'DEVASTATOR',heal:'VITALIST',defense:'BASTION',special:'ANOMALY'})[max]; }
function normalizeCard(raw, wiki) { let nums=['attack','heal','defense','special'].map(k=>Math.max(0,Number(raw[k])||0)); let sum=nums.reduce((a,b)=>a+b,0); if(!sum) nums=[40,10,30,20],sum=100; nums=nums.map(n=>Math.round(n*100/sum)); nums[0]+=100-nums.reduce((a,b)=>a+b,0); const [attack,heal,defense,special]=nums; return { id: crypto.randomUUID(), name:(raw.name||wiki.title).slice(0,30), summary:(raw.summary||wiki.extract||'由人類知識鍛造的未知力量。').slice(0,85), ability:(raw.ability||'知識共鳴：在對決中留下不可預測的痕跡。').slice(0,70), attack,heal,defense,special, rarity:raw.rarity||typeFor({attack,heal,defense,special}), image:wiki.image||fallbackImages[state.cards.length%fallbackImages.length], source:wiki.url } }
function cardNode(card, selectable=true) { const node=$('#card-template').content.firstElementChild.cloneNode(true); node.querySelector('.rarity').textContent=card.rarity;node.querySelector('.card-id').textContent='#'+card.id.slice(0,4).toUpperCase(); node.querySelector('.card-image').style.backgroundImage=`url("${card.image}")`;node.querySelector('.card-kicker').textContent=typeFor(card);node.querySelector('h3').textContent=card.name;node.querySelector('.flavor').textContent=card.summary; ['attack','heal','defense','special'].forEach(k=>node.querySelector('.'+k).textContent=card[k]);node.querySelector('.ability p').textContent=card.ability;
 if(!selectable){node.querySelector('.select-card').remove();return node} const chosen=state.selected.includes(card.id);node.classList.toggle('selected',chosen);node.querySelector('.select-card').textContent=chosen?'已加入牌組 ✓':'加入出戰牌組';node.querySelector('.select-card').onclick=()=>toggleCard(card.id);return node;
}
function render() { $('#card-count').textContent=state.cards.length; $('#collection-grid').replaceChildren(...state.cards.map(c=>cardNode(c))); $('#empty-collection').classList.toggle('hidden',state.cards.length>0); const n=state.selected.length; $('#deck-meter').innerHTML=`選擇 <strong>${n}</strong> / 4 張卡牌`;$('#start-battle').disabled=n!==4; }
function toggleCard(id){ const index=state.selected.indexOf(id); if(index>=0) state.selected.splice(index,1); else if(state.selected.length<4) state.selected.push(id); else return alert('牌組最多只能有四張卡牌。');save();render(); }
function show(view) { document.querySelectorAll('.view').forEach(x=>x.classList.toggle('active',x.id===view));document.querySelectorAll('.nav-btn').forEach(x=>x.classList.toggle('active',x.dataset.view===view)); if(view==='battle') render();window.scrollTo({top:0,behavior:'smooth'}); }
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>show(b.dataset.view)));

function articleTitle(parsed) {
  const fromPath = parsed.pathname.match(/\/wiki\/(.+)$/)?.[1];
  const fromQuery = parsed.searchParams.get('title');
  // 維基百科的內容語言切換網址會是 /zh-tw/核武器，而非 /wiki/核武器。
  const fromLanguagePath = parsed.pathname.match(/^\/[a-z]{2,3}(?:-[a-z0-9]+)?\/(.+)$/i)?.[1];
  return decodeURIComponent(fromQuery || fromPath || fromLanguagePath || '').replaceAll('_', ' ').trim();
}
async function jsonFetch(url) {
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}
async function getWiki(url) {
  let parsed;
  try { parsed = new URL(url); } catch { throw new Error('網址格式不正確，請貼上完整的 Wikipedia 文章網址。'); }
  if (!/(^|\.)wikipedia\.org$/i.test(parsed.hostname)) throw new Error('目前只支援 Wikipedia 的文章網址。');
  const title = articleTitle(parsed);
  if (!title) throw new Error('找不到文章標題。請使用像「…wikipedia.org/wiki/核武器」的文章網址。');
  const host = parsed.hostname.replace(/\.m\.wikipedia\.org$/i, '.wikipedia.org');
  const origin = `${parsed.protocol}//${host}`;
  const encodedTitle = encodeURIComponent(title.replaceAll(' ', '_'));
  let summary;
  try {
    summary = await jsonFetch(`${origin}/api/rest_v1/page/summary/${encodedTitle}`);
    if (summary.type === 'https://mediawiki.org/wiki/HyperSwitch/errors/not_found') throw new Error('not found');
    return { title: summary.title, extract: summary.extract || summary.description || '', image: summary.thumbnail?.source, url: summary.content_urls?.desktop?.page || url };
  } catch (restError) {
    try {
      const api = `${origin}/w/api.php?action=query&origin=*&format=json&prop=extracts%7Cpageimages&exintro=1&explaintext=1&pithumbsize=800&titles=${encodedTitle}`;
      const data = await jsonFetch(api);
      const page = Object.values(data.query?.pages || {})[0];
      if (!page || page.missing !== undefined) throw new Error('not found');
      return { title: page.title, extract: page.extract || '', image: page.thumbnail?.source, url };
    } catch {
      throw new Error('無法讀取這篇維基文章。請確認網址是公開的文章頁面，或稍後再試。');
    }
  }
}
function localOracle(wiki){ const text=(wiki.title+' '+wiki.extract).toLowerCase(); let a=35,h=10,d=30,s=25; if(/武器|戰爭|missile|gun|nuclear|核/.test(text)) [a,h,d,s]=[72,0,10,18]; else if(/醫|藥|生命|health|medicine/.test(text)) [a,h,d,s]=[15,60,15,10]; else if(/建築|城|堡|防禦|building|fort/.test(text)) [a,h,d,s]=[12,8,67,13]; return {name:wiki.title,summary:wiki.extract,attack:a,heal:h,defense:d,special:s,ability:'知識殘響：此造物的背景故事使它在戰局中產生獨特的壓力。'}; }
async function callGemini(key, model, prompt, generationConfig={}) {
  let response;
  try { response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({contents:[{parts:[{text:prompt}]}], generationConfig}) }); }
  catch { throw new Error('無法連線至 Gemini。請檢查網路或瀏覽器是否封鎖連線。'); }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error?.message || `Gemini 連線失敗（${response.status}）`);
  return data;
}
async function geminiOracle(wiki) { const key=localStorage.getItem('gemini-key'); if(!key)return localOracle(wiki); const model=localStorage.getItem('gemini-model')||'gemini-2.5-flash'; const prompt=`你是繁體中文集換式卡牌遊戲的設計師。根據這篇維基百科內容，生成一張造物卡。四項數值 attack(攻擊), heal(治療), defense(防禦), special(特殊) 加總必須精確為100。特殊效果要有一個富創意、但簡短的能力名稱和作用。請只輸出 JSON：{"name":"","summary":"不超過55字","attack":0,"heal":0,"defense":0,"special":0,"ability":"不超過45字","rarity":"英文類別"}\n標題：${wiki.title}\n摘要：${wiki.extract.slice(0,1700)}`; const data=await callGemini(key,model,prompt,{responseMimeType:'application/json',temperature:.8}); return JSON.parse(data.candidates?.[0]?.content?.parts?.[0]?.text||'{}'); }
$('#forge-form').addEventListener('submit',async(e)=>{ e.preventDefault();const btn=e.currentTarget.querySelector('button');const original=btn.innerHTML;btn.disabled=true;btn.innerHTML='<span>ANALYZING…</span>';try{const wiki=await getWiki($('#wiki-url').value.trim());const raw=await geminiOracle(wiki);const card=normalizeCard(raw,wiki);state.cards.unshift(card);save();const prev=$('#preview-card');prev.replaceWith(cardNode(card,false));$('#preview-card')?.setAttribute('id','preview-card'); document.querySelector('.forge-preview .card').id='preview-card';render();}catch(err){alert(err.message)}finally{btn.disabled=false;btn.innerHTML=original} });
function setApiStatus(message, type='') { const el=$('#api-status'); el.textContent=message; el.className=`api-status ${type}`; }
$('#open-settings').onclick=()=>{$('#api-key').value=localStorage.getItem('gemini-key')||'';$('#model-name').value=localStorage.getItem('gemini-model')||'gemini-2.5-flash';setApiStatus('');$('#settings-dialog').showModal()};
$('#save-settings').onclick=()=>{localStorage.setItem('gemini-key',$('#api-key').value.trim());localStorage.setItem('gemini-model',$('#model-name').value.trim()||'gemini-2.5-flash');setApiStatus('設定已儲存於此瀏覽器。','success')};
$('#test-settings').onclick=async()=>{const key=$('#api-key').value.trim();const model=$('#model-name').value.trim()||'gemini-2.5-flash';const button=$('#test-settings');if(!key){setApiStatus('請先輸入 Gemini API Key。','error');return}button.disabled=true;button.textContent='測試中…';setApiStatus('正在向 Gemini 發送測試請求…','testing');try{const data=await callGemini(key,model,'只回答：OK',{maxOutputTokens:8});const answer=data.candidates?.[0]?.content?.parts?.[0]?.text?.trim()||'已取得回應';setApiStatus(`連線成功！Gemini 回應：「${answer.slice(0,30)}」`,'success')}catch(error){setApiStatus(`連線失敗：${error.message}`,'error')}finally{button.disabled=false;button.textContent='測試連線'}};
function createAiDeck(team) {
  const total = team.reduce((sum, card) => ({ attack:sum.attack + card.attack, heal:sum.heal + card.heal, defense:sum.defense + card.defense, special:sum.special + card.special }), {attack:0,heal:0,defense:0,special:0});
  const templates = [
    ['深海利維坦', 65, 4, 20, 11, '深淵衝擊：以高攻擊撕裂防線。'],
    ['時間修補者', 18, 52, 16, 14, '逆流修補：將傷害轉化為生命。'],
    ['黑曜堡壘', 14, 8, 67, 11, '黑曜壁壘：大幅吸收正面攻勢。'],
    ['量子迷霧', 28, 9, 17, 46, '相位偏移：特殊能量造成不可預測的傷害。']
  ];
  const favored = Object.entries(total).sort((a,b) => b[1] - a[1])[0][0];
  const counter = {attack:'defense', defense:'special', heal:'attack', special:'heal'}[favored];
  return templates.map(([name,attack,heal,defense,special,ability], index) => {
    const stats = {attack,heal,defense,special};
    stats[counter] += 8;
    stats.attack += Math.floor(Math.random() * 7) - 3;
    stats.defense += Math.floor(Math.random() * 7) - 3;
    const totalStats = Object.values(stats).reduce((a,b)=>a+b,0);
    const scale = 100 / totalStats;
    for (const stat of Object.keys(stats)) stats[stat] = Math.max(0, Math.round(stats[stat] * scale));
    stats.attack += 100 - Object.values(stats).reduce((a,b)=>a+b,0);
    return { id:`ai-${Date.now()}-${index}`, name, ability, ...stats, image:fallbackImages[index % fallbackImages.length] };
  });
}
function resolveRound(player, ai) {
  const playerDamage = Math.max(4, Math.round(player.attack * 1.05 + player.special * .55 - ai.defense * .48));
  const aiDamage = Math.max(4, Math.round(ai.attack * 1.05 + ai.special * .55 - player.defense * .48));
  const playerHealth = 62 + player.defense * .62 + player.heal * .38;
  const aiHealth = 62 + ai.defense * .62 + ai.heal * .38;
  const playerRemain = playerHealth - aiDamage + player.heal * .52;
  const aiRemain = aiHealth - playerDamage + ai.heal * .52;
  const outcome = Math.abs(playerRemain-aiRemain)<4 ? 'draw' : playerRemain > aiRemain ? 'player' : 'ai';
  return { outcome, playerDamage, aiDamage, playerRemain:Math.max(0,Math.round(playerRemain)), aiRemain:Math.max(0,Math.round(aiRemain)) };
}
$('#start-battle').onclick=()=>{
  const team=state.selected.map(id=>state.cards.find(c=>c.id===id)).filter(Boolean);
  const enemy=createAiDeck(team);
  const rounds=team.map((card,index)=>({player:card, ai:enemy[index], ...resolveRound(card,enemy[index])}));
  const wins=rounds.filter(r=>r.outcome==='player').length, losses=rounds.filter(r=>r.outcome==='ai').length;
  const winner=wins===losses?'平局：勢均力敵！':wins>losses?'你擊敗了 AI！':'AI 對手勝出';
  const faces=(cards,enemySide=false)=>`<div class="battle-side ${enemySide?'enemy':''}">${cards.map(c=>`<div class="battle-card"><img src="${c.image}" alt=""/><b>${escapeHTML(c.name)}</b><span>⚔${c.attack}　✦${c.special}</span></div>`).join('')}</div>`;
  const report=rounds.map((round,index)=>{const outcome=round.outcome==='player'?'你獲勝':round.outcome==='ai'?'AI 獲勝':'平局';return `<div>R${index+1}　${escapeHTML(round.player.name)} <b>${round.playerRemain}</b> HP　vs　<b>${round.aiRemain}</b> HP ${escapeHTML(round.ai.name)}　— ${outcome}<br/><small>你造成 ${round.playerDamage} 傷害；AI 造成 ${round.aiDamage} 傷害。</small></div>`}).join('');
  $('#battle-setup').classList.add('hidden');const board=$('#battle-board');board.classList.remove('hidden');board.innerHTML=`<div class="versus">${faces(team)}<div class="vs">VS<br/><small>AI</small></div>${faces(enemy,true)}</div><div class="battle-result"><h3>${winner}</h3><p>回合勝場：你 <b>${wins}</b>　—　AI <b>${losses}</b><br/>AI 已依你的主力能力調整了剋制牌組。</p></div><div class="battle-log">${report}</div>`;
};
render();
