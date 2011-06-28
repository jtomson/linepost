require.paths.unshift(__dirname); // include local dir
var diffHighlighter = require('diffHighlighter');
var fs = require('fs');

var input = fs.readFileSync('/dev/stdin').toString();

//var testInput = "diff --git a/html/views/history/history.js b/html/views/history/history.js\nindex c0ac4c6..225e590 100644\n--- a/html/views/history/history.js\n+++ b/html/views/history/history.js\n@@ -107,7 +107,7 @@ var gistie = function() {\n        var t = new XMLHttpRequest();\n        t.onreadystatechange = function() {\n                if (t.readyState == 4 && t.status >= 200 && t.status < 300) {\n-                       if (m = t.responseText.match(/gist: ([a-f0-9]+)/))\n+                       if (m = t.responseText.match(/<a href=\"\/gists\/([a-f0-9]+)\/edit\">/))\n                                notify(\"Code uploaded to gistie <a target='_new' href='http://gist.github.com/\" + m[1] + \"'>#\" + m[1] + \"</a>\", 1);\n                        else {\n                                notify(\"Pasting to Gistie failed :(.\", -1);\n@@ -116,7 +116,7 @@ var gistie = function() {\n                }\n        }\n \n-       t.open('POST', \"http://gist.github.com/gists\");\n+       t.open('POST', \"https://gist.github.com/gists\");\n        t.setRequestHeader('X-Requested-With', 'XMLHttpRequest');\n        t.setRequestHeader('Accept', 'text/javascript, text/html, application/xml, text/xml, */*');\n        t.setRequestHeader('Content-type', 'application/x-www-form-urlencoded;charset=UTF-8');\n"
var html = diffHighlighter.diff2html(input);

console.log(html);