/* Student Performance Data Explorer
   Data access is intentionally isolated in the storage functions below.
   For a remote database, replace these functions with asynchronous API calls. */
(() => {
  "use strict";
  const STORAGE_KEY = "student-performance-data-explorer-v1";
  const PAGE_SIZE = 8;
  const $ = (id) => document.getElementById(id);
  const today = new Date().toISOString().slice(0, 10);
  let records = [];
  let currentPage = 1;
  let performanceChart = null;
  let departmentChart = null;
  let toastTimer = null;
  let pendingImport = false;

  const sampleRecords = [
    ["STU-1001","Aadhya Raman","Information Technology",2,94,88,"2026-09-02"],
    ["STU-1002","Arjun Kumar","Computer Science",3,87,76,"2026-09-02"],
    ["STU-1003","Diya Srinivasan","Electronics",1,96,92,"2026-09-03"],
    ["STU-1004","Kavin Raj","Mechanical",2,78,63,"2026-09-03"],
    ["STU-1005","Meera Nair","Business Analytics",4,91,85,"2026-09-04"],
    ["STU-1006","Rohan Das","Data Science",3,89,81,"2026-09-04"],
    ["STU-1007","Nila Joseph","Information Technology",2,82,72,"2026-09-05"],
    ["STU-1008","Vikram Shah","Computer Science",4,73,58,"2026-09-05"],
    ["STU-1009","Ishita Bose","Electronics",2,98,95,"2026-09-06"],
    ["STU-1010","Aditya Menon","Mechanical",1,85,69,"2026-09-06"],
    ["STU-1011","Ananya Iyer","Business Analytics",3,92,90,"2026-09-07"],
    ["STU-1012","Dev Patel","Data Science",2,76,67,"2026-09-07"],
    ["STU-1013","Sanjana Rao","Information Technology",4,88,79,"2026-09-08"],
    ["STU-1014","Harish Babu","Computer Science",1,69,54,"2026-09-08"],
    ["STU-1015","Priya Thomas","Electronics",3,95,86,"2026-09-09"],
    ["STU-1016","Yash Verma","Mechanical",4,81,74,"2026-09-09"],
    ["STU-1017","Keerthi Suresh","Business Analytics",2,90,83,"2026-09-10"],
    ["STU-1018","Rahul Sen","Data Science",1,74,61,"2026-09-10"],
    ["STU-1019","Lavanya Krishnan","Information Technology",3,97,93,"2026-09-11"],
    ["STU-1020","Neil Fernandes","Computer Science",2,84,71,"2026-09-11"],
    ["STU-1021","Tara Mukherjee","Electronics",4,89,87,"2026-09-12"],
    ["STU-1022","Siddharth Jain","Mechanical",3,72,59,"2026-09-12"],
    ["STU-1023","Maya Pillai","Business Analytics",1,93,89,"2026-09-13"],
    ["STU-1024","Pranav Reddy","Data Science",4,86,78,"2026-09-13"]
  ].map(([id,name,department,year,attendance,marks,date]) => ({id,name,department,year:String(year),attendance:Number(attendance),marks:Number(marks),date}));

  function loadRecords() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      records = saved ? JSON.parse(saved) : [];
      if (!Array.isArray(records)) records = [];
      records = records.map(normalizeRecord);
    } catch (error) {
      records = [];
      showToast("Could not read saved browser data. Starting with an empty dataset.", true);
    }
  }
  function saveRecords() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(records)); return true; }
    catch (error) { showToast("Could not save data in this browser. Storage may be full or disabled.", true); return false; }
  }
  function normalizeRecord(r) {
    return {
      id: String(r.id ?? r.studentId ?? "").trim(),
      name: String(r.name ?? r.studentName ?? "").trim(),
      department: String(r.department ?? "").trim(),
      year: String(r.year ?? "").trim(),
      attendance: r.attendance === "" || r.attendance == null ? "" : Number(r.attendance),
      marks: r.marks === "" || r.marks == null ? "" : Number(r.marks),
      date: String(r.date ?? r.collectionDate ?? "").trim()
    };
  }
  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, ch => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[ch]));
  }
  function average(list, key) {
    const vals = list.map(r => Number(r[key])).filter(n => Number.isFinite(n));
    return vals.length ? vals.reduce((a,b) => a+b, 0) / vals.length : null;
  }
  function avgText(n) { return n == null ? "—" : `${n.toFixed(1)}%`; }
  function performance(marks) {
    if (!Number.isFinite(Number(marks))) return {label:"Unknown",cls:"support"};
    if (Number(marks) >= 80) return {label:"Excellent",cls:"excellent"};
    if (Number(marks) >= 60) return {label:"Good",cls:"good"};
    return {label:"Needs support",cls:"support"};
  }
  function initials(name) {
    return String(name || "?").split(/\s+/).filter(Boolean).slice(0,2).map(s => s[0]).join("").toUpperCase();
  }
  function showToast(message, error=false) {
    const toast = $("toast");
    toast.textContent = message;
    toast.classList.toggle("error", error);
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 3300);
  }
  function setPage(page) {
    const valid = ["dashboard","collect","explore","quality","about"].includes(page) ? page : "dashboard";
    document.querySelectorAll(".page").forEach(el => el.classList.toggle("active", el.id === `page-${valid}`));
    document.querySelectorAll(".nav-item").forEach(el => el.classList.toggle("active", el.dataset.page === valid));
    $("pageCrumb").textContent = ({dashboard:"Dashboard",collect:"Collect Data",explore:"Explore Dataset",quality:"Data Quality",about:"About Project"})[valid];
    $("sidebar").classList.remove("open");
    if (valid === "dashboard") renderDashboard();
    if (valid === "explore") renderDataset();
    if (valid === "quality") renderQuality();
    window.scrollTo({top:0,behavior:"smooth"});
  }
  function rowHtml(r, includeId=false, actions=false) {
    const perf = performance(Number(r.marks));
    const attendance = Number.isFinite(Number(r.attendance)) && r.attendance !== "" ? Number(r.attendance) : null;
    const marks = Number.isFinite(Number(r.marks)) && r.marks !== "" ? Number(r.marks) : null;
    const pclass = marks == null ? "low" : marks >= 80 ? "" : marks >= 60 ? "mid" : "low";
    const idCell = includeId ? `<td><span class="student-id">${esc(r.id || "—")}</span></td>` : "";
    const actionCell = actions ? `<td><div class="action-group"><button class="icon-btn" data-action="edit" data-id="${esc(r.id)}" aria-label="Edit ${esc(r.name)}" title="Edit record">✎</button><button class="icon-btn delete" data-action="delete" data-id="${esc(r.id)}" aria-label="Delete ${esc(r.name)}" title="Delete record">×</button></div></td>` : "";
    return `<tr>${idCell}<td><div class="student-cell"><span class="student-avatar">${esc(initials(r.name))}</span><span><span class="student-name">${esc(r.name || "Missing name")}</span>${includeId ? "" : `<span class="student-id">${esc(r.id || "No ID")}</span>`}</span></div></td><td class="dept-cell">${esc(r.department || "—")}</td><td><span class="year-pill">${r.year ? `Year ${esc(r.year)}` : "—"}</span></td><td><div class="progress-cell"><span>${attendance == null ? "—" : `${attendance}%`}</span>${attendance == null ? "" : `<span class="progress-track"><span class="progress-fill ${attendance < 60 ? "low" : attendance < 80 ? "mid" : ""}" style="display:block;width:${Math.max(0,Math.min(100,attendance))}%"></span></span>`}</div></td><td><strong>${marks == null ? "—" : `${marks}%`}</strong></td><td><span class="performance ${perf.cls}">${esc(perf.label)}</span></td>${actionCell}</tr>`;
  }
  function renderDashboard() {
    $("statRecords").textContent = records.length.toLocaleString();
    $("statMarks").textContent = avgText(average(records,"marks"));
    $("statAttendance").textContent = avgText(average(records,"attendance"));
    $("statDepartments").textContent = new Set(records.map(r=>r.department).filter(Boolean)).size;
    const recent = [...records].sort((a,b) => (b.date || "").localeCompare(a.date || "") || b.id.localeCompare(a.id)).slice(0,5);
    $("recentTable").innerHTML = recent.length ? recent.map(r => rowHtml(r,false,false)).join("") : `<tr><td colspan="6" style="text-align:center;padding:28px;color:#95a4b1">No records yet. Add a record or load sample data.</td></tr>`;
    $("recentCount").textContent = `Showing ${recent.length} of ${records.length} records`;
    renderCharts();
  }
  function renderCharts() {
    if (typeof Chart === "undefined") return;
    const counts = [
      records.filter(r => Number(r.marks) >= 80 && r.marks !== "").length,
      records.filter(r => Number(r.marks) >= 60 && Number(r.marks) < 80 && r.marks !== "").length,
      records.filter(r => r.marks !== "" && Number(r.marks) < 60).length
    ];
    const pctx = $("performanceChart");
    if (performanceChart) performanceChart.destroy();
    performanceChart = new Chart(pctx, {type:"doughnut",data:{labels:["Excellent","Good","Needs support"],datasets:[{data:counts,backgroundColor:["#13a58f","#5181f4","#f2b15b"],borderWidth:0,hoverOffset:5}]},options:{responsive:true,maintainAspectRatio:false,cutout:"70%",plugins:{legend:{display:false},tooltip:{padding:10}}}});
    const departments = [...new Set(records.map(r=>r.department).filter(Boolean))].sort();
    const averages = departments.map(d => average(records.filter(r=>r.department===d),"marks") ?? 0);
    const dctx = $("departmentChart");
    if (departmentChart) departmentChart.destroy();
    departmentChart = new Chart(dctx,{type:"bar",data:{labels:departments,datasets:[{label:"Average marks",data:averages,backgroundColor:"#24a99a",borderRadius:5,maxBarThickness:24}]},options:{responsive:true,maintainAspectRatio:false,indexAxis:"y",plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>` Average: ${c.raw.toFixed(1)}%`}}},scales:{x:{beginAtZero:true,max:100,grid:{color:"#edf1f5"},ticks:{color:"#94a3b1",font:{size:9},callback:v=>`${v}%`},border:{display:false}},y:{grid:{display:false},ticks:{color:"#718396",font:{size:9}},border:{display:false}}}}});
  }
  function populateDepartmentFilter() {
    const select = $("departmentFilter"), old = select.value;
    const depts = [...new Set(records.map(r=>r.department).filter(Boolean))].sort();
    select.innerHTML = `<option value="">All departments</option>` + depts.map(d=>`<option value="${esc(d)}">${esc(d)}</option>`).join("");
    if (depts.includes(old)) select.value = old;
  }
  function filteredRecords() {
    const q = $("searchInput").value.trim().toLowerCase();
    const dept = $("departmentFilter").value;
    const year = $("yearFilter").value;
    let list = records.filter(r => (!q || r.name.toLowerCase().includes(q) || r.id.toLowerCase().includes(q)) && (!dept || r.department===dept) && (!year || r.year===year));
    const sort = $("sortFilter").value;
    if (sort === "marks-desc") list.sort((a,b)=>(Number(b.marks)||0)-(Number(a.marks)||0));
    else if (sort === "marks-asc") list.sort((a,b)=>(Number(a.marks)||0)-(Number(b.marks)||0));
    else if (sort === "attendance-desc") list.sort((a,b)=>(Number(b.attendance)||0)-(Number(a.attendance)||0));
    else if (sort === "name-asc") list.sort((a,b)=>a.name.localeCompare(b.name));
    else list.sort((a,b)=>(b.date||"").localeCompare(a.date||"") || b.id.localeCompare(a.id));
    return list;
  }
  function renderDataset() {
    populateDepartmentFilter();
    const list = filteredRecords();
    const pages = Math.max(1,Math.ceil(list.length/PAGE_SIZE));
    currentPage = Math.min(currentPage,pages);
    const visible = list.slice((currentPage-1)*PAGE_SIZE,currentPage*PAGE_SIZE);
    $("datasetTable").innerHTML = visible.map(r=>rowHtml(r,true,true)).join("");
    $("emptyState").classList.toggle("hidden",list.length>0);
    $("datasetTable").parentElement.style.display = list.length ? "" : "none";
    $("viewCount").textContent = list.length.toLocaleString();
    $("viewAverage").textContent = avgText(average(list,"marks"));
    $("activeFilterCount").textContent = [ $("searchInput").value.trim(), $("departmentFilter").value, $("yearFilter").value ].filter(Boolean).length;
    $("datasetCount").textContent = `${list.length} record${list.length===1?"":"s"}${list.length!==records.length?` · ${records.length} total`:""}`;
    $("pageInfo").textContent = `Page ${currentPage} of ${pages}`;
    $("prevPage").disabled = currentPage<=1;
    $("nextPage").disabled = currentPage>=pages;
  }
  function dataIssues() {
    const counts = new Map();
    records.forEach(r=>{if(r.id) counts.set(r.id,(counts.get(r.id)||0)+1);});
    const duplicateIds = [...counts.entries()].filter(([,n])=>n>1).map(([id])=>id);
    let missing=0, invalid=0, valid=0;
    records.forEach(r=>{
      let rowIssue = false;
      ["id","name","department","year","date","attendance","marks"].forEach(k=>{if(r[k]=== "" || r[k] == null) {missing++;rowIssue=true;}});
      if (!["1","2","3","4"].includes(String(r.year)) || (r.attendance!=="" && (!Number.isFinite(Number(r.attendance))||Number(r.attendance)<0||Number(r.attendance)>100)) || (r.marks!=="" && (!Number.isFinite(Number(r.marks))||Number(r.marks)<0||Number(r.marks)>100))) {invalid++;rowIssue=true;}
      if (!rowIssue && !duplicateIds.includes(r.id)) valid++;
    });
    return {duplicateIds,missing,invalid,valid,total:records.length};
  }
  function renderQuality() {
    const q = dataIssues();
    $("qualityTotal").textContent = q.total;
    $("qualityValid").textContent = q.valid;
    $("qualityIssues").textContent = q.missing + q.invalid;
    $("qualityDuplicates").textContent = q.duplicateIds.length;
    const completion = q.total ? Math.round((q.valid/q.total)*100) : 100;
    $("qualityScore").textContent = `${completion}% complete`;
    const checks = [
      {title:"Required fields completed",desc:`${q.missing} missing field value(s) detected across all records.`,ok:q.missing===0},
      {title:"Numeric ranges are valid",desc:`${q.invalid} record(s) have invalid year, attendance, or marks values.`,ok:q.invalid===0},
      {title:"Student IDs are unique",desc:q.duplicateIds.length ? `Duplicate IDs: ${q.duplicateIds.slice(0,8).join(", ")}${q.duplicateIds.length>8?"…":""}`:"No repeated student IDs detected.",ok:q.duplicateIds.length===0},
      {title:"Dataset is available for analysis",desc:q.total ? `${q.total} record(s) are currently stored in this browser.`:"No records yet. Load the sample dataset or collect a record.",ok:q.total>0}
    ];
    $("qualityChecks").innerHTML = checks.map(c=>`<div class="quality-check"><span class="check-icon ${c.ok?"ok":"warn"}">${c.ok?"✓":"!"}</span><div class="check-copy"><strong>${esc(c.title)}</strong><p>${esc(c.desc)}</p></div><span class="check-status ${c.ok?"ok":"warn"}">${c.ok?"PASSED":"REVIEW"}</span></div>`).join("");
  }
  function clearForm() {
    $("studentForm").reset();
    $("editOriginalId").value = "";
    $("studentId").value = nextId();
    $("collectionDate").value = today;
    $("formTitle").textContent = "Student information";
    $("saveRecordBtn").innerHTML = 'Save student record <span>→</span>';
    $("formError").textContent = "";
  }
  function nextId() {
    let n=1001;
    const used=new Set(records.map(r=>r.id.toUpperCase()));
    while(used.has(`STU-${n}`)) n++;
    return `STU-${n}`;
  }
  function editRecord(id) {
    const r = records.find(x=>x.id===id);
    if (!r) return;
    setPage("collect");
    $("editOriginalId").value = r.id;
    $("studentId").value = r.id;
    $("studentName").value = r.name;
    $("department").value = r.department;
    $("year").value = r.year;
    $("attendance").value = r.attendance;
    $("marks").value = r.marks;
    $("collectionDate").value = r.date;
    $("formTitle").textContent = "Edit student record";
    $("saveRecordBtn").innerHTML = 'Update record <span>→</span>';
    window.scrollTo({top:0,behavior:"smooth"});
  }
  function deleteRecord(id) {
    const r=records.find(x=>x.id===id);
    if (!r) return;
    if (!confirm(`Delete the record for ${r.name || id} (${id})? This action cannot be undone.`)) return;
    records=records.filter(x=>x.id!==id);
    saveRecords(); renderAll(); showToast("Student record deleted.");
  }
  function validateRecord(r, originalId="") {
    if (!r.id || !r.name || !r.department || !r.year || r.attendance==="" || r.marks==="" || !r.date) return "Please complete all required fields.";
    if (!["1","2","3","4"].includes(r.year)) return "Year of study must be between Year 1 and Year 4.";
    if (!Number.isFinite(Number(r.attendance)) || Number(r.attendance)<0 || Number(r.attendance)>100) return "Attendance must be a number between 0 and 100.";
    if (!Number.isFinite(Number(r.marks)) || Number(r.marks)<0 || Number(r.marks)>100) return "Marks must be a number between 0 and 100.";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date) || Number.isNaN(Date.parse(r.date))) return "Please select a valid data collection date.";
    if (records.some(x=>x.id.toLowerCase()===r.id.toLowerCase() && x.id!==originalId)) return "That student ID already exists. Please use a unique ID.";
    return "";
  }
  function handleSubmit(e) {
    e.preventDefault();
    const originalId=$("editOriginalId").value;
    const r=normalizeRecord({id:$("studentId").value,name:$("studentName").value,department:$("department").value,year:$("year").value,attendance:$("attendance").value,marks:$("marks").value,date:$("collectionDate").value});
    const error=validateRecord(r,originalId);
    if (error) {$("formError").textContent=error;return;}
    if (originalId) records=records.map(x=>x.id===originalId? r:x);
    else records.unshift(r);
    if (saveRecords()) {
      renderAll(); clearForm(); setPage("explore");
      $("searchInput").value=""; $("departmentFilter").value=""; $("yearFilter").value="";
      renderDataset();
      showToast(originalId ? "Student record updated successfully." : "Student record added successfully.");
    }
  }
  function csvEscape(v) {
    const s=String(v??"");
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
  }
  function exportCsv(all=false) {
    const list=all?records:filteredRecords();
    if (!list.length) {showToast("There are no records to export.",true);return;}
    const headers=["id","name","department","year","attendance","marks","date"];
    const lines=[headers.join(","),...list.map(r=>headers.map(h=>csvEscape(r[h])).join(","))];
    const blob=new Blob(["\uFEFF"+lines.join("\r\n")],{type:"text/csv;charset=utf-8;"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a"); a.href=url; a.download=all?"student-performance-all-records.csv":"student-performance-dataset.csv";
    document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
    showToast(`Exported ${list.length} record(s) to CSV.`);
  }
  // Small RFC4180-compatible parser, including quoted commas and escaped quotes.
  function parseCsv(text) {
    const rows=[];let row=[],field="",quoted=false;
    text=text.replace(/^\uFEFF/,"");
    for(let i=0;i<text.length;i++){
      const ch=text[i],next=text[i+1];
      if(quoted){
        if(ch==='"'&&next==='"'){field+='"';i++;}
        else if(ch==='"') quoted=false;
        else field+=ch;
      } else if(ch==='"'&&field==="") quoted=true;
      else if(ch===","){row.push(field);field="";}
      else if(ch==="\n"){row.push(field);if(row.some(v=>v.trim()!==""))rows.push(row);row=[];field="";}
      else if(ch!=="\r")field+=ch;
    }
    if(quoted) throw new Error("The CSV contains an unclosed quoted field.");
    if(field!==""||row.length){row.push(field);if(row.some(v=>v.trim()!==""))rows.push(row);}
    return rows;
  }
  function normalizeHeader(h) {return String(h).trim().toLowerCase().replace(/[\s_-]+/g,"");}
  function importCsvText(text) {
    let rows;
    try {rows=parseCsv(text);} catch(e){showToast(e.message,true);return;}
    if(rows.length<2){showToast("CSV must contain a header row and at least one data row.",true);return;}
    const headerAliases={
      id:["id","studentid"],name:["name","studentname"],department:["department","dept"],
      year:["year","yearofstudy","studyyear"],attendance:["attendance","attendancepercentage","attendancepercent"],
      marks:["marks","mark","score","markspercentage"],date:["date","collectiondate","datacollectiondate"]
    };
    const headerMap={};
    rows[0].forEach((h,i)=>{const n=normalizeHeader(h);for(const [key,aliases] of Object.entries(headerAliases)){if(aliases.includes(n))headerMap[key]=i;}});
    const missingHeaders=Object.keys(headerAliases).filter(k=>headerMap[k]===undefined);
    if(missingHeaders.length){showToast(`Missing CSV column(s): ${missingHeaders.join(", ")}. Required headers: id, name, department, year, attendance, marks, date.`,true);return;}
    let added=0,skipped=0;const errors=[];
    rows.slice(1).forEach((cells,index)=>{
      const rowNumber=index+2;
      const r=normalizeRecord(Object.fromEntries(Object.keys(headerAliases).map(k=>[k,cells[headerMap[k]]??""])));
      if(!r.id) r.id=nextId();
      const error=validateRecord(r,"");
      if(error){skipped++;if(errors.length<5)errors.push(`Row ${rowNumber}: ${error}`);return;}
      if(records.some(x=>x.id.toLowerCase()===r.id.toLowerCase())){skipped++;if(errors.length<5)errors.push(`Row ${rowNumber}: duplicate ID ${r.id}.`);return;}
      records.push(r);added++;
    });
    if(added) {saveRecords();renderAll();}
    if(skipped) showToast(`Imported ${added} valid row(s); skipped ${skipped}. ${errors.join(" ")}`,true);
    else showToast(`Successfully imported ${added} row(s).`);
  }
  function openImport() {$("csvInput").value="";$("csvInput").click();}
  function loadSample() {
    if(records.length && !confirm("Add the sample dataset to your existing records? Records with duplicate IDs will be skipped.")) return;
    let added=0;
    sampleRecords.forEach(r=>{if(!records.some(x=>x.id.toLowerCase()===r.id.toLowerCase())){records.push({...r});added++;}});
    saveRecords();renderAll();showToast(added?`Loaded ${added} sample student records.`:"Sample data is already loaded.");
  }
  function renderAll() {renderDashboard();renderDataset();renderQuality();}
  function init() {
    loadRecords();
    $("collectionDate").value=today;
    $("studentId").value=nextId();
    document.querySelectorAll("[data-page]").forEach(el=>el.addEventListener("click",e=>{e.preventDefault();setPage(el.dataset.page);}));
    document.querySelectorAll("[data-goto]").forEach(el=>el.addEventListener("click",()=>{setPage(el.dataset.goto);if(el.dataset.goto==="collect")clearForm();}));
    $("mobileMenu").addEventListener("click",()=>$("sidebar").classList.toggle("open"));
    $("topAddBtn").addEventListener("click",()=>{clearForm();setPage("collect");});
    $("studentForm").addEventListener("submit",handleSubmit);
    $("clearFormBtn").addEventListener("click",clearForm);
    $("searchInput").addEventListener("input",()=>{currentPage=1;renderDataset();});
    ["departmentFilter","yearFilter","sortFilter"].forEach(id=>$(id).addEventListener("change",()=>{currentPage=1;renderDataset();}));
    $("resetFiltersBtn").addEventListener("click",()=>{$("searchInput").value="";$("departmentFilter").value="";$("yearFilter").value="";$("sortFilter").value="newest";currentPage=1;renderDataset();});
    $("prevPage").addEventListener("click",()=>{currentPage=Math.max(1,currentPage-1);renderDataset();});
    $("nextPage").addEventListener("click",()=>{currentPage++;renderDataset();});
    $("datasetTable").addEventListener("click",e=>{const b=e.target.closest("button[data-action]");if(!b)return;b.dataset.action==="edit"?editRecord(b.dataset.id):deleteRecord(b.dataset.id);});
    $("emptyAddBtn").addEventListener("click",()=>{clearForm();setPage("collect");});
    ["dashboardImportBtn","exploreImportBtn","importBottomBtn"].forEach(id=>$(id).addEventListener("click",openImport));
    $("csvInput").addEventListener("change",async e=>{const file=e.target.files[0];if(!file)return;if(!file.name.toLowerCase().endsWith(".csv")){showToast("Please choose a .csv file.",true);return;}try{importCsvText(await file.text());}catch(err){showToast("Could not read the selected file.",true);}});
    $("dashboardExportBtn").addEventListener("click",()=>exportCsv(true));
    $("exploreExportBtn").addEventListener("click",()=>exportCsv(false));
    $("qualityRefreshBtn").addEventListener("click",()=>{renderQuality();showToast("Data quality report refreshed.");});
    $("aboutSampleBtn").addEventListener("click",loadSample);
    renderAll();
    if(!records.length) { /* Empty state is intentional; user can load sample data from About Project. */ }
  }
  document.addEventListener("DOMContentLoaded",init);
})();