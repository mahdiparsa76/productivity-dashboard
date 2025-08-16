// ======= Storage helpers =======
const storage = {
  get(key, fallback){
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch{ return fallback; }
  },
  set(key, val){ localStorage.setItem(key, JSON.stringify(val)); }
};

// ======= Elements =======
const sidebar = document.getElementById('sidebar');
const themeToggle = document.getElementById('themeToggle');
const menuToggle = document.getElementById('menuToggle');
const navLinks = document.querySelectorAll('[data-route]');
const views = {
  dashboard: document.getElementById('view-dashboard'),
  tasks: document.getElementById('view-tasks'),
  notes: document.getElementById('view-notes'),
};

// Dashboard KPIs
const kpiToday = document.getElementById('kpi-today');
const kpiDone = document.getElementById('kpi-done');
const kpiActive = document.getElementById('kpi-active');
const quote = document.getElementById('quote');
const quoteError = document.getElementById('quoteError');
const refreshQuote = document.getElementById('refreshQuote');

// Quick add
const quickForm = document.getElementById('quickAddForm');
const quickTitle = document.getElementById('quickTitle');
const quickPriority = document.getElementById('quickPriority');
const quickList = document.getElementById('quickList');

// Tasks
const taskForm = document.getElementById('taskForm');
const taskTitle = document.getElementById('taskTitle');
const taskDate = document.getElementById('taskDate');
const taskPriority = document.getElementById('taskPriority');
const taskDesc = document.getElementById('taskDesc');
const filterStatus = document.getElementById('filterStatus');
const filterPriority = document.getElementById('filterPriority');
const searchTask = document.getElementById('searchTask');
const taskTableBody = document.querySelector('#taskTable tbody');

// Notes
const noteForm = document.getElementById('noteForm');
const noteTitle = document.getElementById('noteTitle');
const noteBody = document.getElementById('noteBody');
const notesGrid = document.getElementById('notesGrid');

// ======= State =======
let tasks = storage.get('tasks', []);
let notes = storage.get('notes', []);
let theme = storage.get('theme', 'light');

// ======= Theme =======
function applyTheme(){
  if(theme === 'dark') document.documentElement.classList.add('dark');
  else document.documentElement.classList.remove('dark');
}
applyTheme();

themeToggle.addEventListener('click', ()=>{
  theme = theme === 'dark' ? 'light' : 'dark';
  storage.set('theme', theme);
  applyTheme();
});

// ======= SPA Router =======
function setActiveRoute(route){
  Object.values(views).forEach(v=>v.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(a=>a.classList.remove('active'));
  const target = views[route] ?? views.dashboard;
  target.classList.add('active');
  document.querySelector(`.nav-link[href="#/${route}"]`)?.classList.add('active');
  // close sidebar on small screens
  sidebar.classList.remove('show');
  if(window.innerWidth <= 1024) sidebar.classList.add('hidden');
  updateKPIs();
}
function handleHashChange(){
  const route = location.hash.replace('#/','') || 'dashboard';
  setActiveRoute(route);
}
window.addEventListener('hashchange', handleHashChange);
handleHashChange();

menuToggle.addEventListener('click', ()=>{
  sidebar.classList.toggle('show');
  sidebar.classList.toggle('hidden');
});

// ======= Quote (Async/Fetch) =======
async function loadQuote(){
  quoteError.textContent = '';
  quote.textContent = 'در حال بارگذاری...';
  try{
    const res = await fetch('https://api.quotable.io/random?tags=motivational|success');
    if(!res.ok) throw new Error('خطا در دریافت داده');
    const data = await res.json();
    quote.textContent = `«${data.content}» — ${data.author}`;
  }catch(err){
    quote.textContent = 'نتوانستم جمله را بارگیری کنم.';
    quoteError.textContent = err.message;
  }
}
refreshQuote.addEventListener('click', loadQuote);
loadQuote();

// ======= Tasks =======
function uid(){ return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2); }

function addTask({title, date, priority, desc}){
  const t = {
    id: uid(),
    title: title.trim(),
    date: date || '',
    priority,
    desc: desc?.trim() || '',
    done: false,
    createdAt: Date.now()
  };
  tasks.push(t);
  persistTasks();
  renderTasks();
  updateKPIs();
}
function persistTasks(){ storage.set('tasks', tasks); }

function renderTasks(){
  const s = filterStatus.value;
  const p = filterPriority.value;
  const q = searchTask.value.trim().toLowerCase();

  const filtered = tasks.filter(t=>{
    const statusOk = s==='all' ? true : (s==='done' ? t.done : !t.done);
    const priorityOk = p==='all' ? true : t.priority===p;
    const queryOk = !q || t.title.toLowerCase().includes(q) || t.desc.toLowerCase().includes(q);
    return statusOk && priorityOk && queryOk;
  });

  taskTableBody.innerHTML = '';
  filtered.forEach(t=>{
    const tr = document.createElement('tr');

    const statusTd = document.createElement('td');
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'btn icon';
    toggleBtn.title = 'تغییر وضعیت';
    toggleBtn.textContent = t.done ? '✅' : '⏳';
    toggleBtn.addEventListener('click', ()=>{
      t.done = !t.done;
      persistTasks();
      renderTasks();
      updateKPIs();
    });
    statusTd.appendChild(toggleBtn);

    const titleTd = document.createElement('td');
    titleTd.textContent = t.title;

    const prTd = document.createElement('td');
    const pr = document.createElement('span');
    pr.className = `badge ${t.priority}`;
    pr.textContent = t.priority==='high'?'زیاد':t.priority==='medium'?'متوسط':'کم';
    prTd.appendChild(pr);

    const dateTd = document.createElement('td');
    dateTd.textContent = t.date || '—';

    const actionsTd = document.createElement('td');
    const editBtn = document.createElement('button');
    editBtn.className = 'btn icon';
    editBtn.textContent = '✏️';
    editBtn.title = 'ویرایش';
    editBtn.addEventListener('click', ()=> editTaskPrompt(t.id));

    const delBtn = document.createElement('button');
    delBtn.className = 'btn icon';
    delBtn.textContent = '🗑️';
    delBtn.title = 'حذف';
    delBtn.addEventListener('click', ()=>{
      if(confirm('حذف این کار؟')){
        tasks = tasks.filter(x=>x.id!==t.id);
        persistTasks();
        renderTasks();
        updateKPIs();
      }
    });

    actionsTd.append(editBtn, delBtn);

    tr.append(statusTd, titleTd, prTd, dateTd, actionsTd);
    taskTableBody.appendChild(tr);
  });
}
function editTaskPrompt(id){
  const t = tasks.find(x=>x.id===id);
  if(!t) return;
  const newTitle = prompt('عنوان جدید:', t.title) ?? t.title;
  const newDate = prompt('تاریخ (YYYY-MM-DD):', t.date) ?? t.date;
  const newPriority = prompt('اولویت (high|medium|low):', t.priority) ?? t.priority;
  const newDesc = prompt('توضیحات:', t.desc) ?? t.desc;
  Object.assign(t, { title:newTitle.trim(), date:newDate, priority:newPriority, desc:newDesc.trim() });
  persistTasks();
  renderTasks();
  updateKPIs();
}

taskForm.addEventListener('submit', (e)=>{
  e.preventDefault();
  addTask({ title: taskTitle.value, date: taskDate.value, priority: taskPriority.value, desc: taskDesc.value });
  taskForm.reset();
});
[filterStatus, filterPriority, searchTask].forEach(el=> el.addEventListener('input', renderTasks));

// Quick add (dashboard small list)
quickForm.addEventListener('submit',(e)=>{
  e.preventDefault();
  if(!quickTitle.value.trim()) return;
  addTask({ title: quickTitle.value, date:'', priority: quickPriority.value, desc:'' });
  quickTitle.value='';
  renderQuick();
});

function renderQuick(){
  quickList.innerHTML='';
  const last = [...tasks].slice(-5).reverse();
  last.forEach(t=>{
    const li = document.createElement('li');
    li.textContent = `${t.title}`;
    if(t.done) li.classList.add('done');
    li.addEventListener('click', ()=>{
      t.done = !t.done; persistTasks(); renderQuick(); renderTasks(); updateKPIs();
    });
    quickList.appendChild(li);
  });
}

// KPI
function updateKPIs(){
  const today = new Date().toISOString().slice(0,10);
  const todayCount = tasks.filter(t=>t.date===today).length;
  const done = tasks.filter(t=>t.done).length;
  const active = tasks.length - done;
  kpiToday.textContent = todayCount;
  kpiDone.textContent = done;
  kpiActive.textContent = active;
  renderQuick();
}

// Seed sample data if empty (first run)
// if(tasks.length===0){
//   addTask({ title:'مطالعه مباحث JS', date:'', priority:'high', desc:'Array methods تمرین' });
//   addTask({ title:'ساخت To-Do با Vue', date:'', priority:'medium', desc:'emit/props تمرین' });
//   addTask({ title:'مرور CSS Grid', date:'', priority:'low', desc:'1 ساعت' });
// }

// ======= Notes =======
function renderNotes(){
  notesGrid.innerHTML='';
  if(notes.length===0){
    const p = document.createElement('p');
    p.textContent = 'یادداشتی موجود نیست.';
    notesGrid.appendChild(p);
    return;
  }
  notes.forEach(n=>{
    const card = document.createElement('div');
    card.className = 'card';
    const title = document.createElement('h3');
    title.textContent = n.title;
    const body = document.createElement('p');
    body.textContent = n.body;
    const row = document.createElement('div');
    row.className = 'row between';
    const time = document.createElement('small');
    time.style.color = 'var(--muted)';
    time.textContent = new Date(n.createdAt).toLocaleString('fa-IR');
    const del = document.createElement('button');
    del.className = 'btn icon';
    del.textContent = '🗑️';
    del.title = 'حذف یادداشت';
    del.addEventListener('click', ()=>{
      if(confirm('حذف این یادداشت؟')){
        notes = notes.filter(x=>x.id!==n.id);
        storage.set('notes', notes);
        renderNotes();
      }
    });
    row.append(time, del);
    card.append(title, body, row);
    notesGrid.appendChild(card);
  });
}

noteForm.addEventListener('submit',(e)=>{
  e.preventDefault();
  const n = {
    id: uid(),
    title: noteTitle.value.trim(),
    body: noteBody.value.trim(),
    createdAt: Date.now()
  };
  notes.push(n);
  storage.set('notes', notes);
  noteForm.reset();
  renderNotes();
});

// ======= Init =======
renderTasks();
renderNotes();
updateKPIs();
