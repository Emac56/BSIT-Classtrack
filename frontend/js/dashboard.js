async function renderDashboard() {
  const c = document.getElementById('page-dashboard');
  const user = getUser();
  if (!user || !user.section_id) { c.innerHTML = noSectionHTML(); return; }
  c.innerHTML = loadingHTML();
  try {
    const d = await api.dashboard(user.section_id);
    const today = d.today_sessions || [];
    const presentToday = today.reduce((s,t) => s + parseInt(t.present_count||0), 0);
    const absentToday = today.reduce((s,t) => s + parseInt(t.absent_count||0), 0);
    const totalToday = presentToday + absentToday;
    const collTarget = parseFloat(user.collection_target || 0);
    const collPct = collTarget > 0 ? Math.min(100, Math.round((d.monthly_collected / collTarget) * 100)) : 0;

    const alertsHTML = (() => {
      const alerts = [];
      if (today.length === 0) alerts.push(`<div style="padding:8px 12px;background:var(--amber-light);border:1px solid var(--amber);border-radius:8px;font-size:.8rem;color:var(--amber)">⚠️ No attendance taken today yet. <a href="#" onclick="navigate('attendance');return false" style="color:var(--amber);font-weight:700">Take Attendance →</a></div>`);
      if (d.students_unpaid > 0) alerts.push(`<div style="padding:8px 12px;background:var(--red-light);border:1px solid var(--red);border-radius:8px;font-size:.8rem;color:var(--red)">💰 ${d.students_unpaid} student${d.students_unpaid>1?'s':''} have unpaid fees. <a href="#" onclick="navigate('fees');return false" style="color:var(--red);font-weight:700">View Fees →</a></div>`);
      if (d.at_risk && d.at_risk.length > 0) alerts.push(`<div style="padding:8px 12px;background:var(--red-light);border:1px solid var(--red);border-radius:8px;font-size:.8rem;color:var(--red)">🔴 ${d.at_risk.length} student${d.at_risk.length>1?'s':''} at risk (3+ absences).</div>`);
      return alerts.length ? `<div style="display:flex;flex-direction:column;gap:6px;margin-bottom:16px">${alerts.join('')}</div>` : '';
    })();

    const annHTML = d.announcements && d.announcements.length > 0 ? d.announcements.slice(0,3).map(a => `
      <div class="ann-card priority-${a.priority||'normal'}" style="margin-bottom:6px">
        <div class="ann-title">${esc(a.title)}</div>
        ${a.due_date ? `<div class="ann-meta"><span>📅 Due: ${fmtDate(a.due_date)}</span></div>` : ''}
      </div>`).join('') : '<div class="empty-state" style="padding:20px"><span class="empty-icon" style="font-size:1.5rem">📢</span><p>No announcements</p></div>';

    const logsHTML = d.recent_logs && d.recent_logs.length > 0 ? d.recent_logs.map(l => `
      <div class="activity-item">
        <div class="activity-dot"></div>
        <div class="activity-text">${esc(l.action)}</div>
        <div class="activity-time">${fmtTime(l.created_at)}</div>
      </div>`).join('') : '<div class="text-muted text-sm" style="padding:10px 0">No recent activity</div>';

    c.innerHTML = `
      <div style="margin-bottom:18px" class="animate">
        <h1 style="font-size:1.3rem;font-weight:800">Welcome, ${esc(user.full_name.split(' ')[0])}! 👋</h1>
        <p class="text-sm text-muted">${esc(user.section_name||'')} ${user.school_year?'— '+esc(user.school_year):''}</p>
      </div>

      ${alertsHTML}

      <div class="stats-grid animate animate-delay-1">
        <div class="stat-card">
          <div class="stat-icon si-blue">👥</div>
          <div><div class="stat-val">${d.total_students}</div><div class="stat-label">Total Students</div></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon si-green">✅</div>
          <div><div class="stat-val">${presentToday}</div><div class="stat-label">Present Today</div></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon si-red">❌</div>
          <div><div class="stat-val">${absentToday}</div><div class="stat-label">Absent Today</div></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon si-amber">💰</div>
          <div><div class="stat-val" style="font-size:1.1rem">${peso(d.monthly_collected)}</div><div class="stat-label">Collected This Month</div></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon si-green">📅</div>
          <div><div class="stat-val" style="font-size:1.1rem">${peso(d.collected_today||0)}</div><div class="stat-label">Collected Today</div></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon si-blue">📆</div>
          <div><div class="stat-val" style="font-size:1.1rem">${peso(d.collected_week||0)}</div><div class="stat-label">This Week</div></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon si-purple">🗓️</div>
          <div><div class="stat-val" style="font-size:1.1rem">${peso(d.collected_year||0)}</div><div class="stat-label">This Year</div></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon si-purple">⚠️</div>
          <div><div class="stat-val">${d.students_unpaid}</div><div class="stat-label">Students Unpaid</div></div>
        </div>
      </div>

      ${collTarget > 0 ? `<div class="card animate animate-delay-2 mb-5">
        <div class="card-body">
          <div style="display:flex;justify-content:space-between;margin-bottom:8px">
            <span style="font-size:.84rem;font-weight:700">Collection Progress</span>
            <span style="font-size:.82rem;color:var(--text2)">${peso(d.monthly_collected)} / ${peso(collTarget)}</span>
          </div>
          <div class="progress-wrap">
            <div class="progress-bar ${collPct>=100?'green':'primary'}" style="width:${collPct}%"></div>
          </div>
          <div style="font-size:.72rem;color:var(--text3);margin-top:5px">${collPct}% of monthly target</div>
        </div>
      </div>` : ''}

      <div class="two-col animate animate-delay-3">
        <div class="card">
          <div class="card-header">
            <h2>⚡ Quick Attendance</h2>
            ${today.length === 0 ? `<button class="btn btn-primary btn-sm" onclick="openQuickAttendance()">Start Session</button>` : `<button class="btn btn-outline btn-sm" onclick="navigate('attendance')">View All</button>`}
          </div>
          <div class="card-body">
            ${today.length === 0
              ? `<div class="empty-state" style="padding:16px">
                  <span class="empty-icon">📋</span>
                  <h3>No attendance today</h3>
                  <p>Start a session to mark attendance.</p>
                  <button class="btn btn-primary" style="margin-top:10px" onclick="openQuickAttendance()">📋 Quick Attendance</button>
                </div>`
              : today.map(s => `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)">
                  <span class="text-sm">${fmtDate(s.date)}${s.subject?' — '+esc(s.subject):''}</span>
                  <div style="display:flex;gap:6px"><span class="badge badge-present">${s.present_count||0} Present</span><span class="badge badge-absent">${s.absent_count||0} Absent</span></div>
                </div>`).join('')
            }
          </div>
        </div>

        <div class="card">
          <div class="card-header"><h2>📰 Announcements</h2><button class="btn btn-outline btn-sm" onclick="navigate('announcements')">View All</button></div>
          <div class="card-body" style="padding:12px 16px">${annHTML}</div>
        </div>
      </div>

      <div class="two-col animate animate-delay-4" style="margin-top:16px">
        <div class="card">
          <div class="card-header"><h2>🕐 Recent Activity</h2></div>
          <div class="card-body">${logsHTML}</div>
        </div>

        ${d.at_risk && d.at_risk.length > 0 ? `<div class="card">
          <div class="card-header"><h2>🔴 At Risk Students</h2><span class="text-sm text-muted">3+ absences</span></div>
          <div class="tbl-wrap"><table>
            <thead><tr><th>Student</th><th>Absences</th></tr></thead>
            <tbody>${d.at_risk.map(s => `<tr>
              <td><strong>${esc(s.last_name)}, ${esc(s.first_name)}</strong></td>
              <td><span class="badge badge-absent">${s.absent_count}</span></td>
            </tr>`).join('')}</tbody>
          </table></div>
        </div>` : `<div class="card"><div class="card-body"><div class="empty-state" style="padding:20px"><span class="empty-icon">🎉</span><h3>No at-risk students</h3><p>All students have good attendance!</p></div></div></div>`}
      </div>`;
  } catch(e) { c.innerHTML = `<div class="empty-state"><span class="empty-icon">❌</span><h3>Error loading dashboard</h3><p>${esc(e.message)}</p></div>`; }
}

async function openQuickAttendance() {
  const user = getUser();
  if (!user || !user.section_id) return;
  openModal('⚡ Quick Attendance', `
    <div class="form-grid" style="margin-bottom:14px">
      <div class="form-group"><label>Date</label><input type="date" id="qaDate" value="${todayISO()}"></div>
      <div class="form-group"><label>Subject / Period</label><input type="text" id="qaSubject" placeholder="e.g. Advisory, Math"></div>
    </div>
    <div style="display:flex;justify-content:flex-end;gap:6px">
      <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="startQuickAtt()">▶ Start</button>
    </div>`);
}

async function startQuickAtt() {
  const date = document.getElementById('qaDate').value;
  const subject = document.getElementById('qaSubject').value;
  const user = getUser();
  try {
    const res = await api.createSession({ section_id: user.section_id, date, subject, _user: { id: user.id, name: user.full_name } });
    closeModal();
    navigate('attendance');
    setTimeout(() => openSessionEditor(res.data.id), 200);
  } catch(e) { toast(e.message, 'error'); }
}
