#!/usr/bin/env node

import fs from 'fs-extra';
import yargs from 'yargs';
import path from 'path';
import pkg from '../package.json';
import utilities from './utilities';


import puppeteer from 'puppeteer';
import isUrl from 'is-url';
import {inspect} from 'util';

import slug from 'url-slug';
import http from 'http';

const currentDir = process.cwd();
const OPTIONS = {};

let FONTDIR = null;


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
}
function downloadFonts({name, url}) {

    const file = fs.createWriteStream(`${FONTDIR}/${name}`);

    const request = http.get(url);

    request.on('response', response => {
        response.pipe(file);
    });

    file.on('finish', () => {
        file.close(() => {
            utilities.o('log', `✔ ${name}`.green);
        });
    });

    file.on('error', (err) => {
        utilities.o('log', `Error! ${err}`.red.bold);
        file.end();
    });

}
function listFoundFonts() {

    const size = foundFonts.size;

    if (size === 0) {
        utilities.o('log', `Found no fonts:`.yellow.bold);
    } else {

        const rows = [...foundFonts]
            .map(font => font.name)
            .join('\n');

        utilities.o('log', `Found ${size} fonts:`.bold);
        utilities.o('log', `${rows}`);
        utilities.o('log', `\nDownloading to current directory`.bold, currentDir);

        FONTDIR = path.join(currentDir, `/font-thief-${slug(OPTIONS.site)}`);
        !fs.existsSync(FONTDIR) && fs.mkdirSync(FONTDIR);
        foundFonts.forEach(downloadFonts);

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
            listFoundFonts();
            await browser.close();
        } catch (e) {
            utilities.o('log', `ERROR: ${e.message}`.red.bold);
        }


    })();
}


function startApp() {

    utilities.title('FONT THIEF');

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
