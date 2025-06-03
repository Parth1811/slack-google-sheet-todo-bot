function logError(row, message) {
  var cellRange = SHEET.getRange(row, RUN_LOGS_COL);
  reactToSlackMessage(row, ERROR_FEEDBACK_EMOJI);
  var value = cellRange.getValue();
  if (value != null && value != '') {
    cellRange.setValue(value + ', ' + message);
  } else {
    cellRange.setValue(message);
  }
}

function saveID(row, idCol, id) {
  var cellRange = SHEET.getRange(row, idCol);
  cellRange.setValue(id);
}

function getVariable(row, col) {
  return SHEET.getRange(row, col).getValue();
}

function getMsgOrLink(row) {
  return getVariable(row, LINK_OR_MSG_COL);
}

function getUserName(row) {
  return getVariable(row, USERNAME_COL);
}

function getEmoji(row) {
  return getVariable(row, EMOJI_COL);
}

function getMsgId(row) {
  return getVariable(row, MSG_ID_COL);
}

function getChannelId(row) {
  return getVariable(row, CHANNEL_ID_COL);
}

function getTaskId(row) {
  return getVariable(row, TASK_ID_COL);
}

function getSlackMsgLink(row) {
  return getVariable(row, SLACK_LINK_COL);
}

function getTaskState(row) {
  return getVariable(row, TASK_STATE_COL);
}

function setTaskState(row, state) {
  var cellRange = SHEET.getRange(row, TASK_STATE_COL);
  if (TaskState[state] != null && TaskState[state] != undefined) {
    cellRange.setValue(state);
  }
}

function titleCase(st) {
  return st.toLowerCase().split(" ").reduce((s, c) =>
    s + "" + (c.charAt(0).toUpperCase() + c.slice(1) + " "), '');
}

function toFormattedDate(date) {
  return date.toLocaleDateString("en-US", { weekday: 'short', month: 'short', day: 'numeric' });
}

function findLastProcessedRow() {
  var numRows = SHEET.getLastRow();
  var start = numRows;

  for (var row = numRows; row >= 1; row--) {
    var pointer = getVariable(row, PROCESS_POINTER_COL);
    start = row
    if (pointer === 1) {
      break;
    }
  }

  return start;
}

function searchForInsertedTask(searchMessageId, numProcRows = SHEET.getLastRow()) {

  if (numProcRows < 2) {
    return -1;
  }

  for (var row = numProcRows; row > 1; row--) {
    var msgId = getMsgId(row);
    if (msgId == searchMessageId) {
      var emoji = getEmoji(row);
      if (emoji === INSERT_EMOJI) {
        return row;
      }
    }
  }

  return -1;
}

function searchForCompletedTask(messageTs) {
  var numRows = DB_SHEET.getLastRow();

  for (var row = numRows; row > 1; row--) {
    var msgTs = DB_SHEET.getRange(row, DB_MSG_ID_COL).getValue();
    if (msgTs === messageTs) {
      return row;
    }
  }

  return -1;
}

function getTaskQueueLock() {
  const lockCell = SHEET.getRange(TASK_QUEUE_LOCK_ROW, TASK_QUEUE_COL);

  const timeoutMs = 10000;              // 10 seconds total
  const pollIntervalMs = 500;            // check every 500 ms
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const current = lockCell.getValue();
    if (current === '' || current === null) {
      // Cell is empty → acquire lock by writing a marker
      lockCell.setValue('LOCKED');
      return true;
    }
    // Otherwise, wait and retry
    Utilities.sleep(pollIntervalMs);
  }

  // Timed out before the cell became empty
  return false;
}

function releaseTaskQueueLock() {
  const lockCell = SHEET.getRange(TASK_QUEUE_LOCK_ROW, TASK_QUEUE_COL);
  lockCell.clearContent();
}

function getFirstElementFromTaskQueue() {
  if (getTaskQueueLock()) {
    let output = null;
    try {
      const queue_cell = SHEET.getRange(3, TASK_QUEUE_COL);
      let value = queue_cell.getValue();
      if (value != null && value != undefined && value != '') {
        output = parseInt(value);
      }
    } finally {
      releaseTaskQueueLock()
    }
    return output;
  }
}

function getLastRowInColumn(col, startRow) {
  // Find the bottommost row in the entire sheet with any content:
  const sheetLastRow = SHEET.getLastRow();
  if (sheetLastRow < startRow) {
    return 0;
  }

  // Read values from startRow down through sheetLastRow in the target column
  const numRowsToCheck = sheetLastRow - startRow + 1;

  // Scan backward to find the first non-empty cell
  for (let i = sheetLastRow - 1; i >= startRow; i--) {
    let rawValues = SHEET.getRange(i, col).getValue();
    if (rawValue !== '' && rawValue !== null) {
      return i;
    }
  }
  return 0;
}

function addElementToTaskQueue(item) {
  if (!getTaskQueueLock()) {
    // Couldn’t acquire the lock
    return null;
  }
  try {
    // Find the last row in TASK_QUEUE_COL that has data (only in that column).
    const lastInQueue = getLastRowInColumn(TASK_QUEUE_COL, TASK_QUEUE_START_ROW);
    let writeRow;

    if (lastInQueue === 0) {
      // Queue is empty → first slot is at QUEUE_START_ROW
      writeRow = TASK_QUEUE_START_ROW;
    } else {
      // Check from QUEUE_START_ROW to lastInQueue for a truly empty cell
      const countExisting = lastInQueue - TASK_QUEUE_START_ROW + 1;
      const values = SHEET
        .getRange(TASK_QUEUE_START_ROW, TASK_QUEUE_COL, countExisting, 1)
        .getValues()
        .map(r => r[0]);

      for (let i = 0; i < values.length; i++) {
        if (values[i] === item) {
          return true;
        }
      }

      writeRow = lastInQueue + 1;

    }

    SHEET.getRange(writeRow, TASK_QUEUE_COL).setValue(item);
    return true;
  } finally {
    releaseTaskQueueLock();
  }
}


function removeFirstElementFromTaskQueue() {
  if (!getTaskQueueLock()) {
    // Couldn’t acquire the lock
    return null;
  }
  try {
    // Find the last row in TASK_QUEUE_COL that has data
    const lastInQueue = getLastRowInColumn(TASK_QUEUE_COL, TASK_QUEUE_START_ROW);
    if (lastInQueue < TASK_QUEUE_START_ROW) {
      // No items in the queue
      return null;
    }

    const numRows = lastInQueue - TASK_QUEUE_START_ROW + 1;
    const range = SHEET.getRange(TASK_QUEUE_START_ROW, TASK_QUEUE_COL, numRows, 1);
    const values = range.getValues();  // 2D array: [[item1], [item2], …]

    const firstElement = values[0][0];
    if (firstElement === '' || firstElement === null) {
      // Head is empty → queue is empty
      return null;
    }

    // Shift everything up by one
    for (let i = 0; i < values.length - 1; i++) {
      values[i][0] = values[i + 1][0];
    }
    // Clear the last slot
    values[values.length - 1][0] = '';

    range.setValues(values);
    return firstElement;
  } finally {
    releaseTaskQueueLock();
  }
}


Date.prototype.getWeekNumber = function () {
  var d = new Date(Date.UTC(this.getFullYear(), this.getMonth(), this.getDate()));
  var dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
};