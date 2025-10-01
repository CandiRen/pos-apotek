#!/bin/bash
cd /home/cr/project/pos/pos-apotek/backend && npm run dev &
cd /home/cr/project/pos/pos-apotek/frontend && npm run dev &
wait

