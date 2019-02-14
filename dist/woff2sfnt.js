#!/usr/bin/env node
"use strict";

var pako = require('pako'); //given bit, do 4byte alignment by finding the nearest number that's divisible by 4.


function fourByteAlign(bit) {
  return bit + 3 & ~3;
}
/* Copies the contents of buf1 to buf2
 * This function assumes alignedLen will always be bigger or equal to buf's length.
 */


function fourByteAlignedBuffer(buf, len) {
  var alignedLen = fourByteAlign(len); //console.log("long aligned length: " + alignedLen);

  var woffData = new Buffer(alignedLen);
  var zeroPaddedLen = alignedLen - buf.length;

  for (var i = 0; i < buf.length; ++i) {
    //console.log(buf[i]);
    woffData[i] = buf[i];
  } //extra bytes zero padded


  for (i = 0; i < zeroPaddedLen; ++i) {
    woffData[buf.length + i] = 0;
  }

  return woffData;
}
/*The sfnt based font specifications require that the table directory entries are sorted in ascending order of tag value.
 * comparator function for sort() function.
 * */


function tagComparison(entry1, entry2) {
  var tag1Str = entry1.tag.toString();
  var tag2Str = entry2.tag.toString();

  if (tag1Str < tag2Str) {
    return -1;
  }

  if (tag1Str > tag2Str) {
    return 1;
  }

  return 0;
}
/* Converts Woff to its original format (TTF or OTF) */


function woff2sfnt(woff) {
  var woffBuffer = new Buffer(woff);
  var tableDirectory = [];
  var SFNT_HEADER_LENGTH = 12;
  var SFNT_TABLE_DIR_SIZE = 16;
  var WOFF_TABLE_DIR_SIZE = 20;
  var WOFF_HEADER_LENGTH = 44;
  /* Calculate necessary header fields. */

  var numTables = woffBuffer.readUInt16BE(12);
  var sfntVersion = woffBuffer.readUInt32BE(4); //woff flavor

  var nearestPow2 = Math.pow(2, Math.floor(Math.log(numTables) / Math.log(2)));
  var searchRange = nearestPow2 * 16;
  var entrySelector = Math.log(nearestPow2) / Math.LN2;
  var rangeShift = numTables * 16 - searchRange;
  var SFNTHeader = constructSFNTHeader(sfntVersion, numTables, searchRange, entrySelector, rangeShift);
  /* Table Directory Size = it's calculated by multiplying the numTables value in the SFNT header times the size of a single SFNT table directory */

  var sfntTableSize = numTables * SFNT_TABLE_DIR_SIZE;
  var sfntTableOffset = SFNT_HEADER_LENGTH; //table dir field starts right after header field.

  for (var i = 0; i < numTables; ++i) {
    var next = WOFF_HEADER_LENGTH + i * WOFF_TABLE_DIR_SIZE; //read WOFF directory entries

    var tableDirectoryEntry = {
      tag: woffBuffer.readUInt32BE(next),
      offset: woffBuffer.readUInt32BE(next + 4),
      compLen: woffBuffer.readUInt32BE(next + 8),
      origLen: woffBuffer.readUInt32BE(next + 12),
      origChecksum: woffBuffer.readUInt32BE(next + 16)
    };
    tableDirectory.push(tableDirectoryEntry);
    sfntTableOffset += SFNT_TABLE_DIR_SIZE;
  }
  /* This might not be needed, sfnt directory should already be sorted by tag. */


  tableDirectory = tableDirectory.sort(tagComparison);
  var SFNTTableDir = new Buffer(sfntTableSize);
  var SFNTTableData = []; //contains all the font data for every table.

  /* decompress the */

  for (i = 0; i < numTables; ++i) {
    tableDirectoryEntry = tableDirectory[i];
    var start = tableDirectoryEntry.offset;
    var end = tableDirectoryEntry.offset + tableDirectoryEntry.compLen;
    /* Slice the buffer to get the data for current table. */

    var woffSlice = woffBuffer.slice(start, end);
    var sfntDataEntry;
    /* if uncompressed data is not equal to compressed, then uncompress and use the data. */

    if (tableDirectoryEntry.origLen != tableDirectoryEntry.compLen) {
      //console.log("origLen != compLen: " + tableDirectoryEntry.origLen + " " + tableDirectoryEntry.compLen);
      sfntDataEntry = pako.inflate(woffSlice);
      sfntDataEntry = toBuffer(sfntDataEntry); //sfntDataEntry = new Buffer( new Uint8Array(sfntDataEntry) );
    } else {
      sfntDataEntry = woffSlice;
    }
    /* Construct Sfnt Table Directory, SFNTTableDir = tag, checksum, offset, length */


    SFNTTableDir.writeUInt32BE(tableDirectoryEntry.tag, i * SFNT_TABLE_DIR_SIZE);
    SFNTTableDir.writeUInt32BE(tableDirectoryEntry.origChecksum, i * SFNT_TABLE_DIR_SIZE + 4);
    SFNTTableDir.writeUInt32BE(sfntTableOffset, i * SFNT_TABLE_DIR_SIZE + 8);
    SFNTTableDir.writeUInt32BE(tableDirectoryEntry.origLen, i * SFNT_TABLE_DIR_SIZE + 12);
    /* Check if we need to pad extra 0s (since woff data was 4byte aligned), if they are update sfnt offset accordingly. */

    if (tableDirectoryEntry.origLen % 4 !== 0) {
      sfntDataEntry = fourByteAlignedBuffer(sfntDataEntry, tableDirectoryEntry.origLen);
      sfntTableOffset += sfntDataEntry.length;
    } else {
      sfntTableOffset += tableDirectoryEntry.origLen;
    }

    SFNTTableData.push(sfntDataEntry); //store table data
  } //console.log(sfntTableOffset);
  //console.log(SFNTHeader.length);
  //console.log(SFNTTableDir.length);
  //console.log(SFNTTableData.length);


  var SFNT = constructSFNT(SFNTHeader, SFNTTableDir, SFNTTableData);
  return SFNT;
}
/* Constructs the SFNT data by concatenating SFNT Buffers
 * Here's a top down structure: Header <- TableDir <- Table Data
 */


function constructSFNT(SFNTHeader, SFNTTableDir, SFNTTableData) {
  var SFNT = Buffer.concat([SFNTHeader, SFNTTableDir]);

  for (var i = 0; i < SFNTTableData.length; ++i) {
    SFNT = Buffer.concat([SFNT, SFNTTableData[i]]);
  }

  return SFNT;
}
/*Constructs SFNT Header */


function constructSFNTHeader(sfntVersion, numTables, searchRange, entrySelector, rangeShift) {
  var SFNT_HEADER_LENGTH = 12;
  var SFNTHeader = new Buffer(SFNT_HEADER_LENGTH);
  SFNTHeader.writeInt32BE(sfntVersion, 0); //SFNT Version

  SFNTHeader.writeUInt16BE(numTables, 4); //SFNT Number of Tables

  SFNTHeader.writeUInt16BE(searchRange, 6); //SFNT Search Range (Maximum power of 2 <= numTables) x 16.

  SFNTHeader.writeUInt16BE(entrySelector, 8); //SFNT Entry Selector (Log2(maximum power of 2 <= numTables).

  SFNTHeader.writeUInt16BE(rangeShift, 10); // SFNT Range Shift (NumTables x 16-searchRange.)

  return SFNTHeader;
}
/* inflate function returns uint8array/arrayBuffer, this helper converts it back to buffer */


function toBuffer(arrBuf) {
  var buf = new Buffer(arrBuf.byteLength);
  var view = new Uint8Array(arrBuf);

  for (var i = 0; i < buf.length; ++i) {
    buf[i] = view[i];
  }

  return buf;
}

module.exports = {
  toSfnt: woff2sfnt
};