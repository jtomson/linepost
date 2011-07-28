//-------------

// "Namespace"
var DiffHighlighter = {};

// usage:
// var highlighter = new DiffHighlighter.highlighter();
// highlighter.highlightDiff(diff, element);

DiffHighlighter.highlighter = function() {
    
this.diff2Html = function(diff) {
	element = {};
	highlightDiff(diff, element);
	return '<div class="' + element.className + '">'
	       + element.innerHtml
	       + '</div>';
}

//-------------
// Originally from https://github.com/pieter/gitx
// (C) Some rights reserved. GPL v2. Pieter de Bie 
//-------------

/*
 * GitX Javascript library
 * This library contains functions that can be shared across all
 * webviews in GitX.
 * It is written only for Safari 3 and higher.
 */

String.prototype.escapeHTML = function() {
	return this.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
};

String.prototype.unEscapeHTML = function() {
	return this.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>');
};

//-------------

this.highlightDiff = function(diff, element, callbacks) {
	if (!diff || diff == "")
		return;

	var start = new Date().getTime();
	element.className = "diff"
	var content = diff.escapeHTML().replace(/\t/g, "    ");

	var file_index = 0;

	var startname = "";
	var endname = "";
	var line1 = "";
	var line2 = "";
	var diffContent = "";
	var finalContent = "";
	var lines = content.split('\n');
	var binary = false;
	var mode_change = false;
	var old_mode = "";
	var new_mode = "";

	var hunk_start_line_1 = -1;
	var hunk_start_line_2 = -1;

	var header = false;

	var finishContent = function()
	{
		if (!file_index) {
			file_index++;
			return;
		}
		
		if (callbacks["newfile"])
			callbacks["newfile"](startname, endname, "file_index_" + (file_index - 1), mode_change, old_mode, new_mode);
        
		var title = startname;
		var binaryname = endname;
		
		if (endname == "/dev/null") {
			binaryname = startname;
			title = startname;
		}
		else if (startname == "/dev/null") {
			title = endname;
		}
		else if (startname != endname) {
			title = startname + " renamed to " + endname;
		}

		// If there's a diff or a binary file that hasn't been deleted, we'll make an element
		if (diffContent != "") {

			finalContent += '<div class="file" id="file_index_' + (file_index - 1) + '">' +
							'<div class="fileHeader">' + title + '</div>';
			// FIXME - make these table rows
			if (binary) {
			    if (callbacks["binaryFile"]) {
					finalContent += callbacks["binaryFile"](binaryname);
				}
				else {
				    var msg = "";
				    var classes = "commentable binary ";
				    if (endname == "/dev/null") {
				        msg = "Binary file removed";
				        classes += "delline";
				    }
				    else if (startname == "/dev/null"){
    					msg = "Binary file added";
				        classes += "addline";
					}
					else {
					    msg = "Binary file differs";
					}
					var file_id = file_index - 1;
					var line_id = "file_" + file_id + "line_0";
					finalContent += '<table><tr class="binary diffline"><td class="lineno"><a href="#'
					                + line_id
					                + '">...</a></td><td class="lineno"><a href="#'
					                + line_id
					                + '">...</a></td><td class="'
					                + classes
					                + '" id="'
					                + line_id
					                + '">'
					                + msg
					                + '</td></tr></table>';
				}
			}
			else {
				finalContent +=	 '<div class="diffContent">' + diffContent + '</div>';
			}
			
			finalContent += '</div>';
		}

		// reset bookkeeping
		line1 = "";
		line2 = "";
		diffContent = "";
		startname = "";
		endname = "";
		
		// next up
		file_index++;
	}
	
	for (var lineno = 0, lindex = 0; lineno < lines.length; lineno++) {
		var l = lines[lineno];

		var firstChar = l.charAt(0);

		if (firstChar == "d" && l.charAt(1) == "i") { // "diff", i.e. new file, we have to reset everything
			// diff always starts with a header
			header = true;
			
			// FIXME - table start & end

			// finish previous file ?
			diffContent += "</table>";
			
			finishContent();
			
			diffContent = "<table>";

			binary = false;
			mode_change = false;
			
			// there are cases when we need to capture filenames from
			// the diff line, like with mode-changes.
			// this can get overwritten later if there is a diff or if
			// the file is binary
			if(match = l.match(/^diff --git (a\/)+(.*) (b\/)+(.*)$/)) {	
				startname = match[2];
				endname = match[4];
			}

			continue;
		}

		if (header) {
			if (firstChar == "n") {
				if (l.match(/^new file mode .*$/))
					startname = "/dev/null";

				if (match = l.match(/^new mode (.*)$/)) {
					mode_change = true;
					new_mode = match[1];
				}
				continue;
			}
			if (firstChar == "o") {
				if (match = l.match(/^old mode (.*)$/)) {
					mode_change = true;
					old_mode = match[1];
				}
				continue;
			}

			if (firstChar == "d") {
				if (l.match(/^deleted file mode .*$/))
					endname = "/dev/null";
				continue;
			}
			if (firstChar == "-") {
				if (match = l.match(/^--- (a\/)?(.*)$/))
					startname = match[2];
				continue;
			}
			if (firstChar == "+") {
				if (match = l.match(/^\+\+\+ (b\/)?(.*)$/))
					endname = match[2];
				continue;
			}
			// If it is a complete rename, we don't know the name yet
			// We can figure this out from the 'rename from.. rename to.. thing
			if (firstChar == 'r')
			{
				if (match = l.match(/^rename (from|to) (.*)$/))
				{
					if (match[1] == "from")
						startname = match[2];
					else
						endname = match[2];
				}
				continue;
			}
			if (firstChar == "B") // "Binary files .. and .. differ"
			{
				binary = true;
				// We might not have a diff from the binary file if it's new.
				// So, we use a regex to figure that out

				if (match = l.match(/^Binary files (a\/)?(.*) and (b\/)?(.*) differ$/))
				{
					startname = match[2];
					endname = match[4];
				}
			}

			// Finish the header
			if (firstChar == "@")
				header = false;
			else
				continue;
		}
		
		sindex = "id=" + lindex.toString() + " ";
		if (firstChar == "+") {
			// Highlight trailing whitespace
			if (m = l.match(/\s+$/))
				l = l.replace(/\s+$/, "<span class='whitespace'>" + m + "</span>");
			diffContent += "<tr>";
			diffContent += "<td class='lineno'>" + " " + "</td>";
			diffContent += "<td class='lineno'><a href='#" + lindex + "'>" + ++hunk_start_line_2 + "</a></td>";
			diffContent += "<td " + sindex + "class='commentable addline'>" + l + "</td>";
			diffContent += "</tr>";
		}
		else if (firstChar == "-") {
			diffContent += "<tr>";
			diffContent += "<td class='lineno'><a href='#" + lindex + "'>" + ++hunk_start_line_1 + "</a></td>";
			diffContent += "<td class='lineno'>" + " " + "</td>";
			diffContent += "<td " + sindex + "class='commentable delline'>" + l + "</td>";
			diffContent += "</tr>";
		}
		else if (firstChar == "@") {
			
			header = false;
			
			if (m = l.match(/@@ \-([0-9]+),?\d* \+(\d+),?\d* @@/)) {
				hunk_start_line_1 = parseInt(m[1]) - 1;
				hunk_start_line_2 = parseInt(m[2]) - 1;
			}
			
			diffContent += "<tr>";
			diffContent += "<td class='lineno'><a href='#" + lindex + "'>..." + "</a></td>";
			diffContent += "<td class='lineno'><a href='#" + lindex + "'>..." + "</a></td>";
			diffContent += "<td " + sindex + "class='commentable hunkheader'>" + l + "</td>";
			diffContent += "</tr>";
		}
		else if (firstChar == " ") {
			diffContent += "<tr>";
			diffContent += "<td class='lineno'><a href='#" + lindex + "'>" + ++hunk_start_line_1 + "</a></td>";
			diffContent += "<td class='lineno'><a href='#" + lindex + "'>" + ++hunk_start_line_2 + "</a></td>";
			diffContent += "<td " + sindex + "class='commentable noopline'>" + l + "</td>";
			diffContent += "</tr>";
		}
		
		lindex++;
	}
	
	finishContent();

	// This takes about 7ms
	element.innerHTML = finalContent;
}
// end DiffHighlighter 'namespace'
}