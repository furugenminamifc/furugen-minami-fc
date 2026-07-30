let sb=null,session=null,profile=null,players=[],matches=[],records=[],reports=[],videoNotes=[],v7Plans=[],playerPrivate=[],playerGrowthRecords=[],playerMedicalRecords=[],playerSkillEvaluations=[],playerMatchEvaluations=[],teamSettings={},editingMatchId='',charts={};
let editingMatchEvaluations=[];
let playerPage=1;
const PLAYER_PAGE_SIZE=20;
const detailCache=new Map();
const DETAIL_CACHE_MS=5*60*1000;
const $=id=>document.getElementById(id);
function showMessage(text,type='warn'){const e=$('message');e.textContent=text;e.className=(type==='ok'?'notice success':'notice');e.classList.remove('hidden');setTimeout(()=>e.classList.add('hidden'),5000)}
function showPage(id){document.querySelectorAll('.page').forEach(x=>x.classList.remove('show'));$(id).classList.add('show');if(id==='entry')renderRecordInputs();if(id==='analytics')setTimeout(renderAnalytics,0);if(id==='ai')setTimeout(testAiConnection,0);if(id==='reports')setTimeout(renderReportsPage,0);if(id==='video')setTimeout(renderVideoPage,0);if(id==='ver7')setTimeout(renderV7Page,0)}
function isStaff(){return !!(profile&&profile.active&&['admin','coach'].includes(profile.role))}
function esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
async function init(){const c=window.FURUGEN_CONFIG;if(!c||!c.SUPABASE_URL||!c.SUPABASE_ANON_KEY){showMessage('config.jsの設定がありません。');return}sb=supabase.createClient(c.SUPABASE_URL,c.SUPABASE_ANON_KEY);const x=await sb.auth.getSession();session=x.data.session;await loadProfile();await loadAll();setupRealtime();sb.auth.onAuthStateChange(async(_,s)=>{session=s;await loadProfile();await loadAll()});if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{})}
async function loadProfile(){profile=null;if(session){const r=await sb.from('profiles').select('*').eq('id',session.user.id).maybeSingle();profile=r.data}const staff=isStaff();$('mode').textContent=staff?`${session.user.email}（${profile.role==='admin'?'管理者':'コーチ'}）`:'保護者閲覧モード';$('loginOut').classList.toggle('hidden',!!session);$('loginIn').classList.toggle('hidden',!session);$('entryForm').classList.toggle('hidden',!staff);$('needLogin').classList.toggle('hidden',staff);$('addPlayerBtn').classList.toggle('hidden',!staff);if(session)$('loginWho').textContent=`${session.user.email} / 権限：${profile?.role||'未設定'}`}
async function loadAll(){
 const [p,m,r,t,rp,vn,v7]=await Promise.all([
  sb.from('players').select('*').order('grade').order('name'),
  sb.from('matches').select('*').order('match_date',{ascending:false}),
  sb.from('records').select('*'),
  sb.from('team_settings').select('*'),
  sb.from('ai_reports').select('*').order('created_at',{ascending:false}).limit(100),
  sb.from('video_notes').select('*').order('created_at',{ascending:false}).limit(100),
  sb.from('ai_plans').select('*').order('created_at',{ascending:false}).limit(100)
 ]);
 if(p.error||m.error||r.error){showMessage('データ取得エラー：'+(p.error||m.error||r.error).message);return}
 players=p.data||[];matches=m.data||[];records=r.data||[];
 reports=rp.error?[]:(rp.data||[]);
 videoNotes=vn.error?[]:(vn.data||[]);
 v7Plans=v7.error?JSON.parse(localStorage.getItem('furugenV7Plans')||'[]'):(v7.data||[]);
 playerPrivate=[];playerGrowthRecords=[];playerMedicalRecords=[];playerSkillEvaluations=[];
 teamSettings={};if(!t.error)(t.data||[]).forEach(x=>teamSettings[x.key]=x.value);
 applyTeamSettings();refreshFilters();renderAll()
}
function setupRealtime(){sb.channel('furugen-live').on('postgres_changes',{event:'*',schema:'public',table:'players'},loadAll).on('postgres_changes',{event:'*',schema:'public',table:'matches'},loadAll).on('postgres_changes',{event:'*',schema:'public',table:'records'},loadAll).on('postgres_changes',{event:'*',schema:'public',table:'team_settings'},loadAll).on('postgres_changes',{event:'*',schema:'public',table:'ai_reports'},loadAll).on('postgres_changes',{event:'*',schema:'public',table:'video_notes'},loadAll).on('postgres_changes',{event:'*',schema:'public',table:'ai_plans'},loadAll).on('postgres_changes',{event:'*',schema:'public',table:'player_private'},loadAll).subscribe()}
function totals(p){const rr=records.filter(x=>x.player_id===p.id);return{apps:(p.past_apps||0)+rr.filter(x=>x.played).length,minutes:rr.reduce((a,x)=>a+(x.minutes||0),0),goals:(p.past_goals||0)+rr.reduce((a,x)=>a+(x.goals||0),0),assists:(p.past_assists||0)+rr.reduce((a,x)=>a+(x.assists||0),0),yellow:(p.past_yellow||0)+rr.reduce((a,x)=>a+(x.yellow||0),0),red:(p.past_red||0)+rr.reduce((a,x)=>a+(x.red||0),0),mvp:rr.filter(x=>x.mvp).length}}
function refreshFilters(){const seasons=[...new Set(matches.map(x=>x.season||String(x.match_date||'').slice(0,4)).filter(Boolean))].sort().reverse();$('matchSeason').innerHTML='<option value="">すべて</option>'+seasons.map(x=>`<option>${x}</option>`).join('');const grades=[...new Set(players.map(x=>x.grade).filter(Boolean))].sort();$('rankGrade').innerHTML='<option value="">すべて</option>'+grades.map(x=>`<option>${esc(x)}</option>`).join('');const as=$('analysisSeason'),ac=$('analysisCompetition');if(as){const seasons=[...new Set(matches.map(x=>x.season).filter(Boolean))].sort((a,b)=>b-a);const keep=as.value;as.innerHTML='<option value="">すべて</option>'+seasons.map(x=>`<option>${x}</option>`).join('');as.value=keep}if(ac){const comps=[...new Set(matches.map(x=>x.competition||'通常試合'))].sort((a,b)=>a.localeCompare(b,'ja'));const keep=ac.value;ac.innerHTML='<option value="">すべて</option>'+comps.map(x=>`<option>${esc(x)}</option>`).join('');ac.value=keep}}

function coachTotalsForPlayer(p){
 const t=totals(p);
 const evals=(typeof playerMatchEvaluations!=='undefined'?playerMatchEvaluations:[]).filter(x=>String(x.player_id)===String(p.id));
 const avg=evals.length?(evals.reduce((s,e)=>s+Number(evaluationOverall(e)),0)/evals.length).toFixed(1):'未評価';
 return {...t,evalAvg:avg}
}
function coachSendPrompt(mode,prompt){
 showPage('ai');
 const btn=document.querySelector(`[data-mode="${mode}"]`)||document.querySelector('[data-mode="match"]');
 if(btn)setAiMode(mode,btn);
 setAiPrompt(prompt);
 showMessage('AI Coachの分析材料をセットしました。内容を確認してAIへ送信してください。','ok')
}
function switchCoach11Mode(mode,btn){
 document.querySelectorAll('.coach11-panel').forEach(x=>x.classList.add('hidden'));
 const panel=$(`coach11-${mode}`);if(panel)panel.classList.remove('hidden');
 document.querySelectorAll('[data-coach-mode]').forEach(x=>x.classList.remove('active'));
 if(btn)btn.classList.add('active')
}
function startCoachQuickFlow(){showPage('entry');showMessage('①試合情報 → ②出場選手 → ③評価 → ④保存の順で入力してください。','ok')}
function coachLatestMatch(){return matches[0]||null}
function generateParentsMessageDraftFromCoach(){
 const m=coachLatestMatch();
 const prompt=`少年サッカーチームの保護者向け試合報告文を作成してください。
試合：${m?`${m.match_date||''} 対 ${m.opponent||''} ${m.goals_for||0}-${m.goals_against||0}`:'試合未登録'}
メモ：${m?.memo||'未入力'}
300文字以内、LINEで送りやすい文章にしてください。
構成：応援へのお礼、試合の様子、成長、次回への意気込み。`;
 coachSendPrompt('parents',prompt)
}
function runCoachPlayerReport(){
 const id=$('coachPlayerSelect')?.value,p=players.find(x=>String(x.id)===String(id));
 if(!p){showMessage('選手を選択してください。');return}
 const t=totals(p);
 const prompt=`${p.name}選手の個人レポート下書きを作成してください。
学年:${p.grade} ポジション:${p.position}
出場:${t.apps}試合 ${t.minutes}分 得点:${t.goals} アシスト:${t.assists}
強み:${p.strengths||'未入力'}
成長目標:${p.development_goal||'未入力'}

保護者面談と本人への声かけに使えるよう、
1. 今できていること
2. 成長した点
3. 次の課題
4. 家庭でできる応援
5. コーチからの前向きな一言
の順で作成してください。`;
 coachSendPrompt('player',prompt)
}
function runCoachSeasonAwards(){
 const rows=players.map(p=>({p,t:totals(p)}));
 const goals=[...rows].sort((a,b)=>b.t.goals-a.t.goals).slice(0,5);
 const assists=[...rows].sort((a,b)=>b.t.assists-a.t.assists).slice(0,5);
 const minutes=[...rows].sort((a,b)=>b.t.minutes-a.t.minutes).slice(0,5);
 const prompt=`古堅南FCの年間表彰候補を作成してください。
得点上位:${goals.map(x=>`${x.p.name}${x.t.goals}点`).join('、')}
アシスト上位:${assists.map(x=>`${x.p.name}${x.t.assists}`).join('、')}
出場時間上位:${minutes.map(x=>`${x.p.name}${x.t.minutes}分`).join('、')}

次の表彰候補を、根拠付きで提案してください。
MVP、得点王、アシスト王、守備賞、成長賞、努力賞、フェアプレー賞。
成績だけで決めず、全選手の成長機会を大切にする注意書きも入れてください。`;
 coachSendPrompt('season',prompt)
}
function insertVideoNoteTemplate(){
 const e=$('coachVideoNotes');if(!e)return;
 e.value=`05:21 右サイドから決定機
12:30 守備ラインが下がる
18:10 得点
24:40 ボールロスト後の切り替えが遅い`;
}
function renderAiCoachDashboard(){
 const stats=$('coachStats');if(!stats)return;
 const recent=matches[0];
 const totalMinutes=players.reduce((s,p)=>s+totals(p).minutes,0);
 stats.innerHTML=`
  <div><span>選手</span><b>${players.length}</b></div>
  <div><span>試合</span><b>${matches.length}</b></div>
  <div><span>総得点</span><b>${players.reduce((s,p)=>s+totals(p).goals,0)}</b></div>
  <div><span>総出場時間</span><b>${totalMinutes}分</b></div>
  <div><span>直近試合</span><b>${recent?esc(recent.opponent||'対戦相手未設定'):'未登録'}</b></div>`;
 const ms=$('coachMatchSelect');
 if(ms)ms.innerHTML=matches.map(m=>`<option value="${m.id}">${esc(m.match_date||'')} ${esc(m.opponent||'対戦相手未設定')} ${Number(m.goals_for||0)}-${Number(m.goals_against||0)}</option>`).join('')||'<option value="">試合未登録</option>';
 const ps=$('coachPlayerSelect');
 if(ps)ps.innerHTML=players.map(p=>`<option value="${p.id}">${esc(p.name)} / ${esc(p.grade)} / ${esc(p.position)}</option>`).join('');
 const gs=$('coachGradeSelect');
 if(gs){
  const current=gs.value;
  const grades=[...new Set(players.map(p=>p.grade).filter(Boolean))].sort();
  gs.innerHTML='<option value="">全学年</option>'+grades.map(g=>`<option value="${esc(g)}">${esc(g)}</option>`).join('');
  gs.value=current
 }
 const guide=$('coach11TodayGuide');
 if(guide){
  const latest=matches[0];
  guide.innerHTML=latest
   ? `<b>直近試合：${esc(latest.match_date||'')} 対 ${esc(latest.opponent||'未設定')}</b>
      <span>まず試合入力を確認し、次にAI試合診断、最後に保護者連絡文を作成する流れがおすすめです。</span>`
   : `<b>まだ試合が登録されていません。</b><span>「試合を入力」から始めてください。</span>`
 }
}
function runCoachMatchDiagnosis(){
 const id=$('coachMatchSelect')?.value,m=matches.find(x=>String(x.id)===String(id));
 if(!m){showMessage('対象試合を選択してください。');return}
 const recs=records.filter(r=>String(r.match_id)===String(id));
 const playerRows=recs.map(r=>{
  const p=players.find(x=>String(x.id)===String(r.player_id));
  return `${p?.name||'不明'} 出場${r.played?'有':'無'} 時間${r.minutes||0} 得点${r.goals||0} アシスト${r.assists||0} MVP${r.mvp?'有':'無'}`
 }).join(' / ');
 const prompt=`少年サッカーチームの試合診断をしてください。
試合：${m.match_date||''} ${m.competition||''} 対 ${m.opponent||''}
結果：古堅南FC ${m.goals_for||0}-${m.goals_against||0} 相手
メモ：${m.memo||'未入力'}
選手記録：${playerRows||'未入力'}

次の順で作成してください。
1. 試合総評
2. 攻撃の良かった点と課題
3. 守備の良かった点と課題
4. 選手への声かけ
5. 次回練習メニュー3つ
小学生に適した安全で前向きな内容にしてください。`;
 coachSendPrompt('match',prompt)
}
function runCoachLineup(){
 const count=Math.max(5,Math.min(11,Number($('coachLineupCount')?.value)||8));
 const grade=$('coachGradeSelect')?.value||'';
 const pool=players.filter(p=>p.status==='現役'&&(!grade||p.grade===grade)).map(p=>{
  const t=totals(p);
  return `${p.name} 学年:${p.grade} 位置:${p.position} 出場:${t.apps} 時間:${t.minutes} 得点:${t.goals} アシスト:${t.assists}`
 }).join('\n');
 const prompt=`次の登録選手から${count}人制サッカーのスタメン案と交代案を作成してください。
対象：${grade||'全学年'}
選手：
${pool}

条件：
・GPを必ず含める
・ポジションバランスを優先
・出場時間が少ない選手にも成長機会を与える
・特定選手へ負担を偏らせない
・フォーメーション、先発、控え、交代目安、理由を示す
・最終判断はコーチが行う前提で提案する`;
 coachSendPrompt('lineup',prompt)
}
function runCoachTrainingPlan(){
 const min=$('coachTrainingMinutes')?.value||60;
 const recent=matches.slice(0,5).map(m=>`${m.match_date||''} ${m.opponent||''} ${m.goals_for||0}-${m.goals_against||0} メモ:${m.memo||'-'}`).join(' / ');
 const prompt=`古堅南FC小学生向けの${min}分練習メニューを作成してください。
最近の試合：${recent||'試合データ未登録'}
登録人数：${players.filter(p=>p.status==='現役').length}人

構成：
・ウォーミングアップ
・技術トレーニング
・判断を伴う対人またはポゼッション
・ゲーム
・クールダウン
各メニューの時間、人数、コートサイズ、目的、コーチングポイント、安全上の注意を記載してください。`;
 coachSendPrompt('training',prompt)
}
async function runCoachPlayerDevelopment(){
 const id=$('coachPlayerSelect')?.value,p=players.find(x=>String(x.id)===String(id));
 if(!p){showMessage('選手を選択してください。');return}
 await loadPlayerDetailData(id);
 const t=totals(p),growth=growthForPlayer(id).slice(0,5),skills=skillsForPlayer(id)[0],evals=matchEvaluationsForPlayer(id).slice(0,5);
 const prompt=`${p.name}選手の育成診断を作成してください。
学年:${p.grade} ポジション:${p.position}
出場:${t.apps}試合 ${t.minutes}分 得点:${t.goals} アシスト:${t.assists}
強み:${p.strengths||'未入力'}
成長目標:${p.development_goal||'未入力'}
成長記録:${growth.map(x=>`${x.record_date||''} ${x.note||x.coach_comment||''}`).join(' / ')||'未入力'}
技術評価:${skills?JSON.stringify(skills):'未評価'}
最近の試合評価:${evals.map(e=>`総合${evaluationOverall(e)} 良い点:${e.good_points||'-'} 改善:${e.improvement_points||'-'}`).join(' / ')||'未評価'}

本人向けに、
1. できていること
2. 次に伸ばす1〜2点
3. 自主練メニュー
4. 次の試合の具体目標
5. 前向きな一言
を小学生に伝わる表現で作成してください。`;
 coachSendPrompt('player',prompt)
}
function runCoachVideoAnalysis(){
 const url=$('coachVideoUrl')?.value.trim()||'',notes=$('coachVideoNotes')?.value.trim()||'';
 if(!url&&!notes){showMessage('動画URLまたはタイムスタンプメモを入力してください。');return}
 const prompt=`次のサッカー試合動画メモを分析してください。
動画URL:${url||'未入力'}
タイムスタンプ・場面メモ:
${notes||'未入力'}

映像を直接見たとは断定せず、提供されたメモを根拠に、
1. 時系列の重要場面
2. 攻撃傾向
3. 守備傾向
4. 良かったプレー
5. 改善ポイント
6. 次回練習メニュー
7. 追加で記録すべきタイムスタンプ
を作成してください。`;
 coachSendPrompt('match',prompt)
}
function runCoachSeasonAnalysis(){
 const games=matches.map(m=>`${m.match_date||''} ${m.competition||''} 対${m.opponent||''} ${m.goals_for||0}-${m.goals_against||0}`).join('\n');
 const rank=[...players].map(p=>({p,t:totals(p)})).sort((a,b)=>b.t.goals-a.t.goals).slice(0,10)
  .map(x=>`${x.p.name} 出場${x.t.apps} 時間${x.t.minutes} 得点${x.t.goals} アシスト${x.t.assists}`).join('\n');
 const prompt=`古堅南FCの年間・大会分析を作成してください。
試合一覧:
${games||'未登録'}

主な選手成績:
${rank||'未登録'}

次の順で作成してください。
1. 成績概要
2. 攻撃と守備の傾向
3. 出場時間の偏りへの配慮
4. 得点・アシスト・成長が目立つ選手
5. チームの次の3か月目標
6. 年間育成方針
順位付けだけに偏らず、全選手の成長機会を重視してください。`;
 coachSendPrompt('season',prompt)
}

function renderAll(){renderAiCoachDashboard();renderDashboard();renderPlayers();renderMatches();renderRanking();renderRecordInputs();refreshVer6Selects();renderSavedReports();renderVideoNotes();refreshV7Selects();renderV7History()}
function renderDashboard(){let w=0,d=0,l=0,gf=0,ga=0;matches.forEach(m=>{gf+=m.goals_for||0;ga+=m.goals_against||0;m.goals_for>m.goals_against?w++:m.goals_for<m.goals_against?l++:d++});const rate=matches.length?Math.round(w/matches.length*100):0;$('stats').innerHTML=[['選手',players.length],['試合',matches.length],['勝利',w],['引分',d],['敗戦',l],['勝率',rate+'%'],['得点',gf],['失点',ga]].map(x=>`<div class="card stat"><span>${x[0]}</span><b>${x[1]}</b></div>`).join('');$('recent').innerHTML=matches.slice(0,6).map(matchHtml).join('')||'<p class="muted">まだ試合がありません。</p>'}
function resultClass(m){return m.goals_for>m.goals_against?'win':m.goals_for<m.goals_against?'loss':'draw'}
function matchHtml(m){return `<div class="match-row"><div><b>${esc(m.match_date)}</b> <span class="pill">${esc(m.competition||'通常試合')}</span><div class="muted">${esc(m.venue||'')} ${esc(m.memo||'')}</div></div><div><span class="score ${resultClass(m)}">${m.goals_for} - ${m.goals_against}</span><br>${esc(m.opponent)}</div></div>`}
function resetPlayerPage(){playerPage=1;renderPlayers()}
function changePlayerPage(page){playerPage=Math.max(1,page);renderPlayers();document.getElementById('players')?.scrollIntoView({behavior:'smooth',block:'start'})}
function renderPlayers(){
 const q=$('playerSearch').value.trim().toLowerCase(),status=$('statusFilter').value;
 const list=players.filter(p=>(!status||p.status===status)&&(!q||`${p.name} ${p.grade} ${p.position} ${p.number||''}`.toLowerCase().includes(q)));
 const pages=Math.max(1,Math.ceil(list.length/PLAYER_PAGE_SIZE));if(playerPage>pages)playerPage=pages;
 const start=(playerPage-1)*PLAYER_PAGE_SIZE,shown=list.slice(start,start+PLAYER_PAGE_SIZE);
 $('playerBody').innerHTML=shown.map(p=>{const t=totals(p);return `<tr><td><button class="player-link" onclick="openPlayerDetail('${p.id}')"><div class="player-name">${p.photo_url?`<img class="avatar" src="${esc(p.photo_url)}" alt="" loading="lazy" decoding="async">`:`<span class="avatar"></span>`}<span><b>${esc(p.name)}</b>${p.number?` #${esc(p.number)}`:''}</span></div></button></td><td>${esc(p.grade)}</td><td>${esc(p.position)}</td><td>${esc(p.status)}</td><td>${t.apps}</td><td>${t.goals}</td><td>${t.assists}</td><td>${t.minutes}</td><td><button class="light" onclick="openPlayerDetail('${p.id}')">詳細</button>${isStaff()?` <button class="light" onclick="openPlayerModal('${p.id}')">編集</button> <button class="danger" onclick="deletePlayer('${p.id}')">削除</button>`:''}</td></tr>`}).join('')||'<tr><td colspan="9" class="muted">該当する選手がいません。</td></tr>';
 const pager=$('playerPager');if(!pager)return;
 pager.innerHTML=list.length?`<div class="pager-info">${list.length}人中 ${start+1}〜${Math.min(start+PLAYER_PAGE_SIZE,list.length)}人を表示</div><div class="pager-buttons"><button class="light" onclick="changePlayerPage(${playerPage-1})" ${playerPage<=1?'disabled':''}>‹ 前へ</button><span>${playerPage} / ${pages}</span><button class="light" onclick="changePlayerPage(${playerPage+1})" ${playerPage>=pages?'disabled':''}>次へ ›</button></div>`:'';
}
function renderMatches(){const season=$('matchSeason').value,q=$('matchSearch').value.trim().toLowerCase();const list=matches.filter(m=>(!season||String(m.season)===season)&&(!q||`${m.competition} ${m.opponent} ${m.venue}`.toLowerCase().includes(q)));$('matchList').innerHTML=list.map(m=>{const count=records.filter(r=>r.match_id===m.id&&r.played).length;return `<div class="card"><div class="match-row"><div><b>${esc(m.match_date)}</b> ${esc(m.competition)}<div class="muted">${esc(m.venue)} / 出場 ${count}名</div></div><div><span class="score ${resultClass(m)}">${m.goals_for}-${m.goals_against}</span> ${esc(m.opponent)} ${isStaff()?`<button class="light" onclick="openMatchEdit('${m.id}')">編集</button> <button class="danger" onclick="deleteMatch('${m.id}')">削除</button>`:''}</div></div></div>`}).join('')||'<p class="muted">該当する試合がありません。</p>'}
function renderRanking(){const type=$('rankType').value,grade=$('rankGrade').value,status=$('rankStatus').value;const list=players.filter(p=>(!grade||p.grade===grade)&&(!status||p.status===status)).map(p=>({p,t:totals(p)})).sort((a,b)=>b.t[type]-a.t[type]||a.p.name.localeCompare(b.p.name,'ja'));$('rankBody').innerHTML=list.map((x,i)=>`<tr><td class="${i===0?'rank1':''}">${i+1}</td><td><b>${esc(x.p.name)}</b></td><td>${esc(x.p.grade)}</td><td>${esc(x.p.position)}</td><td><b>${x.t[type]}</b>${type==='minutes'?'分':''}</td></tr>`).join('')}
function renderRecordInputs(){if(!isStaff())return;const existing=new Map(records.filter(r=>r.match_id===editingMatchId).map(r=>[r.player_id,r]));$('recordInputs').innerHTML=`<div class="player-entry muted"><div>選手</div><div>出場</div><div>時間</div><div>得点</div><div class="extra">アシスト</div><div class="extra">黄</div><div class="extra">赤</div><div class="extra">MVP</div></div>`+players.filter(p=>p.status==='現役'||existing.has(p.id)).map(p=>{const r=existing.get(p.id)||{};return `<div class="player-entry" data-player="${p.id}"><div><b>${esc(p.name)}</b><div class="muted">${esc(p.grade)} ${esc(p.position)}</div></div><div><input class="played" type="checkbox" onchange="renderMatchEvaluationInputs()" ${r.played?'checked':''}></div><div><input class="minutes" type="number" min="0" value="${r.minutes||0}"></div><div><input class="goals" type="number" min="0" value="${r.goals||0}"></div><div class="extra"><input class="assists" type="number" min="0" value="${r.assists||0}"></div><div class="extra"><input class="yellow" type="number" min="0" value="${r.yellow||0}"></div><div class="extra"><input class="red" type="number" min="0" value="${r.red||0}"></div><div class="extra"><input class="mvp" type="checkbox" ${r.mvp?'checked':''}></div></div>`}).join('')}
function selectAllPlayed(){document.querySelectorAll('.player-entry .played').forEach(x=>x.checked=true)}
function evalSelect(cls,value=3){
 return `<select class="${cls}">${[1,2,3,4,5].map(n=>`<option value="${n}" ${Number(value)===n?'selected':''}>${n}</option>`).join('')}</select>`
}
function currentMatchEvalDrafts(){
 const drafts=new Map();
 document.querySelectorAll('.match-eval-input[data-player]').forEach(el=>{
  drafts.set(String(el.dataset.player),{
   attack:+el.querySelector('.eval-attack').value||3,
   defense:+el.querySelector('.eval-defense').value||3,
   passing:+el.querySelector('.eval-passing').value||3,
   dribbling:+el.querySelector('.eval-dribbling').value||3,
   shooting:+el.querySelector('.eval-shooting').value||3,
   decision_making:+el.querySelector('.eval-decision').value||3,
   work_rate:+el.querySelector('.eval-work').value||3,
   communication:+el.querySelector('.eval-communication').value||3,
   good_points:el.querySelector('.eval-good').value.trim(),
   improvement_points:el.querySelector('.eval-improve').value.trim(),
   next_goal:el.querySelector('.eval-goal').value.trim()
  })
 });
 return drafts
}
function renderMatchEvaluationInputs(){
 const box=$('matchEvaluationInputs');if(!box)return;
 const draft=currentMatchEvalDrafts();
 const existing=new Map(editingMatchEvaluations.map(x=>[String(x.player_id),x]));
 const showAll=$('evalShowAllPlayers')?.checked;
 const playerEls=[...document.querySelectorAll('.player-entry[data-player]')];
 const selected=playerEls
  .filter(el=>showAll||el.querySelector('.played')?.checked)
  .map(el=>String(el.dataset.player));
 if(!selected.length){
  box.innerHTML=`<div class="eval-empty">
   <b>評価する選手がまだ選ばれていません。</b>
   <p>上の選手記録で「出場」にチェックするか、「全選手を表示」をオンにしてください。</p>
  </div>`;
  return
 }
 box.innerHTML=selected.map(playerId=>{
  const p=players.find(x=>String(x.id)===playerId);if(!p)return '';
  const e=draft.get(playerId)||existing.get(playerId)||{};
  const played=playerEls.find(el=>String(el.dataset.player)===playerId)?.querySelector('.played')?.checked;
  return `<details class="match-eval-input" data-player="${playerId}" ${played?'open':''}>
   <summary>
    <span class="eval-player-summary">
      ${p.photo_url?`<img class="eval-avatar" src="${esc(p.photo_url)}" alt="" loading="lazy" decoding="async">`:`<span class="eval-avatar placeholder"></span>`}
      <span><b>${esc(p.name)}</b><small>${esc(p.grade)} ${esc(p.position)} ${played?'・出場':'・未出場'}</small></span>
    </span>
    <span class="eval-summary-score">総合 <b class="live-overall">${evaluationOverall(e)}</b></span>
   </summary>
   <div class="eval-grid" oninput="updateLiveOverall(this.closest('.match-eval-input'))">
    ${evalRatingControl('攻撃','eval-attack',e.attack)}
    ${evalRatingControl('守備','eval-defense',e.defense)}
    ${evalRatingControl('パス','eval-passing',e.passing)}
    ${evalRatingControl('ドリブル','eval-dribbling',e.dribbling)}
    ${evalRatingControl('シュート','eval-shooting',e.shooting)}
    ${evalRatingControl('判断力','eval-decision',e.decision_making)}
    ${evalRatingControl('運動量','eval-work',e.work_rate)}
    ${evalRatingControl('声かけ','eval-communication',e.communication)}
   </div>
   <div class="eval-comment-grid" oninput="updateEvaluationProgress()">
    <label>良かったところ<textarea class="eval-good" placeholder="良かったプレー、成長した点">${esc(e.good_points||'')}</textarea></label>
    <label>改善したいところ<textarea class="eval-improve" placeholder="次に意識してほしいこと">${esc(e.improvement_points||'')}</textarea></label>
    <label>次の具体目標<textarea class="eval-goal" placeholder="例：受ける前に2回首を振る">${esc(e.next_goal||'')}</textarea></label>
   </div>
   <div class="eval-card-actions">
    <button type="button" class="light" onclick="generateDraftAiAdvice('${playerId}')">🤖 AIアドバイス案</button>
    <button type="button" class="light" onclick="fillQuickPositiveComment('${playerId}')">✨ 前向きコメント例</button>
   </div>
  </details>`
 }).join('');
 updateEvaluationProgress()
}
function evalRatingControl(label,cls,value=3){
 const v=Number(value)||3;
 return `<div class="eval-rating-item">
  <span>${label}</span>
  <div class="score-buttons" data-class="${cls}">
   ${[1,2,3,4,5].map(n=>`<button type="button" class="score-btn ${n===v?'active':''}" data-score="${n}" onclick="setScoreButton(this,'${cls}',${n})">${n}</button>`).join('')}
  </div>
  <select class="${cls} hidden-score-select" aria-hidden="true">
   ${[1,2,3,4,5].map(n=>`<option value="${n}" ${v===n?'selected':''}>${n}</option>`).join('')}
  </select>
 </div>`
}
function visibleEvalCards(){return [...document.querySelectorAll('.match-eval-input[data-player]')]}
function applyEvaluationToCard(card,value){
 card.querySelectorAll('.eval-rating-item').forEach(item=>{
  const select=item.querySelector('select');if(select)select.value=String(value);
  item.querySelectorAll('.score-btn').forEach(b=>b.classList.toggle('active',Number(b.dataset.score)===Number(value)))
 });
 updateLiveOverall(card)
}
function setAllVisibleEvaluation(value){
 const cards=visibleEvalCards();cards.forEach(card=>applyEvaluationToCard(card,value));
 showMessage(`表示中の${cards.length}人を評価${value}に設定しました。`,'ok');
 updateEvaluationProgress()
}
function setPlayedEvaluation(value){
 const playedIds=new Set([...document.querySelectorAll('.player-entry[data-player]')]
  .filter(el=>el.querySelector('.played')?.checked)
  .map(el=>String(el.dataset.player)));
 const cards=visibleEvalCards().filter(card=>playedIds.has(String(card.dataset.player)));
 cards.forEach(card=>applyEvaluationToCard(card,value));
 showMessage(`出場選手${cards.length}人を評価${value}に設定しました。`,'ok');
 updateEvaluationProgress()
}
function clearAllEvaluationComments(){
 if(!confirm('表示中の選手のコメントをすべて空にしますか？'))return;
 visibleEvalCards().forEach(card=>{
  card.querySelector('.eval-good').value='';
  card.querySelector('.eval-improve').value='';
  card.querySelector('.eval-goal').value=''
 });
 showMessage('表示中のコメントを空にしました。','ok');
 updateEvaluationProgress()
}
function updateEvaluationProgress(){
 const cards=visibleEvalCards(),text=$('evalProgressText'),bar=$('evalProgressBar');
 if(!text||!bar)return;
 const commented=cards.filter(card=>{
  const good=card.querySelector('.eval-good')?.value.trim();
  const improve=card.querySelector('.eval-improve')?.value.trim();
  const goal=card.querySelector('.eval-goal')?.value.trim();
  return good||improve||goal
 }).length;
 const pct=cards.length?Math.round((commented/cards.length)*100):0;
 text.textContent=`評価対象 ${cards.length}人 ／ コメント入力 ${commented}人`;
 bar.style.width=`${pct}%`
}
function setScoreButton(btn,cls,value){
 const item=btn.closest('.eval-rating-item');if(!item)return;
 item.querySelectorAll('.score-btn').forEach(b=>b.classList.toggle('active',Number(b.dataset.score)===Number(value)));
 const select=item.querySelector(`select.${cls}`);if(select)select.value=String(value);
 const card=btn.closest('.match-eval-input');updateLiveOverall(card);updateEvaluationProgress()
}
function openAllMatchEvaluations(){document.querySelectorAll('.match-eval-input').forEach(x=>x.open=true)}
function closeAllMatchEvaluations(){document.querySelectorAll('.match-eval-input').forEach(x=>x.open=false)}
function updateLiveOverall(el){
 if(!el)return;const vals=[...el.querySelectorAll('.eval-grid select')].map(x=>+x.value||0);
 const avg=vals.length?(vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(1):'0.0';
 const out=el.querySelector('.live-overall');if(out)out.textContent=avg
}
function matchEvalElement(playerId){return document.querySelector(`.match-eval-input[data-player="${CSS.escape(String(playerId))}"]`)}
function collectEvalFromElement(el){
 return {
  attack:+el.querySelector('.eval-attack').value||3,defense:+el.querySelector('.eval-defense').value||3,
  passing:+el.querySelector('.eval-passing').value||3,dribbling:+el.querySelector('.eval-dribbling').value||3,
  shooting:+el.querySelector('.eval-shooting').value||3,decision_making:+el.querySelector('.eval-decision').value||3,
  work_rate:+el.querySelector('.eval-work').value||3,communication:+el.querySelector('.eval-communication').value||3,
  good_points:el.querySelector('.eval-good').value.trim(),improvement_points:el.querySelector('.eval-improve').value.trim(),
  next_goal:el.querySelector('.eval-goal').value.trim()
 }
}
function fillQuickPositiveComment(playerId){
 const el=matchEvalElement(playerId);if(!el)return;el.open=true;
 const e=collectEvalFromElement(el),p=players.find(x=>String(x.id)===String(playerId));
 const scores=[
  ['攻撃',e.attack],['守備',e.defense],['パス',e.passing],['ドリブル',e.dribbling],
  ['シュート',e.shooting],['判断力',e.decision_making],['運動量',e.work_rate],['声かけ',e.communication]
 ].sort((a,b)=>b[1]-a[1]);
 const best=scores[0][0],low=scores[scores.length-1][0];
 if(!e.good_points)el.querySelector('.eval-good').value=`${best}の場面で積極的にプレーできました。最後まで前向きに取り組めたことも良かったです。`;
 if(!e.improvement_points)el.querySelector('.eval-improve').value=`次は${low}を少し意識し、プレーする前に周りを見る回数を増やしましょう。`;
 if(!e.next_goal)el.querySelector('.eval-goal').value=`次の試合では、良かった${best}を続けながら、${low}を意識したプレーを3回チャレンジする。`;
 showMessage(`${p?.name||'選手'}のコメント例を入力しました。内容を確認して修正してください。`,'ok')
}
function evaluatedPlayerRows(){
 return visibleEvalCards().map(card=>{
  const p=players.find(x=>String(x.id)===String(card.dataset.player));
  const e=collectEvalFromElement(card);
  return {player:p,e,overall:Number(evaluationOverall(e))}
 }).filter(x=>x.player)
}
function suggestMvpCandidates(){
 const box=$('mvpCandidateBox');if(!box)return;
 const rows=evaluatedPlayerRows().sort((a,b)=>b.overall-a.overall).slice(0,5);
 if(!rows.length){showMessage('評価対象の選手がいません。');return}
 box.classList.remove('hidden');
 box.innerHTML=`<div class="mvp-title">⭐ MVP候補</div>
 ${rows.map((x,i)=>`<button type="button" class="mvp-candidate" onclick="selectMvpCandidate('${x.player.id}')">
   <span>${i+1}</span><b>${esc(x.player.name)}</b><em>総合 ${x.overall.toFixed(1)}</em>
 </button>`).join('')}`;
}
function selectMvpCandidate(playerId){
 const row=document.querySelector(`.player-entry[data-player="${CSS.escape(String(playerId))}"]`);
 if(!row){showMessage('選手記録欄が見つかりません。');return}
 document.querySelectorAll('.player-entry .mvp').forEach(x=>x.checked=false);
 const mvp=row.querySelector('.mvp');if(mvp)mvp.checked=true;
 const p=players.find(x=>String(x.id)===String(playerId));
 showMessage(`${p?.name||'選手'}をMVPに設定しました。`,'ok')
}
function generateMatchSummaryDraft(){
 const rows=evaluatedPlayerRows();
 if(!rows.length){showMessage('選手評価を入力してください。');return}
 const date=$('matchDate')?.value||'',opp=$('opponent')?.value||'',comp=$('competition')?.value||'';
 const best=[...rows].sort((a,b)=>b.overall-a.overall).slice(0,3);
 const avg=(key)=>rows.length?(rows.reduce((s,x)=>s+(Number(x.e[key])||0),0)/rows.length).toFixed(1):'0.0';
 const prompt=`次の試合評価から、コーチ向けの試合総評を作成してください。
試合：${date} ${opp} ${comp}
チーム平均：攻撃${avg('attack')} 守備${avg('defense')} パス${avg('passing')} ドリブル${avg('dribbling')} シュート${avg('shooting')} 判断力${avg('decision_making')} 運動量${avg('work_rate')} 声かけ${avg('communication')}
上位選手：${best.map(x=>`${x.player.name} 総合${x.overall.toFixed(1)}`).join('、')}
各選手コメント：${rows.slice(0,12).map(x=>`${x.player.name} 良かった点:${x.e.good_points||'-'} 改善点:${x.e.improvement_points||'-'} 次の目標:${x.e.next_goal||'-'}`).join(' / ')}

以下の順で作成してください。
1. 試合総評
2. 良かった点
3. チーム課題
4. 次回練習メニュー3つ
5. MVP候補3人`;
 showPage('ai');setAiMode('match',document.querySelector('[data-mode="match"]'));setAiPrompt(prompt);
 showMessage('AI画面に試合総評用データをセットしました。','ok')
}
function generateParentsMessageDraft(){
 const rows=evaluatedPlayerRows();
 const date=$('matchDate')?.value||'',opp=$('opponent')?.value||'',comp=$('competition')?.value||'';
 const best=[...rows].sort((a,b)=>b.overall-a.overall).slice(0,2);
 const prompt=`保護者向けの試合報告文を作成してください。
試合：${date} ${opp} ${comp}
スコア：古堅南FC ${$('goalsFor')?.value||0} - ${$('goalsAgainst')?.value||0} 相手
良かった選手：${best.map(x=>`${x.player.name} 総合${x.overall.toFixed(1)}`).join('、')||'未選択'}
コーチメモ：${$('matchMemo')?.value||'未入力'}

LINEで送りやすい、300文字以内の丁寧で前向きな文章にしてください。
構成：
・応援へのお礼
・試合の様子
・子どもたちの成長
・次回への意気込み`;
 showPage('ai');setAiMode('parents',document.querySelector('[data-mode="parents"]'));setAiPrompt(prompt);
 showMessage('AI画面に保護者向け文面の材料をセットしました。','ok')
}
function generateDraftAiAdvice(playerId){
 const el=matchEvalElement(playerId);if(!el)return;el.open=true;
 const p=players.find(x=>String(x.id)===String(playerId)),e=collectEvalFromElement(el);
 const matchDate=$('matchDate')?.value||'',opponent=$('opponent')?.value||'',competition=$('competition')?.value||'';
 const prompt=`${p?.name||'選手'}の試合評価から、小学生本人に伝える前向きなAIアドバイスを作成してください。
試合：${matchDate} ${opponent} ${competition}
攻撃${e.attack}/5、守備${e.defense}/5、パス${e.passing}/5、ドリブル${e.dribbling}/5、シュート${e.shooting}/5、判断力${e.decision_making}/5、運動量${e.work_rate}/5、声かけ${e.communication}/5
良かったところ：${e.good_points||'未入力'}
改善したいところ：${e.improvement_points||'未入力'}
次の目標：${e.next_goal||'未入力'}

次の順で、短く具体的に作成してください。
1. 良かった点
2. 次に意識する1〜2点
3. 次回練習でできるメニュー
4. 前向きなひと言`;
 sessionStorage.setItem('furugenPendingAiPrompt',prompt);
 showPage('ai');setAiMode('player',document.querySelector('[data-mode="player"]'));setAiPrompt(prompt);
 showMessage('AI画面に評価内容をセットしました。','ok')
}
async function loadMatchEvaluationsForEdit(matchId){
 if(!matchId){editingMatchEvaluations=[];renderMatchEvaluationInputs();return}
 const r=await sb.from('player_match_evaluations').select('*').eq('match_id',String(matchId));
 editingMatchEvaluations=r.error?[]:(r.data||[]);
 renderMatchEvaluationInputs()
}
async function saveMatchWithRecords(){if(!isStaff())return;const date=$('matchDate').value,opp=$('opponent').value.trim();if(!date||!opp){showMessage('試合日と対戦相手を入力してください。');return}const btn=$('saveMatchBtn');btn.disabled=true;const match={match_date:date,competition:$('competition').value.trim(),opponent:opp,venue:$('venue').value.trim(),goals_for:+$('goalsFor').value||0,goals_against:+$('goalsAgainst').value||0,season:+date.slice(0,4),memo:$('matchMemo').value.trim(),created_by:session.user.id};let matchId=editingMatchId;if(matchId){const up=await sb.from('matches').update(match).eq('id',matchId);if(up.error){showMessage(up.error.message);btn.disabled=false;return}const del=await sb.from('records').delete().eq('match_id',matchId);if(del.error){showMessage('既存選手記録の削除エラー：'+del.error.message);btn.disabled=false;return}}else{const ins=await sb.from('matches').insert(match).select().single();if(ins.error){showMessage(ins.error.message);btn.disabled=false;return}matchId=ins.data.id}const rows=[...document.querySelectorAll('.player-entry[data-player]')].map(el=>({match_id:matchId,player_id:el.dataset.player,played:el.querySelector('.played').checked,minutes:+el.querySelector('.minutes').value||0,goals:+el.querySelector('.goals').value||0,assists:+el.querySelector('.assists').value||0,yellow:+el.querySelector('.yellow').value||0,red:+el.querySelector('.red').value||0,mvp:el.querySelector('.mvp').checked,created_by:session.user.id})).filter(x=>x.played||x.goals||x.assists||x.yellow||x.red||x.mvp);if(rows.length){const rr=await sb.from('records').insert(rows);if(rr.error){showMessage('試合は保存しましたが選手記録でエラー：'+rr.error.message);btn.disabled=false;return}}
 const evalRows=[...document.querySelectorAll('.match-eval-input[data-player]')].map(el=>({
  player_id:String(el.dataset.player),match_id:String(matchId),
  attack:+el.querySelector('.eval-attack').value||3,
  defense:+el.querySelector('.eval-defense').value||3,
  passing:+el.querySelector('.eval-passing').value||3,
  dribbling:+el.querySelector('.eval-dribbling').value||3,
  shooting:+el.querySelector('.eval-shooting').value||3,
  decision_making:+el.querySelector('.eval-decision').value||3,
  work_rate:+el.querySelector('.eval-work').value||3,
  communication:+el.querySelector('.eval-communication').value||3,
  good_points:el.querySelector('.eval-good').value.trim(),
  improvement_points:el.querySelector('.eval-improve').value.trim(),
  next_goal:el.querySelector('.eval-goal').value.trim(),
  created_by:session.user.id,updated_at:new Date().toISOString()
 }));
 if(evalRows.length){
  const er=await sb.from('player_match_evaluations').upsert(evalRows,{onConflict:'player_id,match_id'});
  if(er.error){showMessage('試合は保存しましたが評価保存でエラー：'+er.error.message);btn.disabled=false;return}
 }
 detailCache.clear();
 showMessage(editingMatchId?'試合・選手記録・評価を更新しました。':'試合・選手記録・評価を保存しました。','ok');cancelMatchEdit(false);btn.disabled=false;await loadAll();showPage('matches')}
function openMatchEdit(id){if(!isStaff())return;const m=matches.find(x=>x.id===id);if(!m)return;editingMatchId=id;$('matchDate').value=m.match_date||'';$('competition').value=m.competition||'';$('opponent').value=m.opponent||'';$('venue').value=m.venue||'';$('goalsFor').value=m.goals_for||0;$('goalsAgainst').value=m.goals_against||0;$('matchMemo').value=m.memo||'';$('saveMatchBtn').textContent='試合を更新';$('cancelMatchEditBtn').classList.remove('hidden');renderRecordInputs();showPage('entry');loadMatchEvaluationsForEdit(id)}
function cancelMatchEdit(clear=true){editingMatchId='';editingMatchEvaluations=[];$('saveMatchBtn').textContent='試合を保存';$('cancelMatchEditBtn').classList.add('hidden');if(clear){['matchDate','competition','opponent','venue','matchMemo'].forEach(id=>$(id).value='');$('goalsFor').value=0;$('goalsAgainst').value=0;renderRecordInputs();renderMatchEvaluationInputs()}}
async function deleteMatch(id){if(!isStaff()||!confirm('この試合と選手記録を削除しますか？'))return;const rr=await sb.from('records').delete().eq('match_id',id);if(rr.error){showMessage('選手記録の削除エラー：'+rr.error.message);return}const r=await sb.from('matches').delete().eq('id',id);if(r.error)showMessage(r.error.message);else{showMessage('試合を削除しました。','ok');await loadAll()}}
function privateForPlayer(id){return playerPrivate.find(x=>String(x.player_id)===String(id))||{}}
function openPlayerModal(id=''){const p=players.find(x=>String(x.id)===String(id)),pv=privateForPlayer(id);$('playerModalTitle').textContent=p?'選手編集':'選手追加';$('editPlayerId').value=p?.id||'';$('editPhotoData').value=p?.photo_url||'';$('playerPhotoPreview').src=p?.photo_url||defaultAvatar();$('editPhoto').value='';$('editName').value=p?.name||'';$('editNumber').value=p?.number||'';$('editGrade').value=p?.grade||'';$('editBirthDate').value=p?.birth_date||'';$('editPosition').value=p?.position||'';$('editDominantFoot').value=p?.dominant_foot||'';$('editHeight').value=p?.height_cm||'';$('editWeight').value=p?.weight_kg||'';$('editStatus').value=p?.status||'現役';$('editStrengths').value=p?.strengths||'';$('editDevelopmentGoal').value=p?.development_goal||'';$('editFatigue').value=pv.fatigue_level||3;$('editCondition').value=pv.condition_level||3;$('editCoachNote').value=pv.coach_note||'';$('editGuardianName').value=pv.guardian_name||'';$('editGuardianPhone').value=pv.guardian_phone||'';$('editGuardianEmail').value=pv.guardian_email||'';$('editEmergencyContact').value=pv.emergency_contact||'';$('editPastApps').value=p?.past_apps||0;$('editPastGoals').value=p?.past_goals||0;$('editPastAssists').value=p?.past_assists||0;$('editPastYellow').value=p?.past_yellow||0;$('editPastRed').value=p?.past_red||0;$('playerModal').classList.remove('hidden')}
function closePlayerModal(){$('playerModal').classList.add('hidden')}
function playerAge(date){if(!date)return '';const b=new Date(date),n=new Date();let a=n.getFullYear()-b.getFullYear();if(n.getMonth()<b.getMonth()||(n.getMonth()===b.getMonth()&&n.getDate()<b.getDate()))a--;return a>=0?`${a}歳`:''}
function levelLabel(v,type){const n=Number(v)||3;return type==='fatigue'?['','とても元気','元気','普通','疲れ気味','強い疲労'][n]:['','低い','やや低い','普通','良い','とても良い'][n]}
let activePlayerDetailId='',playerGrowthChart=null;
function playerMatchRows(id){return records.filter(r=>String(r.player_id)===String(id)&&r.played).map(r=>({r,m:matches.find(m=>String(m.id)===String(r.match_id))})).filter(x=>x.m).sort((a,b)=>(b.m.match_date||'').localeCompare(a.m.match_date||''))}
function playerDetailTabButton(id,label,icon,staffOnly=false){if(staffOnly&&!isStaff())return '';return `<button class="player-detail-tab" data-player-tab="${id}" onclick="switchPlayerDetailTab('${id}',this)">${icon} ${label}</button>`}
async function loadPlayerDetailData(playerId,force=false){
 if(!isStaff()){playerPrivate=[];playerGrowthRecords=[];playerMedicalRecords=[];playerSkillEvaluations=[];playerMatchEvaluations=[];return}
 const key=String(playerId),cached=detailCache.get(key);
 if(!force&&cached&&Date.now()-cached.time<DETAIL_CACHE_MS){
  playerPrivate=cached.privateData;playerGrowthRecords=cached.growth;
  playerMedicalRecords=cached.medical;playerSkillEvaluations=cached.skills;
  playerMatchEvaluations=cached.matchEvaluations||[];return
 }
 const [pv,gr,med,sk,me]=await Promise.all([
  sb.from('player_private').select('*').eq('player_id',key),
  sb.from('player_growth_records').select('*').eq('player_id',key).order('record_date',{ascending:false}),
  sb.from('player_medical_records').select('*').eq('player_id',key).order('record_date',{ascending:false}),
  sb.from('player_skill_evaluations').select('*').eq('player_id',key).order('evaluation_date',{ascending:false}),
  sb.from('player_match_evaluations').select('*').eq('player_id',key).order('created_at',{ascending:false})
 ]);
 playerPrivate=pv.error?[]:(pv.data||[]);
 playerGrowthRecords=gr.error?[]:(gr.data||[]);
 playerMedicalRecords=med.error?[]:(med.data||[]);
 playerSkillEvaluations=sk.error?[]:(sk.data||[]);
 playerMatchEvaluations=me.error?[]:(me.data||[]);
 detailCache.set(key,{time:Date.now(),privateData:playerPrivate,growth:playerGrowthRecords,medical:playerMedicalRecords,skills:playerSkillEvaluations,matchEvaluations:playerMatchEvaluations})
}
function clearPlayerDetailCache(playerId){detailCache.delete(String(playerId))}
function matchEvaluationsForPlayer(id){return playerMatchEvaluations.filter(x=>String(x.player_id)===String(id)).sort((a,b)=>(b.created_at||'').localeCompare(a.created_at||''))}
function matchById(id){return matches.find(x=>String(x.id)===String(id))}
function averageEvaluation(items,key){if(!items.length)return '—';const vals=items.map(x=>Number(x[key])||0).filter(Boolean);return vals.length?(vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(1):'—'}
function evaluationOverall(v){const keys=['attack','defense','passing','dribbling','shooting','decision_making','work_rate','communication'];const vals=keys.map(k=>Number(v[k])||0).filter(Boolean);return vals.length?(vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(1):'0.0'}
function medicalForPlayer(id){return playerMedicalRecords.filter(x=>String(x.player_id)===String(id)).sort((a,b)=>(b.record_date||'').localeCompare(a.record_date||''))}
function skillsForPlayer(id){return playerSkillEvaluations.filter(x=>String(x.player_id)===String(id)).sort((a,b)=>(b.evaluation_date||'').localeCompare(a.evaluation_date||''))}
function growthForPlayer(id){return playerGrowthRecords.filter(x=>String(x.player_id)===String(id)).sort((a,b)=>(b.record_date||'').localeCompare(a.record_date||''))}
function growthStatusLabel(v){return ({full:'参加',limited:'一部参加',rest:'見学・休養',absent:'欠席'})[v]||v||'未設定'}
function injuryLabel(v){return ({none:'なし',watch:'経過観察',injured:'ケガあり',returning:'復帰途中'})[v]||v||'未設定'}
async function openPlayerDetail(id){
 await loadPlayerDetailData(id);
 const p=players.find(x=>String(x.id)===String(id));if(!p)return;
 activePlayerDetailId=String(id);
 const t=totals(p),pv=privateForPlayer(id),rows=playerMatchRows(id),staff=isStaff();
 const avgMinutes=t.apps?Math.round(t.minutes/t.apps):0;
 const goalRate=t.apps?(t.goals/t.apps).toFixed(2):'0.00';
 const assistRate=t.apps?(t.assists/t.apps).toFixed(2):'0.00';
 $('playerDetailContent').innerHTML=`
 <div class="player-profile-head">
   <img src="${esc(p.photo_url||defaultAvatar())}" alt="" loading="lazy" decoding="async">
   <div>
     <h2>${esc(p.name)} ${p.number?`<span class="pill">#${esc(p.number)}</span>`:''}</h2>
     <div class="muted">${esc(p.grade||'学年未設定')} / ${esc(p.position||'ポジション未設定')} / ${esc(p.status||'')}</div>
     <div class="player-tags">
       ${p.dominant_foot?`<span class="pill">利き足 ${esc(p.dominant_foot)}</span>`:''}
       ${p.birth_date?`<span class="pill">${esc(playerAge(p.birth_date))}</span>`:''}
       ${p.height_cm?`<span class="pill">${p.height_cm}cm</span>`:''}
       ${p.weight_kg?`<span class="pill">${p.weight_kg}kg</span>`:''}
     </div>
   </div>
 </div>

 <div class="player-detail-tabs" role="tablist">
   ${playerDetailTabButton('basic','基本情報','👤')}
   ${playerDetailTabButton('results','試合成績','📊')}
   ${playerDetailTabButton('growth','成長カルテ','📈')}
   ${playerDetailTabButton('medical','メディカル','🩺',true)}
   ${playerDetailTabButton('skills','技術評価','⚽',true)}
   ${playerDetailTabButton('match-eval','試合評価','⭐',true)}
   ${playerDetailTabButton('ai','AI分析','🤖')}
   ${playerDetailTabButton('condition','コンディション','🩺',true)}
   ${playerDetailTabButton('guardian','保護者情報','👨‍👩‍👧',true)}
 </div>

 <div id="playerTab-basic" class="player-tab-panel">
   <div class="player-stat-grid">
     ${[['出場',t.apps],['出場時間',t.minutes+'分'],['得点',t.goals],['アシスト',t.assists],['MVP',t.mvp],['警告',t.yellow],['退場',t.red]].map(x=>`<div class="player-stat"><span>${x[0]}</span><b>${x[1]}</b></div>`).join('')}
   </div>
   <div class="detail-columns">
     <div class="detail-panel"><h4>🌱 強み</h4><div class="detail-text">${esc(p.strengths||'未入力')}</div></div>
     <div class="detail-panel"><h4>🎯 次の成長目標</h4><div class="detail-text">${esc(p.development_goal||'未入力')}</div></div>
   </div>
   <div class="detail-panel player-basic-info">
     <h4>基本プロフィール</h4>
     <div class="profile-info-grid">
       <div><span>生年月日</span><b>${esc(p.birth_date||'未設定')}</b></div>
       <div><span>利き足</span><b>${esc(p.dominant_foot||'未設定')}</b></div>
       <div><span>身長</span><b>${p.height_cm?`${p.height_cm} cm`:'未設定'}</b></div>
       <div><span>体重</span><b>${p.weight_kg?`${p.weight_kg} kg`:'未設定'}</b></div>
     </div>
   </div>
 </div>

 <div id="playerTab-results" class="player-tab-panel hidden">
   <div class="player-summary-cards">
     <div class="summary-card"><span>1試合平均時間</span><b>${avgMinutes}分</b></div>
     <div class="summary-card"><span>1試合平均得点</span><b>${goalRate}</b></div>
     <div class="summary-card"><span>1試合平均アシスト</span><b>${assistRate}</b></div>
     <div class="summary-card"><span>記録済み試合</span><b>${rows.length}</b></div>
   </div>
   <div class="table player-result-table"><table>
     <thead><tr><th>日付</th><th>大会</th><th>対戦相手</th><th>時間</th><th>得点</th><th>アシスト</th><th>MVP</th></tr></thead>
     <tbody>${rows.length?rows.map(x=>`<tr><td>${esc(x.m.match_date||'')}</td><td>${esc(x.m.competition||'')}</td><td>${esc(x.m.opponent||'')}</td><td>${x.r.minutes||0}分</td><td>${x.r.goals||0}</td><td>${x.r.assists||0}</td><td>${x.r.mvp?'⭐':''}</td></tr>`).join(''):'<tr><td colspan="7" class="muted">出場記録はありません。</td></tr>'}</tbody>
   </table></div>
 </div>

 <div id="playerTab-growth" class="player-tab-panel hidden">
   <div class="detail-panel">
     <div class="section-title"><h4>試合ごとの成長推移</h4><span class="muted">直近20試合</span></div>
     <div class="player-growth-wrap"><canvas id="playerGrowthCanvas"></canvas></div>
   </div>
   ${staff?`<div class="detail-panel growth-card-panel">
     <div class="section-title"><h4>身体・コンディション記録</h4><button class="light" onclick="toggleGrowthEntry()">＋ 記録を追加</button></div>
     <div id="growthEntryForm" class="growth-entry hidden">
       <div class="grid">
         <div><label>記録日</label><input id="growthDate" type="date" value="${new Date().toISOString().slice(0,10)}"></div>
         <div><label>身長（cm）</label><input id="growthHeight" type="number" step="0.1" min="0"></div>
         <div><label>体重（kg）</label><input id="growthWeight" type="number" step="0.1" min="0"></div>
         <div><label>睡眠時間</label><input id="growthSleep" type="number" step="0.5" min="0" max="24"></div>
         <div><label>疲労度</label><select id="growthFatigue"><option value="1">1 とても元気</option><option value="2">2 元気</option><option value="3" selected>3 普通</option><option value="4">4 疲れ気味</option><option value="5">5 強い疲労</option></select></div>
         <div><label>調子</label><select id="growthCondition"><option value="1">1 低い</option><option value="2">2 やや低い</option><option value="3" selected>3 普通</option><option value="4">4 良い</option><option value="5">5 とても良い</option></select></div>
         <div><label>ケガ状態</label><select id="growthInjury"><option value="none">なし</option><option value="watch">経過観察</option><option value="injured">ケガあり</option><option value="returning">復帰途中</option></select></div>
         <div><label>練習参加</label><select id="growthTraining"><option value="full">参加</option><option value="limited">一部参加</option><option value="rest">見学・休養</option><option value="absent">欠席</option></select></div>
         <div><label>コーチ評価</label><select id="growthCoachScore"><option value="1">1</option><option value="2">2</option><option value="3" selected>3</option><option value="4">4</option><option value="5">5</option></select></div>
       </div>
       <label>記録メモ</label><textarea id="growthNote" placeholder="練習内容、本人の様子、次回確認すること"></textarea>
       <div class="modal-actions"><button onclick="saveGrowthRecord('${p.id}')">記録を保存</button><button class="secondary" onclick="toggleGrowthEntry()">閉じる</button></div>
     </div>
     <div class="body-growth-wrap"><canvas id="playerBodyGrowthCanvas"></canvas></div>
     <div class="growth-history">
       ${growthForPlayer(p.id).length?growthForPlayer(p.id).map(g=>`<div class="growth-history-row">
         <div><b>${esc(g.record_date||'')}</b><span>${g.height_cm?`${g.height_cm}cm`:''} ${g.weight_kg?`/ ${g.weight_kg}kg`:''}</span></div>
         <div><span>疲労 ${g.fatigue_level||3}</span><span>調子 ${g.condition_level||3}</span><span>${esc(injuryLabel(g.injury_status))}</span><span>${esc(growthStatusLabel(g.training_status))}</span></div>
         <div class="growth-note">${esc(g.note||'')}</div>
         <button class="danger mini" onclick="deleteGrowthRecord('${g.id}')">削除</button>
       </div>`).join(''):'<div class="muted">成長記録はまだありません。</div>'}
     </div>
   </div>`:''}
   <div class="muted player-chart-note">出場時間・得点・アシスト、身体記録を時系列で確認できます。</div>
 </div>

 <div id="playerTab-ai"
 ${staff?`<div id="playerTab-medical" class="player-tab-panel hidden">
   <div class="detail-panel">
     <div class="section-title"><h4>メディカルカルテ</h4><button class="light" onclick="toggleMedicalEntry()">＋ 記録を追加</button></div>
     <div id="medicalEntryForm" class="medical-entry hidden">
       <div class="grid">
         <div><label>記録日</label><input id="medicalDate" type="date" value="${new Date().toISOString().slice(0,10)}"></div>
         <div><label>ケガ部位</label><input id="medicalBodyPart" placeholder="例：右足首、左ひざ"></div>
         <div><label>症状・内容</label><input id="medicalDiagnosis" placeholder="例：捻挫、成長痛、打撲"></div>
         <div><label>重症度</label><select id="medicalSeverity"><option value="1">1 軽い</option><option value="2">2 やや軽い</option><option value="3" selected>3 中程度</option><option value="4">4 重い</option><option value="5">5 非常に重い</option></select></div>
         <div><label>練習参加</label><select id="medicalParticipation"><option value="full">通常参加</option><option value="limited">制限付き</option><option value="rest">見学・休養</option><option value="absent">欠席</option></select></div>
         <div><label>復帰予定日</label><input id="medicalReturnDate" type="date"></div>
         <div><label>受診先</label><input id="medicalClinic" placeholder="病院・整骨院など"></div>
         <div><label>通院状況</label><select id="medicalVisitStatus"><option value="none">未受診</option><option value="scheduled">受診予定</option><option value="visited">受診済み</option><option value="treatment">治療中</option><option value="cleared">復帰許可</option></select></div>
       </div>
       <label>対応・注意事項</label><textarea id="medicalAction" placeholder="アイシング、運動制限、保護者共有内容など"></textarea>
       <div class="modal-actions"><button onclick="saveMedicalRecord('${p.id}')">メディカル記録を保存</button><button class="secondary" onclick="toggleMedicalEntry()">閉じる</button></div>
     </div>
     <div class="medical-history">
       ${medicalForPlayer(p.id).length?medicalForPlayer(p.id).map(x=>`<div class="medical-row severity-${x.severity||3}">
         <div><b>${esc(x.record_date||'')}</b><span>${esc(x.body_part||'部位未設定')}</span></div>
         <div><b>${esc(x.diagnosis||'内容未入力')}</b><span>${esc(x.participation_status||'')}</span></div>
         <div>${x.return_date?`復帰予定：${esc(x.return_date)}`:'復帰予定未設定'}<br>${esc(x.action_note||'')}</div>
         <button class="danger mini" onclick="deleteMedicalRecord('${x.id}')">削除</button>
       </div>`).join(''):'<div class="muted">メディカル記録はありません。</div>'}
     </div>
   </div>
 </div>

 <div id="playerTab-skills" class="player-tab-panel hidden">
   <div class="detail-panel">
     <div class="section-title"><h4>技術評価（5段階）</h4><button class="light" onclick="toggleSkillEntry()">＋ 評価を追加</button></div>
     <div id="skillEntryForm" class="skill-entry hidden">
       <div class="grid skill-grid">
         ${['ドリブル','パス','シュート','守備','スピード','判断力','フィジカル','メンタル'].map((label,i)=>`<div><label>${label}</label><select id="skill${i}"><option value="1">1</option><option value="2">2</option><option value="3" selected>3</option><option value="4">4</option><option value="5">5</option></select></div>`).join('')}
         <div><label>評価日</label><input id="skillDate" type="date" value="${new Date().toISOString().slice(0,10)}"></div>
       </div>
       <label>評価コメント</label><textarea id="skillComment" placeholder="伸びた点、次に取り組むこと"></textarea>
       <div class="modal-actions"><button onclick="saveSkillEvaluation('${p.id}')">技術評価を保存</button><button class="secondary" onclick="toggleSkillEntry()">閉じる</button></div>
     </div>
     <div class="skill-chart-wrap"><canvas id="playerSkillCanvas"></canvas></div>
     <div class="skill-history">
       ${skillsForPlayer(p.id).length?skillsForPlayer(p.id).map(s=>`<div class="skill-history-row"><div><b>${esc(s.evaluation_date||'')}</b></div><div>${esc(s.comment||'コメントなし')}</div><button class="danger mini" onclick="deleteSkillEvaluation('${s.id}')">削除</button></div>`).join(''):'<div class="muted">技術評価はありません。</div>'}
     </div>
   </div>
 </div>`:''}


 ${staff?`<div id="playerTab-match-eval" class="player-tab-panel hidden">
   <div class="detail-panel">
     <div class="section-title"><h4>試合ごとの選手評価</h4><button class="light" onclick="toggleMatchEvalEntry()">＋ 評価を追加</button></div>
     <div id="matchEvalEntryForm" class="match-eval-entry hidden">
       <div class="grid">
         <div>
           <label>対象試合</label>
           <select id="matchEvalMatchId">
             <option value="">試合を選択</option>
             ${matches.map(m=>`<option value="${m.id}">${esc(m.match_date||'')} ${esc(m.opponent||'対戦相手未設定')} ${esc(m.competition||'')}</option>`).join('')}
           </select>
         </div>
         <div><label>攻撃</label><select id="matchEvalAttack">${[1,2,3,4,5].map(n=>`<option value="${n}" ${n===3?'selected':''}>${n}</option>`).join('')}</select></div>
         <div><label>守備</label><select id="matchEvalDefense">${[1,2,3,4,5].map(n=>`<option value="${n}" ${n===3?'selected':''}>${n}</option>`).join('')}</select></div>
         <div><label>パス</label><select id="matchEvalPassing">${[1,2,3,4,5].map(n=>`<option value="${n}" ${n===3?'selected':''}>${n}</option>`).join('')}</select></div>
         <div><label>ドリブル</label><select id="matchEvalDribbling">${[1,2,3,4,5].map(n=>`<option value="${n}" ${n===3?'selected':''}>${n}</option>`).join('')}</select></div>
         <div><label>シュート</label><select id="matchEvalShooting">${[1,2,3,4,5].map(n=>`<option value="${n}" ${n===3?'selected':''}>${n}</option>`).join('')}</select></div>
         <div><label>判断力</label><select id="matchEvalDecision">${[1,2,3,4,5].map(n=>`<option value="${n}" ${n===3?'selected':''}>${n}</option>`).join('')}</select></div>
         <div><label>運動量</label><select id="matchEvalWorkRate">${[1,2,3,4,5].map(n=>`<option value="${n}" ${n===3?'selected':''}>${n}</option>`).join('')}</select></div>
         <div><label>コミュニケーション</label><select id="matchEvalCommunication">${[1,2,3,4,5].map(n=>`<option value="${n}" ${n===3?'selected':''}>${n}</option>`).join('')}</select></div>
       </div>
       <label>良かったところ</label>
       <textarea id="matchEvalGood" placeholder="例：前向きにボールを運べた、味方への声かけが良かった"></textarea>
       <label>改善したいところ</label>
       <textarea id="matchEvalImprove" placeholder="例：守備への切り替え、周囲を見る回数"></textarea>
       <label>次の具体目標</label>
       <textarea id="matchEvalNextGoal" placeholder="例：受ける前に2回首を振る"></textarea>
       <div class="modal-actions">
         <button onclick="saveMatchEvaluation('${p.id}')">試合評価を保存</button>
         <button class="secondary" onclick="toggleMatchEvalEntry()">閉じる</button>
       </div>
     </div>

     <div class="match-eval-summary">
       ${['attack','defense','passing','dribbling','shooting','decision_making','work_rate','communication'].map((k,i)=>`<div><span>${['攻撃','守備','パス','ドリブル','シュート','判断力','運動量','声かけ'][i]}</span><b>${averageEvaluation(matchEvaluationsForPlayer(p.id),k)}</b></div>`).join('')}
     </div>

     <div class="match-eval-chart-wrap"><canvas id="playerMatchEvalCanvas"></canvas></div>

     <div class="match-eval-history">
       ${matchEvaluationsForPlayer(p.id).length?matchEvaluationsForPlayer(p.id).map(e=>{const m=matchById(e.match_id);return `<div class="match-eval-row">
         <div>
           <b>${esc(m?.match_date||'日付未設定')} ${esc(m?.opponent||'対戦相手未設定')}</b>
           <span>${esc(m?.competition||'')} / 総合 ${evaluationOverall(e)}</span>
         </div>
         <div class="match-eval-scores">
           <span>攻${e.attack}</span><span>守${e.defense}</span><span>パ${e.passing}</span><span>ド${e.dribbling}</span><span>シ${e.shooting}</span><span>判${e.decision_making}</span><span>運${e.work_rate}</span><span>声${e.communication}</span>
         </div>
         <div class="match-eval-comments">
           <p><b>良かった点：</b>${esc(e.good_points||'未入力')}</p>
           <p><b>改善点：</b>${esc(e.improvement_points||'未入力')}</p>
           <p><b>次の目標：</b>${esc(e.next_goal||'未入力')}</p>
         </div>
         <div class="match-eval-actions">
           <button class="light mini" onclick="prepareMatchEvaluationAi('${e.id}','${p.id}')">AIアドバイス</button>
           <button class="danger mini" onclick="deleteMatchEvaluation('${e.id}','${p.id}')">削除</button>
         </div>
       </div>`}).join(''):'<div class="muted">試合評価はまだありません。</div>'}
     </div>
   </div>
 </div>`:''}

<div id="playerTab-ai" class="player-tab-panel hidden">
   <div class="ai-player-summary">
     <h4>🤖 AIへ渡す育成データ</h4>
     <div class="detail-text">学年：${esc(p.grade||'未設定')}
ポジション：${esc(p.position||'未設定')}
強み：${esc(p.strengths||'未入力')}
次の目標：${esc(p.development_goal||'未入力')}
出場：${t.apps}試合・${t.minutes}分
得点：${t.goals}　アシスト：${t.assists}　MVP：${t.mvp}</div>
   </div>
   <div class="ai-player-actions">
     <button onclick="preparePlayerDetailAi('${p.id}')">AI育成評価を作成</button>
     <button class="light" onclick="copyPlayerSummary('${p.id}')">データをコピー</button>
   </div>
   <div class="notice">AIの回答は育成の参考案です。最終判断と本人への伝え方は、指導者が確認してください。</div>
 </div>

 ${staff?`<div id="playerTab-condition" class="player-tab-panel hidden">
   <div class="condition-meter-grid">
     <div class="condition-card"><span>疲労度</span><b>${esc(levelLabel(pv.fatigue_level,'fatigue'))}</b><div class="meter"><i style="width:${Math.min(100,(Number(pv.fatigue_level)||3)*20)}%"></i></div></div>
     <div class="condition-card"><span>調子</span><b>${esc(levelLabel(pv.condition_level,'condition'))}</b><div class="meter positive"><i style="width:${Math.min(100,(Number(pv.condition_level)||3)*20)}%"></i></div></div>
   </div>
   <div class="detail-panel"><h4>コーチメモ</h4><div class="detail-text">${esc(pv.coach_note||'未入力')}</div></div>
   <div class="modal-actions"><button class="light" onclick="closePlayerDetail();openPlayerModal('${p.id}')">状態を編集</button></div>
 </div>

 <div id="playerTab-guardian" class="player-tab-panel hidden">
   <div class="detail-panel private-panel">
     <h4>🔒 保護者・緊急連絡</h4>
     <div class="guardian-grid">
       <div><span>保護者氏名</span><b>${esc(pv.guardian_name||'未入力')}</b></div>
       <div><span>電話番号</span><b>${esc(pv.guardian_phone||'未入力')}</b></div>
       <div><span>メール</span><b>${esc(pv.guardian_email||'未入力')}</b></div>
       <div><span>緊急連絡先</span><b>${esc(pv.emergency_contact||'未入力')}</b></div>
     </div>
   </div>
   <div class="notice warn">この情報は管理者・コーチだけが閲覧できます。画面共有や印刷時の取り扱いに注意してください。</div>
   <div class="modal-actions"><button class="light" onclick="closePlayerDetail();openPlayerModal('${p.id}')">連絡先を編集</button></div>
 </div>`:''}

 <div class="modal-actions player-detail-footer">
   ${staff?`<button class="light" onclick="closePlayerDetail();openPlayerModal('${p.id}')">編集</button>`:''}
   <button class="secondary" onclick="closePlayerDetail()">閉じる</button>
 </div>`;
 $('playerDetailModal').classList.remove('hidden');
 const first=$('playerDetailContent').querySelector('[data-player-tab="basic"]');if(first)switchPlayerDetailTab('basic',first);
}
function switchPlayerDetailTab(tab,button){
 document.querySelectorAll('#playerDetailContent .player-tab-panel').forEach(x=>x.classList.add('hidden'));
 document.querySelectorAll('#playerDetailContent .player-detail-tab').forEach(x=>x.classList.remove('active'));
 const panel=$('playerTab-'+tab);if(panel)panel.classList.remove('hidden');if(button)button.classList.add('active');
 if(tab==='growth')setTimeout(()=>{renderPlayerGrowthChart(activePlayerDetailId);if(isStaff())renderPlayerBodyGrowthChart(activePlayerDetailId)},30);if(tab==='skills'&&isStaff())setTimeout(()=>renderPlayerSkillChart(activePlayerDetailId),30);if(tab==='match-eval'&&isStaff())setTimeout(()=>renderPlayerMatchEvalChart(activePlayerDetailId),30);
}
function renderPlayerGrowthChart(id){
 if(!window.Chart)return;
 const rows=[...playerMatchRows(id)].reverse().slice(-20);
 const canvas=$('playerGrowthCanvas');if(!canvas)return;
 if(playerGrowthChart)playerGrowthChart.destroy();
 playerGrowthChart=new Chart(canvas,{type:'line',data:{
   labels:rows.map(x=>(x.m.match_date||'').slice(5)+' '+(x.m.opponent||'')),
   datasets:[
     {label:'出場時間（分）',data:rows.map(x=>x.r.minutes||0),yAxisID:'y'},
     {label:'得点',data:rows.map(x=>x.r.goals||0),yAxisID:'y1'},
     {label:'アシスト',data:rows.map(x=>x.r.assists||0),yAxisID:'y1'}
   ]},
   options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},
   scales:{y:{beginAtZero:true,title:{display:true,text:'出場時間'}},y1:{beginAtZero:true,position:'right',grid:{drawOnChartArea:false},ticks:{precision:0},title:{display:true,text:'得点・アシスト'}}},
   plugins:{legend:{position:'bottom'}}}
 });
}
function toggleGrowthEntry(){const e=$('growthEntryForm');if(e)e.classList.toggle('hidden')}
async function saveGrowthRecord(playerId){
 if(!isStaff())return;
 const date=$('growthDate').value;if(!date){showMessage('記録日を入力してください。');return}
 const data={player_id:String(playerId),record_date:date,height_cm:+$('growthHeight').value||null,weight_kg:+$('growthWeight').value||null,sleep_hours:+$('growthSleep').value||null,fatigue_level:+$('growthFatigue').value||3,condition_level:+$('growthCondition').value||3,injury_status:$('growthInjury').value,training_status:$('growthTraining').value,coach_score:+$('growthCoachScore').value||3,note:$('growthNote').value.trim(),created_by:session?.user?.id||null,updated_at:new Date().toISOString()};
 const r=await sb.from('player_growth_records').upsert(data,{onConflict:'player_id,record_date'});
 if(r.error){showMessage('成長記録を保存できません：'+r.error.message);return}
 showMessage('成長記録を保存しました。','ok');clearPlayerDetailCache(playerId);await loadPlayerDetailData(playerId,true);openPlayerDetail(playerId);const btn=$('playerDetailContent').querySelector('[data-player-tab="growth"]');if(btn)switchPlayerDetailTab('growth',btn)
}
async function deleteGrowthRecord(id){
 if(!isStaff()||!confirm('この成長記録を削除しますか？'))return;
 const playerId=activePlayerDetailId;const r=await sb.from('player_growth_records').delete().eq('id',id);
 if(r.error){showMessage(r.error.message);return}
 showMessage('成長記録を削除しました。','ok');clearPlayerDetailCache(playerId);await loadPlayerDetailData(playerId,true);openPlayerDetail(playerId);const btn=$('playerDetailContent').querySelector('[data-player-tab="growth"]');if(btn)switchPlayerDetailTab('growth',btn)
}
function renderPlayerBodyGrowthChart(id){
 if(!window.Chart)return;const canvas=$('playerBodyGrowthCanvas');if(!canvas)return;
 const rows=[...growthForPlayer(id)].reverse();if(canvas._chart)canvas._chart.destroy();
 canvas._chart=new Chart(canvas,{type:'line',data:{labels:rows.map(x=>x.record_date),datasets:[{label:'身長（cm）',data:rows.map(x=>x.height_cm),yAxisID:'y'},{label:'体重（kg）',data:rows.map(x=>x.weight_kg),yAxisID:'y1'}]},options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},scales:{y:{position:'left',beginAtZero:false,title:{display:true,text:'身長'}},y1:{position:'right',beginAtZero:false,grid:{drawOnChartArea:false},title:{display:true,text:'体重'}}},plugins:{legend:{position:'bottom'}}}})
}
function toggleMedicalEntry(){const e=$('medicalEntryForm');if(e)e.classList.toggle('hidden')}
async function saveMedicalRecord(playerId){
 if(!isStaff())return;
 const date=$('medicalDate').value;if(!date){showMessage('記録日を入力してください。');return}
 const data={player_id:String(playerId),record_date:date,body_part:$('medicalBodyPart').value.trim(),diagnosis:$('medicalDiagnosis').value.trim(),severity:+$('medicalSeverity').value||3,participation_status:$('medicalParticipation').value,return_date:$('medicalReturnDate').value||null,clinic:$('medicalClinic').value.trim(),visit_status:$('medicalVisitStatus').value,action_note:$('medicalAction').value.trim(),created_by:session?.user?.id||null,updated_at:new Date().toISOString()};
 const r=await sb.from('player_medical_records').insert(data);if(r.error){showMessage(r.error.message);return}
 showMessage('メディカル記録を保存しました。','ok');clearPlayerDetailCache(playerId);await loadPlayerDetailData(playerId,true);openPlayerDetail(playerId);const btn=$('playerDetailContent').querySelector('[data-player-tab="medical"]');if(btn)switchPlayerDetailTab('medical',btn)
}
async function deleteMedicalRecord(id){if(!isStaff()||!confirm('このメディカル記録を削除しますか？'))return;const playerId=activePlayerDetailId;const r=await sb.from('player_medical_records').delete().eq('id',id);if(r.error){showMessage(r.error.message);return}clearPlayerDetailCache(playerId);await loadPlayerDetailData(playerId,true);openPlayerDetail(playerId);const btn=$('playerDetailContent').querySelector('[data-player-tab="medical"]');if(btn)switchPlayerDetailTab('medical',btn)}

function toggleSkillEntry(){const e=$('skillEntryForm');if(e)e.classList.toggle('hidden')}
async function saveSkillEvaluation(playerId){
 if(!isStaff())return;
 const date=$('skillDate').value;if(!date){showMessage('評価日を入力してください。');return}
 const data={player_id:String(playerId),evaluation_date:date,dribbling:+$('skill0').value,passing:+$('skill1').value,shooting:+$('skill2').value,defending:+$('skill3').value,speed:+$('skill4').value,decision_making:+$('skill5').value,physical:+$('skill6').value,mental:+$('skill7').value,comment:$('skillComment').value.trim(),created_by:session?.user?.id||null,updated_at:new Date().toISOString()};
 const r=await sb.from('player_skill_evaluations').upsert(data,{onConflict:'player_id,evaluation_date'});if(r.error){showMessage(r.error.message);return}
 showMessage('技術評価を保存しました。','ok');clearPlayerDetailCache(playerId);await loadPlayerDetailData(playerId,true);openPlayerDetail(playerId);const btn=$('playerDetailContent').querySelector('[data-player-tab="skills"]');if(btn)switchPlayerDetailTab('skills',btn)
}
async function deleteSkillEvaluation(id){if(!isStaff()||!confirm('この技術評価を削除しますか？'))return;const playerId=activePlayerDetailId;const r=await sb.from('player_skill_evaluations').delete().eq('id',id);if(r.error){showMessage(r.error.message);return}clearPlayerDetailCache(playerId);await loadPlayerDetailData(playerId,true);openPlayerDetail(playerId);const btn=$('playerDetailContent').querySelector('[data-player-tab="skills"]');if(btn)switchPlayerDetailTab('skills',btn)}
function renderPlayerSkillChart(id){
 if(!window.Chart)return;const canvas=$('playerSkillCanvas');if(!canvas)return;const s=skillsForPlayer(id)[0];
 if(canvas._chart)canvas._chart.destroy();const vals=s?[s.dribbling,s.passing,s.shooting,s.defending,s.speed,s.decision_making,s.physical,s.mental]:[0,0,0,0,0,0,0,0];
 canvas._chart=new Chart(canvas,{type:'radar',data:{labels:['ドリブル','パス','シュート','守備','スピード','判断力','フィジカル','メンタル'],datasets:[{label:s?`最新評価 ${s.evaluation_date}`:'未評価',data:vals}]},options:{responsive:true,maintainAspectRatio:false,scales:{r:{beginAtZero:true,min:0,max:5,ticks:{stepSize:1}}},plugins:{legend:{position:'bottom'}}}})
}
function toggleMatchEvalEntry(){const e=$('matchEvalEntryForm');if(e)e.classList.toggle('hidden')}
async function saveMatchEvaluation(playerId){
 if(!isStaff())return;
 const matchId=$('matchEvalMatchId').value;if(!matchId){showMessage('対象試合を選択してください。');return}
 const data={
  player_id:String(playerId),match_id:String(matchId),
  attack:+$('matchEvalAttack').value||3,defense:+$('matchEvalDefense').value||3,
  passing:+$('matchEvalPassing').value||3,dribbling:+$('matchEvalDribbling').value||3,
  shooting:+$('matchEvalShooting').value||3,decision_making:+$('matchEvalDecision').value||3,
  work_rate:+$('matchEvalWorkRate').value||3,communication:+$('matchEvalCommunication').value||3,
  good_points:$('matchEvalGood').value.trim(),improvement_points:$('matchEvalImprove').value.trim(),
  next_goal:$('matchEvalNextGoal').value.trim(),created_by:session?.user?.id||null,updated_at:new Date().toISOString()
 };
 const r=await sb.from('player_match_evaluations').upsert(data,{onConflict:'player_id,match_id'});
 if(r.error){showMessage('試合評価を保存できません：'+r.error.message);return}
 showMessage('試合評価を保存しました。','ok');
 clearPlayerDetailCache(playerId);await loadPlayerDetailData(playerId,true);openPlayerDetail(playerId);
 const btn=$('playerDetailContent').querySelector('[data-player-tab="match-eval"]');if(btn)switchPlayerDetailTab('match-eval',btn)
}
async function deleteMatchEvaluation(id,playerId){
 if(!isStaff()||!confirm('この試合評価を削除しますか？'))return;
 const r=await sb.from('player_match_evaluations').delete().eq('id',id);
 if(r.error){showMessage(r.error.message);return}
 clearPlayerDetailCache(playerId);await loadPlayerDetailData(playerId,true);openPlayerDetail(playerId);
 const btn=$('playerDetailContent').querySelector('[data-player-tab="match-eval"]');if(btn)switchPlayerDetailTab('match-eval',btn)
}
function renderPlayerMatchEvalChart(id){
 if(!window.Chart)return;const canvas=$('playerMatchEvalCanvas');if(!canvas)return;
 const items=[...matchEvaluationsForPlayer(id)].reverse().slice(-10);
 if(canvas._chart)canvas._chart.destroy();
 canvas._chart=new Chart(canvas,{type:'line',data:{
  labels:items.map(e=>{const m=matchById(e.match_id);return (m?.match_date||'').slice(5)+' '+(m?.opponent||'')}),
  datasets:[
   {label:'攻撃',data:items.map(e=>e.attack)},{label:'守備',data:items.map(e=>e.defense)},
   {label:'判断力',data:items.map(e=>e.decision_making)},{label:'運動量',data:items.map(e=>e.work_rate)},
   {label:'総合',data:items.map(e=>Number(evaluationOverall(e)))}
  ]},options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},
  scales:{y:{beginAtZero:true,min:0,max:5,ticks:{stepSize:1}}},
  plugins:{legend:{position:'bottom'}}}})
}
function prepareMatchEvaluationAi(evalId,playerId){
 const p=players.find(x=>String(x.id)===String(playerId)),e=matchEvaluationsForPlayer(playerId).find(x=>String(x.id)===String(evalId));
 if(!p||!e)return;const m=matchById(e.match_id);closePlayerDetail();showPage('ai');setAiMode('player',document.querySelector('[data-mode="player"]'));
 setAiPrompt(`${p.name}選手の試合評価をもとに、本人向けの前向きなAIアドバイスを作成してください。
試合：${m?.match_date||''} ${m?.opponent||''} ${m?.competition||''}
攻撃：${e.attack}/5
守備：${e.defense}/5
パス：${e.passing}/5
ドリブル：${e.dribbling}/5
シュート：${e.shooting}/5
判断力：${e.decision_making}/5
運動量：${e.work_rate}/5
コミュニケーション：${e.communication}/5
良かったところ：${e.good_points||'未入力'}
改善したいところ：${e.improvement_points||'未入力'}
次の具体目標：${e.next_goal||'未入力'}

小学生本人に伝わる言葉で、
1. 良かった点
2. 次に意識する1〜2点
3. 次回練習でできる具体メニュー
4. 前向きな声かけ
の順で作ってください。`)
}
function copyPlayerSummary(id){
 const p=players.find(x=>String(x.id)===String(id));if(!p)return;const t=totals(p);
 const text=`${p.name} 選手データ
学年：${p.grade||'未設定'}
ポジション：${p.position||'未設定'}
出場：${t.apps}試合 / ${t.minutes}分
得点：${t.goals}
アシスト：${t.assists}
MVP：${t.mvp}
強み：${p.strengths||'未入力'}
次の成長目標：${p.development_goal||'未入力'}`;
 navigator.clipboard.writeText(text).then(()=>showMessage('選手データをコピーしました。','ok')).catch(()=>showMessage('コピーできませんでした。'));
}
function closePlayerDetail(){if(playerGrowthChart){playerGrowthChart.destroy();playerGrowthChart=null}$('playerDetailModal').classList.add('hidden')}
function preparePlayerDetailAi(id){const p=players.find(x=>String(x.id)===String(id));if(!p)return;closePlayerDetail();showPage('ai');setAiMode('player',document.querySelector('[data-mode="player"]'));const t=totals(p),g=growthForPlayer(id).slice(0,5),med=medicalForPlayer(id).slice(0,3),sk=skillsForPlayer(id)[0],mev=matchEvaluationsForPlayer(id).slice(0,5);setAiPrompt(`${p.name}選手の育成評価を作成してください。\n学年：${p.grade||'未設定'}\nポジション：${p.position||'未設定'}\n強み：${p.strengths||'未入力'}\n次の目標：${p.development_goal||'未入力'}\n出場：${t.apps}試合、${t.minutes}分\n得点：${t.goals}、アシスト：${t.assists}、MVP：${t.mvp}\n最近の成長記録：${g.length?g.map(x=>`${x.record_date} 身長${x.height_cm||'-'}cm 体重${x.weight_kg||'-'}kg 疲労${x.fatigue_level} 調子${x.condition_level} ${injuryLabel(x.injury_status)} ${growthStatusLabel(x.training_status)}`).join(' / '):'未記録'}\n最近のメディカル情報：${med.length?med.map(x=>`${x.record_date} ${x.body_part||''} ${x.diagnosis||''} 復帰予定${x.return_date||'-'}`).join(' / '):'未記録'}\n最新技術評価：${sk?`ドリブル${sk.dribbling} パス${sk.passing} シュート${sk.shooting} 守備${sk.defending} スピード${sk.speed} 判断力${sk.decision_making} フィジカル${sk.physical} メンタル${sk.mental}`:'未評価'}\n最近の試合評価：${mev.length?mev.map(e=>{const m=matchById(e.match_id);return `${m?.match_date||''} ${m?.opponent||''} 総合${evaluationOverall(e)} 良かった点:${e.good_points||'-'} 改善点:${e.improvement_points||'-'}`}).join(' / '):'未評価'}\n本人に伝える良い点、伸ばしたい点、次の具体目標、前向きな声かけを小学生に伝わる言葉で作ってください。`)}
async function savePlayer(){if(!isStaff())return;const name=$('editName').value.trim();if(!name){showMessage('名前を入力してください。');return}const id=$('editPlayerId').value||('P'+Date.now().toString(36));const data={id,name,photo_url:$('editPhotoData').value||null,number:$('editNumber').value.trim(),grade:$('editGrade').value.trim(),birth_date:$('editBirthDate').value||null,position:$('editPosition').value.trim(),dominant_foot:$('editDominantFoot').value,height_cm:+$('editHeight').value||null,weight_kg:+$('editWeight').value||null,status:$('editStatus').value,strengths:$('editStrengths').value.trim(),development_goal:$('editDevelopmentGoal').value.trim(),past_apps:+$('editPastApps').value||0,past_goals:+$('editPastGoals').value||0,past_assists:+$('editPastAssists').value||0,past_yellow:+$('editPastYellow').value||0,past_red:+$('editPastRed').value||0,updated_at:new Date().toISOString()};const r=await sb.from('players').upsert(data);if(r.error){showMessage(r.error.message);return}const privateData={player_id:String(id),fatigue_level:+$('editFatigue').value||3,condition_level:+$('editCondition').value||3,coach_note:$('editCoachNote').value.trim(),guardian_name:$('editGuardianName').value.trim(),guardian_phone:$('editGuardianPhone').value.trim(),guardian_email:$('editGuardianEmail').value.trim(),emergency_contact:$('editEmergencyContact').value.trim(),updated_at:new Date().toISOString()};const pr=await sb.from('player_private').upsert(privateData);if(pr.error){showMessage('基本情報は保存しましたが、非公開情報の保存に失敗しました：'+pr.error.message);return}closePlayerModal();showMessage('選手詳細を保存しました。','ok');await loadAll()}
async function deletePlayer(id){if(!isStaff())return;const p=players.find(x=>x.id===id);if(!p||!confirm(`「${p.name}」を削除しますか？\nこの選手の試合記録もすべて削除されます。`))return;const rr=await sb.from('records').delete().eq('player_id',id);if(rr.error){showMessage('選手記録の削除エラー：'+rr.error.message);return}const r=await sb.from('players').delete().eq('id',id);if(r.error)showMessage(r.error.message);else{showMessage('選手を削除しました。','ok');await loadAll()}}
async function login(){const r=await sb.auth.signInWithPassword({email:$('loginEmail').value.trim(),password:$('loginPassword').value});if(r.error)showMessage('ログイン失敗：'+r.error.message);else showMessage('ログインしました。','ok')}
async function logout(){await sb.auth.signOut();showMessage('ログアウトしました。','ok')}
function exportAllCsv(){const rows=[['名前','学年','ポジション','状態','出場','時間','得点','アシスト','黄','赤','MVP'],...players.map(p=>{const t=totals(p);return[p.name,p.grade,p.position,p.status,t.apps,t.minutes,t.goals,t.assists,t.yellow,t.red,t.mvp]})];const csv='\ufeff'+rows.map(r=>r.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',')).join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='古堅南FC_選手成績.csv';a.click();URL.revokeObjectURL(a.href)}

function defaultAvatar(){return 'data:image/svg+xml;charset=UTF-8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><rect width="100%" height="100%" fill="#e2e8f0"/><circle cx="80" cy="58" r="30" fill="#94a3b8"/><path d="M28 148c5-38 28-55 52-55s47 17 52 55" fill="#94a3b8"/></svg>')}
async function imageToDataUrl(file,maxSize=480,quality=.78){return new Promise((resolve,reject)=>{const img=new Image(),url=URL.createObjectURL(file);img.onload=()=>{let w=img.width,h=img.height;if(Math.max(w,h)>maxSize){const k=maxSize/Math.max(w,h);w=Math.round(w*k);h=Math.round(h*k)}const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(img,0,0,w,h);URL.revokeObjectURL(url);resolve(c.toDataURL('image/jpeg',quality))};img.onerror=reject;img.src=url})}
async function previewPlayerPhoto(input){const f=input.files?.[0];if(!f)return;try{const data=await imageToDataUrl(f,420,.76);$('editPhotoData').value=data;$('playerPhotoPreview').src=data}catch(e){showMessage('写真を読み込めませんでした。')}}
async function previewEmblem(input){const f=input.files?.[0];if(!f)return;try{$('emblemPreview').src=await imageToDataUrl(f,360,.82)}catch(e){showMessage('画像を読み込めませんでした。')}}
function applyTeamSettings(){const name=teamSettings.team_name||'古堅南FC',emblem=teamSettings.emblem_url||'';$('teamName').value=name;$('emblemPreview').src=emblem||defaultAvatar();$('headerEmblem').src=emblem||'';$('headerEmblem').classList.toggle('hidden',!emblem);document.querySelector('.title').lastChild && null;document.title=name+' Ver.5';$('settingsNav').classList.toggle('hidden',!isStaff())}
async function saveTeamSettings(){if(!isStaff())return;const name=$('teamName').value.trim()||'古堅南FC',emblem=$('emblemPreview').src.startsWith('data:')?$('emblemPreview').src:(teamSettings.emblem_url||'');const rows=[{key:'team_name',value:name,updated_at:new Date().toISOString()},{key:'emblem_url',value:emblem,updated_at:new Date().toISOString()}];const r=await sb.from('team_settings').upsert(rows);if(r.error)showMessage(r.error.message);else showMessage('チーム設定を保存しました。','ok')}
function analysisMatches(){const season=$('analysisSeason').value,comp=$('analysisCompetition').value,from=$('analysisFrom').value,to=$('analysisTo').value;return matches.filter(m=>(!season||String(m.season)===season)&&(!comp||(m.competition||'通常試合')===comp)&&(!from||m.match_date>=from)&&(!to||m.match_date<=to))}
function resetAnalysisFilters(){$('analysisSeason').value='';$('analysisCompetition').value='';$('analysisFrom').value='';$('analysisTo').value='';renderAnalytics()}
function chart(id,config){if(charts[id])charts[id].destroy();const el=$(id);if(el)charts[id]=new Chart(el,config)}
function renderAnalytics(){if(!window.Chart)return;const ms=analysisMatches();let w=0,d=0,l=0,gf=0,ga=0;ms.forEach(m=>{gf+=m.goals_for||0;ga+=m.goals_against||0;m.goals_for>m.goals_against?w++:m.goals_for<m.goals_against?l++:d++});const rate=ms.length?Math.round(w/ms.length*100):0,avgFor=ms.length?(gf/ms.length).toFixed(1):'0.0',avgAgainst=ms.length?(ga/ms.length).toFixed(1):'0.0';$('analysisStats').innerHTML=[['対象試合',ms.length],['勝利',w],['引分',d],['敗戦',l],['勝率',rate+'%'],['平均得点',avgFor],['平均失点',avgAgainst],['得失点差',gf-ga]].map(x=>`<div class="card stat"><span>${x[0]}</span><b>${x[1]}</b></div>`).join('');chart('resultChart',{type:'doughnut',data:{labels:['勝利','引分','敗戦'],datasets:[{data:[w,d,l]}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom'}}}});const chronological=[...ms].sort((a,b)=>a.match_date.localeCompare(b.match_date)).slice(-20);chart('scoreChart',{type:'line',data:{labels:chronological.map(x=>x.match_date.slice(5)+' '+x.opponent),datasets:[{label:'得点',data:chronological.map(x=>x.goals_for)},{label:'失点',data:chronological.map(x=>x.goals_against)}]},options:{responsive:true,maintainAspectRatio:false,scales:{y:{beginAtZero:true,ticks:{precision:0}}},plugins:{legend:{position:'bottom'}}}});const matchIds=new Set(ms.map(x=>x.id));const mins=players.map(p=>({name:p.name,value:records.filter(r=>r.player_id===p.id&&matchIds.has(r.match_id)).reduce((a,r)=>a+(r.minutes||0),0)})).sort((a,b)=>b.value-a.value).slice(0,10);chart('minutesChart',{type:'bar',data:{labels:mins.map(x=>x.name),datasets:[{label:'出場時間（分）',data:mins.map(x=>x.value)}]},options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,scales:{x:{beginAtZero:true}},plugins:{legend:{display:false}}}});const map={};ms.forEach(m=>{const k=m.competition||'通常試合',x=map[k]||(map[k]={games:0,w:0,d:0,l:0,gf:0,ga:0});x.games++;x.gf+=m.goals_for||0;x.ga+=m.goals_against||0;m.goals_for>m.goals_against?x.w++:m.goals_for<m.goals_against?x.l++:x.d++});$('competitionBody').innerHTML=Object.entries(map).sort((a,b)=>b[1].games-a[1].games).map(([k,x])=>`<tr><td>${esc(k)}</td><td>${x.games}</td><td>${x.w}</td><td>${x.d}</td><td>${x.l}</td><td>${x.gf}</td><td>${x.ga}</td><td>${Math.round(x.w/x.games*100)}%</td></tr>`).join('')||'<tr><td colspan="8">該当試合なし</td></tr>'}

init();

// ===== Ver.5 Phase 2: AI会話・分析 =====
const AI_DEFAULT_URL='https://furugen-minami-ai.onrender.com';
let aiMode='chat';
let aiHistory=[];
function aiSettings(){let saved=(localStorage.getItem('furugenAiServerUrl')||'').trim().replace(/\/$/,'');if(!saved||/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(saved)){saved=AI_DEFAULT_URL;localStorage.setItem('furugenAiServerUrl',saved)}return {url:saved,instruction:localStorage.getItem('furugenAiInstruction')||'小学生年代に伝わる言葉を使い、安全・成長・楽しさを優先してください。'}}
function openAiSettings(){const s=aiSettings();$('aiServerUrl').value=s.url;$('aiTeamInstruction').value=s.instruction;$('aiSettingsModal').classList.remove('hidden')}
function closeAiSettings(){$('aiSettingsModal').classList.add('hidden')}
function saveAiSettings(){const url=$('aiServerUrl').value.trim().replace(/\/$/,'')||AI_DEFAULT_URL;localStorage.setItem('furugenAiServerUrl',url);localStorage.setItem('furugenAiInstruction',$('aiTeamInstruction').value.trim());closeAiSettings();showMessage('AI設定を保存しました。','ok');testAiConnection()}
function addAiMessage(text,role='assistant',id=''){const box=$('aiChat');const e=document.createElement('div');e.className='ai-message '+role;e.textContent=text;if(id)e.id=id;box.appendChild(e);box.scrollTop=box.scrollHeight;return e}
function setAiPrompt(text){$('aiPrompt').value=text;$('aiPrompt').focus()}
function clearAiChat(){aiHistory=[];localStorage.removeItem('furugenAiHistory');$('aiChat').innerHTML='<div class="ai-message assistant">会話を消去しました。新しい相談を入力してください。</div>'}
function saveAiHistory(){localStorage.setItem('furugenAiHistory',JSON.stringify(aiHistory.slice(-12)))}
function restoreAiHistory(){try{aiHistory=JSON.parse(localStorage.getItem('furugenAiHistory')||'[]');if(!Array.isArray(aiHistory))aiHistory=[]}catch{aiHistory=[]}if(aiHistory.length){$('aiChat').innerHTML='';aiHistory.forEach(x=>addAiMessage(x.content,x.role))}}
function setAiMode(mode,button){aiMode=mode;document.querySelectorAll('.ai-mode').forEach(b=>b.classList.toggle('active',b===button));const examples={chat:'相談内容を入力してください。',training:'対象学年、時間、人数、目的を入力してください。',tactics:'相手の特徴と自チームの課題を入力してください。',match:'試合結果や気付いたことを入力してください。',player:'対象選手を選び、伝えたい目的を入力してください。'};$('aiPrompt').placeholder=examples[mode]||examples.chat}
function prepareTrainingPrompt(){setAiMode('training',document.querySelector('[data-mode="training"]'));setAiPrompt('小学5〜6年生、16人、60分で、パスと判断力を高める練習メニューを作ってください。')}
function preparePressingPrompt(){setAiMode('tactics',document.querySelector('[data-mode="tactics"]'));setAiPrompt('相手が前から強くプレスしてくる時の対策を、小学生が理解できる言葉で教えてください。')}
function preparePlayerPrompt(){setAiMode('player',document.querySelector('[data-mode="player"]'));const id=$('aiPlayerSelect').value;if(!id){showMessage('評価する選手を選択してください。');return}const p=players.find(x=>String(x.id)===String(id));if(!p)return;const t=totals(p);setAiPrompt(`${p.name}選手について、強み、伸ばしたい点、次の具体目標、本人への前向きな伝え方を作ってください。現在の記録：学年 ${p.grade||'未設定'}、ポジション ${p.position||'未設定'}、出場 ${t.apps}、出場時間 ${t.minutes}分、得点 ${t.goals}、アシスト ${t.assists}。`)}
function fillMatchSummaryPrompt(){setAiMode('match',document.querySelector('[data-mode="match"]'));const m=[...matches].sort((a,b)=>(b.match_date||'').localeCompare(a.match_date||''))[0];if(!m){setAiPrompt('まだ試合データがありません。次の試合に向けた練習メニューを提案してください。');return}const rel=records.filter(r=>r.match_id===m.id);const scorers=rel.filter(r=>r.goals>0).map(r=>{const p=players.find(x=>x.id===r.player_id);return `${p?.name||'選手'} ${r.goals}得点`}).join('、')||'得点者記録なし';setAiPrompt(`次の試合を分析してください。\n日付：${m.match_date||''}\n大会：${m.competition||'通常試合'}\n相手：${m.opponent||''}\n結果：古堅南FC ${m.goals_for||0}-${m.goals_against||0} 相手\n得点者：${scorers}\nメモ：${m.memo||'なし'}\n良かった点、改善点、次回練習、選手への声かけを提案してください。`)}
function refreshAiPlayerSelect(){const sel=$('aiPlayerSelect');if(!sel)return;const current=sel.value;sel.innerHTML='<option value="">選択なし</option>'+players.filter(p=>p.status==='現役').sort((a,b)=>(a.name||'').localeCompare(b.name||'','ja')).map(p=>`<option value="${p.id}">${esc(p.name)}（${esc(p.grade||'-')}・${esc(p.position||'-')}）</option>`).join('');sel.value=current}
function aiTeamContext(){if(!$('aiIncludeTeamData')?.checked)return {};const sorted=[...matches].sort((a,b)=>(b.match_date||'').localeCompare(a.match_date||''));const recent=sorted.slice(0,5).map(m=>`${m.match_date||''} ${m.opponent||''} ${m.goals_for||0}-${m.goals_against||0}`).join(' / ');const wins=matches.filter(m=>(m.goals_for||0)>(m.goals_against||0)).length;return {team:teamSettings.team_name||'古堅南FC',players_count:players.length,active_players:players.filter(p=>p.status==='現役').length,matches_count:matches.length,wins,recent_matches:recent||'なし'}}
async function testAiConnection(){const badge=$('aiConnectionBadge');badge.textContent='確認中…';badge.className='notice';try{const r=await fetch(aiSettings().url+'/health',{cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);const data=await r.json();badge.textContent=`✅ 接続済み：${data.service||'AIサーバー'}${data.api_key_configured?'（APIキー設定済み）':'（APIキー未設定）'}`;badge.className='notice '+(data.api_key_configured?'success':'')}catch(e){badge.textContent='❌ 未接続：Ver.6サーバーを起動し、URLを確認してください。';badge.className='notice'}}
async function sendAiMessage(){const prompt=$('aiPrompt').value.trim();if(!prompt){showMessage('相談内容を入力してください。');return}const btn=$('aiSendBtn'),status=$('aiStatus');const outgoingHistory=aiHistory.slice(-10);addAiMessage(prompt,'user');aiHistory.push({role:'user',content:prompt});$('aiPrompt').value='';btn.disabled=true;status.textContent='AIが回答を作成中…';const loading=addAiMessage('考えています','assistant','aiLoading');loading.classList.add('ai-loading');try{const s=aiSettings();const r=await fetch(s.url+'/v1/ai/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:prompt,mode:aiMode,system_instruction:s.instruction,context:aiTeamContext(),history:outgoingHistory})});const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.detail||data.error||('HTTP '+r.status));loading.remove();const answer=data.answer||'回答が空でした。';addAiMessage(answer,'assistant');aiHistory.push({role:'assistant',content:answer});saveAiHistory()}catch(e){loading.remove();addAiMessage('AI回答を取得できませんでした。Ver.6 Dockerサーバー、AI設定URL、APIキーを確認してください。\n'+e.message,'error')}finally{btn.disabled=false;status.textContent=''}}
async function copyLastAiAnswer(){const last=[...aiHistory].reverse().find(x=>x.role==='assistant');if(!last){showMessage('コピーできるAI回答がありません。');return}try{await navigator.clipboard.writeText(last.content);showMessage('AI回答をコピーしました。','ok')}catch{showMessage('コピーできませんでした。回答を長押ししてコピーしてください。')}}
const originalLoadAll=loadAll;loadAll=async function(){await originalLoadAll();refreshAiPlayerSelect()};
setTimeout(()=>{restoreAiHistory();refreshAiPlayerSelect();const input=$('aiServerUrl');if(input)input.placeholder=AI_DEFAULT_URL;document.querySelectorAll('#ai code').forEach(el=>{if((el.textContent||'').includes('localhost:8001'))el.textContent=AI_DEFAULT_URL});},0);


// Ver.6 - AIレポート・動画メモ
function refreshVer6Selects(){
  const opts='<option value="">選択してください</option>'+matches.map(m=>`<option value="${m.id}">${esc(m.match_date||'')} ${esc(m.opponent||'')}（${m.goals_for||0}-${m.goals_against||0}）</option>`).join('');
  ['reportMatchSelect','videoMatchSelect'].forEach(id=>{const e=$(id);if(e){const keep=e.value;e.innerHTML=opts;e.value=keep}});
  const popts='<option value="">チーム全体</option>'+players.filter(p=>p.status==='現役').map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('');
  const ps=$('videoPlayerSelect');if(ps){const keep=ps.value;ps.innerHTML=popts;ps.value=keep}
}
function renderReportsPage(){refreshVer6Selects();renderSavedReports();previewReportMatch()}
function prepareLatestReport(){if(!matches.length){showMessage('試合データがありません。');return}const s=$('reportMatchSelect');s.value=matches[0].id;previewReportMatch()}
function selectedReportMatch(){return matches.find(m=>String(m.id)===String($('reportMatchSelect')?.value))}
function reportContextForMatch(m){const rr=records.filter(r=>r.match_id===m.id);const played=rr.filter(r=>r.played);const scorers=rr.filter(r=>r.goals>0).map(r=>`${players.find(p=>p.id===r.player_id)?.name||'選手'} ${r.goals}得点`).join('、')||'記録なし';const assists=rr.filter(r=>r.assists>0).map(r=>`${players.find(p=>p.id===r.player_id)?.name||'選手'} ${r.assists}アシスト`).join('、')||'記録なし';const notes=videoNotes.filter(n=>n.match_id===m.id).map(n=>`${n.timestamp||''} ${n.event_type||''}: ${n.note||''}`).join(' / ');return {match_id:m.id,date:m.match_date,competition:m.competition||'通常試合',opponent:m.opponent,venue:m.venue||'',score:`${m.goals_for||0}-${m.goals_against||0}`,memo:m.memo||'',played_count:played.length,scorers,assists,video_notes:notes||'なし'}}
function previewReportMatch(){const box=$('reportMatchPreview');if(!box)return;const m=selectedReportMatch();box.textContent=m?`${m.match_date||''} / ${m.competition||'通常試合'} / 対 ${m.opponent||''} / ${m.goals_for||0}-${m.goals_against||0}`:'試合を選択してください。'}
async function generateAiReport(){const m=selectedReportMatch();if(!m){showMessage('対象試合を選択してください。');return}const btn=$('generateReportBtn'),status=$('reportStatus'),type=$('reportType').value;btn.disabled=true;status.textContent='AIがレポートを作成中…';try{const st=aiSettings(),context=reportContextForMatch(m);let r=await fetch(st.url+'/v1/ai/report',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({report_type:type,context,system_instruction:st.instruction})});let data=await r.json().catch(()=>({}));if(r.status===404){const typeText=type==='parents'?'保護者向けの温かい試合報告':type==='training'?'次回の60〜90分練習メニュー':'コーチ向け試合分析';const message=`次の試合データを使って、${typeText}を作成してください。\n${Object.entries(context).map(([k,v])=>`${k}: ${v}`).join('\n')}`;r=await fetch(st.url+'/v1/ai/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message,mode:type==='training'?'training':'match',system_instruction:st.instruction,context:{},history:[]})});data=await r.json().catch(()=>({}))}if(!r.ok)throw new Error(data.detail||data.error||('HTTP '+r.status));$('reportOutput').value=data.answer||''}catch(e){showMessage('レポート作成エラー：'+e.message)}finally{btn.disabled=false;status.textContent=''}}
async function saveGeneratedReport(){if(!isStaff()){showMessage('レポート保存はコーチログインが必要です。');return}const m=selectedReportMatch(),content=$('reportOutput').value.trim();if(!m||!content){showMessage('対象試合とレポート内容を確認してください。');return}const row={match_id:m.id,report_type:$('reportType').value,title:`${m.match_date||''} 対${m.opponent||''}`.trim(),content,created_by:session.user.id};const r=await sb.from('ai_reports').insert(row);if(r.error){showMessage('保存エラー：'+r.error.message);return}showMessage('AIレポートを保存しました。','ok');await loadAll()}
function renderSavedReports(){const box=$('savedReports');if(!box)return;box.innerHTML=reports.map(r=>`<div class="saved-report"><div><b>${esc(r.title||'AIレポート')}</b><span class="pill">${esc(reportTypeLabel(r.report_type))}</span><div class="muted">${esc(String(r.created_at||'').slice(0,16).replace('T',' '))}</div></div><details><summary>内容を見る</summary><div class="report-text">${esc(r.content)}</div></details>${isStaff()?`<button class="danger" onclick="deleteSavedReport('${r.id}')">削除</button>`:''}</div>`).join('')||'<p class="muted">保存済みレポートはありません。</p>'}
function reportTypeLabel(t){return t==='parents'?'保護者向け':t==='training'?'練習提案':'コーチ分析'}
async function deleteSavedReport(id){if(!confirm('このレポートを削除しますか？'))return;const r=await sb.from('ai_reports').delete().eq('id',id);if(r.error)showMessage(r.error.message);else await loadAll()}
async function copyReportOutput(){const v=$('reportOutput').value;if(!v){showMessage('コピーする内容がありません。');return}await navigator.clipboard.writeText(v);showMessage('レポートをコピーしました。','ok')}
function renderVideoPage(){refreshVer6Selects();renderVideoNotes()}
async function saveVideoNote(){if(!isStaff()){showMessage('動画メモ保存はコーチログインが必要です。');return}const matchId=$('videoMatchSelect').value,note=$('videoNote').value.trim();if(!matchId||!note){showMessage('対象試合とメモを入力してください。');return}const row={match_id:matchId,timestamp:$('videoTimestamp').value.trim(),event_type:$('videoEventType').value,player_id:$('videoPlayerSelect').value||null,note,created_by:session.user.id};const r=await sb.from('video_notes').insert(row);if(r.error){showMessage('保存エラー：'+r.error.message);return}$('videoNote').value='';$('videoTimestamp').value='';showMessage('動画メモを保存しました。','ok');await loadAll()}
function renderVideoNotes(){const box=$('videoNotesList');if(!box)return;box.innerHTML=videoNotes.map(n=>{const m=matches.find(x=>x.id===n.match_id),p=players.find(x=>x.id===n.player_id);return `<div class="video-note"><div><b>${esc(n.timestamp||'時間未設定')} ${esc(n.event_type||'')}</b><span class="pill">${esc(p?.name||'チーム全体')}</span><div>${esc(n.note||'')}</div><div class="muted">${esc(m?`${m.match_date||''} 対${m.opponent||''}`:'試合')}</div></div>${isStaff()?`<button class="danger" onclick="deleteVideoNote('${n.id}')">削除</button>`:''}</div>`}).join('')||'<p class="muted">動画メモはありません。</p>'}
async function deleteVideoNote(id){if(!confirm('この動画メモを削除しますか？'))return;const r=await sb.from('video_notes').delete().eq('id',id);if(r.error)showMessage(r.error.message);else await loadAll()}
function buildVideoAiPrompt(){const matchId=$('videoMatchSelect')?.value;if(!matchId){showMessage('対象試合を選択してください。');return}const m=matches.find(x=>String(x.id)===String(matchId)),notes=videoNotes.filter(n=>String(n.match_id)===String(matchId));if(!notes.length){showMessage('この試合の動画メモがありません。');return}showPage('ai');setAiMode('match',document.querySelector('[data-mode="match"]'));setAiPrompt(`次の動画メモを分析し、良かった点、改善点、次回練習、試合中の声かけを提案してください。\n試合：${m?.match_date||''} 対${m?.opponent||''} ${m?.goals_for||0}-${m?.goals_against||0}\n場面：\n${notes.map(n=>`${n.timestamp||''} ${n.event_type||''} ${n.note||''}`).join('\n')}`)}


// Ver.7.0 - AI戦略センター
let v7Feature='lineup';
const V7_FEATURES={
 lineup:{title:'⚽ スタメン自動提案',instruction:'登録選手から先発と控えを提案してください。フォーメーション、各ポジション、選考理由、注意点、公平な出場機会を示してください。記録だけで能力を断定せず、欠席・負傷・疲労の選手は無理に起用しないでください。'},
 substitution:{title:'🔄 出場時間・疲労度を考慮した交代提案',instruction:'試合時間全体の交代プランを作成してください。交代時刻、入る選手、出る選手、狙い、想定出場時間を表形式で示し、全員の安全と公平性を優先してください。'},
 match_report:{title:'📝 試合終了後のAI試合レポート',instruction:'対象試合の事実を基に、結果、良かった点、改善点、選手起用、次回の優先課題、具体的練習、短い総括を見出し付きで作成してください。事実と推測を分けてください。'},
 parents:{title:'👨‍👩‍👧 保護者向け連絡文',instruction:'保護者へ送れる丁寧で温かい連絡文を作成してください。結果だけで評価せず、努力・成長・感謝・次回予定を簡潔にまとめ、個人を責めたり比較したりしないでください。'},
 season:{title:'📊 年間成績・ランキングAI分析',instruction:'年度成績を分析し、チーム傾向、得点・失点、勝率、出場時間、得点・アシストの傾向、成長点、課題、次年度への提案を示してください。ランキングは優劣の断定ではなく役割と成長の参考として扱ってください。'}
};
function setV7Feature(key,btn){v7Feature=key;document.querySelectorAll('.v7-tab').forEach(x=>x.classList.toggle('active',x===btn));$('v7FeatureTitle').textContent=V7_FEATURES[key].title;const showPlayers=['lineup','substitution'].includes(key);$('v7PlayerControls').classList.toggle('hidden',!showPlayers);renderV7Preview()}
function refreshV7Selects(){const ms=$('v7MatchSelect'),ss=$('v7SeasonSelect');if(ms){const keep=ms.value;ms.innerHTML='<option value="">次の試合・試合未指定</option>'+matches.map(m=>`<option value="${m.id}">${esc(m.match_date||'')} 対 ${esc(m.opponent||'')}（${m.goals_for||0}-${m.goals_against||0}）</option>`).join('');ms.value=keep}if(ss){const keep=ss.value,seasons=[...new Set(matches.map(m=>String(m.season||m.match_date?.slice(0,4)||'')).filter(Boolean))].sort().reverse();ss.innerHTML='<option value="">全期間</option>'+seasons.map(y=>`<option value="${y}">${y}年度</option>`).join('');ss.value=keep}}
function renderV7Page(){refreshV7Selects();renderV7PlayerControls();renderV7Preview();renderV7History();testAiConnection()}
function recentMinutes(p,limit=3){const mids=[...matches].sort((a,b)=>(b.match_date||'').localeCompare(a.match_date||'')).slice(0,limit).map(m=>m.id);return records.filter(r=>r.player_id===p.id&&mids.includes(r.match_id)).reduce((a,r)=>a+(+r.minutes||0),0)}
function renderV7PlayerControls(){const box=$('v7PlayerControls');if(!box)return;const active=players.filter(p=>p.status==='現役');box.innerHTML='<h4>選手の当日状況</h4><div class="muted">欠席・負傷は候補から除外されます。疲労度と調子はAI提案の参考です。</div><div class="table"><table><thead><tr><th>選手</th><th>参加</th><th>疲労</th><th>調子</th><th>直近3試合</th></tr></thead><tbody>'+active.map(p=>`<tr data-v7-player="${p.id}"><td><b>${esc(p.name)}</b><div class="muted">${esc(p.position||'-')} / ${esc(p.grade||'-')}</div></td><td><select class="v7-availability"><option value="available">参加</option><option value="late">遅刻・途中参加</option><option value="absent">欠席</option><option value="injured">負傷・体調不良</option></select></td><td><select class="v7-fatigue"><option value="1">1 低い</option><option value="2">2</option><option value="3" selected>3 普通</option><option value="4">4</option><option value="5">5 高い</option></select></td><td><select class="v7-form"><option value="1">1 低め</option><option value="2">2</option><option value="3" selected>3 普通</option><option value="4">4</option><option value="5">5 良い</option></select></td><td>${recentMinutes(p)}分</td></tr>`).join('')+'</tbody></table></div>'}
function v7PlayerData(){return [...document.querySelectorAll('[data-v7-player]')].map(row=>{const p=players.find(x=>String(x.id)===row.dataset.v7Player),t=p?totals(p):{};return {name:p?.name||'',grade:p?.grade||'',position:p?.position||'',number:p?.number||'',availability:row.querySelector('.v7-availability').value,fatigue:+row.querySelector('.v7-fatigue').value,form:+row.querySelector('.v7-form').value,apps:t.apps||0,minutes:t.minutes||0,recent_minutes:recentMinutes(p),goals:t.goals||0,assists:t.assists||0}})}
function v7SelectedMatches(){const season=$('v7SeasonSelect')?.value;return matches.filter(m=>!season||String(m.season||String(m.match_date||'').slice(0,4))===season)}
function v7SeasonSummary(){const ms=v7SelectedMatches();let w=0,d=0,l=0,gf=0,ga=0;ms.forEach(m=>{gf+=+m.goals_for||0;ga+=+m.goals_against||0;m.goals_for>m.goals_against?w++:m.goals_for<m.goals_against?l++:d++});const ranking=players.filter(p=>p.status==='現役').map(p=>({name:p.name,grade:p.grade,position:p.position,...totals(p)})).sort((a,b)=>(b.goals+b.assists)-(a.goals+a.assists)).slice(0,15);return {matches:ms.length,wins:w,draws:d,losses:l,win_rate:ms.length?Math.round(w/ms.length*100):0,goals_for:gf,goals_against:ga,goal_difference:gf-ga,player_summary:ranking}}
function v7MatchContext(){const id=$('v7MatchSelect')?.value,m=matches.find(x=>String(x.id)===String(id));return m?reportContextForMatch(m):null}
function renderV7Preview(){const box=$('v7Preview');if(!box)return;const match=v7MatchContext(),summary=v7SeasonSummary(),available=v7PlayerData().filter(p=>p.availability==='available'||p.availability==='late').length;box.textContent=`機能：${V7_FEATURES[v7Feature].title} / 対象試合：${match?match['対戦相手']:'未指定'} / 対象試合数：${summary.matches} / 起用可能：${available}人`}
function v7PromptAndContext(){const match=v7MatchContext(),season=v7SeasonSummary(),pdata=v7PlayerData(),notes=$('v7Notes').value.trim(),format=$('v7Format').value,minutes=+$('v7MatchMinutes').value||40;let context={team:teamSettings.team_name||'古堅南FC',feature:v7Feature,match_format:`${format}人制`,match_minutes:minutes,coach_notes:notes,season_summary:season};if(['lineup','substitution'].includes(v7Feature))context.players=pdata;if(match)context.selected_match=match;return {message:V7_FEATURES[v7Feature].instruction,context}}
async function generateV7Plan(){const btn=$('v7GenerateBtn'),status=$('v7Status');btn.disabled=true;status.textContent='AIが作成中…';try{const pc=v7PromptAndContext(),st=aiSettings(),r=await fetch(st.url+'/v1/ai/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:pc.message,mode:v7Feature==='match_report'?'match':'chat',system_instruction:st.instruction,context:pc.context,history:[]})}),data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.detail||data.error||('HTTP '+r.status));$('v7Output').value=data.answer||'';showMessage('Ver.7 AI案を作成しました。内容を確認・編集してください。','ok')}catch(e){showMessage('AI作成エラー：'+e.message)}finally{btn.disabled=false;status.textContent=''}}
async function copyV7Output(){const v=$('v7Output').value.trim();if(!v){showMessage('コピーする内容がありません。');return}try{await navigator.clipboard.writeText(v);showMessage('コピーしました。','ok')}catch{showMessage('コピーできませんでした。')}}
async function saveV7Plan(){const content=$('v7Output').value.trim();if(!content){showMessage('保存するAI案がありません。');return}if(!isStaff()){showMessage('Supabaseへの保存はコーチログインが必要です。端末内へ保存します。')}const m=matches.find(x=>String(x.id)===String($('v7MatchSelect').value));const row={plan_type:v7Feature,title:`${V7_FEATURES[v7Feature].title}${m?' / '+(m.opponent||''):''}`,content,match_id:m?.id||null,season:$('v7SeasonSelect').value||null,input_data:v7PromptAndContext().context,created_by:session?.user?.id||null,created_at:new Date().toISOString()};if(isStaff()){const r=await sb.from('ai_plans').insert(row);if(!r.error){showMessage('Ver.7 AI案を保存しました。','ok');await loadAll();return}if(!String(r.error.message||'').includes('ai_plans'))showMessage('保存エラー：'+r.error.message)}row.id='local-'+Date.now();v7Plans.unshift(row);localStorage.setItem('furugenV7Plans',JSON.stringify(v7Plans.slice(0,100)));renderV7History();showMessage('この端末に保存しました。SupabaseでVer7追加設定.sqlを実行すると共有保存できます。','ok')}
function v7TypeLabel(t){return V7_FEATURES[t]?.title||t}
function renderV7History(){const box=$('v7History');if(!box)return;box.innerHTML=v7Plans.length?v7Plans.map(x=>`<div class="saved-report"><div><b>${esc(x.title||v7TypeLabel(x.plan_type))}</b><div class="muted">${esc(String(x.created_at||'').slice(0,16).replace('T',' '))}</div></div><details><summary>内容を見る</summary><div class="report-text">${esc(x.content||'')}</div></details><div class="ai-actions"><button class="light" onclick="loadV7Plan('${x.id}')">編集欄へ</button>${isStaff()&&!String(x.id).startsWith('local-')?`<button class="danger" onclick="deleteV7Plan('${x.id}')">削除</button>`:''}</div></div>`).join(''):'<div class="muted">保存履歴はありません。</div>'}
function loadV7Plan(id){const x=v7Plans.find(y=>String(y.id)===String(id));if(!x)return;v7Feature=x.plan_type||'lineup';const btn=document.querySelector(`[data-v7="${v7Feature}"]`);setV7Feature(v7Feature,btn);$('v7Output').value=x.content||'';showPage('ver7')}
async function deleteV7Plan(id){if(!confirm('このAI案を削除しますか？'))return;const r=await sb.from('ai_plans').delete().eq('id',id);if(r.error)showMessage(r.error.message);else await loadAll()}
