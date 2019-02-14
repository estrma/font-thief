#!/usr/bin/env node
"use strict";

var _fsExtra = _interopRequireDefault(require("fs-extra"));

var _yargs = _interopRequireDefault(require("yargs"));

var _path = _interopRequireDefault(require("path"));

var _package = _interopRequireDefault(require("../package.json"));

var _puppeteer = _interopRequireDefault(require("puppeteer"));

var _isUrl = _interopRequireDefault(require("is-url"));

var _urlSlug = _interopRequireDefault(require("url-slug"));

var _httpHttps = _interopRequireDefault(require("http-https"));

var _woff = _interopRequireDefault(require("woff2"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const utilities = require('./utilities');

const currentDir = process.cwd();
const OPTIONS = {};
const FORMATS = ['ttf', 'otf'];
let FONTDIR = null;
const foundFonts = new Set();

function logResp(resp) {
  if ('font' === resp.request().resourceType()) {
    const url = resp.url();

    const name = _path.default.basename(url);

    foundFonts.add({
      url,
      name
    });
  }
}

function convert(name, format) {
  if (!FORMATS.includes(format)) {
    return;
  }

  const ext = _path.default.extname(name);

  const file = `${FONTDIR}/${name}`;

  if (ext === '.woff2') {
    const input = _fsExtra.default.readFileSync(file);

    const output = file.replace(ext, `.${format}`);

    _fsExtra.default.writeFileSync(output, _woff.default.decode(input));

    _fsExtra.default.unlink(file);

    utilities.o('log', `Converted to ${format}`.green);
  }
}

function downloadFonts({
  name,
  url
}) {
  const file = _fsExtra.default.createWriteStream(`${FONTDIR}/${name}`);

  const request = _httpHttps.default.get(url);

  request.on('response', response => {
    response.pipe(file);
  });
  file.on('finish', () => {
    file.close(() => {
      utilities.o('log', `✔ ${name}`.green);
    });

    if (OPTIONS.convert) {
      convert(name, OPTIONS.convert);
    }
  });
  file.on('error', err => {
    utilities.o('log', `Error! ${err}`.red.bold);
    file.end();
  });
}

function listFoundFonts() {
  const size = foundFonts.size;

  if (size === 0) {
    utilities.o('log', `Found no fonts:`.yellow.bold);
  } else {
    const rows = [...foundFonts].map(font => font.name).join('\n');
    utilities.o('log', `Found ${size} fonts:`.bold);
    utilities.o('log', `${rows}`);
    utilities.o('log', `\nDownloading to current directory`.bold, currentDir);
    FONTDIR = _path.default.join(currentDir, `/font-thief-${(0, _urlSlug.default)(OPTIONS.site)}`);
    !_fsExtra.default.existsSync(FONTDIR) && _fsExtra.default.mkdirSync(FONTDIR);
    foundFonts.forEach(downloadFonts);
  }
}

function getPage(url) {
  (async () => {
    const browser = await _puppeteer.default.launch({
      ignoreHTTPSErrors: true
    });
    const page = await browser.newPage();
    page.on('response', logResp);

    try {
      const response = await page.goto(url);
      listFoundFonts();
      await browser.close();
    } catch (e) {
      utilities.o('log', `ERROR: ${e.message}`.red.bold);
    }
  })();
}

function run() {
  utilities.title('FONT THIEF');

  if (OPTIONS.site) {
    const url = OPTIONS.site;

    if (!(0, _isUrl.default)(url)) {
      utilities.o('log', `Not a valid url: ${url}`.red.bold);
      return;
    }

    getPage(url);
  } else {
    utilities.o('log', `Url not provided.`.red.bold);
  }

  utilities.exitGraceful();
}

function getOptions() {
  let argv = _yargs.default.version(_package.default.version).usage(`Usage: $0 -s [url]`).option('convert', {
    alias: ['c'],
    description: 'Convert fonts to format. Currently supported: ' + FORMATS.join(', '),
    type: 'string',
    default: 'otf'
  }).option('site', {
    alias: ['s'],
    description: 'Site to loot',
    type: 'string',
    demand: true
  }).alias('h', 'help').help('h', 'Show help.').argv;

  OPTIONS.directory = _fsExtra.default.realpathSync(__dirname);
  OPTIONS.site = argv.site;
  OPTIONS.convert = argv.convert;
  run();
}

getOptions();