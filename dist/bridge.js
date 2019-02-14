#!/usr/bin/env node
"use strict";

require('@babel/register')({
  only: ['./app']
});

require('./index');