 
 
//  function validateStudent() {
//     const studentId = document.getElementById('student-id').value.trim();
//     const messageEl = document.getElementById('validation-message');
//     const pointsEl = document.getElementById('points');
//     const registerDiv = document.getElementById("register");

//     messageEl.textContent = "";
//     pointsEl.textContent = "";
//     registerDiv.innerHTML = "";

//     // קודם בודקים אם התלמיד קיים
//     getStudent(studentId, function(studentData) {
//         if (!studentData) {
//             messageEl.textContent = 'התלמיד לא רשום. נא להירשם תחילה.';
//             document.getElementById('student-id').value = "";

//             const newElement = document.createElement("a");
//             newElement.textContent = "להרשמה📝";
//             newElement.style.textDecoration = "none";
//             newElement.style.color = "#007bff";
//             newElement.href = "register.html";
//             registerDiv.appendChild(newElement);
//             return;
//         }

       
// // בודקים טווח זמן
//     const now = new Date();
//     const startTime = new Date(now);
//     startTime.setHours(7, 35, 0, 0);
//     const endTime = new Date(now);
//     endTime.setHours(9, 0, 0, 0);
//     const startTime2 = new Date(now);
//     startTime2.setHours(19, 10, 0, 0);
//     const endTime2 = new Date(now);
//     endTime2.setHours(21, 10, 0, 0);

//     if (!(now >= startTime && now <= endTime || now >= startTime2 && now <= endTime2)) {
//         messageEl.textContent = "תיקוף אפשרי רק בין השעות 07:35-09:00 ומ19:10-21:10";
//         return;
//     }

//         // עכשיו עושים תיקוף (כניסה/יציאה)
//         validateEntry(studentId,startTime,endTime,startTime2,endTime2, function(result) {
//             if (!result) {
//                 messageEl.textContent = "שגיאה בתיקוף";
//                 return;
//             }

//             // result = "added" או "updated"
//             const actionText = result === "added" ? "תודה שנכנסת" : "יצאת בהצלחה";
//             messageEl.textContent = `שלום, ${studentData.name}, ${actionText} 🎉`;

//             // אפקט רקע
//             document.body.style.backgroundColor = '#d4edda';
//             setTimeout(() => {
//                 document.body.style.backgroundColor = '#f5f5f5';
//             }, 1500);

//             // נצנצים
//             for (let i = 0; i < 20; i++) {
//                 const sparkle = document.createElement('div');
//                 sparkle.classList.add('sparkle');
//                 sparkle.style.left = Math.random() * window.innerWidth + 'px';
//                 sparkle.style.top = (window.innerHeight / 2 + Math.random() * 100 - 50) + 'px';
//                 document.body.appendChild(sparkle);
//                 setTimeout(() => sparkle.remove(), 800);
//             }
//         });
//     });
// }

//  // function validateStudent() {
//   //         const studentId = document.getElementById('student-id').value.trim();
//   //         const messageEl = document.getElementById('validation-message');
//   //         const pointsEl = document.getElementById('points');
//   //         let studentData
//   //       getStudent(studentId, function(studentData2) {
//   //   if (!studentData2) {
//   //       messageEl.textContent = 'התלמיד לא רשום. נא להירשם תחילה.';
//   //        document.getElementById('student-id').value = "";
      
//   //           const newElement = document.createElement("a");
//   //           newElement.textContent = "להרשמה📝";
//   //           newElement.style.textDecoration = "none";
//   //           newElement.style.color = "#007bff";
//   //           newElement.href = "register.html";
//   //           registerDiv.appendChild(newElement);
      
//   //           return;
//   //   }
//   // })
//   //         console.log(studentId);
          
//   //         const registerDiv = document.getElementById("register");
      
//   //         messageEl.textContent = "";
//   //         pointsEl.textContent = "";
//   //         registerDiv.innerHTML = ""; // נקה קישורים קודמים
      
//   //         // בדיקת קיום התלמיד
//   //         // if (!studentData) {
//   //         //   messageEl.textContent = 'התלמיד לא רשום. נא להירשם תחילה.';
//   //         //   document.getElementById('student-id').value = "";
      
//   //         //   const newElement = document.createElement("a");
//   //         //   newElement.textContent = "להרשמה📝";
//   //         //   newElement.style.textDecoration = "none";
//   //         //   newElement.style.color = "#007bff";
//   //         //   newElement.href = "register.html";
//   //         //   registerDiv.appendChild(newElement);
      
//   //         //   return;
//   //         // }
      
//   //         // בדיקת טווח זמן
//   //         const now = new Date();
//   //         const startTime = new Date(now);
//   //         startTime.setHours(7, 40, 0, 0);
//   //         const endTime = new Date(now);
//   //         endTime.setHours(9, 0, 0, 0);
//   //         const startTime2 = new Date(now);
//   //         startTime2.setHours(19, 0, 0, 0);
//   //         const endTime2 = new Date(now);
//   //         endTime2.setHours(22, 30, 0, 0);
//   //         if (!(now >= startTime && now <=endTime||now >= startTime2 && now <=endTime2)) {
//   //               messageEl.textContent = "תיקוף אפשרי רק בין השעות 07:40 עד  07:45. ומ19:00 עד 21:10";
//   //               return;
//   //         }

//   //         // if (now < startTime2 || now > endTime) {
//   //         //   messageEl.textContent = "תיקוף אפשרי רק בין השעות 19:00 עד 21:10";
//   //         //   return;
//   //         // }
      
//   //       //   const student = JSON.parse(studentData);
//   //       //   const todayStr = now.toISOString().split('T')[0]; // תאריך בפורמט YYYY-MM-DD
      
//   //       //   // בדיקת האם תוקף כבר היום
//   //       //   if (student.lastValidationDate === todayStr) {
//   //       //     messageEl.textContent = "כבר ביצעת תיקוף היום. ניתן לתקף פעם אחת בלבד.";
//   //       //     return;
//   //       //   }
//   //           //בדיקת יציאה/כניסה
            
          
//   //         // תיקוף תקף

//   //       validateEntry(studentId)

//   //           // אם השעה עכשיו היא בדיוק או אחרי אחד מהסופים
//   //   // if ((now.getHours() === endTime.getHours() && now.getMinutes() === endTime.getMinutes()) ||
//   //   //     (now.getHours() === endTime2.getHours() && now.getMinutes() === endTime2.getMinutes())) {
        
//   //   //     // קריאה לפונקציה שמוחקת את EntryExit
//   //   //     clearEntryExit(); // <- זו הפונקציה שלך ב-db.js
//   //   // }
//   //         // student.points += 10;
//   //         // student.lastValidationDate = todayStr;
//   //         // localStorage.setItem(studentId, JSON.stringify(student));
      
//   //         messageEl.textContent = `שלום, ${data.name}, התווספו 10 נקודות 🎉`;
//   //         // pointsEl.textContent = `מספר הנקודות שלך הוא: ${student.points}`;
//   //         // document.getElementById('student-id').value = "";
          
//   //         // רקע ירוק קצר
//   //         document.body.style.backgroundColor = '#d4edda';
//   //         setTimeout(() => {
//   //           document.body.style.backgroundColor = '#f5f5f5';
//   //         }, 1500);
      
//   //         // נצנצים
//   //         for (let i = 0; i < 20; i++) {
//   //           const sparkle = document.createElement('div');
//   //           sparkle.classList.add('sparkle');
//   //           sparkle.style.left = Math.random() * window.innerWidth + 'px';
//   //           sparkle.style.top = (window.innerHeight / 2 + Math.random() * 100 - 50) + 'px';
//   //           document.body.appendChild(sparkle);
//   //           setTimeout(() => sparkle.remove(), 800);
//   //         }
//   //       }