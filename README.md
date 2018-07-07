# Inkbunny favorites downloader
Author: Hoya Kim

## Prerequirements
 - Node.js 6 or higher
 - latest npm package manager
 - Large enough free space of storage

## How to use it
 - Download sync.js
 - Place sync.js in an empty folder
 - Open terminal, type 'npm init'
 - After init(just type enter several times) type 'npm i lodash axios path'
 - 'mkdir data' folder(or edit dataDir variable as you want)
 - Place credential.json and last_submission_id.txt into the data folder
 - Edit 2 files, Do NOT set 0 or negative number into the last_submission_id.txt file. Program will never stops.
 - last_submission_id is your last favorite submission id. Submission id is like this: https://inkbunny.net/s/1648903
 - Run 'nodejs sync.js', Downloading will takes very long time.
 - Favorites saved into the each Artist's name folder.

