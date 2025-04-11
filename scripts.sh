#!/bin/bash
cd /mnt/vol1/vhost/hsbc-instabenefit-node
npm install
pm2 reload hsbc-instabenefit-node
