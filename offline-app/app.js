import { ENTITIES, all, get, save, saveMany, remove, subscribe, snapshot, replaceAll } from './db.js';

const $ = (s, root=document) => root.querySelector(s);
const esc = (v='') => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const val = (v, fallback='—') => v === undefined || v === null || v === '' ? fallback : esc(v);
const nowIso = () => new Date().toISOString();
const fmt = (v, withTime=false) => v ? new Date(v).toLocaleString([], withTime ? {dateStyle:'medium',timeStyle:'short'} : {dateStyle:'medium'}) : '—';
const isoDate = d => new Date(d).toISOString().slice(0,10);
const today = () => isoDate(new Date());
const id = () => crypto.randomUUID();
const appRoot = $('#app');
const nav = [['dashboard','▦','Dashboard'],['inventory','▣','Inventory'],['counter','⇄','Release & Return'],['transactions','☷','Transactions'],['maintenance','⚒','Maintenance'],['reports','▤','Reports'],['borrowers','♙','Borrowers'],['student','⌗','Student Kiosk']];
const state = {page:location.hash.slice(1)||'dashboard', search:'', profileId:'', activeRef:'', staged:[], cart:{}, kioskBorrower:sessionStorage.getItem('amt-local-borrower')||'', returnBorrower:'', counterTab:'release'};
let toastTimer;
function toast(msg, type='ok') {
  let n=$('#toast');
  if(!n){ n=document.createElement('div'); n.id='toast'; document.body.appendChild(n); }
  n.className='toast '+type; n.textContent=msg; clearTimeout(toastTimer); toastTimer=setTimeout(()=>n.remove(),3200);
}


async function expireRequests() {
  const rows=await all('BorrowRequest');
  const stale=rows.filter(r=>r.status==='Pending Release'&&r.expires_at&&new Date(r.expires_at)<=new Date());
  if(!stale.length)return;
  for(const r of stale) await save('BorrowRequest',{...r,status:'Expired'});
  for(const ref of [...new Set(stale.map(r=>r.request_ref))]) await recordAudit('request_expired','counter timer',ref,'Request passed its five-minute collection window');
}
async function counterPage() {
  await expireRequests();
  const [reqs,borrowers,items,loans]=await Promise.all([all('BorrowRequest'),all('Borrower'),all('Item'),all('Loan')]);
  const groups=groupRows(reqs.filter(r=>['Pending Release','In Progress','Partially Released'].includes(r.status)));
  const tabs='<div class="tabs"><button class="btn '+(state.counterTab==='release'?'selected':'')+'" data-action="counter-tab" data-id="release">Release queue</button><button class="btn '+(state.counterTab==='returns'?'selected':'')+'" data-action="counter-tab" data-id="returns">Returns</button></div>';
  if(state.counterTab==='returns') {
    const borrower=borrowers.find(b=>b.id===state.returnBorrower);
    const open=borrower?loans.filter(l=>l.borrower_id===borrower.id&&['Open','Partial'].includes(l.status)):[];
    return title('Tool Release & Return Counter','Confirm physical scans and returns')+tabs+'<div class="panel"><h2>Find borrower for return</h2><form id="return-identify-form" class="toolbar"><input name="code" placeholder="Scan or enter borrower ID / RFID" required><button class="btn primary">Find borrower</button>'+ (borrower?btn('Clear','clear-return'):'')+'</form>'+(borrower?'<div class="notice info">'+val(borrower.full_name)+' · '+val(borrower.id_number)+'</div><h3>Open loan lines</h3>'+table(['Transaction','Tool','Qty out','Qty returned','Outstanding','Due','Status','Action'],open.map(l=>{const outstanding=(l.qty_issued||0)-(l.qty_returned||0);return row([val(l.trans_no),val(l.item_name),val(l.qty_issued),val(l.qty_returned||0),outstanding,fmt(l.expected_return_at,true),badge(l.status),'<button class="btn primary" data-action="return-loan" data-id="'+esc(l.id)+'">Record return</button>']);})):'<p class="muted">Search for a borrower to see open loans.</p>')+'</div>';
  }
  const active=groups.find(g=>g.ref===state.activeRef);
  const queue='<div class="panel"><h2>Open request queue</h2>'+table(['Reference','Requested','Borrower','Items','Purpose','Time left','Status','Action'],groups.map(g=>{const left=g.expires_at?Math.max(0,Math.ceil((new Date(g.expires_at)-Date.now())/1000)):null;return row([val(g.ref),fmt(g.requested_at,true),val(g.borrower_name)+'<div class="small muted">'+val(g.id_number)+'</div>',esc(g.lines.map(l=>l.item_name+' × '+l.qty).join(', ')),val(g.purpose),g.status==='Pending Release'?left===null?'—':Math.floor(left/60)+':'+String(left%60).padStart(2,'0'):'—',badge(g.status),'<button class="btn '+(state.activeRef===g.ref?'selected':'')+'" data-action="start-request" data-id="'+esc(g.ref)+'">Open</button>']);}))+'</div>';
  if(!active) return title('Tool Release & Return Counter','Scan assets against student requests, then confirm returns')+tabs+queue;
  const staged=state.staged;
  const stagedCount=staged.length;
  const lines=active.lines.map(l=>{const n=staged.filter(s=>s.lineId===l.id).length;return '<div class="list-row"><div class="grow"><strong>'+val(l.item_name)+'</strong><div class="small muted">'+val(l.asset_tag)+' · '+(l.released_qty||0)+' of '+l.qty+' released · '+n+' staged</div></div>'+badge(n+(l.released_qty||0)>=(l.qty||0)?'Ready':'Remaining')+'</div>';}).join('');
  const scans=staged.map((s,i)=>'<div class="list-row"><div class="grow">'+val(s.item.name)+' <span class="small muted">'+val(s.item.asset_tag)+'</span></div><button class="btn danger" data-action="unstage" data-id="'+i+'">Remove</button></div>').join('');
  const overrideBox=state.override?'<div class="notice" style="margin-top:12px">Restricted asset: '+val(state.override.item.name)+' — '+val(state.override.reason)+'<form id="override-form" class="toolbar" style="margin-top:8px"><input name="reason" required placeholder="Reason for override (required)"><button class="btn primary">Record override & stage</button><button type="button" class="btn" data-action="cancel-override">Cancel</button></form></div>':'';
  const dueDefault=active.needed_until?active.needed_until+'T17:00':new Date(Date.now()+86400000).toISOString().slice(0,16);
  return title('Tool Release & Return Counter','Scan only the assets physically handed to the borrower')+tabs+queue+'<div class="two-col grid" style="margin-top:14px"><section class="panel"><div class="split"><h2>Request '+val(active.ref)+'</h2>'+badge(active.status)+'</div><p class="muted">'+val(active.borrower_name)+' · '+val(active.id_number)+' · '+val(active.purpose)+'</p><div class="list">'+lines+'</div><h3>Scan asset tag</h3><form id="scan-form" class="toolbar"><input name="tag" autofocus required placeholder="Scan or type an asset tag"><button class="btn">Add scan</button><button type="button" class="btn" data-action="camera">Use camera</button></form>'+overrideBox+'<h3>Scanned units ('+stagedCount+')</h3><div class="list">'+(scans||'<p class="muted">No tools staged yet.</p>')+'</div><form id="release-form" style="margin-top:14px">'+field('Return due date and time','dueIso',dueDefault,'datetime-local',{required:true})+'<div class="actions">'+btn('Clear scans','clear-staged','')+'<button class="btn primary" '+(stagedCount?'':'disabled')+'>Confirm release & print slip</button></div></form></section><aside class="panel"><h2>Release checks</h2><ul class="small muted" style="line-height:1.8"><li>Asset is active and not retired</li><li>Condition is not marked poor</li><li>Calibration is current</li><li>Requested quantity is not exceeded</li><li>Available quantity is checked again before release</li></ul><div class="notice">Restricted assets can be staged only with a written override reason.</div></aside></div>';
}
async function transactionsPage() {
  const [loans,borrowers]=await Promise.all([all('Loan'),all('Borrower')]);
  const status=state.txStatus||'all'; const q=state.search.toLowerCase();
  const rows=loans.filter(l=>{
    const overdue=l.expected_return_at&&new Date(l.expected_return_at)<new Date()&&['Open','Partial'].includes(l.status);
    const matchesStatus=status==='all'||(status==='Overdue'?overdue:l.status===status);
    const matchesQ=!q||[l.trans_no,l.borrower_name,l.borrower_id_number,l.item_name,l.asset_tag].some(v=>String(v||'').toLowerCase().includes(q));
    return matchesStatus&&matchesQ;
  }).sort((a,b)=>String(b.issued_at||'').localeCompare(String(a.issued_at||'')));
  return '<div class="title-row"><div><h1>Transactions</h1><div class="muted small">Loan issue and return history</div></div>'+btn('Export CSV','export-transactions','')+'</div><div class="toolbar"><input data-search placeholder="Search borrower, transaction, asset…" value="'+esc(state.search)+'"><select data-status><option value="all" '+(status==='all'?'selected':'')+'>All statuses</option>'+['Open','Partial','Closed','Overdue','Damaged','Lost'].map(s=>'<option '+(status===s?'selected':'')+'>'+s+'</option>').join('')+'</select></div>'+table(['Transaction','Request ref','Borrower','ID','Asset','Tool','Qty out/returned','Issued','Due','Status'],rows.map(l=>row([val(l.trans_no),val(l.request_ref),val(l.borrower_name),val(l.borrower_id_number),val(l.asset_tag),val(l.item_name),esc((l.qty_issued||0)+' / '+(l.qty_returned||0)),fmt(l.issued_at,true),fmt(l.expected_return_at,true),badge(l.status)])));
}
async function maintenancePage() {
  const [logs,items]=await Promise.all([all('MaintenanceLog'),all('Item')]);
  const calib=items.filter(i=>i.calibration_required&&i.status!=='Retired').sort((a,b)=>compareBy(a,b,'calibration_due'));
  const sorted=[...logs].sort((a,b)=>String(b.created_date||b.start_date).localeCompare(String(a.created_date||a.start_date)));
  return title('Maintenance & Calibration','Record repair work and track calibration dates')+'<div class="panel"><h2>Log maintenance</h2><form id="maintenance-form" class="row-fields">'+field('Asset tag','asset_tag','','text',{required:true,placeholder:'Exact asset tag'})+field('Type','type','Maintenance','select',{choices:['Maintenance','Calibration','Repair']})+field('Findings','findings','','textarea')+'<div class="actions"><button class="btn primary">Create log</button></div></form></div><div class="panel" style="margin-top:14px"><h2>Maintenance records</h2>'+table(['Item','Tag','Type','Start','Findings','Status','Action'],sorted.map(m=>row([val(m.item_name),val(m.asset_tag),val(m.type),fmt(m.start_date),val(m.findings),badge(m.status),m.status==='Open'?'<button class="btn" data-action="complete-maint" data-id="'+esc(m.id)+'">Mark complete</button>':'—'])))+'</div><div class="panel" style="margin-top:14px"><h2>Calibration schedule</h2>'+table(['Item','Asset tag','Due date','Status','Action'],calib.map(i=>row([val(i.name),val(i.asset_tag),fmt(i.calibration_due),badge(dueState(i.calibration_due)), '<button class="btn" data-action="calibrate" data-id="'+esc(i.id)+'">Record calibrated today</button>'])))+'</div>';
}
async function reportsPage() {
  const reports=[['daily','Daily Tool Issue & Return Log'],['overdue','Overdue Tools & Equipment Report'],['inventory','Inventory Masterlist'],['incident','Tool Damage / Loss Incident Report']];
  const selected=state.report||'';
  if(!selected) return title('Reports','Choose a report to preview, print, or download as CSV')+'<div class="grid three-col">'+reports.map(r=>'<button class="card" style="text-align:left;cursor:pointer" data-action="report" data-id="'+r[0]+'"><strong>'+r[1]+'</strong><div class="muted small" style="margin-top:7px">Open report</div></button>').join('')+'</div>';
  const [loans,items]=await Promise.all([all('Loan'),all('Item')]);
  let headers=[],rows=[],reportName=reports.find(r=>r[0]===selected)?.[1]||'Report';
  if(selected==='daily') {headers=['Time Issued','Borrower','ID No.','Trans. No.','Asset Tag','Item','Qty','Condition','Expected Return','Returned','Status'];rows=loans.sort((a,b)=>String(b.issued_at).localeCompare(String(a.issued_at))).map(l=>[fmt(l.issued_at,true),l.borrower_name,l.borrower_id_number,l.trans_no,l.asset_tag,l.item_name,l.qty_issued,l.issued_condition,fmt(l.expected_return_at,true),fmt(l.returned_at,true),l.status]);}
  if(selected==='overdue') {headers=['Borrower','ID No.','Trans. No.','Asset Tag','Item','Qty Outstanding','Issued','Expected Return','Days Overdue'];rows=loans.filter(l=>['Open','Partial'].includes(l.status)&&l.expected_return_at&&new Date(l.expected_return_at)<new Date()).map(l=>[l.borrower_name,l.borrower_id_number,l.trans_no,l.asset_tag,l.item_name,(l.qty_issued||0)-(l.qty_returned||0),fmt(l.issued_at,true),fmt(l.expected_return_at,true),Math.ceil((Date.now()-new Date(l.expected_return_at))/86400000)]).sort((a,b)=>b[8]-a[8]);}
  if(selected==='inventory') {headers=['Asset Tag','Item','Category','Brand/Model','Serial No.','Total','Available','On Loan','Status','Location','Calibration Due','Unit Cost'];rows=items.map(i=>[i.asset_tag,i.name,i.category,i.brand_model,i.serial_no,i.qty_total,i.qty_available,(i.qty_total||0)-(i.qty_available||0),i.status,i.location,i.calibration_due,i.unit_cost]);}
  if(selected==='incident') {headers=['Trans. No.','Asset Tag','Item','Borrower','Issued','Reported','Type','Notes'];rows=loans.filter(l=>['Damaged','Lost'].includes(l.status)).map(l=>[l.trans_no,l.asset_tag,l.item_name,l.borrower_name,fmt(l.issued_at,true),fmt(l.returned_at,true),l.status,l.notes]);}
  state.reportData={headers,rows,reportName};
  return '<div class="title-row"><div><button class="btn" data-action="reports-home">← Reports</button><h1 style="margin-top:12px">'+esc(reportName)+'</h1><div class="muted small">Generated '+fmt(nowIso(),true)+' · AMT-TRALMS</div></div><div class="actions">'+btn('Download CSV','report-csv','')+btn('Print','print-report','primary')+'</div></div><div class="panel"><div class="print-only">WCC Aeronautical & Technological College · Department of Aircraft Maintenance Technology</div>'+table(headers,rows.map(r=>row(r.map(c=>val(c,'')))))+'<div class="footer-note">Total records: '+rows.length+'</div></div>';
}
function csvDownload(name,headers,rows) {
  const quote=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
  const text=[headers,...rows].map(r=>r.map(quote).join(',')).join('\r\n');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\ufeff'+text],{type:'text/csv;charset=utf-8'}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000);
}
function itemFields() { return [
  {label:'Asset tag',name:'asset_tag',opts:{required:true}},{label:'Name',name:'name',opts:{required:true}},{label:'Category',name:'category'},{label:'Brand / model',name:'brand_model'},{label:'Serial number',name:'serial_no'},{label:'Location',name:'location'},{label:'Unit cost',name:'unit_cost',type:'number',opts:{min:0,step:'0.01'}},
  {label:'Condition',name:'condition',type:'select',default:'Good',choices:['Good','Fair','Poor']},{label:'Status',name:'status',type:'select',default:'Active',choices:['Active','Under Maintenance','Retired']},{label:'Consumable',name:'is_consumable',type:'check',opts:{checkLabel:'Track as consumable'}},{label:'Minimum stock',name:'min_stock',type:'number',opts:{min:0}},{label:'Total quantity',name:'qty_total',type:'number',default:1,opts:{required:true,min:0}},{label:'Available quantity',name:'qty_available',type:'number',default:1,opts:{required:true,min:0}},{label:'Calibration required',name:'calibration_required',type:'check',opts:{checkLabel:'Calibration-controlled'}},{label:'Calibration due',name:'calibration_due',type:'date'}
];}
function borrowerFields() { return [
  {label:'Full name',name:'full_name',opts:{required:true}},{label:'Type',name:'borrower_type',type:'select',default:'Student',choices:['Student','Instructor']},{label:'ID number',name:'id_number',opts:{required:true}},{label:'RFID tag',name:'rfid_tag'},{label:'Course',name:'course'},{label:'Section',name:'section'},{label:'Course / section',name:'course_section'},{label:'Email',name:'email',type:'email'},{label:'Contact number',name:'contact'},{label:'Restrictions',name:'restrictions'},{label:'Status',name:'status',type:'select',default:'Active',choices:['Active','Inactive']}
];}

async function openItemForm(itemId='') {
  const existing=itemId?await get('Item',itemId):{};
  state.modalKind='item';state.modalRecordId=itemId;
  openForm(itemId?'Edit inventory item':'Register inventory item',itemFields(),existing||{});
  const form=$('#modal-form');form.dataset.kind='item';
}
async function openBorrowerForm(borrowerId='') {
  const existing=borrowerId?await get('Borrower',borrowerId):{};
  state.modalKind='borrower';state.modalRecordId=borrowerId;
  openForm(borrowerId?'Edit borrower':'Register borrower',borrowerFields(),existing||{});
  $('#modal-form').dataset.kind='borrower';
}
function formObject(form) {
  const obj=Object.fromEntries(new FormData(form).entries());
  for(const key of ['unit_cost','min_stock','qty_total','qty_available']) if(key in obj)obj[key]=Number(obj[key]||0);
  for(const key of ['is_consumable','calibration_required']) obj[key]=form.elements[key]?.checked||false;
  return obj;
}
async function saveItemForm(form) {
  const data=formObject(form);
  if(!data.asset_tag.trim()||!data.name.trim()) throw Error('Asset tag and name are required.');
  if(data.qty_available>data.qty_total) throw Error('Available quantity cannot exceed total quantity.');
  const dup=(await all('Item')).find(i=>i.asset_tag.toLowerCase()===data.asset_tag.toLowerCase()&&i.id!==state.modalRecordId);
  if(dup) throw Error('That asset tag is already registered.');
  if(state.modalRecordId) await save('Item',{...(await get('Item',state.modalRecordId)),...data,id:state.modalRecordId});
  else await save('Item',{...data});
  closeModal();toast('Inventory saved');await render();
}
async function saveBorrowerForm(form) {
  const data=formObject(form);
  if(!data.full_name.trim()||!data.id_number.trim()) throw Error('Full name and ID number are required.');
  const dup=(await all('Borrower')).find(b=>b.id_number.toLowerCase()===data.id_number.toLowerCase()&&b.id!==state.modalRecordId);
  if(dup) throw Error('That borrower ID is already registered.');
  data.course_section=data.course_section||[data.course,data.section].filter(Boolean).join(' / ');
  if(state.modalRecordId) await save('Borrower',{...(await get('Borrower',state.modalRecordId)),...data,id:state.modalRecordId});
  else await save('Borrower',data);
  closeModal();toast('Borrower saved');await render();
}
function parseBorrowerCode(raw) {
  const code=String(raw||'').trim();
  if(code.startsWith('AMT-BORROWER|')) {
    const parts=code.split('|');
    return {id_number:parts[2]||'',rfid_tag:parts[10]||''};
  }
  return {id_number:code,rfid_tag:code};
}
async function identifyBorrower(raw) {
  const codes=parseBorrowerCode(raw);
  return (await all('Borrower')).find(b=>b.status!=='Inactive'&&((b.id_number&&b.id_number===codes.id_number)||(b.rfid_tag&&(b.rfid_tag===codes.rfid_tag||b.rfid_tag===String(raw||'').trim()))));
}
async function scanAsset(tag) {
  const raw=String(tag||'').trim();
  if(!raw)throw Error('Scan or enter an asset tag.');
  const group=groupRows((await all('BorrowRequest')).filter(r=>r.request_ref===state.activeRef))[0];
  if(!group)throw Error('Open a request first.');
  const borrower=await get('Borrower',group.borrower_id);
  if(!borrower||borrower.status!=='Active')throw Error('Borrower is inactive or no longer registered.');
  const item=(await all('Item')).find(i=>String(i.asset_tag||'').toLowerCase()===raw.toLowerCase());
  if(!item)throw Error('Asset tag not found.');
  const line=group.lines.find(l=>l.item_id===item.id);
  if(!line)throw Error(item.name+' was not requested.');
  const staged=state.staged.filter(s=>s.lineId===line.id).length;
  const remaining=(line.qty||0)-(line.released_qty||0);
  if(staged>=remaining)throw Error('The requested quantity for '+item.name+' is already scanned.');
  if((item.qty_available||0)-staged<1)throw Error('No available units remain for this item.');
  const restriction=item.status==='Retired'?'asset is retired':item.status==='Under Maintenance'?'asset is under maintenance':item.status!=='Active'?'asset status is '+item.status:item.condition==='Poor'?'asset condition is poor / damaged':item.calibration_required&&item.calibration_due&&item.calibration_due<today()?'calibration is overdue':'';
  if(restriction){state.override={item,lineId:line.id,reason:restriction};await render();return;}
  state.staged.push({item,lineId:line.id,override:''});
  await recordAudit('tool_scanned','Offline user',group.ref,item.asset_tag);
  toast(item.name+' scanned');
  await render();
}
async function releaseRequest(dueValue) {
  const ref=state.activeRef;
  if(!ref||!state.staged.length)throw Error('Select a request and scan at least one tool.');
  const group=groupRows((await all('BorrowRequest')).filter(r=>r.request_ref===ref))[0];
  const borrower=await get('Borrower',group.borrower_id);
  const due=new Date(dueValue);
  if(Number.isNaN(due.getTime()))throw Error('Enter a valid due date and time.');
  const byLine=new Map();
  for(const s of state.staged)byLine.set(s.lineId,(byLine.get(s.lineId)||0)+1);
  const ts=nowIso(), trans='TR-'+ts.replace(/[-:T.Z]/g,'').slice(0,14);
  const issued=[];
  for(const [lineId,qty] of byLine) {
    const line=group.lines.find(l=>l.id===lineId);
    const item=await get('Item',line.item_id);
    if(!item||Number(item.qty_available)<qty)throw Error((item?.name||'Item')+': stock changed; only '+(item?.qty_available||0)+' available.');
    await save('Item',{...item,qty_available:Number(item.qty_available)-qty});
    await save('Loan',{trans_no:trans,request_ref:ref,borrower_id:borrower.id,borrower_name:borrower.full_name,borrower_id_number:borrower.id_number,course_section:borrower.course_section||'',purpose:group.purpose||'',item_id:item.id,asset_tag:item.asset_tag,item_name:item.name,qty_issued:qty,qty_returned:0,issued_condition:item.condition||'Good',issued_at:ts,expected_return_at:due.toISOString(),issued_by:'Offline administrator',status:'Open'});
    await save('BorrowRequest',{...line,released_qty:(line.released_qty||0)+qty,released_at:ts,toolkeeper:'Offline administrator'});
    issued.push({item,qty});
  }
  const refreshed=await all('BorrowRequest');
  const siblings=refreshed.filter(r=>r.request_ref===ref);
  const complete=siblings.every(r=>(r.released_qty||0)>=(r.qty||0));
  for(const r of siblings)await save('BorrowRequest',{...r,status:complete?'Completed':'Partially Released'});
  await recordAudit(complete?'release_completed':'release_partial','Offline administrator',ref,issued.map(x=>x.item.name+' × '+x.qty).join(', '));
  const overrides=state.staged.filter(s=>s.override).map(s=>s.override);
  state.staged=[];state.activeRef='';
  await printSlip({trans,group,borrower,issued,due:due.toISOString(),issuedAt:ts,complete,overrides});
  toast(complete?'Release completed':'Partial release recorded');
  await render();
}
function printSlip(slip) {
  const w=window.open('','_blank','width=850,height=900');
  if(!w){toast('Allow pop-ups to print the borrow slip.','error');return;}
  const rows=slip.issued.map((x,i)=>'<tr><td>'+ (i+1)+'</td><td>'+esc(x.item.asset_tag)+'</td><td>'+esc(x.item.name)+'</td><td>'+x.qty+'</td><td>'+esc(x.item.condition||'Good')+'</td></tr>').join('');
  const overrideHtml=(slip.overrides||[]).length?'<p><strong>Release overrides:</strong><br>'+slip.overrides.map(esc).join('<br>')+'</p>':'';
  w.document.write('<!doctype html><html><head><title>Borrow Slip '+esc(slip.trans)+'</title><style>body{font:14px Arial;margin:28px;color:#123}h1{color:#14306b;border-bottom:3px solid;padding-bottom:9px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #999;padding:8px;text-align:left}.meta{line-height:2}</style></head><body><h1>WCC ATC NORTH MANILA — AMT TOOL ROOM</h1><h2>Borrow Slip — '+(slip.complete?'Full':'Partial')+' Release</h2><div class="meta">Borrower: '+esc(slip.borrower.full_name)+'<br>ID: '+esc(slip.borrower.id_number)+'<br>Course / Section: '+esc(slip.borrower.course_section||'—')+'<br>Request: '+esc(slip.group.ref)+'<br>Transaction: '+esc(slip.trans)+'<br>Purpose: '+esc(slip.group.purpose||'—')+'<br>Issued: '+esc(fmt(slip.issuedAt,true))+'<br>Due: '+esc(fmt(slip.due,true))+'<br>Toolkeeper: Offline administrator</div><table><thead><tr><th>#</th><th>Asset tag</th><th>Tool</th><th>Qty</th><th>Condition at issue</th></tr></thead><tbody>'+rows+'</tbody></table><p>Only the tools above were physically scanned and released.</p>'+overrideHtml+'<p style="margin-top:55px">__________________________ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; __________________________<br>Released by &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Received by</p><script>window.onload=()=>window.print()</script></body></html>');
  w.document.close();
}
async function returnLoanForm(loanId) {
  const loan=await get('Loan',loanId);
  const outstanding=(loan.qty_issued||0)-(loan.qty_returned||0);
  state.returnLoanId=loanId;
  modal(modalHead('Record physical return')+'<div class="notice info">'+val(loan.borrower_name)+' · '+val(loan.item_name)+' · '+outstanding+' outstanding</div><form id="return-form">'+field('Quantity returned or reported lost','qty',outstanding,'number',{required:true,min:1,max:outstanding})+field('Condition','condition','Good','select',{choices:['Good','Fair','Damaged','Lost']})+field('Notes','notes','','textarea')+'<div class="actions"><button type="button" class="btn" data-action="close">Cancel</button><button class="btn primary">Save return</button></div></form>');
}
async function commitReturnForm(form) {
  const f=new FormData(form), loan=await get('Loan',state.returnLoanId), item=await get('Item',loan.item_id);
  const qty=Number(f.get('qty')), condition=f.get('condition'), notes=String(f.get('notes')||'').trim();
  const outstanding=(loan.qty_issued||0)-(loan.qty_returned||0);
  if(!qty||qty<1||qty>outstanding)throw Error('Enter a quantity from 1 to '+outstanding+'.');
  if(condition==='Lost'&&!notes)throw Error('Explain the loss in the notes.');
  const returned=(loan.qty_returned||0)+(condition==='Lost'?0:qty);
  const patch={};
  if(condition==='Lost')patch.qty_total=Math.max(0,(item.qty_total||0)-qty);
  else if(condition==='Damaged'){patch.status='Under Maintenance';patch.qty_available=(item.qty_available||0)+qty;}
  else {patch.qty_available=(item.qty_available||0)+qty;if(condition!==item.condition)patch.condition=condition;}
  await save('Item',{...item,...patch});
  const status=condition==='Lost'?'Lost':returned>=(loan.qty_issued||0)?'Closed':'Partial';
  await save('Loan',{...loan,qty_returned:returned,returned_condition:condition,returned_at:nowIso(),returned_by:'Offline administrator',notes,status});
  if(condition==='Damaged')await save('MaintenanceLog',{item_id:item.id,asset_tag:item.asset_tag,item_name:item.name,type:'Repair',start_date:today(),findings:notes||'Returned damaged at counter',status:'Open'});
  await recordAudit(condition==='Lost'?'loss_reported':condition==='Damaged'?'damage_reported':'return_confirmed','Offline administrator',loan.request_ref||'',item.asset_tag+' × '+qty+' · '+condition);
  closeModal();state.returnLoanId='';toast('Return recorded');await render();
}
async function submitRequest(form) {
  const borrower=currentBorrower();if(!borrower)throw Error('Start a borrower session first.');
  const fd=new FormData(form),purpose=String(fd.get('purpose')||'').trim(),needed=fd.get('needed_until');
  if(!purpose)throw Error('Please state the purpose.');
  const lines=Object.entries(state.cart).filter(([,q])=>Number(q)>0);
  if(!lines.length)throw Error('Add a tool to the request first.');
  const ref='REQ-'+today().slice(2).replace(/-/g,'')+'-'+Math.random().toString(36).slice(2,6).toUpperCase();
  const ts=nowIso(),expiry=new Date(Date.now()+300000).toISOString(),records=[];
  const items=await all('Item');
  for(const [itemId,qty] of lines) {
    const item=items.find(i=>i.id===itemId);
    if(!item||item.status!=='Active'||Number(qty)>Number(item.qty_available))throw Error('Availability changed for '+(item?.name||'a selected item')+'. Review your cart.');
    records.push({request_ref:ref,borrower_id:borrower.id,borrower_name:borrower.full_name,id_number:borrower.id_number,course_section:borrower.course_section,contact:borrower.contact,item_id:item.id,asset_tag:item.asset_tag,item_name:item.name,qty:Number(qty),released_qty:0,purpose,needed_until:needed,requested_at:ts,expires_at:expiry,status:'Pending Release'});
  }
  await saveMany('BorrowRequest',records);await recordAudit('request_submitted',borrower.full_name,ref,records.map(r=>r.item_name+' × '+r.qty).join(', '));
  state.cart={};toast('Request '+ref+' sent. Collect it within five minutes.');await render();
}
async function startCamera() {
  if(!navigator.mediaDevices?.getUserMedia||!window.BarcodeDetector){toast('Camera QR scanning is unavailable here. Use a USB scanner or type the asset tag.','error');return;}
  modal(modalHead('Scan an asset QR code')+'<div class="camera-box"><video id="scan-video" autoplay muted playsinline></video></div><p class="muted small">Camera scanning uses the browser’s built-in QR detector and works without internet on supported browsers.</p><button class="btn" data-action="close">Close camera</button>');
  try {
    const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}});
    const video=$('#scan-video');if(!video){stream.getTracks().forEach(t=>t.stop());return;}
    video.srcObject=stream;state.cameraStream=stream;
    const detector=new BarcodeDetector({formats:['qr_code']});
    state.cameraTimer=setInterval(async()=>{try{const codes=await detector.detect(video);if(codes.length){const v=codes[0].rawValue;stopCamera();closeModal();await scanAsset(v);}}catch{}},400);
  } catch {stopCamera();toast('Camera access was not available. Enter the asset tag manually.','error');}
}
function stopCamera(){clearInterval(state.cameraTimer);state.cameraTimer=null;if(state.cameraStream){state.cameraStream.getTracks().forEach(t=>t.stop());state.cameraStream=null;}}
async function handleSubmit(event) {
  const form=event.target;
  if(!(form instanceof HTMLFormElement))return;
  event.preventDefault();
  try {
    if(form.id==='register-kiosk-form') {
      const fd=new FormData(form),parsed=parseBorrowerCode(state.pendingId),idNumber=parsed.id_number||state.pendingId,name=String(fd.get('full_name')||'').trim();
      if(!name)throw Error('Enter the student name.');
      const exists=(await all('Borrower')).find(b=>b.id_number===idNumber);
      const b=exists||await save('Borrower',{full_name:name,id_number:idNumber,rfid_tag:parsed.rfid_tag||state.pendingId,borrower_type:'Student',course:String(fd.get('course')||'').trim(),section:String(fd.get('section')||'').trim(),course_section:[fd.get('course'),fd.get('section')].filter(Boolean).join(' - '),email:String(fd.get('email')||'').trim(),contact:String(fd.get('contact')||'').trim(),status:'Active'});
      state.pendingId='';sessionStorage.setItem('amt-local-borrower',JSON.stringify(b));toast('Profile registered');await render();
    } else if(form.id==='override-form') {
      const reason=String(new FormData(form).get('reason')||'').trim();if(!reason)throw Error('State the reason for this override.');
      const note='OVERRIDE by Offline administrator: '+reason;
      state.staged.push({item:state.override.item,lineId:state.override.lineId,override:note});
      await recordAudit('override_recorded','Offline administrator',state.activeRef,state.override.item.asset_tag+' — '+note);
      state.override=null;toast('Override recorded and staged');await render();
    } else if(form.id==='modal-form') {
      if(form.dataset.kind==='item')await saveItemForm(form);
      if(form.dataset.kind==='borrower')await saveBorrowerForm(form);
    } else if(form.id==='identify-form') {
      const b=await identifyBorrower(new FormData(form).get('code'));
      if(!b){state.pendingId=String(new FormData(form).get('code')||'').trim();modal(modalHead('Create student profile')+'<p class="muted">No borrower matched this card. Enter the student details to register a local profile.</p><form id="register-kiosk-form">'+field('Full name','full_name','','text',{required:true})+field('Course','course')+field('Section','section')+field('Email','email','','email')+field('Contact number','contact')+'<div class="actions"><button type="button" class="btn" data-action="close">Cancel</button><button class="btn primary">Register & continue</button></div></form>');return;}
      sessionStorage.setItem('amt-local-borrower',JSON.stringify(b));state.cart={};state.search='';toast('Welcome, '+b.full_name);await render();
    } else if(form.id==='request-form')await submitRequest(form);
    else if(form.id==='scan-form') {const tag=new FormData(form).get('tag');await scanAsset(tag);}
    else if(form.id==='release-form')await releaseRequest(new FormData(form).get('dueIso'));
    else if(form.id==='return-identify-form') {
      const b=await identifyBorrower(new FormData(form).get('code'));
      if(!b)throw Error('No active borrower matched that ID or RFID.');
      state.returnBorrower=b.id;await render();
    } else if(form.id==='return-form')await commitReturnForm(form);
    else if(form.id==='maintenance-form') {
      const f=new FormData(form),tag=String(f.get('asset_tag')||'').trim().toLowerCase(),item=(await all('Item')).find(i=>String(i.asset_tag).toLowerCase()===tag);
      if(!item)throw Error('Asset tag not found.');
      await save('MaintenanceLog',{item_id:item.id,asset_tag:item.asset_tag,item_name:item.name,type:f.get('type'),start_date:today(),findings:f.get('findings'),status:'Open'});
      await save('Item',{...item,status:'Under Maintenance'});await recordAudit('maintenance_started','Offline administrator','',item.asset_tag+' · '+f.get('type'));toast('Maintenance logged');await render();
    }
  } catch(e) {if(form.id==='scan-form')await recordAudit('scan_rejected','Offline administrator',state.activeRef,String(new FormData(form).get('tag')||'')+' · '+(e.message||''),'rejected');toast(e.message||'Could not save this change.','error');}
}
async function handleAction(action,idValue='') {
  try {
    if(action==='menu')$('#side').classList.toggle('open');
    if(action==='close'){stopCamera();closeModal();}
    if(action==='cancel-override'){state.override=null;await render();}
    if(action==='add-item')await openItemForm();
    if(action==='edit-item')await openItemForm(idValue);
    if(action==='add-borrower')await openBorrowerForm();
    if(action==='edit-borrower')await openBorrowerForm(idValue||state.profileId);
    if(action==='profile'){state.profileId=idValue;state.search='';await render();}
    if(action==='back-borrowers'){state.profileId='';await render();}
    if(action==='retire-item'){if(confirm('Retire this asset? It will no longer be available for release.')){const i=await get('Item',idValue);await save('Item',{...i,status:'Retired'});await render();}}
    if(action==='print-item'){const i=await get('Item',idValue);modal(modalHead('Printable asset label')+'<div class="panel" style="text-align:center;border:2px solid #14306b"><strong>WCC ATC · AMT TOOL ROOM</strong><h2>'+val(i.name)+'</h2><div style="font-size:24px;font-weight:bold;font-family:monospace">'+val(i.asset_tag)+'</div><p>'+val(i.location)+'</p></div><p class="notice info">This offline label prints the tag as text for a barcode/keyboard scanner. To use camera QR scans, provide a QR image generated by an offline label tool.</p><div class="actions">'+btn('Print label','print-label','primary')+'</div>');}
    if(action==='print-label'){closeModal();window.print();}
    if(action==='borrower-qr'){const b=await get('Borrower',idValue);const text=['AMT-BORROWER|1',b.id_number,b.full_name,b.borrower_type,b.course,b.section,b.course_section,b.email,b.contact,b.rfid_tag,b.status,b.restrictions].map(x=>String(x||'').replace(/[|\\r\\n]+/g,'/')).join('|');modal(modalHead('Borrower card data')+'<div class="panel"><strong>'+val(b.full_name)+'</strong><p class="small muted">ID · '+val(b.id_number)+'</p><textarea readonly style="width:100%;min-height:130px">'+esc(text)+'</textarea><p class="small muted">Copy this text to a QR label tool or use the ID/RFID barcode. No online QR service is used by this app.</p><div class="actions"><button class="btn primary" data-action="copy-text">Copy QR payload</button><button class="btn" data-action="print-label">Print text</button></div></div>');state.copyText=text;}
    if(action==='copy-text'){await navigator.clipboard.writeText(state.copyText||'');toast('Payload copied');}
    if(action==='counter-tab'){state.counterTab=idValue;state.activeRef='';state.staged=[];await render();}
    if(action==='start-request'){
      const group=groupRows((await all('BorrowRequest')).filter(r=>r.request_ref===idValue))[0];
      if(group.status==='Pending Release'&&group.expires_at&&new Date(group.expires_at)<=new Date())throw Error('This request expired before release could start.');
      if(group.status==='Pending Release')for(const l of group.lines)await save('BorrowRequest',{...l,status:'In Progress',started_at:nowIso()});
      state.activeRef=idValue;state.staged=[];await render();
    }
    if(action==='unstage'){state.staged.splice(Number(idValue),1);await render();}
    if(action==='clear-staged'){state.staged=[];await render();}
    if(action==='camera')await startCamera();
    if(action==='clear-return'){state.returnBorrower='';await render();}
    if(action==='return-loan')await returnLoanForm(idValue);
    if(action==='cart-add'){const item=await get('Item',idValue);state.cart[idValue]=Math.min(Number(state.cart[idValue]||0)+1,Number(item.qty_available||1));await render();}
    if(action==='cart-minus'){state.cart[idValue]=Math.max(0,Number(state.cart[idValue]||0)-1);if(!state.cart[idValue])delete state.cart[idValue];await render();}
    if(action==='cart-remove'){delete state.cart[idValue];await render();}
    if(action==='end-session'){sessionStorage.removeItem('amt-local-borrower');state.cart={};state.search='';await render();}
    if(action==='cancel-request'){
      const rows=(await all('BorrowRequest')).filter(r=>r.request_ref===idValue);
      for(const r of rows)if(['Pending Release','In Progress','Partially Released'].includes(r.status))await save('BorrowRequest',{...r,status:'Cancelled'});
      await recordAudit('cancelled',currentBorrower()?.full_name||'Offline user',idValue,'Cancelled by kiosk');toast('Request cancelled');await render();
    }
    if(action==='request-return'){const l=await get('Loan',idValue);await save('Loan',{...l,return_requested:true});toast('Return request recorded');await render();}
    if(action==='complete-maint'){
      const m=await get('MaintenanceLog',idValue),i=await get('Item',m.item_id);
      await save('MaintenanceLog',{...m,status:'Completed'});if(i)await save('Item',{...i,status:'Active'});
      await recordAudit('maintenance_completed','Offline administrator','',m.asset_tag);toast('Maintenance marked complete');await render();
    }
    if(action==='calibrate'){
      const i=await get('Item',idValue),due=isoDate(Date.now()+365*86400000);
      await save('Item',{...i,calibration_required:true,calibration_due:due});
      await save('MaintenanceLog',{item_id:i.id,asset_tag:i.asset_tag,item_name:i.name,type:'Calibration',start_date:today(),findings:'Calibration renewed; next due '+due,status:'Completed'});
      await recordAudit('calibration_recorded','Offline administrator','',i.asset_tag+' · next due '+due);toast('Calibration date updated');await render();
    }
    if(action==='report'){state.report=idValue;await render();}
    if(action==='reports-home'){state.report='';await render();}
    if(action==='report-csv'){const d=state.reportData;if(d)csvDownload('AMT_'+d.reportName.replace(/\\W+/g,'_')+'_'+today()+'.csv',d.headers,d.rows);}
    if(action==='export-transactions'){
      const loans=await all('Loan');csvDownload('AMT_Transactions_'+today()+'.csv',['Transaction','Request ref','Borrower','ID','Asset','Item','Qty issued','Qty returned','Issued','Due','Returned','Status'],loans.map(l=>[l.trans_no,l.request_ref,l.borrower_name,l.borrower_id_number,l.asset_tag,l.item_name,l.qty_issued,l.qty_returned,l.issued_at,l.expected_return_at,l.returned_at,l.status]));
    }
    if(action==='print-report')window.print();
    if(action==='backup'){
      const data=await snapshot();const blob=new Blob([JSON.stringify({format:'AMT-TRALMS local backup',version:1,createdAt:nowIso(),data},null,2)],{type:'application/json'});
      const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='AMT-TRALMS-backup-'+today()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000);
    }
    if(action==='import')$('#backup-file').click();
  } catch(e){toast(e.message||'Could not complete this action.','error');}
}
appRoot.addEventListener('click',async e=>{
  const route=e.target.closest('[data-route]');
  if(route){e.preventDefault();state.page=route.dataset.route;state.search='';state.profileId='';state.report='';state.counterTab='release';state.activeRef='';state.staged=[];state.override=null;location.hash=state.page;$('#side')?.classList.remove('open');await render();return;}
  const target=e.target.closest('[data-action]');if(target){e.preventDefault();await handleAction(target.dataset.action,target.dataset.id||'');}
});
appRoot.addEventListener('submit',handleSubmit);
let searchTimer;
appRoot.addEventListener('input',e=>{
  if(e.target.matches('[data-search]')){state.search=e.target.value;const pos=e.target.selectionStart;clearTimeout(searchTimer);searchTimer=setTimeout(()=>render().then(()=>{const n=$('[data-search]');if(n){n.focus();n.setSelectionRange(pos,pos);}}),140);}
});
appRoot.addEventListener('change',e=>{
  if(e.target.matches('[data-status]')){state.txStatus=e.target.value;render();}
});
document.addEventListener('change',async e=>{
  if(e.target.id==='backup-file'&&e.target.files[0]){
    try {
      const parsed=JSON.parse(await e.target.files[0].text()),data=parsed.data||parsed;
      if(!ENTITIES.every(k=>Array.isArray(data[k])))throw Error('This file is not a valid AMT-TRALMS backup.');
      if(confirm('Replace all local AMT-TRALMS records with the selected backup?')){await replaceAll(data);state.page='dashboard';state.profileId='';state.report='';location.hash='dashboard';toast('Backup restored');await render();}
    } catch(err){toast(err.message||'Could not import backup.','error');}
    e.target.value='';
  }
});
window.addEventListener('hashchange',()=>{const p=location.hash.slice(1);if(nav.some(n=>n[0]===p)){state.page=p;state.profileId='';state.search='';render();}});
for(const entity of ENTITIES)subscribe(entity,()=>{});
setInterval(async()=>{if(state.page==='counter'&&state.counterTab==='release')await expireRequests();},5000);
window.addEventListener('beforeunload',stopCamera);
async function initializeLocalData() {
  if(localStorage.getItem('amt-base44-migration-v1'))return;
  localStorage.setItem('amt-base44-migration-v1','done');
  const existing=await snapshot();
  if(ENTITIES.some(entity=>existing[entity].length))return;
  try {
    const response=await fetch('./base44-data.json',{cache:'no-store'});
    if(!response.ok)return;
    const payload=await response.json();
    if(payload.format==='AMT-TRALMS Base44 migration'&&payload.version===1&&ENTITIES.every(entity=>Array.isArray(payload.data?.[entity])))await replaceAll(payload.data);
  } catch(e) { console.warn('Base44 data migration file was not loaded',e); }
}
initializeLocalData().then(render).catch(e=>{appRoot.innerHTML='<div class="boot">Could not open the local database: '+esc(e.message)+'</div>';});


function badge(status) {
  const s=String(status||'');
  let tone='gray';
  if(/Active|Good|Completed|Closed|ok/i.test(s)) tone='green';
  if(/Pending|Open|Due|Fair|In Progress|Partial|Maintenance/i.test(s)) tone='yellow';
  if(/Overdue|Poor|Damaged|Lost|Rejected|Retired/i.test(s)) tone='red';
  if(/Progress|Partially|Calibration/i.test(s)) tone='blue';
  return '<span class="tag '+tone+'">'+esc(s)+'</span>';
}
function btn(label,action,extra='',idVal='') { return '<button type="button" class="btn '+extra+'" data-action="'+esc(action)+'"'+(idVal?' data-id="'+esc(idVal)+'"':'')+'>'+label+'</button>'; }
function empty(text='No records found.') { return '<div class="no-data">'+esc(text)+'</div>'; }
function title(name, sub='') { return '<div class="title-row"><div><h1>'+esc(name)+'</h1>'+(sub?'<div class="muted small">'+esc(sub)+'</div>':'')+'</div></div>'; }
function table(headers, rows) {
  if(!rows.length) return empty();
  return '<div class="table-wrap"><table><thead><tr>'+headers.map(h=>'<th>'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'+rows.join('')+'</tbody></table></div>';
}
function row(cells) { return '<tr>'+cells.map(c=>'<td>'+c+'</td>').join('')+'</tr>'; }
function modal(content) { const d=$('#modal'); d.innerHTML='<div class="modal-inner">'+content+'</div>'; d.showModal(); }
function closeModal(){ const d=$('#modal'); if(d.open)d.close(); }
function field(label,name,value='',type='text',opts={}) {
  const req=opts.required?' required':'', placeholder=opts.placeholder?' placeholder="'+esc(opts.placeholder)+'"':'';
  let input='';
  if(type==='textarea') input='<textarea name="'+name+'"'+req+placeholder+'>'+esc(value||'')+'</textarea>';
  else if(type==='select') input='<select name="'+name+'"'+req+'>'+opts.choices.map(o=>'<option value="'+esc(o)+'"'+(String(value)===String(o)?' selected':'')+'>'+esc(o)+'</option>').join('')+'</select>';
  else if(type==='check') input='<label class="check"><input type="checkbox" name="'+name+'"'+(value?' checked':'')+'> '+esc(opts.checkLabel||'Yes')+'</label>';
  else input='<input name="'+name+'" type="'+type+'" value="'+esc(value||'')+'"'+req+placeholder+(opts.min!==undefined?' min="'+opts.min+'"':'')+(opts.max!==undefined?' max="'+opts.max+'"':'')+(opts.step?' step="'+opts.step+'"':'')+'>';
  return '<div class="field"><label>'+esc(label)+(opts.required?' *':'')+'</label>'+input+(opts.hint?'<div class="hint">'+esc(opts.hint)+'</div>':'')+'</div>';
}
function modalHead(name) { return '<div class="modal-head"><h2>'+esc(name)+'</h2><button class="modal-close" type="button" data-action="close" aria-label="Close">×</button></div>'; }
function openForm(name, fields, record={}, submitLabel='Save') {
  const body=fields.map(f=>field(f.label,f.name,record[f.name]??f.default??'',f.type||'text',{...f.opts,choices:f.choices||[]})).join('');
  modal(modalHead(name)+'<form id="modal-form">'+body+'<div class="actions"><button type="button" class="btn" data-action="close">Cancel</button><button class="btn primary">'+esc(submitLabel)+'</button></div></form>');
}
function dateDiff(v) { return v ? Math.ceil((new Date(v+'T00:00:00')-new Date(today()+'T00:00:00'))/86400000) : null; }
function dueState(v) { const n=dateDiff(v); return n===null?'No date':n<0?'Overdue · '+(-n)+'d':n<=30?'Due soon · '+n+'d':'Current'; }
async function recordAudit(action, actor='Offline user', ref='', detail='', outcome='ok') {
  try { await save('AuditLog',{action,at:nowIso(),request_ref:ref,detail,actor,outcome}); } catch(e){ console.warn('Audit entry could not be saved',e); }
}
async function getRows(entity) { return all(entity); }
function compareBy(a,b,key) { return String(a[key]??'').localeCompare(String(b[key]??''),undefined,{numeric:true,sensitivity:'base'}); }
function groupRows(rows) {
  const groups=new Map();
  for(const r of rows) {
    const ref=r.request_ref||r.id;
    if(!groups.has(ref)) groups.set(ref,{ref,borrower_id:r.borrower_id,borrower_name:r.borrower_name,id_number:r.id_number,course_section:r.course_section,contact:r.contact,purpose:r.purpose,needed_until:r.needed_until,status:r.status,requested_at:r.requested_at||r.created_date,expires_at:r.expires_at,started_at:r.started_at,lines:[]});
    groups.get(ref).lines.push(r);
  }
  return [...groups.values()].sort((a,b)=>new Date(a.requested_at||0)-new Date(b.requested_at||0));
}
function currentBorrower() { try { return JSON.parse(sessionStorage.getItem('amt-local-borrower')||'null'); } catch { return null; } }

async function render() {
  const page=state.page;
  const heading=nav.find(n=>n[0]===page)?.[2]||'AMT-TRALMS';
  appRoot.innerHTML='<div class="app"><aside class="side" id="side"><div class="brand"><strong>AMT-TRALMS</strong><small>WCC ATC North Manila<br>Offline tool room system</small></div><nav class="nav">'+nav.map(n=>'<a href="#'+n[0]+'" data-route="'+n[0]+'" class="'+(n[0]===page?'active':'')+'"><span>'+n[1]+'</span> &nbsp;'+n[2]+'</a>').join('')+'</nav><div class="side-foot">Offline local user · Administrator<br>Data is stored on this device.'+btn('Export local backup','backup','')+btn('Import backup','import','')+'</div></aside><section class="main"><header class="topbar"><div class="split"><button class="btn mobile-menu" data-action="menu">☰</button><strong>'+esc(heading)+'</strong></div><div class="status">● Offline · Saved on this device</div></header><main class="content" id="content">'+await pageContent()+'</main></section></div><dialog class="modal" id="modal"></dialog><input id="backup-file" type="file" accept="application/json" hidden>';
}
async function pageContent() {
  if(state.page==='inventory') return inventoryPage();
  if(state.page==='borrowers') return state.profileId?borrowerProfilePage():borrowersPage();
  if(state.page==='student') return studentPage();
  if(state.page==='counter') return counterPage();
  if(state.page==='transactions') return transactionsPage();
  if(state.page==='maintenance') return maintenancePage();
  if(state.page==='reports') return reportsPage();
  return dashboardPage();
}
async function dashboardPage() {
  const [items,loans,reqs]=await Promise.all([all('Item'),all('Loan'),all('BorrowRequest')]);
  const open=loans.filter(l=>['Open','Partial'].includes(l.status));
  const openQty=open.reduce((s,l)=>s+(Number(l.qty_issued)||0)-(Number(l.qty_returned)||0),0);
  const overdue=open.filter(l=>l.expected_return_at&&new Date(l.expected_return_at)<new Date()).length;
  const soon=isoDate(Date.now()+30*86400000);
  const cal=items.filter(i=>i.calibration_required&&i.calibration_due&&i.calibration_due<=soon&&i.status!=='Retired').length;
  const maint=items.filter(i=>i.status==='Under Maintenance').length;
  const low=items.filter(i=>i.is_consumable&&Number(i.qty_available)<=Number(i.min_stock||0)).length;
  const recent=[...loans].sort((a,b)=>String(b.created_date||b.issued_at).localeCompare(String(a.created_date||a.issued_at))).slice(0,7);
  return title('Dashboard','Current tool room status on this device')+'<div class="grid cards">'+[['Available units',items.filter(i=>i.status==='Active').reduce((s,i)=>s+Number(i.qty_available||0),0)],['Units on loan',openQty],['Overdue loan lines',overdue],['Calibration due ≤30 days',cal],['Under maintenance',maint],['Low stock consumables',low],['Open requests',groupRows(reqs.filter(r=>['Pending Release','In Progress','Partially Released'].includes(r.status))).length],['Registered tools',items.length]].map(x=>'<div class="card"><div class="metric-label">'+x[0]+'</div><div class="metric">'+x[1]+'</div></div>').join('')+'</div><div class="panel" style="margin-top:16px"><h2>Recent activity</h2>'+table(['Transaction','Borrower','Tool','Qty','Issued','Due','Status'],recent.map(l=>row([val(l.trans_no),val(l.borrower_name),val(l.item_name),val(l.qty_issued),fmt(l.issued_at,true),fmt(l.expected_return_at,true),badge(l.status)])))+'</div><p class="footer-note">Everything shown here is stored locally in this browser profile. Use Export local backup regularly.</p>';
}
async function inventoryPage() {
  const q=state.search.toLowerCase();
  const rows=(await all('Item')).sort((a,b)=>compareBy(a,b,'asset_tag')).filter(i=>!q||[i.name,i.asset_tag,i.category,i.serial_no,i.location].some(v=>String(v||'').toLowerCase().includes(q)));
  return '<div class="title-row"><div><h1>Inventory</h1><div class="muted small">Assets, consumables, condition, and calibration</div></div>'+btn('＋ Add item','add-item','primary')+'</div><div class="toolbar"><input data-search placeholder="Search tag, name, category, serial…" value="'+esc(state.search)+'"></div>'+table(['Asset tag','Item','Category','Location','Available / Total','Condition','Status','Calibration','Actions'],rows.map(i=>row([val(i.asset_tag),val(i.name),val(i.category),val(i.location),esc((i.qty_available??0)+' / '+(i.qty_total??1)),badge(i.condition||'Good'),badge(i.status||'Active'),i.calibration_required?val(i.calibration_due):'—','<button class="btn" data-action="edit-item" data-id="'+esc(i.id)+'">Edit</button> <button class="btn" data-action="print-item" data-id="'+esc(i.id)+'">Label</button> '+(i.status==='Retired'?'': '<button class="btn danger" data-action="retire-item" data-id="'+esc(i.id)+'">Retire</button>')])) )+'<p class="footer-note">QR labels can be scanned with a hardware scanner or typed into the counter. Printed labels include the tag text.</p>';
}
async function borrowersPage() {
  const q=state.search.toLowerCase();
  const rows=(await all('Borrower')).sort((a,b)=>compareBy(a,b,'full_name')).filter(b=>!q||[b.full_name,b.id_number,b.rfid_tag,b.course_section,b.email].some(v=>String(v||'').toLowerCase().includes(q)));
  return '<div class="title-row"><div><h1>Borrowers</h1><div class="muted small">Students and instructors registered for tool room use</div></div>'+btn('＋ Add borrower','add-borrower','primary')+'</div><div class="toolbar"><input data-search placeholder="Search name, ID, RFID, course…" value="'+esc(state.search)+'"></div>'+table(['Name','Type','ID number','Course / section','Contact','Status','Actions'],rows.map(b=>row(['<button class="btn ghost" data-action="profile" data-id="'+esc(b.id)+'">'+val(b.full_name)+'</button>',val(b.borrower_type),val(b.id_number),val(b.course_section),val(b.contact),badge(b.status||'Active'),'<button class="btn" data-action="edit-borrower" data-id="'+esc(b.id)+'">Edit</button> <button class="btn" data-action="borrower-qr" data-id="'+esc(b.id)+'">QR data</button>'])));
}
async function borrowerProfilePage() {
  const b=await get('Borrower',state.profileId); if(!b){state.profileId='';return borrowersPage();}
  const [loans,requests]=await Promise.all([all('Loan'),all('BorrowRequest')]);
  const bh=loans.filter(l=>l.borrower_id===b.id).sort((a,c)=>String(c.issued_at).localeCompare(String(a.issued_at)));
  const br=groupRows(requests.filter(r=>r.borrower_id===b.id));
  return '<div class="title-row"><div><button class="btn" data-action="back-borrowers">← Borrowers</button><h1 style="margin-top:12px">'+val(b.full_name)+'</h1><div class="muted">'+val(b.id_number)+' · '+val(b.course_section)+'</div></div>'+btn('Edit borrower','edit-borrower','',b.id)+'</div><div class="kv"><div class="panel">Type<strong>'+val(b.borrower_type)+'</strong></div><div class="panel">Email<strong>'+val(b.email)+'</strong></div><div class="panel">Contact<strong>'+val(b.contact)+'</strong></div><div class="panel">RFID<strong>'+val(b.rfid_tag)+'</strong></div><div class="panel">Restrictions<strong>'+val(b.restrictions)+'</strong></div><div class="panel">Status<strong>'+badge(b.status)+'</strong></div></div><h2 style="margin-top:22px">Loan history</h2>'+table(['Transaction','Tool','Qty out/returned','Issued','Due','Status'],bh.map(l=>row([val(l.trans_no),val(l.item_name),esc((l.qty_issued||0)+' / '+(l.qty_returned||0)),fmt(l.issued_at,true),fmt(l.expected_return_at,true),badge(l.status)])))+'<h2 style="margin-top:22px">Borrow requests</h2>'+table(['Reference','Requested','Items','Purpose','Status'],br.map(g=>row([val(g.ref),fmt(g.requested_at,true),esc(g.lines.map(l=>l.item_name+' × '+l.qty).join(', ')),val(g.purpose),badge(g.status)])));
}
async function studentPage() {
  let b=currentBorrower();
  if(b) {
    b=await get('Borrower',b.id);
    if(!b||b.status!=='Active'){sessionStorage.removeItem('amt-local-borrower');b=null;}
  }
  if(!b) {
    return title('Student Kiosk','Identify with a borrower ID or RFID code')+'<div class="panel" style="max-width:620px;margin:auto"><h2>Start a student session</h2><p class="muted">Scan a borrower card with a keyboard scanner or type the student ID / RFID value.</p><form id="identify-form">'+field('Student ID or RFID','code','','text',{required:true,placeholder:'Scan or enter ID'})+'<button class="btn primary">Continue</button></form><div class="notice info">This local app accepts the stored borrower ID/RFID values. Borrower QR payloads are also supported by paste or scan input.</div></div>';
  }
  const [items,requests,loans]=await Promise.all([all('Item'),all('BorrowRequest'),all('Loan')]);
  const available=items.filter(i=>i.status==='Active'&&Number(i.qty_available)>0).sort((a,c)=>compareBy(a,c,'name'));
  const mine=groupRows(requests.filter(r=>r.borrower_id===b.id)).sort((a,c)=>String(c.requested_at).localeCompare(String(a.requested_at))).slice(0,12);
  const myLoans=loans.filter(l=>l.borrower_id===b.id&&['Open','Partial'].includes(l.status));
  const cart=Object.entries(state.cart).map(([itemId,qty])=>({item:items.find(i=>i.id===itemId),qty})).filter(x=>x.item);
  return '<div class="title-row"><div><h1>Student Kiosk</h1><div class="muted small">Signed in locally as '+val(b.full_name)+' · '+val(b.id_number)+'</div></div>'+btn('End session','end-session','')+'</div><div class="notice info">Requests expire after five minutes if they are not started at the counter. Stock is deducted only when the toolkeeper releases scanned tools.</div><div class="two-col grid" style="margin-top:14px"><section><div class="panel"><div class="split"><h2 style="margin:0">Available tools</h2><input data-search placeholder="Search tools" value="'+esc(state.search)+'"></div><div class="list" style="margin-top:12px">'+(available.filter(i=>!state.search||[i.name,i.asset_tag,i.category].some(v=>String(v||'').toLowerCase().includes(state.search.toLowerCase()))).map(i=>'<div class="list-row"><div class="grow"><div class="line-title">'+val(i.name)+'</div><div class="small muted">'+val(i.asset_tag)+' · '+val(i.category)+' · '+i.qty_available+' available</div></div><button class="btn" data-action="cart-add" data-id="'+esc(i.id)+'">Add</button></div>').join('')||empty('No available items.'))+'</div></div><div class="panel" style="margin-top:14px"><h2>My requests</h2>'+table(['Reference','Requested','Items','Status','Action'],mine.map(g=>row([val(g.ref),fmt(g.requested_at,true),esc(g.lines.map(l=>l.item_name+' × '+l.qty).join(', ')),badge(g.status),['Pending Release','In Progress','Partially Released'].includes(g.status)?'<button class="btn danger" data-action="cancel-request" data-id="'+esc(g.ref)+'">Cancel</button>':'—'])))+'</div><div class="panel" style="margin-top:14px"><h2>My open loans</h2>'+table(['Transaction','Tool','Qty','Due','Status',''],myLoans.map(l=>row([val(l.trans_no),val(l.item_name),esc((l.qty_issued||0)-(l.qty_returned||0)),fmt(l.expected_return_at,true),badge(l.status),l.return_requested?'Return requested':'<button class="btn" data-action="request-return" data-id="'+esc(l.id)+'">Request return</button>'])))+'</div></section><aside class="panel"><h2>Your request cart</h2>'+(cart.length?cart.map(x=>'<div class="cart-item"><div><strong>'+val(x.item.name)+'</strong><div class="small muted">'+val(x.item.asset_tag)+'</div></div><div class="cart-controls"><button class="btn" data-action="cart-minus" data-id="'+esc(x.item.id)+'">−</button><strong>'+x.qty+'</strong><button class="btn" data-action="cart-add" data-id="'+esc(x.item.id)+'">+</button><button class="btn danger" data-action="cart-remove" data-id="'+esc(x.item.id)+'">×</button></div></div>').join(''):'<p class="muted">Add tools to request them.</p>')+(cart.length?'<form id="request-form" style="margin-top:14px">'+field('Purpose','purpose','','text',{required:true,placeholder:'Class or lab activity'})+field('Needed until','needed_until',isoDate(Date.now()+86400000),'date',{required:true})+'<button class="btn primary" style="width:100%">Send request</button></form>':'')+'</aside></div>';
}

