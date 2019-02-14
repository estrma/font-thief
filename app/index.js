#!/usr/bin/env node

import fs from 'fs-extra';
import colors from 'colors';
import yargs from 'yargs';
import path from 'path';
import pkg from '../package.json';
import utilities from './utilities';

import puppeteer from 'puppeteer';
import isUrl from 'is-url';
import {inspect} from 'util';

const OPTIONS = {};

const FORMATS = ['ttf', 'otf', 'woff', 'woff2'];
const MIMETYPES = [
  'application/x-font-ttf',
  'application/x-font-truetype',
  'application/x-font-otf',
  'application/x-font-opentype',
  'application/font-woff',
  'pplication/font-woff2'
];
const foundFonts = new Set();

function logResp(resp) {
  if ('font' === resp.request().resourceType()) {
    const url = resp.url();
    const name = path.basename(url);

    foundFonts.add({
      url,
      name
    });
  }

  // utilities.o('log', `logResp: ${inspect(resp)}`.green.bold);
}

function logFoundFonts() {

  const size = foundFonts.size;

  if (size === 0) {
    utilities.o('log', `Found no fonts:`.yellow.bold);
  } else {

    const rows = [...foundFonts]
      .map(font => font.name)
      .join('\n');

    utilities.o('log', `Found ${size} fonts:`.green.bold);
    utilities.o('log', `${rows}`.green);
    utilities.o('log', `Download to current directory? (${process.cwd()})`.green.bold);
  }


}
function getPage(url) {

  (async() => {
    const browser = await puppeteer.launch({
      ignoreHTTPSErrors: true
    });
    const page = await browser.newPage();

    page.on('response', logResp);

    try {
      const response = await page.goto(url);
      //  console.log(await response.remoteAddress());
      logFoundFonts();
      await browser.close();

    } catch (e) {
      utilities.o('log', `ERROR: ${e.message}`.red.bold);
    }


  })();
}


function startApp() {

  utilities.title('Starting boilerplate');

  if (OPTIONS.site) {

    const url = OPTIONS.site;

    if (!isUrl(url)) {

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

  let argv = yargs
    .version(pkg.version)
    .usage(`Usage: $0 -s [url]`)
    // .boolean([
    //   'foo',
    //   'baz'
    // ])
    // .option('foo', {
    //   alias: [
    //     'f',
    //   ],
    //   description: 'Create foo text files?',
    //   type: 'boolean',
    // })
    // .option('baz', {
    //   alias: [
    //     'b',
    //   ],
    //   description: 'What will this option do?',
    //   type: 'boolean',
    // })
    .option('convert', {
      alias: [
        'c',
      ],
      description: 'Convert fonts to format (separate by comma)',
      type: 'string',
    })
    .option('site', {
      alias: [
        's',
      ],
      description: 'Site to loot',
      type: 'string',
      demand: true,
    })
    .alias('h', 'help')
    .help('h', 'Show help.')
    .argv;

  OPTIONS.directory = fs.realpathSync(__dirname);
  OPTIONS.site = argv.site;
  OPTIONS.convert = argv.convert;

  startApp();

}

getOptions();
