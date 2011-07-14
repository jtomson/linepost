require.paths.unshift('/usr/local/lib/node/'); // bad brew install

var fs = require('fs');
var jsdom = require('jsdom');
var sys = require('sys');

// Construct HTML preamble
var output = '<!DOCTYPE html><html><head><link rel="stylesheet" type="text/css" href="diff.css" /></head><body>'

// TODO Get commit details

// Get commit diff
var input = fs.readFileSync('/dev/stdin').toString();


// Get notes for commit
var notes = [{file: 1, diffline: 6, message: 'I will gladly pay you tuesday for this **hamburger** todayI will gladly pay you tuesday for this **hamburger** todayI will gladly pay you tuesday for this **hamburger** todayI will gladly pay you tuesday for this **hamburger** todayI will gladly pay you tuesday for this **hamburger** todayI will gladly pay you tuesday for this **hamburger** todayI will gladly pay you tuesday for this **hamburger** today\n -James'}];

// TODO Get html from notes (markdown) ?

var showdown = new Showdown.converter();
var diffhighlighter = new DiffHighlighter.highlighter();

// Html-ize diff
var diffHtml = diffHighlighter.diff2html(input);

// Place notes in diff html
var composeNoteHtml = function(message) {
    return '<tr class="noteRow"><td colspan="2">Note: </td><td class="noteMessage">' + showdown.makeHtml(message) + '</td></tr>'
};


var html = showdown.makeHtml(text);

jsdom.env(diffHtml,
          [
            './jquery-1.5.min.js'
          ],
          function(errors, w) {
              for (var idx in notes) {
                  var note = notes[idx];
                  if (note.file < 0) {
                     // comment is on the whole commit?
                     continue; 
                  }
                  var diffRow = w.$("#file_index_" + note.file + " tr")[note.diffline];
                  if (diffRow == undefined) {
                      console.log('Could not find diffrow for note: ' + sys.inspect(note));
                      continue;
                  }
                  var noteHtml = composeNoteHtml(note.message);
                  w.$(diffRow).after(noteHtml);
              }
              output += w.$('body').html();
              output += '</body></html>';
              console.log(output);
          });

// TODO end HTML