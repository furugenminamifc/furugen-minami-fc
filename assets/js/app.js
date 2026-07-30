let sb=null,session=null,profile=null,players=[],matches=[],records=[],reports=[],videoNotes=[],v7Plans=[],playerPrivate=[],playerGrowthRecords=[],teamSettings={},editingMatchId='',charts={};
const $=id=>document.getElementById(id);
function showMessage(text,type='warn'){const e=$('message');e.textContent=text;e.className=(type==='ok'?'notice success':'notice');e.classList.remove('hidden');setTimeout(()=>e.classList.add('hidden'),5000)}
function showPage(id){document.querySelectorAll('.page').forEach(x=>x.classList.remove('show'));$(id).classList.add('show');if(id==='entry')renderRecordInputs();if(id==='analytics')setTimeout(renderAnalytics,0);if(id==='ai')setTimeout(testAiConnection,0);if(id==='reports')setTimeout(renderReportsPage,0);if(id==='video')setTimeout(renderVideoPage,0);if(id==='ver7')setTimeout(renderV7Page,0)}
function isStaff(){return !!(profile&&profile.active&&['admin','coach'].includes(profile.role))}
function esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
async function init(){const c=window.FURUGEN_CONFIG;if(!c||!c.SUPABASE_URL||!c.SUPABASE_ANON_KEY){showMessage('config.jsの設定がありません。');return}sb=supabase.createClient(c.SUPABASE_URL,c.SUPABASE_ANON_KEY);const x=await sb.auth.getSession();session=x.data.session;await loadProfile();await loadAll();setupRealtime();sb.auth.onAuthStateChange(async(_,s)=>{session=s;await loadProfile();await loadAll()});if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{})}
async function loadProfile(){profile=null;if(session){const r=await sb.from('profiles').select('*').eq('id',session.user.id).maybeSingle();profile=r.data}const staff=isStaff();$('mode').textContent=staff?`${session.user.email}（${profile.role==='admin'?'管理者':'コーチ'}）`:'保護者閲覧モード';$('loginOut').classList.toggle('hidden',!!session);$('loginIn').classList.toggle('hidden',!session);$('entryForm').classList.toggle('hidden',!staff);$('needLogin').classList.toggle('hidden',staff);$('addPlayerBtn').classList.toggle('hidden',!staff);if(session)$('loginWho').textContent=`${session.user.email} / 権限：${profile?.role||'未設定'}`}
async function loadAll(){const [p,m,r,t,rp,vn,v7,pp,pg]=await Promise.all([sb.from('players').select('*').order('grade').order('name'),sb.from('matches').select('*').order('match_date',{ascending:false}),sb.from('records').select('*'),sb.from('team_settings').select('*'),sb.from('ai_reports').select('*').order('created_at',{ascending:false}),sb.from('video_notes').select('*').order('created_at',{ascending:false}),sb.from('ai_plans').select('*').order('created_at',{ascending:false}),isStaff()?sb.from('player_private').select('*'):Promise.resolve({data:[],error:null}),isStaff()?sb.from('player_growth_records').select('*').order('record_date',{ascending:false}):Promise.resolve({data:[],error:null})]);if(p.error||m.error||r.error){showMessage('データ取得エラー：'+(p.error||m.error||r.error).message);return}players=p.data||[];matches=m.data||[];records=r.data||[];reports=rp.error?[]:(rp.data||[]);videoNotes=vn.error?[]:(vn.data||[]);v7Plans=v7.error?JSON.parse(localStorage.getItem('furugenV7Plans')||'[]'):(v7.data||[]);playerPrivate=pp.error?[]:(pp.data||[]);playerGrowthRecords=pg.error?[]:(pg.data||[]);teamSettings={};if(!t.error)(t.data||[]).forEach(x=>teamSettings[x.key]=x.value);applyTeamSettings();refreshFilters();renderAll()}
function setupRealtime(){sb.channel('furugen-live').on('postgres_changes',{event:'*',schema:'public',table:'players'},loadAll).on('postgres_changes',{event:'*',schema:'public',table:'matches'},loadAll).on('postgres_changes',{event:'*',schema:'public',table:'records'},loadAll).on('postgres_changes',{event:'*',schema:'public',table:'team_settings'},loadAll).on('postgres_changes',{event:'*',schema:'public',table:'ai_reports'},loadAll).on('postgres_changes',{event:'*',schema:'public',table:'video_notes'},loadAll).on('postgres_changes',{event:'*',schema:'public',table:'ai_plans'},loadAll).on('postgres_changes',{event:'*',schema:'public',table:'player_private'},loadAll).on('postgres_changes',{event:'*',schema:'public',table:'player_growth_records'},loadAll).subscribe()}
function totals(p){const rr=records.filter(x=>x.player_id===p.id);return{apps:(p.past_apps||0)+rr.filter(x=>x.played).length,minutes:rr.reduce((a,x)=>a+(x.minutes||0),0),goals:(p.past_goals||0)+rr.reduce((a,x)=>a+(x.goals||0),0),assists:(p.past_assists||0)+rr.reduce((a,x)=>a+(x.assists||0),0),yellow:(p.past_yellow||0)+rr.reduce((a,x)=>a+(x.yellow||0),0),red:(p.past_red||0)+rr.reduce((a,x)=>a+(x.red||0),0),mvp:rr.filter(x=>x.mvp).length}}
function refreshFilters(){const seasons=[...new Set(matches.map(x=>x.season||String(x.match_date||'').slice(0,4)).filter(Boolean))].sort().reverse();$('matchSeason').innerHTML='<option value="">すべて</option>'+seasons.map(x=>`<option>${x}</option>`).join('');const grades=[...new Set(players.map(x=>x.grade).filter(Boolean))].sort();$('rankGrade').innerHTML='<option value="">すべて</option>'+grades.map(x=>`<option>${esc(x)}</option>`).join('');const as=$('analysisSeason'),ac=$('analysisCompetition');if(as){const seasons=[...new Set(matches.map(x=>x.season).filter(Boolean))].sort((a,b)=>b-a);const keep=as.value;as.innerHTML='<option value="">すべて</option>'+seasons.map(x=>`<option>${x}</option>`).join('');as.value=keep}if(ac){const comps=[...new Set(matches.map(x=>x.competition||'通常試合'))].sort((a,b)=>a.localeCompare(b,'ja'));const keep=ac.value;ac.innerHTML='<option value="">すべて</option>'+comps.map(x=>`<option>${esc(x)}</option>`).join('');ac.value=keep}}
function renderAll(){renderDashboard();renderPlayers();renderMatches();renderRanking();renderRecordInputs();refreshVer6Selects();renderSavedReports();renderVideoNotes();refreshV7Selects();renderV7History()}
function renderDashboard(){let w=0,d=0,l=0,gf=0,ga=0;matches.forEach(m=>{gf+=m.goals_for||0;ga+=m.goals_against||0;m.goals_for>m.goals_against?w++:m.goals_for<m.goals_against?l++:d++});const rate=matches.length?Math.round(w/matches.length*100):0;$('stats').innerHTML=[['選手',players.length],['試合',matches.length],['勝利',w],['引分',d],['敗戦',l],['勝率',rate+'%'],['得点',gf],['失点',ga]].map(x=>`<div class="card stat"><span>${x[0]}</span><b>${x[1]}</b></div>`).join('');$('recent').innerHTML=matches.slice(0,6).map(matchHtml).join('')||'<p class="muted">まだ試合がありません。</p>'}
function resultClass(m){return m.goals_for>m.goals_against?'win':m.goals_for<m.goals_against?'loss':'draw'}
function matchHtml(m){return `<div class="match-row"><div><b>${esc(m.match_date)}</b> <span class="pill">${esc(m.competition||'通常試合')}</span><div class="muted">${esc(m.venue||'')} ${esc(m.memo||'')}</div></div><div><span class="score ${resultClass(m)}">${m.goals_for} - ${m.goals_against}</span><br>${esc(m.opponent)}</div></div>`}
function renderPlayers(){const q=$('playerSearch').value.trim().toLowerCase(),status=$('statusFilter').value;const list=players.filter(p=>(!status||p.status===status)&&(!q||`${p.name} ${p.grade} ${p.position} ${p.number||''}`.toLowerCase().includes(q)));$('playerBody').innerHTML=list.map(p=>{const t=totals(p);return `<tr><td><button class="player-link" onclick="openPlayerDetail('${p.id}')"><div class="player-name">${p.photo_url?`<img class="avatar" src="${esc(p.photo_url)}" alt="">`:`<span class="avatar"></span>`}<span><b>${esc(p.name)}</b>${p.number?` #${esc(p.number)}`:''}</span></div></button></td><td>${esc(p.grade)}</td><td>${esc(p.position)}</td><td>${esc(p.status)}</td><td>${t.apps}</td><td>${t.goals}</td><td>${t.assists}</td><td>${t.minutes}</td><td><button class="light" onclick="openPlayerDetail('${p.id}')">詳細</button>${isStaff()?` <button class="light" onclick="openPlayerModal('${p.id}')">編集</button> <button class="danger" onclick="deletePlayer('${p.id}')">削除</button>`:''}</td></tr>`}).join('')||'<tr><td colspan="9" class="muted">該当する選手がいません。</td></tr>'}
function renderMatches(){const season=$('matchSeason').value,q=$('matchSearch').value.trim().toLowerCase();const list=matches.filter(m=>(!season||String(m.season)===season)&&(!q||`${m.competition} ${m.opponent} ${m.venue}`.toLowerCase().includes(q)));$('matchList').innerHTML=list.map(m=>{const count=records.filter(r=>r.match_id===m.id&&r.played).length;return `<div class="card"><div class="match-row"><div><b>${esc(m.match_date)}</b> ${esc(m.competition)}<div class="muted">${esc(m.venue)} / 出場 ${count}名</div></div><div><span class="score ${resultClass(m)}">${m.goals_for}-${m.goals_against}</span> ${esc(m.opponent)} ${isStaff()?`<button class="light" onclick="openMatchEdit('${m.id}')">編集</button> <button class="danger" onclick="deleteMatch('${m.id}')">削除</button>`:''}</div></div></div>`}).join('')||'<p class="muted">該当する試合がありません。</p>'}
function renderRanking(){const type=$('rankType').value,grade=$('rankGrade').value,status=$('rankStatus').value;const list=players.filter(p=>(!grade||p.grade===grade)&&(!status||p.status===status)).map(p=>({p,t:totals(p)})).sort((a,b)=>b.t[type]-a.t[type]||a.p.name.localeCompare(b.p.name,'ja'));$('rankBody').innerHTML=list.map((x,i)=>`<tr><td class="${i===0?'rank1':''}">${i+1}</td><td><b>${esc(x.p.name)}</b></td><td>${esc(x.p.grade)}</td><td>${esc(x.p.position)}</td><td><b>${x.t[type]}</b>${type==='minutes'?'分':''}</td></tr>`).join('')}
function renderRecordInputs(){if(!isStaff())return;const existing=new Map(records.filter(r=>r.match_id===editingMatchId).map(r=>[r.player_id,r]));$('recordInputs').innerHTML=`<div class="player-entry muted"><div>選手</div><div>出場</div><div>時間</div><div>得点</div><div class="extra">アシスト</div><div class="extra">黄</div><div class="extra">赤</div><div class="extra">MVP</div></div>`+players.filter(p=>p.status==='現役'||existing.has(p.id)).map(p=>{const r=existing.get(p.id)||{};return `<div class="player-entry" data-player="${p.id}"><div><b>${esc(p.name)}</b><div class="muted">${esc(p.grade)} ${esc(p.position)}</div></div><div><input class="played" type="checkbox" ${r.played?'checked':''}></div><div><input class="minutes" type="number" min="0" value="${r.minutes||0}"></div><div><input class="goals" type="number" min="0" value="${r.goals||0}"></div><div class="extra"><input class="assists" type="number" min="0" value="${r.assists||0}"></div><div class="extra"><input class="yellow" type="number" min="0" value="${r.yellow||0}"></div><div class="extra"><input class="red" type="number" min="0" value="${r.red||0}"></div><div class="extra"><input class="mvp" type="checkbox" ${r.mvp?'checked':''}></div></div>`}).join('')}
function selectAllPlayed(){document.querySelectorAll('.player-entry .played').forEach(x=>x.checked=true)}
async function saveMatchWithRecords(){if(!isStaff())return;const date=$('matchDate').value,opp=$('opponent').value.trim();if(!date||!opp){showMessage('試合日と対戦相手を入力してください。');return}const btn=$('saveMatchBtn');btn.disabled=true;const match={match_date:date,competition:$('competition').value.trim(),opponent:opp,venue:$('venue').value.trim(),goals_for:+$('goalsFor').value||0,goals_against:+$('goalsAgainst').value||0,season:+date.slice(0,4),memo:$('matchMemo').value.trim(),created_by:session.user.id};let matchId=editingMatchId;if(matchId){const up=await sb.from('matches').update(match).eq('id',matchId);if(up.error){showMessage(up.error.message);btn.disabled=false;return}const del=await sb.from('records').delete().eq('match_id',matchId);if(del.error){showMessage('既存選手記録の削除エラー：'+del.error.message);btn.disabled=false;return}}else{const ins=await sb.from('matches').insert(match).select().single();if(ins.error){showMessage(ins.error.message);btn.disabled=false;return}matchId=ins.data.id}const rows=[...document.querySelectorAll('.player-entry[data-player]')].map(el=>({match_id:matchId,player_id:el.dataset.player,played:el.querySelector('.played').checked,minutes:+el.querySelector('.minutes').value||0,goals:+el.querySelector('.goals').value||0,assists:+el.querySelector('.assists').value||0,yellow:+el.querySelector('.yellow').value||0,red:+el.querySelector('.red').value||0,mvp:el.querySelector('.mvp').checked,created_by:session.user.id})).filter(x=>x.played||x.goals||x.assists||x.yellow||x.red||x.mvp);if(rows.length){const rr=await sb.from('records').insert(rows);if(rr.error){showMessage('試合は保存しましたが選手記録でエラー：'+rr.error.message);btn.disabled=false;return}}showMessage(editingMatchId?'試合と選手記録を更新しました。':'試合と選手記録を保存しました。','ok');cancelMatchEdit(false);btn.disabled=false;await loadAll();showPage('matches')}
function openMatchEdit(id){if(!isStaff())return;const m=matches.find(x=>x.id===id);if(!m)return;editingMatchId=id;$('matchDate').value=m.match_date||'';$('competition').value=m.competition||'';$('opponent').value=m.opponent||'';$('venue').value=m.venue||'';$('goalsFor').value=m.goals_for||0;$('goalsAgainst').value=m.goals_against||0;$('matchMemo').value=m.memo||'';$('saveMatchBtn').textContent='試合を更新';$('cancelMatchEditBtn').classList.remove('hidden');renderRecordInputs();showPage('entry')}
function cancelMatchEdit(clear=true){editingMatchId='';$('saveMatchBtn').textContent='試合を保存';$('cancelMatchEditBtn').classList.add('hidden');if(clear){['matchDate','competition','opponent','venue','matchMemo'].forEach(id=>$(id).value='');$('goalsFor').value=0;$('goalsAgainst').value=0;renderRecordInputs()}}
async function deleteMatch(id){if(!isStaff()||!confirm('この試合と選手記録を削除しますか？'))return;const rr=await sb.from('records').delete().eq('match_id',id);if(rr.error){showMessage('選手記録の削除エラー：'+rr.error.message);return}const r=await sb.from('matches').delete().eq('id',id);if(r.error)showMessage(r.error.message);else{showMessage('試合を削除しました。','ok');await loadAll()}}
function privateForPlayer(id){return playerPrivate.find(x=>String(x.player_id)===String(id))||{}}
function openPlayerModal(id=''){const p=players.find(x=>String(x.id)===String(id)),pv=privateForPlayer(id);$('playerModalTitle').textContent=p?'選手編集':'選手追加';$('editPlayerId').value=p?.id||'';$('editPhotoData').value=p?.photo_url||'';$('playerPhotoPreview').src=p?.photo_url||defaultAvatar();$('editPhoto').value='';$('editName').value=p?.name||'';$('editNumber').value=p?.number||'';$('editGrade').value=p?.grade||'';$('editBirthDate').value=p?.birth_date||'';$('editPosition').value=p?.position||'';$('editDominantFoot').value=p?.dominant_foot||'';$('editHeight').value=p?.height_cm||'';$('editWeight').value=p?.weight_kg||'';$('editStatus').value=p?.status||'現役';$('editStrengths').value=p?.strengths||'';$('editDevelopmentGoal').value=p?.development_goal||'';$('editFatigue').value=pv.fatigue_level||3;$('editCondition').value=pv.condition_level||3;$('editCoachNote').value=pv.coach_note||'';$('editGuardianName').value=pv.guardian_name||'';$('editGuardianPhone').value=pv.guardian_phone||'';$('editGuardianEmail').value=pv.guardian_email||'';$('editEmergencyContact').value=pv.emergency_contact||'';$('editPastApps').value=p?.past_apps||0;$('editPastGoals').value=p?.past_goals||0;$('editPastAssists').value=p?.past_assists||0;$('editPastYellow').value=p?.past_yellow||0;$('editPastRed').value=p?.past_red||0;$('playerModal').classList.remove('hidden')}
function closePlayerModal(){$('playerModal').classList.add('hidden')}
function playerAge(date){if(!date)return '';const b=new Date(date),n=new Date();let a=n.getFullYear()-b.getFullYear();if(n.getMonth()<b.getMonth()||(n.getMonth()===b.getMonth()&&n.getDate()<b.getDate()))a--;return a>=0?`${a}歳`:''}
function levelLabel(v,type){const n=Number(v)||3;return type==='fatigue'?['','とても元気','元気','普通','疲れ気味','強い疲労'][n]:['','低い','やや低い','普通','良い','とても良い'][n]}
let activePlayerDetailId='',playerGrowthChart=null;
function playerMatchRows(id){return records.filter(r=>String(r.player_id)===String(id)&&r.played).map(r=>({r,m:matches.find(m=>String(m.id)===String(r.match_id))})).filter(x=>x.m).sort((a,b)=>(b.m.match_date||'').localeCompare(a.m.match_date||''))}
function playerDetailTabButton(id,label,icon,staffOnly=false){if(staffOnly&&!isStaff())return '';return `<button class="player-detail-tab" data-player-tab="${id}" onclick="switchPlayerDetailTab('${id}',this)">${icon} ${label}</button>`}
function growthForPlayer(id){return playerGrowthRecords.filter(x=>String(x.player_id)===String(id)).sort((a,b)=>(b.record_date||'').localeCompare(a.record_date||''))}
function growthStatusLabel(v){return ({full:'参加',limited:'一部参加',rest:'見学・休養',absent:'欠席'})[v]||v||'未設定'}
function injuryLabel(v){return ({none:'なし',watch:'経過観察',injured:'ケガあり',returning:'復帰途中'})[v]||v||'未設定'}
function openPlayerDetail(id){
 const p=players.find(x=>String(x.id)===String(id));if(!p)return;
 activePlayerDetailId=String(id);
 const t=totals(p),pv=privateForPlayer(id),rows=playerMatchRows(id),staff=isStaff();
 const avgMinutes=t.apps?Math.round(t.minutes/t.apps):0;
 const goalRate=t.apps?(t.goals/t.apps).toFixed(2):'0.00';
 const assistRate=t.apps?(t.assists/t.apps).toFixed(2):'0.00';
 $('playerDetailContent').innerHTML=`
 <div class="player-profile-head">
   <img src="${esc(p.photo_url||defaultAvatar())}" alt="">
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

 <div id="playerTab-ai"<div id="playerTab-ai" class="player-tab-panel hidden">
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
 if(tab==='growth')setTimeout(()=>{renderPlayerGrowthChart(activePlayerDetailId);if(isStaff())renderPlayerBodyGrowthChart(activePlayerDetailId)},30);
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
 showMessage('成長記録を保存しました。','ok');await loadAll();openPlayerDetail(playerId);const btn=$('playerDetailContent').querySelector('[data-player-tab="growth"]');if(btn)switchPlayerDetailTab('growth',btn)
}
async function deleteGrowthRecord(id){
 if(!isStaff()||!confirm('この成長記録を削除しますか？'))return;
 const playerId=activePlayerDetailId;const r=await sb.from('player_growth_records').delete().eq('id',id);
 if(r.error){showMessage(r.error.message);return}
 showMessage('成長記録を削除しました。','ok');await loadAll();openPlayerDetail(playerId);const btn=$('playerDetailContent').querySelector('[data-player-tab="growth"]');if(btn)switchPlayerDetailTab('growth',btn)
}
function renderPlayerBodyGrowthChart(id){
 if(!window.Chart)return;const canvas=$('playerBodyGrowthCanvas');if(!canvas)return;
 const rows=[...growthForPlayer(id)].reverse();if(canvas._chart)canvas._chart.destroy();
 canvas._chart=new Chart(canvas,{type:'line',data:{labels:rows.map(x=>x.record_date),datasets:[{label:'身長（cm）',data:rows.map(x=>x.height_cm),yAxisID:'y'},{label:'体重（kg）',data:rows.map(x=>x.weight_kg),yAxisID:'y1'}]},options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},scales:{y:{position:'left',beginAtZero:false,title:{display:true,text:'身長'}},y1:{position:'right',beginAtZero:false,grid:{drawOnChartArea:false},title:{display:true,text:'体重'}}},plugins:{legend:{position:'bottom'}}}})
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
function preparePlayerDetailAi(id){const p=players.find(x=>String(x.id)===String(id));if(!p)return;closePlayerDetail();showPage('ai');setAiMode('player',document.querySelector('[data-mode="player"]'));const t=totals(p),g=growthForPlayer(id).slice(0,5);setAiPrompt(`${p.name}選手の育成評価を作成してください。\n学年：${p.grade||'未設定'}\nポジション：${p.position||'未設定'}\n強み：${p.strengths||'未入力'}\n次の目標：${p.development_goal||'未入力'}\n出場：${t.apps}試合、${t.minutes}分\n得点：${t.goals}、アシスト：${t.assists}、MVP：${t.mvp}\n最近の成長記録：${g.length?g.map(x=>`${x.record_date} 身長${x.height_cm||'-'}cm 体重${x.weight_kg||'-'}kg 疲労${x.fatigue_level} 調子${x.condition_level} ${injuryLabel(x.injury_status)} ${growthStatusLabel(x.training_status)}`).join(' / '):'未記録'}\n本人に伝える良い点、伸ばしたい点、次の具体目標、前向きな声かけを小学生に伝わる言葉で作ってください。`)}
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
