// PocketSheet polish v2: quick tab actions, range copy/paste, and local workbook home.

// ---------- Quick tab actions ----------
const psV2TabMarkup = `
<div class="editor-backdrop hidden" id="v2TabBackdrop"><div class="editor-sheet tab-action-sheet">
  <div class="grabber"></div><div class="editor-head"><div><p class="eyebrow">SHEET TAB</p><h2 id="v2TabTitle">Sheet</h2></div><button class="icon-btn" id="v2TabClose">✕</button></div>
  <input class="tab-action-name" id="v2TabName" maxlength="40" autocomplete="off" />
  <button class="tab-action-primary" id="v2TabRename">Rename sheet</button>
  <div class="tab-action-grid"><button id="v2TabDuplicate">Duplicate</button><button id="v2TabLeft">← Move left</button><button id="v2TabRight">Move right →</button><button id="v2TabOpen">Open sheet</button></div>
  <button class="tab-action-delete" id="v2TabDelete">Delete sheet</button>
</div></div>`;
document.body.insertAdjacentHTML("beforeend", psV2TabMarkup);

const psV2TabBackdrop = document.getElementById("v2TabBackdrop");
const psV2TabTitle = document.getElementById("v2TabTitle");
const psV2TabName = document.getElementById("v2TabName");
const psV2TabClose = document.getElementById("v2TabClose");
const psV2TabRename = document.getElementById("v2TabRename");
const psV2TabDuplicate = document.getElementById("v2TabDuplicate");
const psV2TabLeft = document.getElementById("v2TabLeft");
const psV2TabRight = document.getElementById("v2TabRight");
const psV2TabOpen = document.getElementById("v2TabOpen");
const psV2TabDelete = document.getElementById("v2TabDelete");
let psV2TabId = null;

function psV2UniqueSheetTitle(base) {
  const root = String(base || "Sheet").trim() || "Sheet";
  const used = new Set(psWorkbook.sheets.map(s => String(s.data.title || "").toLocaleLowerCase()));
  if (!used.has(root.toLocaleLowerCase())) return root;
  let i = 2;
  while (used.has(`${root} ${i}`.toLocaleLowerCase())) i += 1;
  return `${root} ${i}`;
}

function psV2OpenTab(id) {
  const record = psSheetRecordById(id);
  if (!record) return;
  psV2TabId = id;
  const index = psWorkbook.sheets.findIndex(s => s.id === id);
  psV2TabTitle.textContent = record.data.title || "Sheet";
  psV2TabName.value = record.data.title || "Sheet";
  psV2TabLeft.disabled = index <= 0;
  psV2TabRight.disabled = index < 0 || index >= psWorkbook.sheets.length - 1;
  psV2TabDuplicate.disabled = psWorkbook.sheets.length >= PS_MAX_SHEETS;
  psV2TabDelete.disabled = psWorkbook.sheets.length <= 1;
  psV2TabBackdrop.classList.remove("hidden");
}
function psV2CloseTab() { psV2TabId = null; psV2TabBackdrop.classList.add("hidden"); psV2TabName.blur(); }

function psV2RenameTab(id, title) {
  const record = psSheetRecordById(id);
  if (!record) return;
  const next = String(title || "").trim() || "Sheet";
  record.data.title = next;
  if (psWorkbook.activeId === id) {
    data.title = next;
    localStorage.setItem("pocketsheet-data", JSON.stringify(data));
    document.getElementById("sheetTitle").textContent = next;
  }
  psPersistWorkbook();
  psRenderSheetTabs();
  if (typeof psShowSaveState === "function") psShowSaveState("Sheet renamed");
}
function psV2DuplicateTab(id) {
  if (psWorkbook.sheets.length >= PS_MAX_SHEETS) return;
  const index = psWorkbook.sheets.findIndex(s => s.id === id);
  if (index < 0) return;
  const source = psWorkbook.sheets[index];
  const copy = psDeepClone(source.data);
  copy.title = psV2UniqueSheetTitle(`${source.data.title || "Sheet"} Copy`);
  const record = { id: psWorkbookId(), data: psNormalizeSheetData(copy, copy.title) };
  psWorkbook.sheets.splice(index + 1, 0, record);
  psWorkbook.activeId = record.id;
  psPersistWorkbook();
  psActivateSheetData(record);
  psRenderSheetTabs();
}
function psV2MoveTab(id, delta) {
  const index = psWorkbook.sheets.findIndex(s => s.id === id);
  const next = index + delta;
  if (index < 0 || next < 0 || next >= psWorkbook.sheets.length) return;
  const [record] = psWorkbook.sheets.splice(index, 1);
  psWorkbook.sheets.splice(next, 0, record);
  psPersistWorkbook();
  psRenderSheetTabs();
  psV2OpenTab(id);
}

psV2TabClose.addEventListener("click", psV2CloseTab);
psV2TabBackdrop.addEventListener("click", e => { if (e.target === psV2TabBackdrop) psV2CloseTab(); });
psV2TabRename.addEventListener("click", () => { if (psV2TabId) psV2RenameTab(psV2TabId, psV2TabName.value); psV2CloseTab(); });
psV2TabName.addEventListener("keydown", e => { if (e.key === "Enter") psV2TabRename.click(); });
psV2TabDuplicate.addEventListener("click", () => { const id = psV2TabId; psV2CloseTab(); if (id) psV2DuplicateTab(id); });
psV2TabLeft.addEventListener("click", () => { if (psV2TabId) psV2MoveTab(psV2TabId, -1); });
psV2TabRight.addEventListener("click", () => { if (psV2TabId) psV2MoveTab(psV2TabId, 1); });
psV2TabOpen.addEventListener("click", () => { const id = psV2TabId; psV2CloseTab(); if (id) psSwitchSheet(id); });
psV2TabDelete.addEventListener("click", () => { const id = psV2TabId; psV2CloseTab(); if (id) psOpenTabDelete(id); });

const psV2RenderTabsBefore = psRenderSheetTabs;
psRenderSheetTabs = function psV2RenderTabs() {
  psV2RenderTabsBefore();
  Array.from(psSheetTabs.querySelectorAll(".sheet-tab-wrap")).forEach((wrap, index) => {
    const record = psWorkbook.sheets[index];
    if (!record) return;
    const more = document.createElement("button");
    more.type = "button"; more.className = "sheet-tab-more"; more.textContent = "•••";
    more.setAttribute("aria-label", `Options for ${record.data.title || "sheet"}`);
    more.addEventListener("click", e => { e.preventDefault(); e.stopPropagation(); psV2OpenTab(record.id); });
    const del = wrap.querySelector(".sheet-tab-delete");
    if (del) wrap.insertBefore(more, del); else wrap.appendChild(more);
  });
};

// ---------- Range copy / paste ----------
let psV2RangeClipboard = null;
let psV2RangePickStart = null;
let psV2RangePicking = false;
let psV2RangeHighlight = null;
const psV2RangeCopy = document.createElement("button");
psV2RangeCopy.type = "button"; psV2RangeCopy.className = "cell-action-btn";
psV2RangeCopy.innerHTML = "<strong>Copy range</strong><small>Pick the opposite corner of a block</small>";
const psV2RangePaste = document.createElement("button");
psV2RangePaste.type = "button"; psV2RangePaste.className = "cell-action-btn"; psV2RangePaste.disabled = true;
psV2RangePaste.innerHTML = "<strong>Paste range</strong><small>Paste block from selected top-left cell</small>";
const psV2ActionGrid = document.querySelector(".cell-actions-grid");
if (psV2ActionGrid) { psV2ActionGrid.append(psV2RangeCopy, psV2RangePaste); }

function psV2Bounds(aRef, bRef) {
  const a = psRefPartsAny(aRef), b = psRefPartsAny(bRef);
  if (!a || !b) return null;
  return { minRow: Math.min(a.row,b.row), maxRow: Math.max(a.row,b.row), minCol: Math.min(a.colIndex,b.colIndex), maxCol: Math.max(a.colIndex,b.colIndex) };
}
function psV2RangeLabel(b) { return `${psRefFromParts(b.minCol,b.minRow)}:${psRefFromParts(b.maxCol,b.maxRow)}`; }
function psV2CaptureRange(aRef,bRef) {
  const b = psV2Bounds(aRef,bRef); if (!b) return null;
  const entries = [], lines = [];
  for (let r=b.minRow;r<=b.maxRow;r++) {
    const line=[];
    for (let c=b.minCol;c<=b.maxCol;c++) {
      const ref=psRefFromParts(c,r), has=Object.prototype.hasOwnProperty.call(data.cells||{},ref);
      entries.push({sourceRef:ref,rowOffset:r-b.minRow,colOffset:c-b.minCol,hasCell:has,cell:has?data.cells[ref]:null,formula:psDeepClone((data.formulas||{})[ref]||null),format:psDeepClone((data.formats||{})[ref]||null)});
      line.push(String(evaluateCell(ref).display??""));
    }
    lines.push(line.join("\t"));
  }
  return { bounds:b, rows:b.maxRow-b.minRow+1, cols:b.maxCol-b.minCol+1, entries, text:lines.join("\n") };
}
function psV2StartRangeCopy() {
  if (!selectedRef) return;
  psV2RangePickStart=selectedRef; psV2RangePicking=true; psCloseCellActionsSheet();
  pickBanner.classList.remove("hidden"); pickTitle.textContent="Copy range to…"; pickHint.textContent=`Start is ${selectedRef}. Tap the opposite corner.`; renderSheet();
}
function psV2FinishRangeCopy(endRef) {
  psV2RangeClipboard=psV2CaptureRange(psV2RangePickStart,endRef); psV2RangePicking=false; pickBanner.classList.add("hidden");
  if (!psV2RangeClipboard) return;
  psV2RangeHighlight=psV2RangeClipboard.bounds; psV2RangePaste.disabled=false;
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(psV2RangeClipboard.text).catch(()=>{});
  selectCell(psRefFromParts(psV2RangeClipboard.bounds.minCol,psV2RangeClipboard.bounds.minRow)); renderSheet();
  if (typeof psShowSaveState === "function") psShowSaveState(`Copied ${psV2RangeLabel(psV2RangeClipboard.bounds)}`,1700);
}
function psV2PasteRange() {
  if (!selectedRef || !psV2RangeClipboard) return;
  const target=psRefPartsAny(selectedRef); if (!target) return;
  const finalRow=target.row+psV2RangeClipboard.rows-1, finalCol=target.colIndex+psV2RangeClipboard.cols-1;
  const maxCols=typeof PS_MAX_COLUMNS==="number"?PS_MAX_COLUMNS:52;
  if (finalRow>1000 || finalCol>=maxCols) { psCellActionsNote.textContent="That range would exceed the current 1,000-row or 52-column limit."; return; }
  if (finalRow>data.rows) data.rows=finalRow;
  if (finalCol>=COLS.length) psSetColumnCount(finalCol+1);
  psV2RangeClipboard.entries.forEach(entry=>{
    const ref=psRefFromParts(target.colIndex+entry.colOffset,target.row+entry.rowOffset);
    const s=psRefPartsAny(entry.sourceRef),t=psRefPartsAny(ref),rd=t.row-s.row,cd=t.colIndex-s.colIndex;
    if (entry.formula) { data.formulas[ref]=psShiftFormula2D(entry.formula,rd,cd); delete data.cells[ref]; }
    else if (entry.hasCell) { data.cells[ref]=entry.cell; delete data.formulas[ref]; }
    else { delete data.cells[ref]; delete data.formulas[ref]; }
    if (entry.format) data.formats[ref]=psDeepClone(entry.format); else delete data.formats[ref];
  });
  psV2RangeHighlight={minRow:target.row,maxRow:finalRow,minCol:target.colIndex,maxCol:finalCol};
  saveData(); psCloseCellActionsSheet(); selectCell(selectedRef); renderSheet();
  if (typeof psUpdateColumnTools==="function") psUpdateColumnTools();
}
psV2RangeCopy.addEventListener("click",psV2StartRangeCopy);
psV2RangePaste.addEventListener("click",psV2PasteRange);
psCellActionsBtn.addEventListener("click",()=>{psV2RangePaste.disabled=!psV2RangeClipboard;});
const psV2HandleTapBefore=handleCellTap;
handleCellTap=function psV2HandleTap(ref){ if(psV2RangePicking){psV2FinishRangeCopy(ref);return;} psV2HandleTapBefore(ref); };
cancelPickBtn.addEventListener("click",e=>{ if(!psV2RangePicking)return; e.preventDefault();e.stopImmediatePropagation();psV2RangePicking=false;psV2RangePickStart=null;pickBanner.classList.add("hidden");renderSheet(); },true);
function psV2ApplyRangeHighlight(){
  if(!psV2RangeHighlight)return;
  document.querySelectorAll(".data-cell[data-ref]").forEach(cell=>{const p=psRefPartsAny(cell.dataset.ref);if(!p)return;const inside=p.row>=psV2RangeHighlight.minRow&&p.row<=psV2RangeHighlight.maxRow&&p.colIndex>=psV2RangeHighlight.minCol&&p.colIndex<=psV2RangeHighlight.maxCol;cell.classList.toggle("range-highlight",inside);cell.classList.toggle("range-corner",inside&&p.row===psV2RangeHighlight.minRow&&p.colIndex===psV2RangeHighlight.minCol);});
}
const psV2RenderSheetBefore=renderSheet;
renderSheet=function psV2RenderSheet(){psV2RenderSheetBefore();psV2ApplyRangeHighlight();};

// ---------- Local workbook Home ----------
const PS_V2_LIBRARY_KEY="pocketsheet-workbook-library-v1";
const PS_V2_ACTIVE_BOOK_KEY="pocketsheet-active-workbook-id";
const PS_V2_MAX_WORKBOOKS=10;
let psV2HomeReady=false;
function psV2BookId(){return `book-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`;}
function psV2LoadLibrary(){try{const v=JSON.parse(localStorage.getItem(PS_V2_LIBRARY_KEY)||"null");return Array.isArray(v)?v:[];}catch(e){console.warn("PocketSheet library read failed",e);return[];}}
let psV2Library=psV2LoadLibrary();
let psV2ActiveBookId=localStorage.getItem(PS_V2_ACTIVE_BOOK_KEY);
function psV2SaveLibrary(){localStorage.setItem(PS_V2_LIBRARY_KEY,JSON.stringify(psV2Library.slice(0,PS_V2_MAX_WORKBOOKS)));}
function psV2DefaultBookName(){const t=psWorkbook.sheets[0]?.data?.title;return t&&t!=="My Sheet"?t:"My Workbook";}
function psV2EnsureLibrary(){
  let record=psV2Library.find(b=>b.id===psV2ActiveBookId);
  if(!record){record={id:psV2BookId(),name:psV2DefaultBookName(),updatedAt:Date.now(),workbook:psDeepClone(psWorkbook)};psV2Library.unshift(record);psV2ActiveBookId=record.id;localStorage.setItem(PS_V2_ACTIVE_BOOK_KEY,record.id);psV2SaveLibrary();}
  return record;
}
function psV2SyncLibrary(){
  const record=psV2Library.find(b=>b.id===psV2ActiveBookId)||psV2EnsureLibrary();
  record.workbook=psDeepClone(psWorkbook);record.updatedAt=Date.now();psV2Library.sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0));psV2SaveLibrary();
  if(psV2HomeReady){const home=document.getElementById("workbookHome");if(home&&!home.classList.contains("hidden"))psV2RenderHome();}
}
psV2EnsureLibrary();
const psV2PersistBefore=psPersistWorkbook;
psPersistWorkbook=function psV2PersistWorkbook(){psV2PersistBefore();psV2SyncLibrary();};
psV2SyncLibrary();

const psV2HomeMarkup=`
<section class="workbook-home hidden" id="workbookHome"><div class="home-topbar"><div class="home-brand"><small>POCKETSHEET</small><strong>Workbooks</strong></div><button class="home-close" id="v2HomeClose">✕</button></div><div class="home-body"><button class="home-new" id="v2NewBook">＋ New workbook</button><p class="home-section-title">RECENT</p><div class="home-workbooks" id="v2BookList"></div></div></section>
<div class="editor-backdrop hidden" id="v2NewBookBackdrop"><div class="editor-sheet new-workbook-sheet"><div class="grabber"></div><div class="editor-head"><div><p class="eyebrow">NEW WORKBOOK</p><h2>Name your workbook</h2></div><button class="icon-btn" id="v2NewBookClose">✕</button></div><input id="v2NewBookName" maxlength="50" autocomplete="off" placeholder="My Workbook"/><p class="new-workbook-help">Starts with one blank sheet. Workbooks stay on this device and work offline.</p><button class="primary-btn" id="v2CreateBook">Create workbook</button></div></div>`;
document.body.insertAdjacentHTML("beforeend",psV2HomeMarkup);
const psV2Home=document.getElementById("workbookHome"),psV2HomeClose=document.getElementById("v2HomeClose"),psV2NewBook=document.getElementById("v2NewBook"),psV2BookList=document.getElementById("v2BookList"),psV2NewBackdrop=document.getElementById("v2NewBookBackdrop"),psV2NewClose=document.getElementById("v2NewBookClose"),psV2NewName=document.getElementById("v2NewBookName"),psV2CreateBook=document.getElementById("v2CreateBook"),psV2Brand=document.querySelector(".brand-label");
psV2HomeReady=true;
function psV2Recent(ts){const m=Math.max(0,Math.floor((Date.now()-Number(ts||0))/60000));if(m<1)return"Just now";if(m<60)return`${m} min ago`;const h=Math.floor(m/60);if(h<24)return`${h} hr${h===1?"":"s"} ago`;const d=Math.floor(h/24);return`${d} day${d===1?"":"s"} ago`;}
function psV2RenderHome(){
  psV2BookList.innerHTML="";
  psV2Library.slice().sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0)).forEach(book=>{
    const current=book.id===psV2ActiveBookId,card=document.createElement("article");card.className=`home-workbook-card${current?" current":""}`;
    const sheets=book.workbook?.sheets||[],active=sheets.find(s=>s.id===book.workbook?.activeId)||sheets[0],info=document.createElement("div");info.innerHTML="<strong></strong><small></small>";info.querySelector("strong").textContent=book.name||"Workbook";info.querySelector("small").textContent=`${sheets.length} sheet${sheets.length===1?"":"s"} · ${active?.data?.title||"Sheet"} · ${psV2Recent(book.updatedAt)}`;
    const open=document.createElement("button");open.className="home-open-btn";open.textContent=current?"Current":"Open";open.addEventListener("click",()=>current?psV2Home.classList.add("hidden"):psV2OpenWorkbook(book.id));card.append(info,open);psV2BookList.appendChild(card);
  });
}
function psV2OpenHome(){psSyncActiveRecordFromData();psPersistWorkbook();psV2RenderHome();psV2Home.classList.remove("hidden");}
function psV2OpenWorkbook(id){psV2SyncLibrary();const record=psV2Library.find(b=>b.id===id);if(!record?.workbook)return;localStorage.setItem(PS_V2_ACTIVE_BOOK_KEY,id);localStorage.setItem(PS_WORKBOOK_KEY,JSON.stringify(record.workbook));const sheet=record.workbook.sheets.find(s=>s.id===record.workbook.activeId)||record.workbook.sheets[0];if(sheet?.data)localStorage.setItem("pocketsheet-data",JSON.stringify(sheet.data));window.location.reload();}
function psV2CreateWorkbook(name){
  if(psV2Library.length>=PS_V2_MAX_WORKBOOKS){if(typeof psShowSaveState==="function")psShowSaveState(`Maximum ${PS_V2_MAX_WORKBOOKS} local workbooks for now`,2200);return;}
  psV2SyncLibrary();const sheetData=psBlankSheetData("My Sheet"),sheetId=psWorkbookId(),workbook={activeId:sheetId,sheets:[{id:sheetId,data:sheetData}]},record={id:psV2BookId(),name:String(name||"").trim()||"My Workbook",updatedAt:Date.now(),workbook};psV2Library.unshift(record);psV2SaveLibrary();localStorage.setItem(PS_V2_ACTIVE_BOOK_KEY,record.id);localStorage.setItem(PS_WORKBOOK_KEY,JSON.stringify(workbook));localStorage.setItem("pocketsheet-data",JSON.stringify(sheetData));window.location.reload();
}
if(psV2Brand){psV2Brand.setAttribute("role","button");psV2Brand.setAttribute("tabindex","0");psV2Brand.setAttribute("aria-label","Open PocketSheet home");psV2Brand.addEventListener("click",psV2OpenHome);psV2Brand.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" ")psV2OpenHome();});}
psV2HomeClose.addEventListener("click",()=>psV2Home.classList.add("hidden"));
psV2NewBook.addEventListener("click",()=>{psV2NewName.value="";psV2NewBackdrop.classList.remove("hidden");setTimeout(()=>psV2NewName.focus(),50);});
psV2NewClose.addEventListener("click",()=>psV2NewBackdrop.classList.add("hidden"));
psV2NewBackdrop.addEventListener("click",e=>{if(e.target===psV2NewBackdrop)psV2NewBackdrop.classList.add("hidden");});
psV2CreateBook.addEventListener("click",()=>psV2CreateWorkbook(psV2NewName.value));
psV2NewName.addEventListener("keydown",e=>{if(e.key==="Enter")psV2CreateWorkbook(psV2NewName.value);});

psRenderSheetTabs();
