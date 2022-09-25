#!/bin/bash

DIR=/mnt/storage/Downloads/_1

source $DIR/.env ; /usr/bin/env node $DIR/index.js >> $DIR/check-domain-expire.log
