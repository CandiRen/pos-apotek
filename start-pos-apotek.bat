@echo off
REM === Backend ===
start wsl -d Ubuntu --cd /home/cr/project/pos/pos-apotek/backend -- bash -lic "npm install && npm run dev"

REM === Frontend ===
start wsl -d Ubuntu --cd /home/cr/project/pos/pos-apotek/frontend -- bash -lic "npm install && npm run dev"