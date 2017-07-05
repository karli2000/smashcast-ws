/* eslint-disable */
const git = require('git-state');
const fs = require('fs');

const path = '.';
const packageFile = require('./package.json');

fs.stat(packageFile.main, err => {
    if (err) {
        console.error('ERROR: Main entry point not accessible!\nDid you run the build task?');
        process.exit(1);
    }
});

git.isGit(path, exists => {
    if (!exists) {
        console.error('ERROR: Git is not initialized in ' + path);
        process.exit(1);
    }

    git.check(path, (err, result) => {
        if (err) {
            console.error(err);
            process.exit(1);
        }

        if (result.dirty > 0 || result.untracked > 0) {
            awaitUserYesNo('Changed or untracked files found!\nMaybe you forgot to commit and push your changes to the repo first?\nDo you want to continue publishing [Y/n]? ').then(input => {
                if (input) {
                    process.stdin.pause();
                    return;
                }
                console.log('Aborted due to user input.');
                process.exit(0);
            }).catch(err => {
                console.error('ERROR: Something went wrong!', err);
                process.exit(1);
            })
        }
    });
});

function awaitUserYesNo(message) {
    return new Promise((resolve, reject) => {
        process.stdout.write(message);
        process.stdin.once('data', data => {
            const input = data.toString().trim().toLowerCase();
            if (input === 'y' || input === '' || input === 'n') {
                resolve(input === 'y' || input === '');
                return;
            }
            reject('Invalid input!');
        });
    });
}
