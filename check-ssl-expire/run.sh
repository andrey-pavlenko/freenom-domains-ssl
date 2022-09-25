#!/bin/bash

DIR=/home/www-data/check-ssl-expire

source $DIR/.env ; /usr/bin/env node $DIR/index.js >> $DIR/check-ssl-expire.log
