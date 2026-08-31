document.addEventListener('deviceready', function() {
    // נעילת מסך על portrait

    // הפעלה מסך מלא
    cordova.plugins.fullscreen.enter();

    // מניעת מצב שינה
    cordova.plugins.backgroundMode.enable();

    // חסימת חזרה אחורה עם קוד
    window.onpopstate = function(event) {
        var userCode = prompt("אנא הזן את הקוד לצורך יציאה");
        if (userCode === "23273") {
            console.log("הקוד נכון, ניתן לצאת");
            // כאן אפשר להוסיף פעולה נוספת אם רוצים
        } else {
            console.log("הקוד לא נכון, נשארים באפליקציה");
            history.pushState(null, null, location.href); // מונע חזרה אחורה
        }
    };
}, false);

let topStudentsRenderToken = 0;

function showTopStudents(stage = getCurrentStage()) {
    if (!db) return;

    const token = ++topStudentsRenderToken;
    const transaction = db.transaction(['Students', 'ValidateHistory'], 'readonly');
    const studentsStore = transaction.objectStore('Students');
    const historyStore = transaction.objectStore('ValidateHistory');

    studentsStore.getAll().onsuccess = function(evt) {
        if (token !== topStudentsRenderToken) return;

        const students = evt.target.result;
        const listEl = document.getElementById("top-students-list");
        if (!listEl) return;
        listEl.innerHTML = "";

        const activeStage = normalizeStage(stage || getCurrentStage());

        if (!activeStage) {
            students.sort((a, b) => b.hours - a.hours);
            const top3 = students.slice(0, 5);

            top3.forEach(student => {
                const formattedTime = formatTime(student.hours);
                const li = document.createElement("li");
                li.textContent = `🏆 ${student.name} - ${formattedTime}`;
                listEl.appendChild(li);
            });
            return;
        }

        const studentsWithStageHours = [];
        let processed = 0;

        students.forEach(student => {
            const index = historyStore.index('studentId');
            const range = IDBKeyRange.only(student.uid);
            index.getAll(range).onsuccess = function(hEvt) {
                if (token !== topStudentsRenderToken) return;

                const histories = hEvt.target.result;
                const totalStageHours = histories
                    .filter(h => h.stage === activeStage)
                    .reduce((sum, h) => {
                        if (h.EndHour && h.StartHour) {
                            return sum + (new Date(h.EndHour) - new Date(h.StartHour)) / (1000 * 60 * 60);
                        }
                        return sum;
                    }, 0);

                studentsWithStageHours.push({ name: student.name, hours: totalStageHours });
                processed++;

                if (processed === students.length) {
                    studentsWithStageHours.sort((a, b) => b.hours - a.hours);
                    const top3 = studentsWithStageHours.slice(0, 5);
                    top3.forEach(s => {
                        const formattedTime = formatTime(s.hours);
                        const li = document.createElement("li");
                        li.textContent = `🏆 ${s.name} - ${formattedTime}`;
                        listEl.appendChild(li);
                    });
                }
            };
        });
    };

    studentsStore.getAll().onerror = function() {
        console.error("לא הצלחנו לשלוף את הסטודנטים");
    };
}

request = indexedDB.open('dbValidate', 3);
request.onsuccess = function(event) {
    db = event.target.result;
    window.showTopStudents = showTopStudents;
    showTopStudents(getCurrentStage());
}

// קוראים לפונקציה לאחר שה־db מוכן

/////////////////////
 
 
 function validateStudent() {
    const studentId = document.getElementById('student-id').value.trim();
    const messageEl = document.getElementById('validation-message');
    const messageEl2 = document.getElementById('validation-message2');
    const pointsEl = document.getElementById('points');
    const registerDiv = document.getElementById("register");

    messageEl.textContent = "";
    messageEl2.textContent = "";
    pointsEl.textContent = "";
    registerDiv.innerHTML = "";

    getStudent(studentId, function(studentData) {
        document.getElementById('student-id').value = "";

        if (!studentData) {
            messageEl2.textContent = 'התלמיד לא רשום. נא להירשם תחילה.';
            return;
        }

        getAttendanceSettings(function(settings) {
            const now = new Date();
            const studentType = normalizeStudentType(studentData.studentType || studentData.institution);

            if (!canStudentValidate(studentData, now, settings)) {
                messageEl2.textContent = `לא מורשה לתיקוף בשעה זו — ${getStudentTypeLabel(studentType)}`;
                return;
            }

            validateEntry(studentId, settings, function(result) {
                if (!result || !result.ok) {
                    messageEl.textContent = 'שגיאה בתיקוף';
                    return;
                }

                const actionText = result.action === 'added' ? 'תודה שנכנסת' : 'יצאת בהצלחה';
                const typeText = getStudentTypeLabel(studentType);
                messageEl.innerHTML = `
                    <div class="validation-bubble">
                        <div class="validation-line validation-greeting">שלום ${studentData.name}</div>
                        <div class="validation-line validation-type">${typeText}</div>
                        <div class="validation-line validation-action">${actionText}</div>
                    </div>
                `;
                messageEl2.textContent = typeText;

                if (result.action === 'updated' && result.lotteryEligible) {
                    evaluateLotteryForStudent(studentId, studentData, function(lotteryResult) {
                        if (lotteryResult && lotteryResult.won) {
                            messageEl.innerHTML = `
                                <div class="validation-bubble validation-bubble--win">
                                    <div class="validation-line validation-greeting">שלום ${studentData.name}</div>
                                    <div class="validation-line validation-type">${typeText}</div>
                                    <div class="validation-line validation-action">${actionText}</div>
                                    <div class="validation-line validation-prize"><span class="gift-icon">🎁</span> זכית ב-${lotteryResult.prize}</div>
                                </div>
                            `;
                            messageEl2.textContent = `זכייה: ${lotteryResult.prize}`;
                        }
                    });
                }

                setTimeout(() => {
                    messageEl.textContent = "";
                    messageEl2.textContent = "";
                }, 2000);

                const overlay = document.createElement('div');
                overlay.className = 'validation-overlay';
                overlay.style.backgroundColor = result.action === 'added' ? 'rgba(137, 218, 62, 0.81)' : 'rgba(13, 0, 255, 0.81)';
                overlay.style.zIndex = '9997';
                overlay.style.pointerEvents = 'none';
                document.body.appendChild(overlay);
                void overlay.offsetWidth;
                overlay.style.opacity = '1';
                setTimeout(() => {
                    overlay.style.opacity = '0';
                    setTimeout(() => overlay.remove(), 700);
                }, 1500);

                const sparkleCount = 40;
                for (let i = 0; i < sparkleCount; i++) {
                    const sparkle = document.createElement('div');
                    sparkle.classList.add('sparkle');
                    sparkle.style.left = Math.random() * window.innerWidth + 'px';
                    sparkle.style.top = (window.innerHeight / 2 + Math.random() * 100 - 50) + 'px';
                    sparkle.style.animationDuration = 0.5 + Math.random() * 0.8 + 's';
                    sparkle.style.zIndex = '9998';
                    sparkle.style.pointerEvents = 'none';
                    document.body.appendChild(sparkle);
                    setTimeout(() => sparkle.remove(), 1000);
                }
            });
        });
    });
}



/////////
// document.addEventListener("DOMContentLoaded", () => {
//     const input = document.getElementById("student-id");

//     // תמיד ישאר בפוקוס
//     input.focus();
// let validateTimeout;
// input.addEventListener("input", () => {
//     clearTimeout(validateTimeout);
//     const val = input.value.trim();
//     if (val.length > 0) {
//         validateTimeout = setTimeout(() => validateStudent(), 200); // 100ms דיליי קטן
//     }
// });

  
// });

document.addEventListener("DOMContentLoaded", () => {
    const input = document.getElementById("student-id");

    // שומר על פוקוס תמיד
    const forceFocus = () => setTimeout(() => input.focus(), 10);
    forceFocus();
    input.addEventListener("blur", forceFocus);

    let buffer = "";
    let lastTime = 0;
    let processTimeout;

    // מאזין גם לג’אווהסקריפט רגיל (input) וגם ל-keydown (הכרחי לטאבלט)
    input.addEventListener("input", () => {
        // אם כן מגיע input – נשתמש בו
        const val = input.value.trim();
        if (val.length === 0) return;

        clearTimeout(processTimeout);
        processTimeout = setTimeout(() => {
            validateStudent(val);
            input.value = "";
        }, 60);
    });

    // גיבוי: מאזין ל-keydown (לטאבלטים שרק זה עובד)
    document.addEventListener("keydown", e => {
        const now = Date.now();
        const isScan = (now - lastTime < 40); // סריקה רציפה
        lastTime = now;

        buffer = isScan ? buffer + e.key : e.key;

        clearTimeout(processTimeout);
        processTimeout = setTimeout(() => {
            if (buffer.length > 2) { 
                validateStudent(buffer);
            }
            buffer = "";
            input.value = "";
        }, 60);
    });
});


 // function validateStudent() {
  //         const studentId = document.getElementById('student-id').value.trim();
  //         const messageEl = document.getElementById('validation-message');
  //         const pointsEl = document.getElementById('points');
  //         let studentData
  //       getStudent(studentId, function(studentData2) {
  //   if (!studentData2) {
  //       messageEl.textContent = 'התלמיד לא רשום. נא להירשם תחילה.';
  //        document.getElementById('student-id').value = "";
      
  //           const newElement = document.createElement("a");
  //           newElement.textContent = "להרשמה📝";
  //           newElement.style.textDecoration = "none";
  //           newElement.style.color = "#007bff";
  //           newElement.href = "register.html";
  //           registerDiv.appendChild(newElement);
      
  //           return;
  //   }
  // })
  //         console.log(studentId);
          
  //         const registerDiv = document.getElementById("register");
      
  //         messageEl.textContent = "";
  //         pointsEl.textContent = "";
  //         registerDiv.innerHTML = ""; // נקה קישורים קודמים
      
  //         // בדיקת קיום התלמיד
  //         // if (!studentData) {
  //         //   messageEl.textContent = 'התלמיד לא רשום. נא להירשם תחילה.';
  //         //   document.getElementById('student-id').value = "";
      
  //         //   const newElement = document.createElement("a");
  //         //   newElement.textContent = "להרשמה📝";
  //         //   newElement.style.textDecoration = "none";
  //         //   newElement.style.color = "#007bff";
  //         //   newElement.href = "register.html";
  //         //   registerDiv.appendChild(newElement);
      
  //         //   return;
  //         // }
      
  //         // בדיקת טווח זמן
  //         const now = new Date();
  //         const startTime = new Date(now);
  //         startTime.setHours(7, 40, 0, 0);
  //         const endTime = new Date(now);
  //         endTime.setHours(9, 0, 0, 0);
  //         const startTime2 = new Date(now);
  //         startTime2.setHours(19, 0, 0, 0);
  //         const endTime2 = new Date(now);
  //         endTime2.setHours(22, 30, 0, 0);
  //         if (!(now >= startTime && now <=endTime||now >= startTime2 && now <=endTime2)) {
  //               messageEl.textContent = "תיקוף אפשרי רק בין השעות 07:40 עד  07:45. ומ19:00 עד 21:10";
  //               return;
  //         }

  //         // if (now < startTime2 || now > endTime) {
  //         //   messageEl.textContent = "תיקוף אפשרי רק בין השעות 19:00 עד 21:10";
  //         //   return;
  //         // }
      
  //       //   const student = JSON.parse(studentData);
  //       //   const todayStr = now.toISOString().split('T')[0]; // תאריך בפורמט YYYY-MM-DD
      
  //       //   // בדיקת האם תוקף כבר היום
  //       //   if (student.lastValidationDate === todayStr) {
  //       //     messageEl.textContent = "כבר ביצעת תיקוף היום. ניתן לתקף פעם אחת בלבד.";
  //       //     return;
  //       //   }
  //           //בדיקת יציאה/כניסה
            
          
  //         // תיקוף תקף

  //       validateEntry(studentId)

  //           // אם השעה עכשיו היא בדיוק או אחרי אחד מהסופים
  //   // if ((now.getHours() === endTime.getHours() && now.getMinutes() === endTime.getMinutes()) ||
  //   //     (now.getHours() === endTime2.getHours() && now.getMinutes() === endTime2.getMinutes())) {
        
  //   //     // קריאה לפונקציה שמוחקת את EntryExit
  //   //     clearEntryExit(); // <- זו הפונקציה שלך ב-db.js
  //   // }
  //         // student.points += 10;
  //         // student.lastValidationDate = todayStr;
  //         // localStorage.setItem(studentId, JSON.stringify(student));
      
  //         messageEl.textContent = `שלום, ${data.name}, התווספו 10 נקודות 🎉`;
  //         // pointsEl.textContent = `מספר הנקודות שלך הוא: ${student.points}`;
  //         // document.getElementById('student-id').value = "";
          
  //         // רקע ירוק קצר
  //         document.body.style.backgroundColor = '#d4edda';
  //         setTimeout(() => {
  //           document.body.style.backgroundColor = '#f5f5f5';
  //         }, 1500);
      
  //         // נצנצים
  //         for (let i = 0; i < 20; i++) {
  //           const sparkle = document.createElement('div');
  //           sparkle.classList.add('sparkle');
  //           sparkle.style.left = Math.random() * window.innerWidth + 'px';
  //           sparkle.style.top = (window.innerHeight / 2 + Math.random() * 100 - 50) + 'px';
  //           document.body.appendChild(sparkle);
  //           setTimeout(() => sparkle.remove(), 800);
  //         }
  //       }