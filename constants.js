// ----------- DO NOT CHANGE THIS SECTION -----------------
const LINK_OR_MSG_COL = 1;
const USERNAME_COL = 2;
const TIMESTAMP_COL = 3;
const EMOJI_COL = 4;
const PROCESS_POINTER_COL = 5;
const MSG_ID_COL = 6;
const CHANNEL_ID_COL = 7;
const TASK_ID_COL = 8;
const RUN_LOGS_COL = 9;
const SLACK_LINK_COL = 10;
const GOOGLE_TASK_LINK_COL = 11;
const TASK_STATE_COL = 12;
const TASK_QUEUE_COL = 13;
const TASK_QUEUE_LOCK_ROW = 2;
const TASK_QUEUE_START_ROW = 3;


const DB_MSG_ID_COL = 1;
const DB_MSG_TITLE_COL = 2;
const DB_SLACK_LINK_COL = 3;
const DB_GOOGLE_TASK_LINK_COL = 4;

const INSERT_EMOJI = 'heart';
const INSERT_FEEDBACK_EMOJI = 'thumbsup';
const COMPLETE_EMOJI = 'white_check_mark';
const COMPLETE_FEEDBACK_EMOJI = 'tada';
const GET_REPORT_EMOJI = 'calendar';
const ERROR_FEEDBACK_EMOJI = 'x';
const RED_CIRCLE_EMOJI = 'red_circle';
const YELLOW_CIRCLE_EMOJI = 'large_yellow_circle';
const GREEN_CIRCLE_EMOJI = 'large_green_circle';
const PROCESSING_EMOJI = 'cool_processing';

const SHEET = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Task Message Tracker');
const DB_SHEET = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Completed Tasks');
const CONFIG_SHEET = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Config');

const USERNAME = CONFIG_SHEET.getRange(1, 2).getValue();
const SLACK_USERNAME = CONFIG_SHEET.getRange(2, 2).getValue();
const SLACK_TOKEN = CONFIG_SHEET.getRange(3, 2).getValue(); 
const SLACK_CHANNEL_ID = 'C08EW39ULBT';

const WEEKDAYS = {
  "sunday": 0, "sun": 0, "s": 0,
  "monday": 1, "mon": 1, "m": 1,
  "tuesday": 2, "tue": 2, "t": 2,
  "wednesday": 3, "wed": 3, "w": 3,
  "thursday": 4, "thu": 4, "th": 4,
  "friday": 5, "fri": 5, "f": 5,
  "saturday": 6, "sat": 6, "sa": 6
};

const TaskState = Object.freeze({
  INTAKE: "INTAKE",
  IN_QUEUE: "IN_QUEUE",
  PARSING: "PARSING",
  PARSED: "PARSED",
  PROCESSING: "PROCESSING",
  PROCESSED: "PROCESSED",
  DELETED: "DELETED",
  INVALID: "INVALID",
});