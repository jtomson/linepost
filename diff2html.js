require.paths.unshift('/usr/local/lib/node/'); // bad brew install

var diffHighlighter = require('./diffHighlighter');
var fs = require('fs');
var jsdom = require('jsdom');
var sys = require('sys');

// TODO Construct HTML preamble

// TODO Get commit details

// Get commit diff
var input = fs.readFileSync('/dev/stdin').toString();

// Html-ize diff
var diffHtml = diffHighlighter.diff2html(input);

// Get notes for commit
var notes = [{file: 1, diffline: 2, message: 'I will gladly pay you tuesday for this hamburger today'}];

// TODO Get html from notes (markdown) ?

// Place notes in diff html
jsdom.env(diffHtml,
          [
            './jquery-1.5.min.js'
          ],
          function(errors, window) {
              for (var idx in notes) {
                  var note = notes[idx];
                  var diffRow = window.$("#file_index_" + note.file + " tr")[note.diffline];
                  if (diffRow == undefined) {
                      console.log('Could not find diffrow for note: ' + sys.inspect(note));
                      continue;
                  }
                  window.$(diffRow).after('<tr><td colspan=3>' + note.message + '</td></tr>').appendTo(html);
                  console.log(window.$('html').html());
              }
          });

// TODO end HTML