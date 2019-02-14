#!/usr/bin/env node
"use strict";

var _fsExtra = _interopRequireDefault(require("fs-extra"));

var _colors = _interopRequireDefault(require("colors"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

module.exports = {
  fileExists: function (filePath) {
    try {
      return _fsExtra.default.statSync(filePath).isFile();
    } catch (error) {
      return false;
    }
  },
  dirExists: function (dirPath) {
    try {
      return _fsExtra.default.statSync(dirPath).isDirectory();
    } catch (error) {
      return false;
    }
  },
  title: function (string) {
    this.o('log');
    this.o('log', ` ${string.toUpperCase()} `.bold.bgBlack.white);
    this.o('log');
  },
  exitGraceful: function (exitCode = 0) {
    process.exitCode = exitCode;
  },
  done: function ({
    text = 'Done!',
    before = true,
    after = false
  } = {}) {
    if (before) this.o('log');
    this.o('log', text);
    if (after) this.o('log');
  },
  o: function (type, ...messages) {
    console[type].apply(this, messages);
  }
};