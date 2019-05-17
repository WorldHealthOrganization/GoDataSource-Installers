'use strict';

const fs = require('fs');

const packagePath = './package.json';
const packageContent = require('./../package');

packageContent.internalBuild = process.argv[2] == 'true';
fs.writeFile(packagePath, JSON.stringify(packageContent, null, 2), function (error) {
  if (error) {
    output(JSON.stringify(error), true);
  }
  output('Successfully wrote internal build value', false);
});

/**
 * Output a message to stdout/stderr and end process
 * @param message
 * @param isError
 */
function output(message, isError) {
  // use stderr/stdout per message type
  process[isError ? 'stderr' : 'stdout'].write(`${message}\n`);
  process.exit(isError ? 1 : 0);
}
