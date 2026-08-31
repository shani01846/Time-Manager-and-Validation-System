let kbTarget = null;

// פונקציה לפתיחת המקלדת ושמירת השדה שנבחר
function kbOpen(inputEl) {
    kbTarget = inputEl;
    document.getElementById('custom-keyboard').style.display = 'block';
}

// פונקציה לסגירת המקלדת
function kbClose() {
    document.getElementById('custom-keyboard').style.display = 'none';
    kbTarget = null;
}

// פונקציה לביצוע ההקלדה בפועל
function kbPress(val) {
    if (!kbTarget) return;
    if (val === 'back') {
        kbTarget.value = kbTarget.value.slice(0, -1);
    } else {
        kbTarget.value += val;
    }
}

// חיבור השדות למקלדת ברגע שהדף נטען
document.addEventListener("DOMContentLoaded", () => {
    const nameInput = document.getElementById('student-name');
    const idInput = document.getElementById('student-id-reg');

    // פתיחת מקלדת בלחיצה על השדות
    nameInput.addEventListener('focus', () => kbOpen(nameInput));
    idInput.addEventListener('focus', () => kbOpen(idInput));

    // סגירת המקלדת כשלוחצים מחוץ למקלדת או מחוץ לשדות
    document.addEventListener('click', (e) => {
        const kb = document.getElementById('custom-keyboard');
        if (kb && !kb.contains(e.target) && e.target !== nameInput && e.target !== idInput) {
            kbClose();
        }
    });
});
function registerStudent() {

            const studentName = document.getElementById('student-name').value.trim();
            const studentId = document.getElementById('student-id-reg').value.trim();
            const institution = document.querySelector('input[name="institution"]:checked').value;
            const messageEl = document.getElementById('registration-message');
            
            if (studentName === '' || studentId === '') {
                messageEl.textContent = 'יש למלא את כל השדות.';
                return;
            }
            
            // if (localStorage.getItem(studentId)) {
            //     messageEl.textContent = 'תלמיד עם מזהה זה כבר רשום.';
            //     return;
            // }
            
            addStudent(studentName, studentId,institution, function(res) {
                   if (!res) {
                    messageEl.style.color = "red";
                      messageEl.textContent = 'בעיה בהרשמה';
                    return;
              } })  
                    messageEl.style.color="rgb(1, 188, 1)"
            messageEl.textContent = `התלמיד ${studentName} נרשם בהצלחה עם מזהה ${studentId}!`;
            document.getElementById('student-name').value=""
            document.getElementById('student-id-reg').value=""
   
        }