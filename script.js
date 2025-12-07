/* script.js
   Central JS for StudyDash prototype.
   - uses localStorage/sessionStorage to persist demo data
   - features: auth simulation, courses, resources, tasks/calendar, GPA calc, charts
*/

/* ---------- Utilities ---------- */
function qs(sel){ return document.querySelector(sel); }
function qsa(sel){ return document.querySelectorAll(sel); }
function safeParse(key, fallback){ try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch(e){ return fallback; } }
function save(key, val){ localStorage.setItem(key, JSON.stringify(val)); }

/* ---------- Demo data initialization ---------- */
if (!localStorage.getItem('studyDashData')) {

  const init = {
    profile: { firstName: 'Demo', lastName: 'Student', email: 'student@example.com' },
    courses: {},
    resources: {},
    tasks: [],
    gpaHistory: []
  };

  localStorage.setItem('studyDashData', JSON.stringify(init));
}

/* ---------- Core data access helpers ---------- */
function getData(){ return safeParse('studyDashData', {}); }
function setData(data){ save('studyDashData', data); }

/* ---------- Auth & session helpers ---------- */
function logout() {
  sessionStorage.removeItem('loggedIn');
  sessionStorage.removeItem('userEmail');
  window.location.href = 'login.html';
}

window.addEventListener('load', () => {
  // Attach logout if present
  const lb = document.getElementById('logout-btn');
  if(lb) lb.addEventListener('click', (e) => {
    e.preventDefault();
    logout();
  });
});

/* ---------- Dashboard logic (index.html) ---------- */
function dashboardInit() {
  if(!document.getElementById('progressChart')) return;
  const data = getData();

  // Show profile
  const profile = data.profile || {};
  qs('#student-name').textContent = (profile.firstName ? profile.firstName + ' ' + (profile.lastName||'') : 'Student');
  qs('#student-email').textContent = profile.email || '';

  function updateTotalCourses() {
  const semesters = JSON.parse(localStorage.getItem("semesters")) || [];
  let total = 0;

  semesters.forEach(sem => {
    total += sem.courses.length;
  });

  // Display in dashboard
  const totalElement = document.getElementById("total-subjects");
  if (totalElement) {
    totalElement.textContent = total;
  }
}

function updateDashboardSubjects() {
  const courses = JSON.parse(localStorage.getItem("subjects")) || [];
  let totalSubjects = 0;

  courses.forEach(course => {
    totalSubjects += course.subjects.length;
  });

  const totalSubjectsElement = document.getElementById("total-subjects");
  if (totalSubjectsElement) {
      totalSubjectsElement.textContent = totalSubjects;
  }
}

  // Semester selection handling
  const semesterSelect = qs('#select-semester');
  semesterSelect.addEventListener('change', renderDashboard);
  renderDashboard();

  // Task handling
  qs('#add-task').addEventListener('click', function(){
    const title = qs('#task-title').value.trim();
    const date = qs('#task-date').value;
    const type = qs('#task-type').value;
    if(!title || !date) { alert('Please provide date and title'); return; }
    const d = getData();
    d.tasks.push({id: Date.now(), title, date, type});
    setData(d);
    qs('#task-title').value = '';
    qs('#task-date').value = '';
    renderTasks();
    renderDashboard();
  });

  renderTasks();

  // Chart: study progress — uses gpaHistory as placeholder progress metric
  const ctx = document.getElementById('progressChart').getContext('2d');
  const chart = new Chart(ctx, {
    type: 'line',
    data: { labels: [], datasets: [{ label: 'GPA', data: [], tension: 0.25, pointRadius: 4 }] },
    options: { scales:{ y:{ min:0, max:4 } } }
  });

  // draw from gpaHistory
  function updateProgressChart(){
    const d = getData();
    const hist = d.gpaHistory || [];
    chart.data.labels = hist.map(h => h.semester || new Date(h.date).toLocaleDateString());
    chart.data.datasets[0].data = hist.map(h => h.gpa);
    chart.update();
  }
  updateProgressChart();

  // refresh dashboard elements
  function renderDashboard(){
    const sem = semesterSelect.value;
    const d = getData();
    const courses = (d.courses && d.courses[sem]) ? d.courses[sem] : [];
    qs('#total-courses').textContent = courses.length;
    const upcoming = (d.tasks || []).filter(t => new Date(t.date) >= startOfToday());
    qs('#upcoming-count').textContent = upcoming.length;
    // Current GPA sample (average of gpaHistory last entry)
    const last = (d.gpaHistory && d.gpaHistory.length>0) ? d.gpaHistory[d.gpaHistory.length-1].gpa : null;
    qs('#current-gpa').textContent = (last===null)? '—' : last.toFixed(2);
    // semester summary text:
    qs('#semester-summary').textContent = `Semester ${sem} — ${courses.length} course(s)`;
  }
}

/* ---------- Tasks rendering ---------- */
function renderTasks(){
  const ulUpcoming = qs('#task-upcoming');
  const ulPast = qs('#task-past');
  if(!ulUpcoming) return;
  ulUpcoming.innerHTML = ''; ulPast.innerHTML = '';
  const d = getData();
  const tasks = (d.tasks || []).sort((a,b)=> new Date(a.date)-new Date(b.date));
  tasks.forEach(task=>{
    const li = document.createElement('li');
    li.className = 'list-group-item';
    const date = new Date(task.date);
    li.innerHTML = `<div class="d-flex justify-content-between">
      <div><strong>${task.title}</strong><div class="small text-muted">${task.type} • ${date.toLocaleDateString()}</div></div>
      <div><button class="btn btn-sm btn-link text-danger remove-task" data-id="${task.id}">Remove</button></div>
    </div>`;
    if(date >= startOfToday()) ulUpcoming.appendChild(li);
    else ulPast.appendChild(li);
  });

  qsa('.remove-task').forEach(btn=>{
    btn.addEventListener('click', (e)=>{
      const id = +e.target.dataset.id;
      const d = getData();
      d.tasks = (d.tasks || []).filter(t=> t.id !== id);
      setData(d);
      renderTasks();
    });
  });
}

function startOfToday(){ const d = new Date(); d.setHours(0,0,0,0); return d; }

/* ---------- Courses page logic ---------- */
function coursesInit(){
  if(!document.getElementById('courses-list')) return;
  const semSelect = qs('#courses-semester');
  semSelect.addEventListener('change', renderCourses);

  qs('#add-course').addEventListener('click', function(){
    const code = qs('#course-code').value.trim();
    const name = qs('#course-name').value.trim();
    const credits = parseFloat(qs('#course-credits').value) || 0;
    if(!code || !name){ alert('Please provide course code and name'); return; }
    const d = getData();
    const sem = semSelect.value;
    d.courses = d.courses || {};
    d.courses[sem] = d.courses[sem] || [];
    const id = 'c' + Date.now();
    d.courses[sem].push({id, code, name, credits});
    setData(d);
    qs('#course-code').value=''; qs('#course-name').value=''; qs('#course-credits').value='3';
    renderCourses();
  });

  // initial render
  renderCourses();
}

function renderCourses(){
  const list = qs('#courses-list');
  const sem = qs('#courses-semester').value;
  const d = getData();
  const courses = (d.courses && d.courses[sem]) ? d.courses[sem] : [];
  list.innerHTML = '';
  if(courses.length===0){
    list.innerHTML = '<div class="text-muted small">No courses for this semester yet.</div>';
    return;
  }
  courses.forEach(c=>{
    const row = document.createElement('div');
    row.className = 'list-group-item d-flex justify-content-between align-items-center';
    row.innerHTML = `<div>
      <div><strong>${c.code}</strong> — ${c.name}</div>
      <div class="small text-muted">${c.credits} credits</div>
    </div>
    <div>
      <a class="btn btn-sm btn-outline-maroon view-course" data-id="${c.id}" href="#">View</a>
      <button class="btn btn-sm btn-danger ms-1 remove-course" data-id="${c.id}">Delete</button>
    </div>`;
    list.appendChild(row);
  });

  qsa('.remove-course').forEach(btn=>{
    btn.addEventListener('click', (e)=>{
      const id = e.target.dataset.id;
      const d = getData();
      const sem = qs('#courses-semester').value;
      d.courses[sem] = (d.courses[sem]||[]).filter(x=> x.id !== id);
      setData(d);
      renderCourses();
    });
  });

  qsa('.view-course').forEach(a=>{
    a.addEventListener('click', (e)=>{
      e.preventDefault();
      const id = e.target.dataset.id;
      // store chosen courseId and go to course details page
      sessionStorage.setItem('viewCourseId', id);
      window.location.href = 'course-details.html';
    });
  });
}

/* ---------- Course details logic ---------- */
function courseDetailsInit(){
  if(!document.getElementById('resources-list')) return;
  const d = getData();
  const courseId = sessionStorage.getItem('viewCourseId');
  if(!courseId) {
    qs('#course-header').innerHTML = `<h4 class="maroon">Course</h4><p class="text-muted small">No course selected. Go to Courses and click View.</p>`;
    return;
  }

  // find course meta
  let courseMeta = null;
  const courses = d.courses || {};
  for(const sem in courses){
    const found = (courses[sem]||[]).find(c=> c.id === courseId);
    if(found) { courseMeta = found; break; }
  }
  if(!courseMeta){
    qs('#course-header').innerHTML = `<h4 class="maroon">Course</h4><p class="text-muted small">Course not found.</p>`;
    return;
  }
  qs('#course-header').innerHTML = `<h4 class="maroon">${courseMeta.code} — ${courseMeta.name}</h4>
    <p id="course-meta" class="text-muted small">${courseMeta.credits} credits</p>`;

  // render resources
  function renderResources(){
    const resources = d.resources || {};
    const list = qs('#resources-list');
    const arr = (resources[courseId]||[]).sort((a,b)=> b.date - a.date);
    if(arr.length===0) list.innerHTML = '<li class="list-group-item small text-muted">No resources yet.</li>';
    else{
      list.innerHTML = '';
      arr.forEach(r=>{
        const li = document.createElement('li');
        li.className = 'list-group-item';
        li.innerHTML = `<div class="d-flex justify-content-between">
          <div>
            <strong>${r.type}</strong> — ${r.title} 
            <div class="small text-muted">${(r.url)? `<a href="${r.url}" target="_blank">Open</a>` : ''}</div>
          </div>
          <div><button class="btn btn-sm btn-danger remove-resource" data-id="${r.id}">Remove</button></div>
        </div>`;
        list.appendChild(li);
      });
      qsa('.remove-resource').forEach(btn=>{
        btn.addEventListener('click', (e)=>{
          const id = +e.target.dataset.id;
          d.resources[courseId] = (d.resources[courseId]||[]).filter(x=> x.id !== id);
          setData(d);
          renderResources();
        });
      });
    }
  }

  renderResources();

  qs('#add-resource').addEventListener('click', ()=>{
    const type = qs('#resource-type').value;
    const title = qs('#resource-title').value.trim();
    const url = qs('#resource-url').value.trim();
    if(!title){ alert('Please add a title.'); return; }
    d.resources = d.resources || {};
    d.resources[courseId] = d.resources[courseId] || [];
    d.resources[courseId].push({id: Date.now(), type, title, url, date: Date.now()});
    setData(d);
    qs('#resource-title').value = ''; qs('#resource-url').value = '';
    renderResources();
  });
}

/* ---------- Summary / GPA logic ---------- */
function summaryInit(){
  if(!document.getElementById('gpa-rows')) return;
  const rowsContainer = qs('#gpa-rows');
  const calcBtn = qs('#calc-gpa');
  const addRowBtn = qs('#add-gpa-row');
  const result = qs('#calculated-gpa');

  function addRow(grade='', credits='3'){
    const id = 'gpa' + Date.now() + Math.random().toString(36).slice(2,6);
    const div = document.createElement('div');
    div.className = 'd-flex gap-2 align-items-center mb-2';
    div.innerHTML = `<input class="form-control form-control-sm gpa-grade" placeholder="grade (0-4)" value="${grade}" style="width:110px;">
                     <input class="form-control form-control-sm gpa-credits" placeholder="credits" value="${credits}" style="width:100px;">
                     <button class="btn btn-sm btn-outline-maroon remove-gpa-row">Remove</button>`;
    rowsContainer.appendChild(div);
    div.querySelector('.remove-gpa-row').addEventListener('click', ()=> div.remove());
  }

  addRow(); // initial

  addRowBtn.addEventListener('click', ()=> addRow());

  calcBtn.addEventListener('click', ()=>{
    const grades = Array.from(qsa('.gpa-grade')).map(n=>parseFloat(n.value)).filter(x=> !isNaN(x));
    const credits = Array.from(qsa('.gpa-credits')).map(n=>parseFloat(n.value)).filter(x=> !isNaN(x));
    if(grades.length === 0 || credits.length === 0 || grades.length !== credits.length){
      alert('Please provide matching grade and credit values.');
      return;
    }
    let totalWeighted = 0, totalCredits = 0;
    for(let i=0;i<grades.length;i++){
      const g = Math.max(0, Math.min(4, grades[i]));
      const c = Math.max(0, credits[i]);
      totalWeighted += g * c;
      totalCredits += c;
    }
    const gpa = totalCredits ? (totalWeighted / totalCredits) : 0;
    result.textContent = gpa.toFixed(3);

    // store to gpaHistory
    const data = getData();
    data.gpaHistory = data.gpaHistory || [];
    const sem = `Sem ${ (data.gpaHistory.length||0) + 1 }`;
    data.gpaHistory.push({semester: sem, gpa: +gpa.toFixed(3), date: new Date().toISOString() });
    setData(data);
    drawGpaChart();
  });

  // draw chart
  const ctx = qs('#gpaChart').getContext('2d');
  const gpaChart = new Chart(ctx, {
    type: 'bar',
    data: { labels: [], datasets: [{ label: 'GPA', data: [] }] },
    options: { scales: { y: { min: 0, max: 4 } } }
  });

  function drawGpaChart(){
    const data = getData();
    const hist = data.gpaHistory || [];
    gpaChart.data.labels = hist.map(h => h.semester || new Date(h.date).toLocaleDateString());
    gpaChart.data.datasets[0].data = hist.map(h => h.gpa);
    gpaChart.update();
  }
  drawGpaChart();
}

/* ---------- Initialize pages conditionally ---------- */
document.addEventListener('DOMContentLoaded', () => {
  dashboardInit();
  coursesInit();
  courseDetailsInit();
  summaryInit();
});
