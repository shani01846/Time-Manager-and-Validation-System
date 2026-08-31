// ==========================
// עזר לפורמט זמן
// ==========================
function formatTime(msOrHours, isMilliseconds = false) {
    let totalSeconds = isMilliseconds
        ? Math.floor(msOrHours / 1000)
        : Math.floor(msOrHours * 3600);

    const h = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
    const s = (totalSeconds % 60).toString().padStart(2, '0');

    return `${h}:${m}:${s}`;
}

// ==========================
// הצגת מידע תלמיד
// ==========================
function renderPrizeHistory(prizeEl, history) {
    if (!prizeEl) return;

    if (!history || history.length === 0) {
        prizeEl.innerHTML = '<div>עדיין לא זכית בפרס</div>';
        return;
    }

    const orderedHistory = [...history].reverse();
    prizeEl.innerHTML = orderedHistory.map((item) => {
        const dateText = item.createdAt ? new Date(item.createdAt).toLocaleString('he-IL') : 'תאריך לא זמין';
        const stageLabel = item.stage ? ` • שלב ${item.stage}` : '';
        const prizeLabel = item.prize || 'פרס';
        return `<div style="margin-bottom: 8px; padding: 8px 10px; background: #fff; border-radius: 6px; border: 1px solid #e8d38a;">${dateText}${stageLabel} — ${prizeLabel}</div>`;
    }).join('');
}

function renderStageHistory(studentId, stage) {
    const tbody = document.getElementById("history-body");
    const totalHoursEl = document.getElementById("total-hours");
    const messageEl = document.getElementById("message");
    const prizeEl = document.getElementById("prize-info");

    if (!studentId) return;

    tbody.innerHTML = "";
    totalHoursEl.textContent = "00:00:00";
    messageEl.textContent = stage ? `הצגת נתונים – שלב ${stage}` : 'הצגת נתונים – שלב נוכחי';
    if (prizeEl) prizeEl.innerHTML = "";

    const transaction = db.transaction(['ValidateHistory'], 'readonly');
    const store = transaction.objectStore('ValidateHistory');
    const index = store.index('studentId');
    const range = IDBKeyRange.only(studentId);
    let totalMs = 0;

    index.openCursor(range, 'prev').onsuccess = function (e) {
        const cursor = e.target.result;
        if (!cursor) {
            totalHoursEl.textContent = formatTime(totalMs, true);
            getStudentLotteryHistory(studentId, function(history) {
                renderPrizeHistory(prizeEl, history);
            });
            return;
        }

        const record = cursor.value;
        if (record.stage === stage) {
            const start = new Date(record.StartHour);
            const end = record.EndHour ? new Date(record.EndHour) : null;

            let duration = "-";
            if (end) {
                const diff = end - start;
                totalMs += diff;
                duration = formatTime(diff, true);
            }

            const row = document.createElement("tr");
            if (record.IsDirector === true) {
                row.style.backgroundColor = "#fff9bbff";
            }

            row.innerHTML = `
                <td>${start.toLocaleString()}</td>
                <td>${end ? end.toLocaleString() : "-"}</td>
                <td>${duration}</td>
            `;

            tbody.appendChild(row);
        }

        cursor.continue();
    };

    index.openCursor(range, 'prev').onerror = function () {
        messageEl.textContent = "שגיאה בטעינת היסטוריית שלב";
    };
}

document.getElementById("get-info").addEventListener("click", () => {
    const studentId = document.getElementById("student-id").value.trim();
    if (!studentId) return;
    renderStageHistory(studentId, getCurrentStage());
});

document.querySelectorAll('.stage-btn').forEach((button) => {
    button.addEventListener('click', () => {
        const studentId = document.getElementById("student-id").value.trim();
        if (!studentId) return;
        renderStageHistory(studentId, button.dataset.stage);
    });
});

function showStageA() { renderStageHistory(document.getElementById("student-id").value.trim(), 'A'); }
function showStageB() { renderStageHistory(document.getElementById("student-id").value.trim(), 'B'); }
function showStageC() { renderStageHistory(document.getElementById("student-id").value.trim(), 'C'); }
function showStageD() { renderStageHistory(document.getElementById("student-id").value.trim(), 'D'); }

