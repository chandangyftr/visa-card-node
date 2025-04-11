const fs = require('fs');

const dateTimeFormat = function dateTimeFormat() {
  let now = new Date();
  let year = '' + now.getFullYear();
  let month = '' + (now.getMonth() + 1);
  if (month.length == 1) {
    month = '0' + month;
  }
  let day = '' + now.getDate();
  if (day.length == 1) {
    day = '0' + day;
  }
  let hour = '' + now.getHours();
  if (hour.length == 1) {
    hour = '0' + hour;
  }
  let minute = '' + now.getMinutes();
  if (minute.length == 1) {
    minute = '0' + minute;
  }
  let second = '' + now.getSeconds();
  if (second.length == 1) {
    second = '0' + second;
  }
  return year + '-' + month + '-' + day + ' ' + hour + ':' + minute + ':' + second;
};

const dateFormat = function dateFormat() {
  let now = new Date();
  let year = '' + now.getFullYear();
  let month = '' + (now.getMonth() + 1);
  if (month.length == 1) {
    month = '0' + month;
  }
  
  let day = '' + now.getDate();
  if (day.length == 1) {
    day = '0' + day;
  }
  return year + '-' + month + '-' + day;
};

function writeLog(type, log_str) {
  console.log('type',type,'log_str',log_str);
}

module.exports = { writeLog };
