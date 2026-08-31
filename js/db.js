///////////
//testing 
function formatTime(msOrHours, isMilliseconds = false) {
    let totalSeconds = isMilliseconds
        ? Math.floor(msOrHours / 1000)
        : Math.floor(msOrHours * 3600);

    const h = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
    const s = (totalSeconds % 60).toString().padStart(2, '0');

    return `${h}:${m}:${s}`;
}
let STAGE = 'A';

const STAGE_SEQUENCE = ['A', 'B', 'C', 'D'];

function normalizeStage(stage) {
    const normalized = String(stage || 'A').trim().toUpperCase();
    return STAGE_SEQUENCE.includes(normalized) ? normalized : 'A';
}

function getCurrentStage() {
    return normalizeStage(STAGE);
}

function loadCurrentStage(callback) {
    if (!db) {
        STAGE = 'A';
        if (callback) callback(STAGE);
        return;
    }

    const transaction = db.transaction(['Settings'], 'readonly');
    const request = transaction.objectStore('Settings').get('currentStage');

    request.onsuccess = function(event) {
        const savedStage = event.target.result && event.target.result.value ? event.target.result.value : 'A';
        STAGE = normalizeStage(savedStage);
        if (callback) callback(STAGE);
    };

    request.onerror = function() {
        STAGE = 'A';
        if (callback) callback(STAGE);
    };
}

function refreshStageDependentViews() {
    if (typeof showTopStudents === 'function') {
        showTopStudents(getCurrentStage());
    }
}

function saveCurrentStage(stage, callback) {
    const normalizedStage = normalizeStage(stage);
    STAGE = normalizedStage;

    if (!db) {
        refreshStageDependentViews();
        if (callback) callback(true);
        return;
    }

    const transaction = db.transaction(['Settings'], 'readwrite');
    const store = transaction.objectStore('Settings');
    const request = store.put({ key: 'currentStage', value: normalizedStage });

    request.onsuccess = function() {
        refreshStageDependentViews();
        if (callback) callback(true);
    };

    request.onerror = function() {
        if (callback) callback(false);
    };
}

function advanceCurrentStage(callback) {
    const current = getCurrentStage();
    const currentIndex = STAGE_SEQUENCE.indexOf(current);
    const nextStage = STAGE_SEQUENCE[Math.min(currentIndex + 1, STAGE_SEQUENCE.length - 1)];
    saveCurrentStage(nextStage, callback);
}

const DEFAULT_ATTENDANCE_SETTINGS = {
    mechina: {
        morningStart: '07:35',
        morningEnd: '09:10',
        eveningStart: '19:10',
        eveningEnd: '21:10',
        specialStart: '17:00',
        specialEnd: '18:10',
        enabled: true
    },
    yeshiva: {
        morningStart: '07:35',
        morningEnd: '09:10',
        eveningStart: '19:10',
        eveningEnd: '21:10',
        specialStart: '17:00',
        specialEnd: '18:10',
        enabled: true
    }
};

const DEFAULT_LOTTERY_SETTINGS = {
    winChance: 0.33,
    prizes: [
        { threshold: 10, label: 'כרטיספר 5 שח', quantity: 1 }
    ],
    tiers: {
        10: 'כרטיספר 5 שח'
    }
};

function normalizePrizeEntry(entry) {
    if (!entry || typeof entry !== 'object') return null;

    const threshold = Number(entry.threshold ?? entry.hours ?? 0);
    const label = String(entry.label ?? entry.name ?? '').trim();
    const quantity = Number(entry.quantity ?? entry.count ?? entry.items ?? 1);

    if (!Number.isFinite(threshold) || threshold <= 0 || !label) {
        return null;
    }

    return {
        threshold: Math.round(threshold),
        label,
        quantity: Number.isFinite(quantity) && quantity > 0 ? Math.max(1, Math.round(quantity)) : 1
    };
}

function sanitizePrizeList(list) {
    const unique = new Map();

    (Array.isArray(list) ? list : [])
        .map(normalizePrizeEntry)
        .filter(Boolean)
        .forEach(item => {
            const key = `${String(item.threshold)}|${String(item.label).trim().toLowerCase()}`;
            const existing = unique.get(key);

            if (!existing || item.quantity > existing.quantity) {
                unique.set(key, item);
            }
        });

    return Array.from(unique.values())
        .sort((a, b) => Number(a.threshold) - Number(b.threshold));
}

function buildPrizeTiers(prizes) {
    return Object.fromEntries(
        sanitizePrizeList(prizes).map(item => [String(item.threshold), item.label])
    );
}

function normalizeLotterySettings(rawSettings) {
    const defaults = JSON.parse(JSON.stringify(DEFAULT_LOTTERY_SETTINGS));
    const legacyTiers = rawSettings && rawSettings.tiers && typeof rawSettings.tiers === 'object' ? rawSettings.tiers : null;
    const rawPrizes = Array.isArray(rawSettings && rawSettings.prizes) ? rawSettings.prizes : [];

    let prizeList = sanitizePrizeList(rawPrizes);

    if (!prizeList.length && legacyTiers) {
        prizeList = sanitizePrizeList(Object.entries(legacyTiers).map(([threshold, label]) => ({
            threshold,
            label,
            quantity: 1
        })));
    }

    // רק השתמש בברירת המחדל אם rawSettings היא undefined/null (כלומר אין הגדרות בכלל)
    // אם rawSettings קיימת, אפשר מערך ריק של מתנות
    if (!prizeList.length && !rawSettings) {
        prizeList = sanitizePrizeList(defaults.prizes);
    }

    return {
        winChance: Number(rawSettings && rawSettings.winChance != null ? rawSettings.winChance : defaults.winChance),
        prizes: prizeList,
        tiers: buildPrizeTiers(prizeList)
    };
}

function getLotteryPrizeForHours(totalHours, settings) {
    const normalized = normalizeLotterySettings(settings || DEFAULT_LOTTERY_SETTINGS);
    const prize = [...normalized.prizes]
        .reverse()
        .find(item => Number(totalHours) >= Number(item.threshold));
    return prize || null;
}

function getAvailableLotteryPrizeForHours(totalHours, settings, existingRecords) {
    const normalized = normalizeLotterySettings(settings || DEFAULT_LOTTERY_SETTINGS);
    const counts = {};

    (existingRecords || []).forEach(record => {
        const label = String(record && record.prize ? record.prize : '').trim();
        if (!label) return;
        counts[label] = (counts[label] || 0) + 1;
    });

    const sortedPrizes = [...normalized.prizes].sort((a, b) => Number(b.threshold) - Number(a.threshold));
    const prize = sortedPrizes.find(item => {
        const threshold = Number(item.threshold || 0);
        const quantity = Number(item.quantity || 1);
        const label = String(item.label || '').trim();

        if (Number(totalHours) < threshold) return false;
        if (!label) return false;
        return (counts[label] || 0) < quantity;
    });

    return prize || null;
}

function normalizeStudentType(value) {
    const cleaned = String(value || '').trim().toLowerCase();
    if (['mechina', 'mekhina', 'preparatory', 'prep', 'מכינה'].includes(cleaned)) return 'mechina';
    if (['yeshiva', 'ישיבה'].includes(cleaned)) return 'yeshiva';
    return 'yeshiva';
}

function getDefaultAttendanceSettings() {
    return JSON.parse(JSON.stringify(DEFAULT_ATTENDANCE_SETTINGS));
}

function getAttendanceSettings(callback) {
    if (!db) {
        if (callback) callback(getDefaultAttendanceSettings());
        return;
    }

    const transaction = db.transaction(['Settings'], 'readonly');
    const store = transaction.objectStore('Settings');
    const request = store.get('attendance');

    request.onsuccess = function(event) {
        const saved = event.target.result;
        const settings = saved && saved.value ? saved.value : getDefaultAttendanceSettings();
        if (callback) callback(settings);
    };

    request.onerror = function() {
        if (callback) callback(getDefaultAttendanceSettings());
    };
}

function getLotterySettings(callback) {
    if (!db) {
        if (callback) callback(JSON.parse(JSON.stringify(DEFAULT_LOTTERY_SETTINGS)));
        return;
    }

    const transaction = db.transaction(['Settings'], 'readonly');
    const store = transaction.objectStore('Settings');
    const request = store.get('lottery');

    request.onsuccess = function(event) {
        const saved = event.target.result;
        const settings = saved && saved.value ? saved.value : JSON.parse(JSON.stringify(DEFAULT_LOTTERY_SETTINGS));
        if (callback) callback(normalizeLotterySettings(settings));
    };

    request.onerror = function() {
        if (callback) callback(JSON.parse(JSON.stringify(DEFAULT_LOTTERY_SETTINGS)));
    };
}

function saveAttendanceSettings(settings, callback) {
    if (!db) {
        if (callback) callback(false);
        return;
    }

    const safeSettings = settings || getDefaultAttendanceSettings();
    const transaction = db.transaction(['Settings'], 'readwrite');
    const store = transaction.objectStore('Settings');
    const request = store.put({ key: 'attendance', value: safeSettings });

    request.onsuccess = function() {
        if (callback) callback(true);
    };

    request.onerror = function() {
        if (callback) callback(false);
    };
}

function saveLotterySettings(settings, callback) {
    if (!db) {
        if (callback) callback(false);
        return;
    }

    const safeSettings = normalizeLotterySettings(settings || JSON.parse(JSON.stringify(DEFAULT_LOTTERY_SETTINGS)));
    const transaction = db.transaction(['Settings'], 'readwrite');
    const store = transaction.objectStore('Settings');
    const request = store.put({ key: 'lottery', value: safeSettings });

    request.onsuccess = function() {
        if (callback) callback(true);
    };

    request.onerror = function() {
        if (callback) callback(false);
    };
}

function canStudentValidate(student, now, settings) {
    if (!student || !now) return false;

    const studentType = normalizeStudentType(student.studentType || student.institution);
    const typeSettings = (settings && settings[studentType]) || getDefaultAttendanceSettings()[studentType];

    if (!typeSettings || typeSettings.enabled === false) {
        return false;
    }

    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const ranges = [
        ['morningStart', 'morningEnd'],
        ['eveningStart', 'eveningEnd'],
        ['specialStart', 'specialEnd']
    ];

    return ranges.some(([startKey, endKey]) => {
        const startMinutes = toMinutes(typeSettings[startKey]);
        const endMinutes = toMinutes(typeSettings[endKey]);
        return isWithinTimeRange(nowMinutes, startMinutes, endMinutes);
    });
}

function toMinutes(time) {
    if (!time || typeof time !== 'string') return 0;
    const [hours, minutes] = time.split(':').map(Number);
    return (hours || 0) * 60 + (minutes || 0);
}

function isWithinTimeRange(currentMinutes, startMinutes, endMinutes) {
    if (startMinutes <= endMinutes) {
        return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
    }
    return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
}

function getTimeRangeNameForMinutes(minutes, typeSettings) {
    if (!typeSettings) return null;

    const ranges = [
        { name: 'morning', start: toMinutes(typeSettings.morningStart), end: toMinutes(typeSettings.morningEnd) },
        { name: 'evening', start: toMinutes(typeSettings.eveningStart), end: toMinutes(typeSettings.eveningEnd) },
        { name: 'special', start: toMinutes(typeSettings.specialStart), end: toMinutes(typeSettings.specialEnd) }
    ];

    return ranges.find(({ start, end }) => isWithinTimeRange(minutes, start, end))?.name || null;
}

function getStudentTypeLabel(type) {
    return type === 'mechina' ? 'תלמיד מכינה' : 'תלמיד ישיבה';
}

//functions:////



function showFloatingDivWithImage(num) {
    // יצירת הדיב
//     const div = document.createElement('div');
    
//     // הוספת קלאס לדיב
    
//     div.classList.add('floating-div');
    
    
//     // הוספת תוכן לדיב (טקסט)

// if(num==60)
// div.id = 'myFloatingDiv60';
// else if(num==50)
// div.id = 'myFloatingDiv50';
// else if(num==40)
// div.id = 'showGoal';
// else if(num==30)
// div.id = 'myFloatingDiv30';
// else if(num==20)
// div.id = 'showGift';
// else if(num==10)
// div.id = 'myFloatingDiv10';



//     // הוספת הדיב לדף
//     document.body.appendChild(div);

//     // מחיקה של הדיב אחרי 3 שניות
//     setTimeout(() => {
//         div.remove();
//     }, 3000);
}



////////
/////////
const MIN_LOTTERY_EXIT_MINUTES = 70
function logLotteryStep(step, details = {}) {
    console.log(`[הגרלה] ${step}`, details);
}

function logRaffleDecision(studentId, studentName, eligible, reason, details = {}) {
    const status = eligible ? '✅ נכנס להגרלה' : '❌ לא נכנס להגרלה';
    const nameText = studentName ? `${studentName} (${studentId})` : `UID: ${studentId}`;
    console.log(`[הגרלה] ${status} | תלמיד: ${nameText} | סיבה: ${reason}`, details);
}

let db;

// פתיחת מסד הנתונים
// גרסה חדשה: מוחק את כל הנתונים הקיימים כדי לחייב הרשמה מחדש
let request = indexedDB.open('dbValidate', 3);

// טיפול ביצירת הטבלאות בעת שדרוג DB
request.onupgradeneeded = function(event) {
    db = event.target.result;

    const createIfMissing = (storeName, factory) => {
        if (!db.objectStoreNames.contains(storeName)) {
            factory();
        }
    };

    createIfMissing('Students', () => {
        const studentsStore = db.createObjectStore('Students', { keyPath: 'id', autoIncrement: true });
        studentsStore.createIndex('name', 'name', { unique: false });
        studentsStore.createIndex('uid', 'uid', { unique: true });
        studentsStore.createIndex('hours', 'hours', { unique: false });
        studentsStore.createIndex('institution', 'institution', { unique: false });
        studentsStore.createIndex('studentType', 'studentType', { unique: false });
    });

    createIfMissing('ValidateHistory', () => {
        const validateHistoryStore = db.createObjectStore('ValidateHistory', { keyPath: 'id', autoIncrement: true });
        validateHistoryStore.createIndex('studentId', 'studentId', { unique: false });
        validateHistoryStore.createIndex('StartHour', 'StartHour', { unique: false });
        validateHistoryStore.createIndex('EndHour', 'EndHour', { unique: false });
        validateHistoryStore.createIndex('IsDirector', 'IsDirector', { unique: false });
        validateHistoryStore.createIndex('stage', 'stage', { unique: false });
    });

    createIfMissing('EntryExit', () => {
        const entryExitStore = db.createObjectStore('EntryExit', { keyPath: 'id', autoIncrement: true });
        entryExitStore.createIndex('studentId', 'studentId', { unique: false });
        entryExitStore.createIndex('Hour', 'Hour', { unique: false });
    });

    createIfMissing('Settings', () => {
        const settingsStore = db.createObjectStore('Settings', { keyPath: 'key' });
        settingsStore.createIndex('key', 'key', { unique: true });
    });

    createIfMissing('LotteryHistory', () => {
        const lotteryHistoryStore = db.createObjectStore('LotteryHistory', { keyPath: 'id', autoIncrement: true });
        lotteryHistoryStore.createIndex('studentId', 'studentId', { unique: false });
        lotteryHistoryStore.createIndex('tier', 'tier', { unique: false });
        lotteryHistoryStore.createIndex('createdAt', 'createdAt', { unique: false });
    });
};

// DB פתוח בהצלחה
request.onsuccess = function(event) {
    db = event.target.result;
    loadCurrentStage(function() {
        refreshStageDependentViews();
        if (typeof renderLotteryHistory === 'function') {
            renderLotteryHistory();
        }
    });
    console.log('DB פתוח בהצלחה');
};

// DB נכשלה
request.onerror = function(event) {
    console.error('שגיאה בפתיחת DB:', event.target.error);
};

// ---------------------------
// פונקציות
// ---------------------------
function deleteStudent(id, callback) {
  if (!db) {
    if (callback) callback(false, "לא הצלחנו לגשת לבסיס הנתונים");
    return;
  }

  const transaction = db.transaction(['Students'], 'readwrite');
  const objectStore = transaction.objectStore('Students');
  const index = objectStore.index('uid');

  // חיפוש לפי ה-UID
  const keyToFind = id; // הUID שאתה רוצה למחוק
  const getRequest = index.get(keyToFind);

  getRequest.onsuccess = function() {
    const record = getRequest.result;
    
    if (record) {
      // אם מצאנו את הרשומה, מוחקים אותה
      const deleteRequest = objectStore.delete(record.id);
      
      deleteRequest.onsuccess = function() {
        console.log("הרשומה נמחקה בהצלחה!");
        if (callback) callback(true); // מחזירים true במקרה של הצלחה
      };

      deleteRequest.onerror = function() {
        console.log("אירעה שגיאה במהלך המחיקה.");
        if (callback) callback(false, "אירעה שגיאה במהלך המחיקה");
      };
    } else {
      console.log("לא נמצא UID כזה.");
      if (callback) callback(false, "לא נמצא UID כזה");
    }
  };

  getRequest.onerror = function() {
    console.log("אירעה שגיאה במהלך החיפוש.");
    if (callback) callback(false, "אירעה שגיאה במהלך החיפוש");
  };
}



function addStudent(name, id, institution, callback) {
    if (!db) { if (callback) callback(false); return; }
    console.log(name, id, institution);

    const normalizedType = normalizeStudentType(institution);
    const transaction = db.transaction(['Students'], 'readwrite');
    const store = transaction.objectStore('Students');

    const addRequest = store.add({
        name: name,
        uid: id,
        hours: 0,
        institution: institution,
        studentType: normalizedType
    });

    addRequest.onsuccess = function() {
        console.log(`התלמיד ${name} עם מזהה ${id} נוסף בהצלחה`);
        if (callback) callback(true);
    };

    addRequest.onerror = function(event) {
        console.error('שגיאה בהוספת תלמיד:', event.target.error);
        if (callback) callback(false);
    };
}

function updateStudent(id, hours, minutes, callback) {
    const cleanId = String(id || '').trim();
    const cleanHours = Number(hours || 0);
    const cleanMinutes = Number(minutes || 0);

    if (!cleanId || !Number.isFinite(cleanHours) || !Number.isFinite(cleanMinutes)) {
        console.error('[admin] updateStudent failed: invalid id/hours/minutes', { id, hours, minutes });
        if (callback) callback(null);
        return;
    }

    if (!db) {
        console.error('[admin] updateStudent failed: db not ready');
        if (callback) callback(null);
        return;
    }

    const addHours = cleanHours + (cleanMinutes / 60);
    const transaction = db.transaction(['Students', 'ValidateHistory'], 'readwrite');
    const studentStore = transaction.objectStore('Students');
    const historyStore = transaction.objectStore('ValidateHistory');
    const index = studentStore.index('uid');
    const request = index.get(cleanId);

    request.onsuccess = function(event) {
        const student = event.target.result;
        if (!student) {
            console.warn('[admin] updateStudent: student not found', { id: cleanId });
            if (callback) callback(null);
            return;
        }

        student.hours = Number(student.hours || 0) + addHours;
        const updateRequest = studentStore.put(student);

        updateRequest.onsuccess = function() {
            console.log('[admin] points added', {
                studentId: cleanId,
                hours: cleanHours,
                minutes: cleanMinutes,
                addedHours: addHours,
                updatedTotalHours: student.hours
            });

            const now = new Date();
            const historyRecord = {
                studentId: cleanId,
                StartHour: now,
                EndHour: new Date(now.getTime() + (cleanHours * 60 * 60 * 1000) + (cleanMinutes * 60 * 1000)),
                stage: getCurrentStage(),
                IsDirector: true
            };

            const historyRequest = historyStore.add(historyRecord);
            historyRequest.onsuccess = function() {
                console.log('[admin] points history added', { studentId: cleanId, record: historyRecord });
                if (callback) callback('ok');
            };
            historyRequest.onerror = function(e) {
                console.error('[admin] failed to add points history', { studentId: cleanId, error: e.target.error });
                if (callback) callback(null);
            };
        };

        updateRequest.onerror = function(e) {
            console.error('[admin] failed to update student hours', { studentId: cleanId, error: e.target.error });
            if (callback) callback(null);
        };
    };

    request.onerror = function(e) {
        console.error('[admin] failed to load student for update', { studentId: cleanId, error: e.target.error });
        if (callback) callback(null);
    };
}

function getAllHistory() {
    return new Promise((resolve, reject) => {
        if (!db) { resolve([]); return; }
        const transaction = db.transaction(['ValidateHistory'], 'readonly');
        const store = transaction.objectStore('ValidateHistory');
        const request = store.getAll();
        request.onsuccess = function(event) {
            resolve(event.target.result); // מחזיר מערך הסטוריית תיקופים
        };

        request.onerror = function() {
            resolve([]); // מחזיר מערך ריק במקרה של שגיאה
        };
    });
}

function getAllStudents() {
    return new Promise((resolve, reject) => {
        if (!db) { resolve([]); return; }
        const transaction = db.transaction(['Students'], 'readonly');
        const store = transaction.objectStore('Students');
        const request = store.getAll();

        request.onsuccess = function(event) {
            resolve(event.target.result); // מחזיר מערך תלמידים
        };

        request.onerror = function() {
            resolve([]); // מחזיר מערך ריק במקרה של שגיאה
        };
    });
}

function getStudent(id, callback) {
    if (!db) { if (callback) callback(null); return; }
    const transaction = db.transaction(['Students'], 'readwrite');
    const store = transaction.objectStore('Students');
    const index = store.index('uid');
    const request = index.get(id);

    request.onsuccess = function(event) {
        
        if (callback) callback(event.target.result);

    };
    request.onerror = function() {
        
        if (callback) callback(null);
    };
}

function validateEntry(id, attendanceSettings, callback) {
    if (!db) { if (callback) callback(null); return; }

    const effectiveSettings = attendanceSettings || getDefaultAttendanceSettings();
    const transaction = db.transaction(['Students', 'EntryExit', 'ValidateHistory'], 'readwrite');
    const studentsStore = transaction.objectStore('Students');
    const entryExitStore = transaction.objectStore('EntryExit');
    const historyStore = transaction.objectStore('ValidateHistory');

    const studentRequest = studentsStore.index('uid').get(id);
    studentRequest.onsuccess = function(evt) {
        const student = evt.target.result;
        if (!student) {
            if (callback) callback(null);
            return;
        }

        const studentType = normalizeStudentType(student.studentType || student.institution);
        const typeSettings = effectiveSettings[studentType] || effectiveSettings.mechina || getDefaultAttendanceSettings()[studentType];
        const now = new Date();

        if (!canStudentValidate(student, now, effectiveSettings)) {
            if (callback) callback({
                ok: false,
                message: `לא מורשה לתיקוף בשלב ${getStudentTypeLabel(studentType)} בשעה זו`,
                studentType
            });
            return;
        }

        const entryRequest = entryExitStore.index('studentId').get(id);

        entryRequest.onsuccess = function(event) {
            const entry = event.target.result;
            const now = new Date();

            if (entry) {
                const studentRequest = studentsStore.index('uid').get(id);
                studentRequest.onsuccess = function(evt) {
                    const student = evt.target.result;
                    if (!student) { if (callback) callback(null); return; }
                    let studentHours = 0;

                    getTotalHours(student.uid, STAGE)
                        .then(hours => {
                            studentHours = parseFloat(hours.toFixed(1));
                            if (studentHours >= 40 && studentHours <= 42) showFloatingDivWithImage(40);
                            else if (studentHours >= 20 && studentHours <= 22) showFloatingDivWithImage(20);
                        })
                        .catch(err => console.error('שגיאה בקבלת שעות:', err));

                    const entryTime = new Date(entry.Hour);
                    const isYesterday = entryTime.toDateString() !== now.toDateString();
                    const typeSettings = effectiveSettings[studentType] || effectiveSettings.mechina || getDefaultAttendanceSettings()[studentType];
                    const currentMinutes = now.getHours() * 60 + now.getMinutes();
                    const entryMinutes = entryTime.getHours() * 60 + entryTime.getMinutes();
                    const currentRangeName = getTimeRangeNameForMinutes(currentMinutes, typeSettings);
                    const entryRangeName = getTimeRangeNameForMinutes(entryMinutes, typeSettings);
                    const invalidEntry = isYesterday || (entryRangeName && (!currentRangeName || entryRangeName !== currentRangeName));

                    if (invalidEntry) {
                        logLotteryStep('Entry invalidated, resetting session before raffle check', {
                            studentId: id,
                            studentName: student.name,
                            isYesterday,
                            currentRangeName,
                            entryRangeName,
                            entryTime: entryTime.toISOString(),
                            now: now.toISOString(),
                            stage: STAGE
                        });

                        entryExitStore.delete(entry.id).onsuccess = function() {
                            const historyIndex = historyStore.index('studentId');
                            historyIndex.getAll(id).onsuccess = function(hEvt) {
                                const histories = hEvt.target.result;
                                histories.filter(h => h.EndHour === null).forEach(h => historyStore.delete(h.id));
                                const addRequest = entryExitStore.add({ studentId: id, Hour: now });
                                addRequest.onsuccess = function() {
                                    const historyRequest = historyStore.add({
                                        studentId: id,
                                        StartHour: now,
                                        EndHour: null,
                                        stage: STAGE
                                    });
                                    historyRequest.onsuccess = function() { if (callback) callback({ ok: true, action: 'added' }); };
                                    historyRequest.onerror = function() { if (callback) callback(null); };
                                };
                                addRequest.onerror = function() { if (callback) callback(null); };
                            };
                        };
                        entryExitStore.delete(entry.id).onerror = function() { if (callback) callback(null); };
                        return;
                    }

                    const diffInMinutes = (now - entryTime) / (1000 * 60);
                    const diffInHours = diffInMinutes / 60;
                    const minimumRequiredHours = MIN_LOTTERY_EXIT_MINUTES / 60;
                    const lotteryEligible = diffInMinutes >= MIN_LOTTERY_EXIT_MINUTES;

                    logLotteryStep('בדיקת זמן יציאה לפני כניסה להגרלה', {
                        studentId: id,
                        studentName: student.name,
                        entryTime: entryTime.toISOString(),
                        exitTime: now.toISOString(),
                        diffInMinutes: Number(diffInMinutes.toFixed(2)),
                        diffInHours: Number(diffInHours.toFixed(2)),
                        minimumRequiredMinutes: MIN_LOTTERY_EXIT_MINUTES,
                        minimumRequiredHours: Number(minimumRequiredHours.toFixed(2)),
                        lotteryEligible
                    });

                    if (!lotteryEligible) {
                        logRaffleDecision(id, student.name, false, `זמן היציאה קצר מדי: ${Number(diffInMinutes.toFixed(2))} דקות, נדרש לפחות ${MIN_LOTTERY_EXIT_MINUTES} דקות`, {
                            diffInMinutes: Number(diffInMinutes.toFixed(2)),
                            requiredMinutes: MIN_LOTTERY_EXIT_MINUTES,
                            stage: STAGE
                        });
                    } else {
                        logRaffleDecision(id, student.name, true, `עבר את זמן המינימום להגרלה (${Number(diffInMinutes.toFixed(2))} דקות)`, {
                            diffInMinutes: Number(diffInMinutes.toFixed(2)),
                            requiredMinutes: MIN_LOTTERY_EXIT_MINUTES,
                            stage: STAGE
                        });
                    }

                    student.hours += diffInHours;

                    const updateStudentRequest = studentsStore.put(student);
                    updateStudentRequest.onsuccess = function() {
                        entryExitStore.delete(entry.id).onsuccess = function() {
                            const historyIndex = historyStore.index('studentId');
                            const historyQuery = historyIndex.getAll(id);
                            historyQuery.onsuccess = function(hEvt) {
                                const histories = hEvt.target.result;
                                const openHistory = histories.reverse().find(h => h.EndHour === null);
                                if (openHistory) {
                                    openHistory.EndHour = now;
                                    historyStore.put(openHistory).onsuccess = function() { if (callback) callback({ ok: true, action: 'updated', lotteryEligible }); };
                                    historyStore.put(openHistory).onerror = function() { if (callback) callback(null); };
                                } else {
                                    historyStore.add({
                                        studentId: id,
                                        StartHour: entryTime,
                                        EndHour: now,
                                        stage: STAGE
                                    }).onsuccess = function() { if (callback) callback({ ok: true, action: 'updated', lotteryEligible }); };
                                    historyStore.add({
                                        studentId: id,
                                        StartHour: entryTime,
                                        EndHour: now,
                                        stage: STAGE
                                    }).onerror = function() { if (callback) callback(null); };
                                }
                            };
                            historyQuery.onerror = function() { if (callback) callback(null); };
                        };
                    };
                    updateStudentRequest.onerror = function() { if (callback) callback(null); };
                };
            } else {
                const addRequest = entryExitStore.add({ studentId: id, Hour: now });
                addRequest.onsuccess = function() {
                    const historyRequest = historyStore.add({
                        studentId: id,
                        StartHour: now,
                        EndHour: null,
                        stage: STAGE
                    });
                    historyRequest.onsuccess = function() { if (callback) callback({ ok: true, action: 'added' }); };
                    historyRequest.onerror = function() { if (callback) callback(null); };
                };
                addRequest.onerror = function() { if (callback) callback(null); };
            }
        };

        entryRequest.onerror = function() { if (callback) callback(null); };
    };

    studentRequest.onerror = function() { if (callback) callback(null); };
}
function clearEntryExit() {
    if (!db) return;
    const transaction = db.transaction(['EntryExit'], 'readwrite'); 
    const store = transaction.objectStore('EntryExit'); 
    const clearRequest = store.clear();

    clearRequest.onsuccess = function() {
        console.log("טבלת EntryExit נמחקה בהצלחה");
    };

    clearRequest.onerror = function(event) {
        console.error("שגיאה במחיקת EntryExit:", event.target.error);
    };
}

function getStudentLotteryHistory(studentId, callback) {
    if (!db) {
        if (callback) callback([]);
        return;
    }

    const transaction = db.transaction(['LotteryHistory'], 'readonly');
    const store = transaction.objectStore('LotteryHistory');
    const index = store.index('studentId');
    const request = index.getAll(studentId);

    request.onsuccess = function(event) {
        if (callback) callback(event.target.result || []);
    };

    request.onerror = function() {
        if (callback) callback([]);
    };
}

function deleteLotteryRecord(recordId, callback) {
    if (!db) {
        if (callback) callback(false);
        return;
    }

    const transaction = db.transaction(['LotteryHistory'], 'readwrite');
    const store = transaction.objectStore('LotteryHistory');
    const request = store.delete(Number(recordId));

    request.onsuccess = function() {
        console.log('[lottery] record deleted', { recordId });
        if (callback) callback(true);
    };

    request.onerror = function(e) {
        console.error('[lottery] failed to delete record', { recordId, error: e.target.error });
        if (callback) callback(false);
    };
}

function evaluateLotteryForStudent(studentId, studentData, callback) {
    if (!studentId) {
        logLotteryStep('Lottery evaluation skipped because studentId is missing', { studentId });
        if (callback) callback({ eligible: false, won: false });
        return;
    }

    const stageToUse = normalizeStage(STAGE || getCurrentStage());
    logLotteryStep('Lottery evaluation started', { studentId, studentName: studentData && studentData.name ? studentData.name : '', stage: stageToUse, minimumRequiredMinutes: MIN_LOTTERY_EXIT_MINUTES });

    getTotalHours(studentId, stageToUse)
        .then(totalHours => {
            const requiredHours = MIN_LOTTERY_EXIT_MINUTES / 60;
            logLotteryStep('Stage hours checked for lottery eligibility', {
                studentId,
                stage: stageToUse,
                totalHours,
                requiredHours,
                minimumRequiredMinutes: MIN_LOTTERY_EXIT_MINUTES
            });

            if (Number(totalHours) < requiredHours) {
                logRaffleDecision(studentId, studentData && studentData.name ? studentData.name : '', false, `סך השעות ${Number(totalHours).toFixed(2)}h נמוך מהדרוש ${requiredHours.toFixed(2)}h`, {
                    studentId,
                    stage: stageToUse,
                    totalHours: Number(totalHours).toFixed(2),
                    requiredHours: Number(requiredHours).toFixed(2),
                    reason: 'not enough accumulated time'
                });
                if (callback) callback({ eligible: false, won: false, totalHours, stage: stageToUse, prize: null });
                return;
            }

            const loadLotteryState = () => {
                getLotterySettings(function(settings) {
                    const transaction = db.transaction(['LotteryHistory'], 'readonly');
                    const store = transaction.objectStore('LotteryHistory');
                    const request = store.getAll();

                    request.onsuccess = function(event) {
                        const history = event.target.result || [];
                        const prize = getAvailableLotteryPrizeForHours(totalHours, settings, history);
                        const threshold = prize ? Number(prize.threshold) : null;

                        logLotteryStep('Lottery prize lookup result', {
                            studentId,
                            totalHours,
                            threshold,
                            prize: prize ? prize.label : null,
                            availableHistoryCount: history.length
                        });

                        if (!threshold) {
                            logRaffleDecision(studentId, studentData && studentData.name ? studentData.name : '', false, `הזמן עומד בדרישה, אבל לא הושג סף פרס תקף (${Number(totalHours).toFixed(2)}h)`, {
                                studentId,
                                totalHours: Number(totalHours).toFixed(2),
                                stage: stageToUse,
                                reason: 'prize threshold not reached or all prizes used'
                            });
                            if (callback) callback({ eligible: false, won: false, totalHours, stage: stageToUse, prize: null });
                            return;
                        }

                        const chance = Number(settings.winChance ?? DEFAULT_LOTTERY_SETTINGS.winChance ?? 0.33);
                        const didWin = Math.random() < chance;

                        logLotteryStep('Lottery chance result', {
                            studentId,
                            totalHours,
                            prizeLabel: prize.label,
                            threshold,
                            chance,
                            didWin
                        });

                        if (!didWin) {
                            logRaffleDecision(studentId, studentData && studentData.name ? studentData.name : '', true, `זכה בהגרלה מבחינה זכאות, אך הפסיד בסבירות (${Number(chance * 100).toFixed(1)}%)`, {
                                studentId,
                                totalHours: Number(totalHours).toFixed(2),
                                tier: threshold,
                                prize: null,
                                stage: stageToUse,
                                winChance: chance
                            });
                            if (callback) callback({ eligible: true, won: false, totalHours, tier: threshold, prize: null, stage: stageToUse });
                            return;
                        }

                        const writeTransaction = db.transaction(['LotteryHistory'], 'readwrite');
                        const writeStore = writeTransaction.objectStore('LotteryHistory');
                        const record = {
                            studentId,
                            studentName: studentData && studentData.name ? studentData.name : '',
                            tier: threshold,
                            prize: prize.label,
                            createdAt: new Date().toISOString(),
                            stage: stageToUse
                        };

                        const addRequest = writeStore.add(record);
                        addRequest.onsuccess = function() {
                            logRaffleDecision(studentId, studentData && studentData.name ? studentData.name : '', true, `זכה בפרס: ${prize.label} | סף: ${threshold}`, {
                                studentId,
                                totalHours: Number(totalHours).toFixed(2),
                                tier: threshold,
                                prize: prize.label,
                                stage: stageToUse
                            });
                            if (callback) callback({ eligible: true, won: true, totalHours, tier: threshold, prize: prize.label, stage: stageToUse });
                        };

                        addRequest.onerror = function() {
                            logRaffleDecision(studentId, studentData && studentData.name ? studentData.name : '', true, `היה זכאי, אבל שמירת הפרס נכשלה (${prize.label})`, {
                                studentId,
                                totalHours: Number(totalHours).toFixed(2),
                                tier: threshold,
                                prize: prize.label,
                                stage: stageToUse
                            });
                            if (callback) callback({ eligible: true, won: false, totalHours, tier: threshold, prize: prize.label, stage: stageToUse });
                        };
                    };

                    request.onerror = function() {
                        logLotteryStep('Lottery history load failed', { studentId, stage: stageToUse });
                        if (callback) callback({ eligible: false, won: false, totalHours, stage: stageToUse });
                    };
                });
            };

            if (!db) {
                logLotteryStep('Lottery evaluation aborted because DB is not available', { studentId, stage: stageToUse, totalHours });
                if (callback) callback({ eligible: false, won: false, totalHours, stage: stageToUse });
                return;
            }

            loadLotteryState();
        })
        .catch((error) => {
            logLotteryStep('Lottery evaluation failed while calculating total hours', { studentId, stage: stageToUse, error: error && error.message ? error.message : error });
            if (callback) callback({ eligible: false, won: false, stage: stageToUse });
        });
}

//קבלת שעות לפי שלב לתלמיד
function getTotalHours(studentId, stage = STAGE) {
    return new Promise((resolve, reject) => {
        if (!db) {
            logLotteryStep('getTotalHours aborted because DB is unavailable', { studentId, stage });
            return resolve(0);
        }

        const transaction = db.transaction(['ValidateHistory'], 'readonly');
        const historyStore = transaction.objectStore('ValidateHistory');
        const index = historyStore.index('studentId');
        const range = IDBKeyRange.only(studentId);

        let totalMs = 0;

        index.openCursor(range, 'prev').onsuccess = function(e) {
            const cursor = e.target.result;
            if (!cursor) {
                const totalHours = totalMs / (1000 * 60 * 60);
                logLotteryStep('Total stage hours calculated', {
                    studentId,
                    stage,
                    totalMs,
                    totalHours
                });
                resolve(totalHours);
                return;
            }

            const record = cursor.value;
            if (record.stage === stage) {
                const start = new Date(record.StartHour);
                const end = record.EndHour ? new Date(record.EndHour) : null;
                if (end) {
                    const segmentMs = end - start;
                    totalMs += segmentMs;
                    logLotteryStep('Added time segment to stage total', {
                        studentId,
                        stage,
                        start: start.toISOString(),
                        end: end.toISOString(),
                        segmentMs,
                        runningTotalMs: totalMs
                    });
                }
            }

            cursor.continue();
        };

        index.openCursor(range, 'prev').onerror = function() {
            logLotteryStep('Failed to calculate total hours for student', { studentId, stage });
            reject("שגיאה בקריאת ההיסטוריה");
        };
    });
}

//תלמיד איבד צ'יפ

function changeStudentUid(oldUid, newUid, callback) {
    const cleanOldUid = String(oldUid || '').trim();
    const cleanNewUid = String(newUid || '').trim();

    if (!cleanOldUid || !cleanNewUid) {
        console.error('[admin] changeStudentUid failed: missing UID values', { oldUid, newUid });
        if (callback) callback(false, 'יש להזין מזהה נוכחי ומזהה חדש.');
        return;
    }

    if (cleanOldUid === cleanNewUid) {
        if (callback) callback(false, 'המזהה החדש חייב להיות שונה מהמזהה הנוכחי.');
        return;
    }

    if (!db) {
        console.error('[admin] changeStudentUid failed: db not ready');
        if (callback) callback(false, 'DB עדיין לא פתוח');
        return;
    }

    const transaction = db.transaction(['Students', 'ValidateHistory', 'EntryExit', 'LotteryHistory'], 'readwrite');
    const studentsStore = transaction.objectStore('Students');
    const historyStore = transaction.objectStore('ValidateHistory');
    const entryExitStore = transaction.objectStore('EntryExit');
    const lotteryHistoryStore = transaction.objectStore('LotteryHistory');
    const studentsIndex = studentsStore.index('uid');

    let finished = false;
    const finalizeSuccess = () => {
        if (finished) return;
        finished = true;
        console.log('[admin] UID successfully changed', { from: cleanOldUid, to: cleanNewUid });
        if (callback) callback(true, '✅ המזהה עודכן בהצלחה.');
    };
    const finalizeFailure = (message) => {
        if (finished) return;
        finished = true;
        console.error('[admin] UID change failed', { from: cleanOldUid, to: cleanNewUid, message });
        if (callback) callback(false, message);
    };

    const existingStudentRequest = studentsIndex.get(cleanOldUid);
    existingStudentRequest.onsuccess = function(event) {
        const student = event.target.result;
        if (!student) {
            finalizeFailure('תלמיד עם UID זה לא נמצא.');
            return;
        }

        const duplicateCheckRequest = studentsIndex.get(cleanNewUid);
        duplicateCheckRequest.onsuccess = function(dupEvent) {
            const duplicateStudent = dupEvent.target.result;
            if (duplicateStudent && duplicateStudent.id !== student.id) {
                finalizeFailure('המזהה החדש כבר קיים במערכת.');
                return;
            }

            student.uid = cleanNewUid;
            const updateStudentRequest = studentsStore.put(student);
            updateStudentRequest.onsuccess = function() {
                const updateStoreRecords = (store, indexName, label) => new Promise((resolve, reject) => {
                    const recordsRequest = store.index(indexName).getAll(cleanOldUid);
                    recordsRequest.onsuccess = function(recordsEvent) {
                        const records = recordsEvent.target.result || [];
                        if (!records.length) {
                            resolve();
                            return;
                        }

                        let remaining = records.length;
                        records.forEach(record => {
                            record.studentId = cleanNewUid;
                            const putRequest = store.put(record);
                            putRequest.onsuccess = function() {
                                remaining -= 1;
                                if (remaining <= 0) resolve();
                            };
                            putRequest.onerror = function(err) {
                                reject(err.target ? err.target.error : err);
                            };
                        });
                    };
                    recordsRequest.onerror = function(err) {
                        reject(err.target ? err.target.error : err);
                    };
                });

                Promise.all([
                    updateStoreRecords(historyStore, 'studentId', 'validateHistory'),
                    updateStoreRecords(entryExitStore, 'studentId', 'entryExit'),
                    updateStoreRecords(lotteryHistoryStore, 'studentId', 'lotteryHistory')
                ]).then(() => {
                    finalizeSuccess();
                }).catch((error) => {
                    finalizeFailure('שגיאה בעדכון היסטוריות התלמיד.');
                    console.error('[admin] UID change history update failed', { error });
                });
            };

            updateStudentRequest.onerror = function(err) {
                finalizeFailure('שגיאה בעדכון מזהה התלמיד.');
                console.error('[admin] failed to save updated student UID', { error: err.target ? err.target.error : err });
            };
        };

        duplicateCheckRequest.onerror = function(err) {
            finalizeFailure('שגיאה בבדיקת המזהה החדש.');
            console.error('[admin] failed to check duplicate UID', { error: err.target ? err.target.error : err });
        };
    };

    existingStudentRequest.onerror = function(err) {
        finalizeFailure('שגיאה בחיפוש התלמיד.');
        console.error('[admin] failed to find student by old UID', { error: err.target ? err.target.error : err });
    };

    transaction.onerror = function(err) {
        finalizeFailure('שגיאה בטרנזקציה של עדכון המזהה.');
        console.error('[admin] UID swap transaction failed', { error: err.target ? err.target.error : err });
    };
}

//---------------------------------
//עדכון מזהה ציפ לתלמיד
//----------------------------------
// request.onsuccess = function(event) {
//     db = event.target.result;
//     console.log("DB פתוח בהצלחה");

//     // עכשיו אפשר להשתמש ב־DB בבטחה
//     changeStudentUid("11934252", "16115450", function(success, msg) {
//         if (success) {
//             console.log(msg); // "ה־UID עודכן בהצלחה ב-Students וב-ValidateHistory"
//         } else {
//             console.error(msg);
//         }
//     });
// };

// request.onsuccess = function(event) {
//     db = event.target.result;
//     console.log("DB פתוח בהצלחה");

//     // עכשיו אפשר להשתמש ב־DB בבטחה
//     changeStudentUid("11714852", "17040066", function(success, msg) {
//         if (success) {
//             console.log(msg); // "ה־UID עודכן בהצלחה ב-Students וב-ValidateHistory"
//         } else {
//             console.error(msg);
//         }
//     });
// };





