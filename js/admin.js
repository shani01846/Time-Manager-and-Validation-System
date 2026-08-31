let kbTarget = null;
 const ADMIN_PASSWORD = "11937066";

function isNumericKeyboardTarget(inputEl) {
    return !!inputEl && (
        inputEl.id === 'hours' ||
        inputEl.id === 'minutes' ||
        inputEl.classList.contains('lottery-threshold-input') ||
        inputEl.classList.contains('lottery-quantity-input')
    );
}

function isTextKeyboardTarget(inputEl) {
    return !!inputEl && inputEl.classList && inputEl.classList.contains('lottery-label-input');
}

function kbOpen(inputEl) {
    if (!inputEl || (!isNumericKeyboardTarget(inputEl) && !isTextKeyboardTarget(inputEl))) return;

    kbTarget = inputEl;
    const kb = document.getElementById('custom-keyboard');
    if (!kb) return;

    const isNumericMode = isNumericKeyboardTarget(inputEl);
    const numericLayout = kb.querySelector('.keyboard-numeric');
    const lettersLayout = kb.querySelector('.keyboard-letters');

    if (numericLayout) numericLayout.classList.toggle('active', isNumericMode);
    if (lettersLayout) lettersLayout.classList.toggle('active', !isNumericMode);

    kb.style.display = 'block';
    setTimeout(() => {
        if (document.activeElement !== inputEl) {
            inputEl.focus();
        }
    }, 0);
}

function kbClose() {
    const kb = document.getElementById('custom-keyboard');
    if (kb) {
        kb.style.display = 'none';
        kb.querySelectorAll('.keyboard-layout').forEach(layout => layout.classList.remove('active'));
    }
    kbTarget = null;
}

function kbPress(val) {
    if (!kbTarget) return;

    const currentValue = String(kbTarget.value || '');

    if (val === 'back') {
        kbTarget.value = currentValue.slice(0, -1);
        return;
    }

    if (val === ' ') {
        if (isTextKeyboardTarget(kbTarget)) {
            kbTarget.value += ' ';
        }
        return;
    }

    if (isNumericKeyboardTarget(kbTarget)) {
        if (val === '-') {
            if (currentValue.includes('-')) return;
            kbTarget.value = '-' + currentValue.replace(/^-/, '');
            return;
        }

        if (!/^[0-9]$/.test(val)) return;
        if (currentValue === '-' || currentValue === '') {
            kbTarget.value = currentValue + val;
            return;
        }

        kbTarget.value = currentValue + val;
        return;
    }

    if (isTextKeyboardTarget(kbTarget)) {
        kbTarget.value += val;
    }
}

document.addEventListener('click', (e) => {
    const kb = document.getElementById('custom-keyboard');
    const target = e.target;
    if (!kb || !(target instanceof HTMLElement)) return;

    const clickedInsideKeyboard = kb.contains(target);
    const clickedTargetField =
        target.id === 'hours' ||
        target.id === 'minutes' ||
        target.classList.contains('lottery-threshold-input') ||
        target.classList.contains('lottery-quantity-input') ||
        target.classList.contains('lottery-label-input');

    if (!clickedInsideKeyboard && !clickedTargetField) {
        kbClose();
    }
});

function getRootElementById(id, root = getActiveAdminRoot()) {
  if (root && root !== document && root.querySelector) {
    const match = root.querySelector(`#${CSS.escape(id)}`);
    if (match) return match;
  }
  return document.getElementById(id);
}

function loadGiftsPanel() {
  const root = getActiveAdminRoot();
  const container = getRootElementById('gifts-list-container', root);
  const msgEl = getRootElementById('giftsMessage', root);
  if (!container) return;

  container.innerHTML = '<p style="text-align:center;color:#888">טוען...</p>';

  getLotterySettings(function(settings) {
    const prizes = sanitizePrizeList(settings && settings.prizes);
    console.log('[gifts] loadGiftsPanel loaded prizes', prizes);

    if (!prizes.length) {
      container.innerHTML = '<div class="empty-history-state">אין מתנות מוגדרות כרגע</div>';
      if (msgEl) {
        msgEl.textContent = '';
      }
      return;
    }

    container.innerHTML = `
      <div class="gifts-table-wrapper">
        <table class="gifts-table">
          <thead>
            <tr>
              <th>#</th>
              <th>שם מתנה</th>
              <th>סף שעות</th>
              <th>כמות</th>
              <th>פעולה</th>
            </tr>
          </thead>
          <tbody>
            ${prizes.map((prize, i) => `
              <tr class="gift-edit-row" data-index="${i}">
                <td>${i + 1}</td>
                <td>
                  <input type="text" class="gift-label-input" value="${(prize.label || '').replace(/"/g, '&quot;')}">
                </td>
                <td>
                  <input type="number" class="gift-threshold-input" value="${Number(prize.threshold || 0)}" min="1">
                </td>
                <td>
                  <input type="number" class="gift-qty-input" value="${Number(prize.quantity || 1)}" min="1">
                </td>
                <td>
                  <button type="button" class="gift-delete-btn" data-index="${i}">🗑️</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    container.querySelectorAll('.gift-delete-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.index);
        const nextPrizes = sanitizePrizeList(prizes.filter((_, index) => index !== idx));

        getLotterySettings(function(currentSettings) {
          const mergedSettings = {
            ...(currentSettings || DEFAULT_LOTTERY_SETTINGS),
            winChance: Number(currentSettings?.winChance ?? DEFAULT_LOTTERY_SETTINGS.winChance ?? 0.33),
            prizes: nextPrizes,
            tiers: buildPrizeTiers(nextPrizes)
          };

          saveLotterySettings(mergedSettings, (ok) => {
            if (msgEl) {
              msgEl.textContent = ok ? 'נמחק בהצלחה' : 'שגיאה במחיקה';
              msgEl.style.color = ok ? 'green' : 'red';
            }
            if (ok) {
              loadGiftsPanel();
            }
          });
        });
      });
    });
  });
}

function logPrizeArray(label, prizes) {
  const safePrizes = Array.isArray(prizes) ? prizes : [];
  const readable = safePrizes.map((prize, index) => ({
    index: index + 1,
    emoji: Number(prize.quantity || 1) > 1 ? '🎁' : '🏆',
    label: prize.label || 'ללא שם',
    threshold: Number(prize.threshold ?? 0),
    quantity: Number(prize.quantity ?? 1)
  }));

  console.log(`🎁 ${label}`, readable);
  if (readable.length) {
    console.table(readable);
  } else {
    console.log('📭 אין מתנות כרגע במערך');
  }
}

function saveGiftEdits() {
  const root = getActiveAdminRoot();
  const container = getRootElementById('gifts-list-container', root);
  const msgEl = getRootElementById('giftsMessage', root);
  if (!container) return;

  const rows = container.querySelectorAll('.gift-edit-row');
  const parsedPrizes = Array.from(rows)
    .map(row => {
      const label = row.querySelector('.gift-label-input')?.value.trim() || '';
      const threshold = Number(row.querySelector('.gift-threshold-input')?.value ?? 0);
      const quantity = Number(row.querySelector('.gift-qty-input')?.value ?? 1);

      if (!label || !Number.isFinite(threshold) || threshold <= 0) {
        return null;
      }

      return {
        threshold: Math.round(threshold),
        label,
        quantity: Number.isFinite(quantity) && quantity > 0 ? Math.max(1, Math.round(quantity)) : 1
      };
    })
    .filter(Boolean);

  console.log('[gifts] saveGiftEdits start', { rowsCount: rows.length, parsedPrizes });
  logPrizeArray('📦 מערך המתנות לפני שמירה', parsedPrizes);

  getLotterySettings(function(settings) {
    const mergedPrizes = mergePrizeEntries(settings && settings.prizes, parsedPrizes);
    const mergedSettings = {
      ...(settings || DEFAULT_LOTTERY_SETTINGS),
      winChance: Number(settings?.winChance ?? DEFAULT_LOTTERY_SETTINGS.winChance ?? 0.33),
      prizes: mergedPrizes,
      tiers: buildPrizeTiers(mergedPrizes)
    };

    console.log('[gifts] merged settings before save', { base: settings && settings.prizes, incoming: parsedPrizes, mergedPrizes, mergedSettings });
    logPrizeArray('✅ מערך המתנות אחרי מיזוג לפני שמירה', mergedPrizes);

    saveLotterySettings(mergedSettings, (ok) => {
      console.log('[gifts] saveLotterySettings result', { ok, mergedPrizes });
      logPrizeArray('💾 מערך המתנות שנשמר ב-DB', mergedPrizes);
      if (msgEl) {
        msgEl.textContent = ok ? '✅ נשמר בהצלחה' : '❌ שגיאה בשמירה';
        msgEl.style.color = ok ? 'green' : 'red';
      }
      if (ok) {
        loadGiftsPanel();
      }
    });
  });
}

function getAttendanceFieldMap() {
  return {
    mechina: ['mechina-morningStart', 'mechina-morningEnd', 'mechina-eveningStart', 'mechina-eveningEnd', 'mechina-specialStart', 'mechina-specialEnd'],
    yeshiva: ['yeshiva-morningStart', 'yeshiva-morningEnd', 'yeshiva-eveningStart', 'yeshiva-eveningEnd', 'yeshiva-specialStart', 'yeshiva-specialEnd']
  };
}

function loadStageControlToForm() {
  const root = getActiveAdminRoot();
  const select = getManagerField('currentStageSelect', root);
  const label = getManagerField('currentStageLabel', root);
  const stage = getCurrentStage();

  if (select) select.value = stage;
  if (label) label.textContent = stage;
}

function saveCurrentStageFromForm() {
  const root = getActiveAdminRoot();
  const select = getManagerField('currentStageSelect', root);
  const stage = select ? select.value : getCurrentStage();
  saveCurrentStage(stage, function(success) {
    const messageEl = getManagerField('stageMessage', root);
    if (messageEl) {
      messageEl.textContent = success ? `השלב עודכן ל-${stage}.` : 'שגיאה בעדכון שלב.';
      messageEl.style.color = success ? 'green' : 'red';
    }
    loadStageControlToForm();
  });
}

function advanceStageFromManager() {
  const root = getActiveAdminRoot();
  advanceCurrentStage(function(success) {
    const messageEl = getManagerField('stageMessage', root);
    const activeStage = getCurrentStage();
    if (messageEl) {
      messageEl.textContent = success ? `המערכת עברה לשלב ${activeStage}.` : 'שגיאה בהעברת שלב.';
      messageEl.style.color = success ? 'green' : 'red';
    }
    loadStageControlToForm();
  });
}

function createEmptyPrizeRow() {
  return { threshold: '', label: '', quantity: 1 };
}

function mergePrizeEntries(basePrizes, incomingPrizes) {
  const merged = new Map();

  const allEntries = [
    ...(Array.isArray(basePrizes) ? basePrizes : []),
    ...(Array.isArray(incomingPrizes) ? incomingPrizes : [])
  ]
    .map(item => item && typeof item === 'object' ? {
      threshold: Number(item.threshold ?? item.hours ?? 0),
      label: String(item.label ?? item.name ?? '').trim(),
      quantity: Number(item.quantity ?? item.count ?? item.items ?? 1)
    } : null)
    .filter(item => item && Number.isFinite(item.threshold) && item.threshold > 0 && item.label)
    .map(item => ({
      threshold: Math.round(item.threshold),
      label: item.label,
      quantity: Number.isFinite(item.quantity) && item.quantity > 0 ? Math.max(1, Math.round(item.quantity)) : 1
    }));

  allEntries.forEach(item => {
    const key = `${String(item.threshold)}|${String(item.label).trim().toLowerCase()}`;
    const existing = merged.get(key);

    if (!existing || item.quantity > existing.quantity) {
      merged.set(key, item);
    }
  });

  return Array.from(merged.values()).sort((a, b) => Number(a.threshold) - Number(b.threshold));
}

function getDefaultLotteryPrizeRows() {
  return [
    { threshold: 10, label: 'כרטיס 5 שח', quantity: 1 }
  ];
}

function getActiveAdminRoot() {
  const dialog = document.getElementById('adminDialog');
  if (dialog && dialog.classList.contains('open')) {
    return document.getElementById('dialogContent') || document;
  }
  return document;
}

function getManagerField(id, root = getActiveAdminRoot()) {
  if (root && root !== document && root.querySelector) {
    const match = root.querySelector(`#${CSS.escape(id)}`);
    if (match) return match;
  }
  return document.getElementById(id);
}

function getLotteryPrizeContainer() {
  const dialog = document.getElementById('adminDialog');
  if (dialog && dialog.classList.contains('open')) {
    const dialogPrizeRow = dialog.querySelector('#lotteryPrizeRows');
    if (dialogPrizeRow) return dialogPrizeRow;
  }

  return document.querySelector('#lotteryAdminSection #lotteryPrizeRows') || document.getElementById('lotteryPrizeRows');
}

function bindLotteryPrizeControls(root = document) {
  const addPrizeButton = root.querySelector('#addLotteryPrizeBtn');
  if (addPrizeButton) {
    addPrizeButton.onclick = null;
    addPrizeButton.addEventListener('click', () => {
      const container = getLotteryPrizeContainer();
      if (!container) return;
      const rows = Array.from(container.querySelectorAll('.lottery-prize-row')).map(row => ({
        threshold: row.querySelector('.lottery-threshold-input')?.value || '',
        label: row.querySelector('.lottery-label-input')?.value.trim() || '',
        quantity: Number(row.querySelector('.lottery-quantity-input')?.value || 1)
      }));

      const currentRows = rows.filter(row => row.threshold !== '' || row.label);
      const nextRow = createEmptyPrizeRow();
      const displayRows = [...currentRows, nextRow];
      console.log('[lottery] add prize row clicked', { currentRows, nextRow });
      logPrizeArray('🆕 מערך המתנות הנוכחי אחרי הוספת שורה חדשה', displayRows);
      renderLotteryPrizeRows(displayRows);
    });
  }

  const saveSettingsButton = root.querySelector('#saveLotterySettingsBtn');
  if (saveSettingsButton) {
    saveSettingsButton.onclick = () => saveLotterySettingsFromForm();
  }
}

function renderLotteryPrizeRows(rows) {
  const container = getLotteryPrizeContainer();
  if (!container) return;

  const prizeRows = Array.isArray(rows) && rows.length ? rows : [createEmptyPrizeRow()];

  container.innerHTML = `
    <div class="lottery-prize-list">
      ${prizeRows.map((row, index) => `
        <div class="lottery-prize-row" data-index="${index}">
          <div class="lottery-prize-row__header">
            <span class="lottery-prize-tag">מתנה ${index + 1}</span>
            <button type="button" class="lottery-remove-btn" data-remove-index="${index}" aria-label="הסר פרס">×</button>
          </div>
          <div class="lottery-prize-grid">
            <div class="field-group">
              <label>סף שעות</label>
              <input type="text" inputmode="numeric" min="1" step="1" value="${row.threshold ?? ''}" class="lottery-threshold-input" placeholder="10" onfocus="kbOpen(this)">
            </div>
            <div class="field-group">
              <label>כמות</label>
              <input type="text" inputmode="numeric" min="1" step="1" value="${Number(row.quantity || 1)}" class="lottery-quantity-input" placeholder="1" onfocus="kbOpen(this)">
            </div>
            <div class="field-group" style="grid-column: 1 / -1;">
              <label>שם מתנה</label>
              <input type="text" value="${(row.label || '').replace(/"/g, '&quot;')}" class="lottery-label-input" placeholder="לדוגמה: כרטיס 5 שח" onfocus="kbOpen(this)">
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  const rowsInContainer = Array.from(container.querySelectorAll('.lottery-prize-row'));
  rowsInContainer.forEach((row, rowIndex) => {
    const removeButton = row.querySelector('.lottery-remove-btn');
    if (removeButton) {
      removeButton.addEventListener('click', () => {
        const currentRows = rowsInContainer.map(item => ({
          threshold: item.querySelector('.lottery-threshold-input')?.value || '',
          label: item.querySelector('.lottery-label-input')?.value.trim() || '',
          quantity: Number(item.querySelector('.lottery-quantity-input')?.value || 1)
        }));

        if (currentRows.length <= 1) {
          renderLotteryPrizeRows([createEmptyPrizeRow()]);
          return;
        }

        currentRows.splice(rowIndex, 1);
        renderLotteryPrizeRows(currentRows.filter(item => item.threshold !== '' && item.label));
      });
    }
  });
}

function renderCurrentPrizeSummary() {
  const container = getRootElementById('currentPrizeSummary', getActiveAdminRoot());
  if (!container) return;

  getLotterySettings(function(settings) {
    const merged = normalizeLotterySettings(settings || DEFAULT_LOTTERY_SETTINGS);
    const prizes = Array.isArray(merged.prizes) && merged.prizes.length
      ? [...merged.prizes].sort((a, b) => Number(a.threshold || 0) - Number(b.threshold || 0))
      : [];

    if (!prizes.length) {
      container.innerHTML = '<div class="empty-history-state">אין מתנות מוגדרות כרגע</div>';
      return;
    }

    container.innerHTML = `
      <div class="lottery-prize-summary__list">
        ${prizes.map((prize, index) => `
          <div class="lottery-prize-summary__item">
            <span class="lottery-prize-tag">מתנה ${index + 1}</span>
            <strong>${(prize.label || 'ללא שם').replace(/</g, '&lt;')}</strong>
            <span>סף: ${Number(prize.threshold || 0)} שעות</span>
            <span>כמות: ${Number(prize.quantity || 1)}</span>
          </div>
        `).join('')}
      </div>
    `;
  });
}

function loadLotterySettingsToForm(settings) {
  const merged = normalizeLotterySettings(settings || DEFAULT_LOTTERY_SETTINGS);
  const root = getActiveAdminRoot();
  const winChance = root.querySelector('#lotteryWinChance');
  if (winChance) winChance.value = ((merged.winChance ?? 0.33) * 100).toFixed(0);
  renderLotteryPrizeRows(merged.prizes && merged.prizes.length ? merged.prizes : [createEmptyPrizeRow()]);
  renderCurrentPrizeSummary();
}

function getLotterySettingsFromForm() {
  const root = getActiveAdminRoot();
  const activeContainer = getLotteryPrizeContainer();
  const rows = activeContainer ? Array.from(activeContainer.querySelectorAll('.lottery-prize-row')) : [];
  const prizes = rows
    .map(row => {
      const thresholdInput = row.querySelector('.lottery-threshold-input');
      const quantityInput = row.querySelector('.lottery-quantity-input');
      const labelInput = row.querySelector('.lottery-label-input');
      const threshold = Number(thresholdInput ? thresholdInput.value : 0);
      const quantity = Number(quantityInput ? quantityInput.value : 1);
      const label = labelInput ? labelInput.value.trim() : '';

      if (!label || !Number.isFinite(threshold) || threshold <= 0) return null;

      return {
        threshold: Math.round(threshold),
        label,
        quantity: Number.isFinite(quantity) && quantity > 0 ? Math.max(1, Math.round(quantity)) : 1
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.threshold - b.threshold);

  const deduped = new Map();
  prizes.forEach(prize => {
    const key = `${String(prize.threshold)}|${String(prize.label).trim().toLowerCase()}`;
    const existing = deduped.get(key);
    if (!existing || prize.quantity > existing.quantity) {
      deduped.set(key, prize);
    }
  });

  const cleanPrizes = Array.from(deduped.values());

  return {
    winChance: Number((root.querySelector('#lotteryWinChance')?.value || 33)) / 100,
    prizes: cleanPrizes,
    tiers: buildPrizeTiers(cleanPrizes)
  };
}

function saveLotterySettingsFromForm() {
  const root = getActiveAdminRoot();
  const settings = getLotterySettingsFromForm();
  const messageEl = root.querySelector('#lotterySettingsMessage');

  if (!settings.prizes || !settings.prizes.length) {
    if (messageEl) {
      messageEl.textContent = 'יש להוסיף לפחות מתנה אחת.';
      messageEl.style.color = 'red';
    }
    return;
  }

  getLotterySettings(function(existingSettings) {
    const mergedPrizes = mergePrizeEntries(existingSettings && existingSettings.prizes, settings.prizes);

    const safeSettings = {
      ...(existingSettings || DEFAULT_LOTTERY_SETTINGS),
      ...settings,
      prizes: mergedPrizes,
      tiers: buildPrizeTiers(mergedPrizes)
    };

    console.log('[lottery] saveLotterySettingsFromForm snapshot', {
      existing: existingSettings && existingSettings.prizes,
      incoming: settings.prizes,
      mergedPrizes,
      safeSettings
    });
    logPrizeArray('📦 מערך המתנות לפני שמירה מהטופס', mergedPrizes);

    saveLotterySettings(safeSettings, function(success) {
      console.log('[lottery] saveLotterySettingsFromForm success', { success, safeSettings });
      logPrizeArray('🎉 מערך המתנות אחרי שמירה', mergedPrizes);
      if (messageEl) {
        messageEl.textContent = success ? 'המתנה נוספה בהצלחה!' : 'שגיאה בשמירת הגדרות הזכייה.';
        messageEl.style.color = success ? 'green' : 'red';
      }

      if (success) {
        getLotterySettings(function(savedSettings) {
          const normalized = normalizeLotterySettings(savedSettings || DEFAULT_LOTTERY_SETTINGS);
          console.log('[lottery] normalized after save', normalized);
          logPrizeArray('🧾 מערך המתנות הסופי אחרי טעינה מחדש', normalized.prizes || []);
          renderLotteryHistory();
          renderCurrentPrizeSummary();
          renderLotteryPrizeRows(normalized.prizes && normalized.prizes.length ? normalized.prizes : [createEmptyPrizeRow()]);

          const winChance = root.querySelector('#lotteryWinChance');
          if (winChance) {
            winChance.value = ((normalized.winChance ?? 0.33) * 100).toFixed(0);
          }

          const giftsMessage = document.getElementById('giftsMessage');
          if (giftsMessage) {
            giftsMessage.textContent = 'המתנה נוספה בהצלחה!';
            giftsMessage.style.color = 'green';
          }
        });
      }
    });
  });
}

function getAllLotteryHistory() {
  return new Promise((resolve) => {
    if (!db) {
      resolve([]);
      return;
    }

    const transaction = db.transaction(['LotteryHistory'], 'readonly');
    const store = transaction.objectStore('LotteryHistory');
    const request = store.getAll();

    request.onsuccess = function(event) {
      const records = event.target.result || [];
      resolve(records.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)));
    };

    request.onerror = function() {
      resolve([]);
    };
  });
}

function renderLotteryHistory() {
  const container = getRootElementById('lotteryHistoryContainer', getActiveAdminRoot());
  if (!container) return;

  if (!db) {
    container.innerHTML = '<div class="empty-history-state">טוען נתוני זכיות...</div>';
    return;
  }

  getAllLotteryHistory().then((records) => {
    if (!records || records.length === 0) {
      container.innerHTML = '<div class="empty-history-state">עדיין לא נרשמו זכיות</div>';
      return;
    }

    const formatDate = (value) => {
      if (!value) return '—';
      const dateObj = new Date(value);
      return Number.isNaN(dateObj.getTime()) ? '—' : new Intl.DateTimeFormat('he-IL', {
        dateStyle: 'short',
        timeStyle: 'short'
      }).format(dateObj);
    };

    container.innerHTML = `
      <table class="lottery-history-table" aria-label="היסטוריית זכיות">
        <thead>
          <tr>
            <th>שם</th>
            <th>מזהה</th>
            <th>פרס</th>
            <th>סף</th>
            <th>שלב</th>
            <th>תאריך וזמן</th>
            <th>פעולה</th>
          </tr>
        </thead>
        <tbody>
          ${records.map((item) => `
            <tr>
              <td>${item.studentName || 'לא ידוע'}</td>
              <td>${item.studentId || '—'}</td>
              <td>${item.prize || 'פרס'}</td>
              <td>${item.tier || '—'}</td>
              <td>${item.stage || '—'}</td>
              <td>${formatDate(item.createdAt)}</td>
              <td>
                <button type="button" class="lottery-delete-btn" data-record-id="${item.id}" aria-label="מחק זכייה">🗑️</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    container.querySelectorAll('.lottery-delete-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const recordId = btn.dataset.recordId;
        if (confirm('האם אתה בטוח שברצונך למחוק זכייה זו?')) {
          deleteLotteryRecord(recordId, (ok) => {
            if (ok) {
              renderLotteryHistory();
            }
          });
        }
      });
    });
  });
}

function loadAttendanceSettingsToForm(settings) {
  const root = getActiveAdminRoot();
  const formMap = getAttendanceFieldMap();
  Object.keys(formMap).forEach(type => {
    const values = settings && settings[type] ? settings[type] : getDefaultAttendanceSettings()[type];
    formMap[type].forEach((fieldId, index) => {
      const field = getManagerField(fieldId, root);
      if (!field) return;
      const keys = ['morningStart', 'morningEnd', 'eveningStart', 'eveningEnd', 'specialStart', 'specialEnd'];
      field.value = values[keys[index]] || '07:35';
    });
  });
}

function getAttendanceSettingsFromForm() {
  const root = getActiveAdminRoot();
  const settings = getDefaultAttendanceSettings();
  const groups = getAttendanceFieldMap();

  Object.keys(groups).forEach(type => {
    const values = groups[type].map(fieldId => getManagerField(fieldId, root)?.value || '');
    settings[type] = {
      morningStart: values[0] || '07:35',
      morningEnd: values[1] || '09:10',
      eveningStart: values[2] || '19:10',
      eveningEnd: values[3] || '21:10',
      specialStart: values[4] || '17:00',
      specialEnd: values[5] || '18:10',
      enabled: true
    };
  });

  return settings;
}

function saveAttendanceSettingsFromForm() {
  const root = getActiveAdminRoot();
  const settings = getAttendanceSettingsFromForm();
  saveAttendanceSettings(settings, function(success) {
    const messageEl = getManagerField('settingsMessage', root);
    if (messageEl) {
      messageEl.textContent = success ? 'הגדרות התיקוף נשמרו בהצלחה.' : 'שגיאה בשמירת הגדרות התיקוף.';
      messageEl.style.color = success ? 'green' : 'red';
    }
  });
}

function setManagerStatus(elementId, message, isSuccess, isBusy) {
  const el = getManagerField(elementId, getActiveAdminRoot());
  if (!el) return;

  el.textContent = message || '';
  el.style.color = isBusy ? '#333' : isSuccess ? 'green' : 'red';
}

function applyUidChange(oldUid, newUid) {
  const root = getActiveAdminRoot();
  const oldValue = String(oldUid || '').trim();
  const newValue = String(newUid || '').trim();

  if (!oldValue || !newValue) {
    setManagerStatus('uidChangeMessage', 'יש למלא את שני השדות.', false, false);
    return;
  }

  setManagerStatus('uidChangeMessage', 'מבצע עדכון מזהה...', true, true);

  changeStudentUid(oldValue, newValue, function(success, msg) {
    const finalMessage = msg || (success ? '✅ המזהה עודכן בהצלחה.' : 'העדכון נכשל.');
    setManagerStatus('uidChangeMessage', finalMessage, !!success, false);

    if (success) {
      const oldInput = getManagerField('oldUidInput', root);
      const newInput = getManagerField('newUidInput', root);
      if (oldInput) oldInput.value = '';
      if (newInput) newInput.value = '';
      if (typeof list === 'function') {
        list();
      }
    }
  });
}

function changeUidFromForm() {
  const root = getActiveAdminRoot();
  const oldUid = getManagerField('oldUidInput', root)?.value?.trim() || '';
  const newUid = getManagerField('newUidInput', root)?.value?.trim() || '';
  applyUidChange(oldUid, newUid);
}

function populateUidFields(uid, name) {
  const root = getActiveAdminRoot();
  const oldInput = getManagerField('oldUidInput', root);
  const newInput = getManagerField('newUidInput', root);
  if (oldInput) oldInput.value = uid || '';
  if (newInput) newInput.focus();
  const el = getManagerField('uidChangeMessage', root);
  if (el) {
    el.textContent = `עבור ${name || 'התלמיד'} — הכנס מזהה חדש.`;
    el.style.color = '#333';
  }
}

  function formatHours(hoursDecimal) {
    const hours = Math.floor(hoursDecimal); // שעות מלאות
    const minutes = Math.round((hoursDecimal - hours) * 60); // המרה לדקות
    return `${hours}:${minutes.toString().padStart(2, '0')}`; // פורמט HH:MM
}

function openAdminDialog(sectionId) {
  const section = document.getElementById(sectionId);
  const dialog = document.getElementById('adminDialog');
  const title = document.getElementById('dialogTitle');
  const content = document.getElementById('dialogContent');

  if (!section || !dialog || !title || !content) return;

  title.textContent = section.dataset.dialogTitle || 'פעולה';
  content.innerHTML = section.innerHTML;
  dialog.classList.add('open');
  dialog.setAttribute('aria-hidden', 'false');

  const changeUidButton = content.querySelector('#changeUidBtn');
  if (changeUidButton) {
    changeUidButton.onclick = changeUidFromForm;
  }

  const saveStageButton = content.querySelector('#saveStageBtn');
  if (saveStageButton) {
    saveStageButton.onclick = saveCurrentStageFromForm;
  }

  const nextStageButton = content.querySelector('#nextStageBtn');
  if (nextStageButton) {
    nextStageButton.onclick = advanceStageFromManager;
  }

  bindLotteryPrizeControls(content);

  const formActionButtons = content.querySelectorAll('button[onclick]');
  formActionButtons.forEach(button => {
    const original = button.getAttribute('onclick');
    if (original && original.includes('saveAttendanceSettingsFromForm()')) {
      button.setAttribute('onclick', 'saveAttendanceSettingsFromForm();');
    }
  });

  const closeButton = content.querySelector('[data-close-dialog]');
  if (closeButton) closeButton.remove();

  const dialogCloseButtons = document.querySelectorAll('[data-close-dialog="true"]');
  dialogCloseButtons.forEach(button => {
    button.onclick = closeAdminDialog;
  });

  if (sectionId === 'attendanceSettingsSection') {
    getAttendanceSettings(function(settings) {
      loadAttendanceSettingsToForm(settings);
    });
  }

  if (sectionId === 'stageAdminSection') {
    loadCurrentStage(function() {
      loadStageControlToForm();
    });
  }

  if (sectionId === 'lotteryHistorySection') {
    renderLotteryHistory();
  }
  if (sectionId === 'giftsPanel') {
    loadGiftsPanel();
    // שדר את כפתור שמור השינויים בדיאלוג
    const saveGiftsButton = content.querySelector('button[onclick="saveGiftEdits()"]');
    if (saveGiftsButton) {
      saveGiftsButton.onclick = saveGiftEdits;
    }
  }
}

function closeAdminDialog() {
  const dialog = document.getElementById('adminDialog');
  if (!dialog) return;
  dialog.classList.remove('open');
  dialog.setAttribute('aria-hidden', 'true');
  document.getElementById('dialogContent').innerHTML = '';
}

      function checkPassword() {
        const input = document.getElementById("adminPassword").value;
        const registerButton = document.getElementById("registerFromManagerButton");

        if (input === ADMIN_PASSWORD) {
          document.getElementById("loginSection").classList.add("hidden");
          document.getElementById("adminPanel").classList.remove("hidden");
          document.getElementById("list-container").classList.remove("hidden");
          if (registerButton) {
            registerButton.classList.remove("hidden");
          }
          renderLotteryHistory();
        } else {
          if (registerButton) {
            registerButton.classList.add("hidden");
          }
          document.getElementById("loginError").textContent = "סיסמה שגויה";
        }
      }
  document.addEventListener("DOMContentLoaded", () => {
    const input = document.getElementById("adminPassword");

    if (input) {
      input.focus();
    }

    const actionCards = document.querySelectorAll('.action-card[data-open-panel]');
    actionCards.forEach(button => {
      button.addEventListener('click', () => {
        const sectionId = button.dataset.openPanel;
        if (sectionId) openAdminDialog(sectionId);
      });
    });

    const closeDialogButtons = document.querySelectorAll('[data-close-dialog="true"]');
    closeDialogButtons.forEach(button => {
      button.addEventListener('click', closeAdminDialog);
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeAdminDialog();
      }
    });

    const settingsButton = document.getElementById('changeUidBtn');
    if (settingsButton) {
      settingsButton.addEventListener('click', changeUidFromForm);
    }

    const adminLoginButton = document.getElementById('adminLoginBtn');
    if (adminLoginButton) {
      adminLoginButton.addEventListener('click', () => checkPassword());
    }

    const adminPasswordInput = document.getElementById('adminPassword');
    if (adminPasswordInput) {
      adminPasswordInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          checkPassword();
        }
      });
    }

    getAttendanceSettings(function(settings) {
      loadAttendanceSettingsToForm(settings);
    });

    loadCurrentStage(function(stage) {
      loadStageControlToForm();
    });

    getLotterySettings(function(settings) {
      loadLotterySettingsToForm(settings);
    });

    renderCurrentPrizeSummary();
    renderLotteryHistory();

    const nextStageButton = document.getElementById('nextStageBtn');
    if (nextStageButton) {
      nextStageButton.addEventListener('click', advanceStageFromManager);
    }

    const saveStageButton = document.getElementById('saveStageBtn');
    if (saveStageButton) {
      saveStageButton.addEventListener('click', saveCurrentStageFromForm);
    }

    bindLotteryPrizeControls(document);

let validateTimeout;
if (input) {
  input.addEventListener("input", () => {
      clearTimeout(validateTimeout);
      const val = input.value.trim();
      if (val.length > 0) {
          validateTimeout = setTimeout(() => checkPassword(), 200); // 100ms דיליי קטן
      }
  });
}

});
      function updatePoints() {
        const root = getActiveAdminRoot();
        const userIdEl = getManagerField('userId', root);
        const hoursEl = getManagerField('hours', root);
        const minutesEl = getManagerField('minutes', root);
        const userId = String(userIdEl ? userIdEl.value : '').trim();
        const rawHours = hoursEl ? hoursEl.value : '';
        const rawMinutes = minutesEl ? minutesEl.value : '';
        const hours = Number.parseInt(rawHours || '0', 10);
        const minutes = Number.parseInt(rawMinutes || '0', 10);

        if (!userId) {
          setManagerStatus('updateMessage', 'יש להזין מזהה תלמיד.', false, false);
          return;
        }

        if (Number.isNaN(hours) || Number.isNaN(minutes) || (hours === 0 && minutes === 0)) {
          setManagerStatus('updateMessage', 'יש להזין שעות או דקות תקינות.', false, false);
          return;
        }

        setManagerStatus('updateMessage', 'מעדכן נקודות...', true, true);

        updateStudent(userId, hours, minutes, function(result) {
          const success = result === 'ok';
          const finalMessage = success
            ? `✅ עודכן בהצלחה: ${hours} שעות ו-${minutes} דקות.`
            : '❌ העדכון נכשל. בדוק מזהה ותוכן השעות.';

          setManagerStatus('updateMessage', finalMessage, success, false);

          if (success) {
            if (userIdEl) userIdEl.value = '';
            if (hoursEl) hoursEl.value = '';
            if (minutesEl) minutesEl.value = '';
            if (typeof list === 'function') {
              list();
            }
          }
        });
      }
  
async function list() {
    const root = getActiveAdminRoot();
    const container = root.querySelector('#list-container') || document.getElementById('list-container');
    const table = getManagerField('list', root);
    const tbody = getManagerField('list-body', root);

    if (!table || !tbody) return;

    tbody.innerHTML = "";

    if (container) {
      container.classList.remove('hidden');
    }

    table.classList.remove('hidden2');
    table.style.display = 'table';

    try {

    // 1️⃣ שולפים את כל התלמידים
    const students = await getAllStudents(); // מערך { uid, name }
    const studentMap = {};
    students.forEach(s => studentMap[s.uid] = s.name);

    // 2️⃣ שולפים את כל ההיסטוריה
    const historyRecords = await getAllHistory(); // מערך { studentId, StartHour, EndHour, stage }

    // 3️⃣ מחשבים שעות לכל תלמיד לפי שלב
    const hoursPerStudent = {};

    historyRecords.forEach(record => {
        const { studentId, StartHour, EndHour, stage } = record;
        
        let duration =0
        if(StartHour!=null&&EndHour!=null)
{const start = new Date(record.StartHour);
const end = new Date(record.EndHour);
 duration = (end - start) / (1000 * 60 * 60); }// הפרש בשעות

        if (!hoursPerStudent[studentId]) {
            hoursPerStudent[studentId] = { A: 0, B: 0 ,C:0,D:0};
        }

        if (stage === 'A') hoursPerStudent[studentId].A += duration;
        else if (stage === 'B') hoursPerStudent[studentId].B += duration;
        else if (stage === 'C') hoursPerStudent[studentId].C += duration;
        
        else{ hoursPerStudent[studentId].D += duration;
          console.log("stage:", stage);
          
        }

    });

   // 4️⃣ מציגים בטבלה
    Object.keys(hoursPerStudent).forEach(studentId => {
        const student = hoursPerStudent[studentId];
        const studentName = studentMap[studentId] || "Unknown";

        const row = document.createElement("tr");
        row.style.cursor = "pointer";
        row.title = "לחץ לצפייה בפירוט או שנה מזהה";
        
        row.innerHTML = `
            <td>${studentId}</td>
            <td>${studentName}</td>
            <td>${formatHours(student.A)}</td>
            <td>${formatHours(student.B)}</td>
            <td>${formatHours(student.C)}</td>
            <td>${formatHours(student.D)}</td>
            <td>
              <button type="button" class="change-uid-button" data-student-id="${studentId}" data-student-name="${studentName}">שנה מזהה</button>
            </td>
        `;

        row.onclick = (event) => {
          if (event.target && event.target.tagName === 'BUTTON') return;
          openStudentDetails(studentId, studentName);
        };

        const button = row.querySelector('.change-uid-button');
        if (button) {
          button.addEventListener('click', (event) => {
            event.stopPropagation();
            populateUidFields(studentId, studentName);
          });
        }

        tbody.appendChild(row);
    });

}
    catch (err) {
        console.error("Error fetching students:", err);
    }




  function openStudentDetails(uid, name) {
    populateUidFields(uid, name);
    const idInput = document.getElementById("student-id");
    if (idInput) {
      idInput.value = String(uid).trim();
    }
  }
}
