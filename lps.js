require.paths.unshift('./node_modules');

var _settings = require('./settings');

// global sqlite db obj
var _db = {};

// ----------------

var express = require('express'),
    connect = require('connect'),
    sys = require('sys'),
    fs = require('fs'),
    exec = require('child_process').exec,
    sqlite3 = require('sqlite3').verbose(),
    nodemailer = require('nodemailer');
    app = express.createServer();

//-------------------------
// Initialization
//-------------------------


(function init() {
    var is_new_db = false;

    try {
        fs.lstatSync(_settings.db_path);
    }
    catch (error) {
        is_new_db = true;
    }

    _db = new sqlite3.Database(_settings.db_path, function(error) { if (error) { throw error; } });
    _db.serialize(); // put in serial mode

    // calls are queued so we can start using the db even if we haven't completed open above
    if (is_new_db) {
        // FIXME - not optimized at all, just blatted for the time being
        _db.run('CREATE TABLE comments( ' +
                'id INTEGER PRIMARY KEY AUTOINCREMENT, ' +
                'repo_name TEXT, ' +
                'commit_sha TEXT, ' +
                'file_idx INTEGER, ' +
                'row_idx INTEGER, ' +
                'added_timestamp INTEGER, ' +
                'edited_timestamp INTEGER, ' +
                'comment_text TEXT, ' +
                'deleted BOOLEAN DEFAULT 0);', function(error) {if (error) { throw error; } });
    }

}());

var _isGoodSha = function(sha) {
    var sha_matches = sha.match(/(?:\d|[a-f]){6,40}/i);
    return (sha_matches !== null && sha_matches.length === 1);
};

// assumes comment is valid
var _addComment = function(comment, callback) {
    _db.run('INSERT INTO comments VALUES(NULL, $repo_name, $commit_sha, $file_idx, $row_idx, $added_timestamp, $edited_timestamp, $comment_text, 0)',
            { '$repo_name': comment.repo_name,
              '$commit_sha': comment.commit_sha,
              '$file_idx': comment.file_idx,
              '$row_idx': comment.row_idx,
              '$added_timestamp': comment.added_timestamp,
              '$edited_timestamp': comment.edited_timestamp,
              '$comment_text': comment.comment_text
            },
            callback);
};

var _updateComment = function(id, comment_text, callback) {
    _db.run('UPDATE comments SET comment_text=$comment_text, edited_timestamp=$edited_timestamp WHERE id=$id',
            { '$comment_text': comment_text,
              '$edited_timestamp': new Date().getTime(),
               '$id': id
            },
            callback);
};

var _deleteComment = function(id, callback) {
    // just mark the row as deleted
    _db.run('UPDATE comments SET deleted=1 WHERE id=$id',
            { '$id': id },
            callback);
};

// assume params are clean
var _getComments = function(repo_name, sha, callback) {
    // FIXME stores in memory so assuming not a whole lot of comments
    _db.all('SELECT * from comments WHERE repo_name = $repo_name AND commit_sha LIKE $commit_sha || "%" AND deleted = 0',
             { '$repo_name': repo_name,
               '$commit_sha': sha },
             function(error, rows) {
                 callback(error, rows);
             });
};

var _sendNewCommentEmail = function(comment) {
    var mailto = _settings.repos[comment.repo_name].mailto;
    var SMTP = _settings.SMTP;

    if (!mailto || !SMTP) {
        console.log('mailto: ' + mailto + ', SMTP: ' + sys.inspect(SMTP));
        return;
    }

    // borrow showdown from the client
    var showdown = require('./client/3rdparty/showdown.js');
    // TODO - templatize
    var preamble = '[gopost] ';
    var email_body = comment.url +
                     '\n\n-----------------\n\n' +
                     comment.comment_text +
                     '\n\n-----------------\n\n';
    var email_html = showdown(email_body);

    nodemailer.SMTP = SMTP;
    nodemailer.send_mail(
        // e-mail options
        {
            sender: 'gopost-noreply@wimba.com',
            to: mailto,
            // TODO better commit info ([..] comment added to (repo/aef6538) - add new foo in bar baz)
            subject: '[gopost] comment added to ' + comment.repo_name + '/' + comment.commit_sha.substr(0, 6), 
            html: email_html,
            body: email_body
        },
        // callback function
        function(error, success) {
            console.log('Message ' + success ? 'sent' : 'failed');
        });
};

// Testing
/*
(function(){
    _addComment( {
        'repo_name': 'linepost',
        'commit_sha': 'a084bff88',
        'file_idx': '1',
        'row_idx': '2',
        'timestamp': new Date().getTime(),
        'comment_text': '"Hey there guy"'
    },
    function(error) { if(error) { throw error; } });

    //_getComments('linepost', 'ae12', function(rows) {_log(res, sys.inspect(rows));});
}());
*/

var _log = function(req, msg) {
    console.log((req.socket && req.socket.remoteAddress) +
                ' - - [' + (new Date).toUTCString() + '] ' + msg);
};

var _api_sendError = function(error_code, error_msg, res) {
    var error_stringified = JSON.stringify({'error': error_msg});

    res.writeHead(error_code,
                  {'Content-Type': 'application/json',
                   'Content-Length': error_stringified.length});
    res.write(error_stringified);
    res.end();
    _log(res, 'sent api error code: ' + error_code + ', error: ' + error_stringified);
};

// TODO - nicer 404 pages etc
var _content_sendError = function(error_code, error_msg, res) {
    res.writeHead(error_code,
                  {'Content-Type': 'text/plain',
                   'Content-Length': error_msg.length});
    res.write(error_msg);
    res.end();
    _log(res, 'sent content error code: ' + error_code + ', error: ' + error_msg);
};

var _getGitShow = function(repo_name, sha, callback) {
    // SHA \01
    // Author Name <Author Email>\01
    // Subject \n Body \01
    // Author Date \01
    // DIFF EOF
    var format_str = '--pretty=format:"%H\01%an\01%ae\01%s\n%b\01%at\01"';
    exec(_settings.git_bin + ' show ' + format_str + ' ' + sha,
          {cwd: _settings.repos[repo_name].repo_dir},
          function(error, stdout, stderr) {
              if (error) {
                  callback({status: 500, message: 'Error running git show: ' + error}, null);
              }
              else if (stdout.length === 0) {
                  callback({status: 500, message: 'Error running git show - no output'}, null);
              }
              else {
                  var split_output_array = stdout.split('\01', 6);

                  if (split_output_array.length !== 6) {
                      callback({status: 500, message: 'Error running git show - bad output: ' + stdout}, null);
                  }
                  else {
                      var response = {
                            'sha': split_output_array[0],
                            'author-name': split_output_array[1],
                            'author-email': split_output_array[2],
                            'subject-and-body': split_output_array[3],
                            'author-date': split_output_array[4],
                            'diff': split_output_array[5]
                      };
                      callback(null, response);
                  }
              }
          });
};

var _getGitLog = function(repo_name, branch, max_count, callback) {
    
    var format_str = '--pretty=format:"%h\01%an\01%ae\01%s\01%at"';
    console.log(' origin/' + branch);
    exec(_settings.git_bin + ' log --max-count=' + max_count + ' ' + format_str + ' origin/' + branch,
        {cwd: _settings.repos[repo_name].repo_dir},
        function(error, stdout, stderr) {
            if (error) {
                callback({status: 500, message: 'Error running git log: ' + error}, null);
                return;
            }        
            var lines = stdout.split('\n');
            var result = [];
            for (idx in lines) {
                var split_line = lines[idx].split('\01');
                if (split_line.length !== 5) {
                    // TODO - shouldn't need to stop the whole boat when this happends
                    callback({status: 500, message: 'Error running git log - bad output: ' + stdout}, null);
                }
                else {
                    result.push({
                        'sha': split_line[0],
                        'author-name': split_line[1],
                        'author-email': split_line[2],
                        'subject': split_line[3],
                        'author-date': split_line[4]
                    });
                }
            }
            callback(null, result);
        });
};

var _content_sendCommitPage = function(reponame, sha, res) {
    // TODO - static page
    // all that's needed is to look at the window.url
    res.render('commit.haml', {
        locals: {'sha': sha,
                 'repo': reponame },
        layout: false});
};

var _renderRecentBranch = function (req, res, branch) {
    var repo_name = req.params.repo;

    if (_settings.repos[repo_name] === undefined) {
        var msg = 'Undefined repo: "' + repo_name + '"';
        _content_sendError(404, msg, res);
        return;
    }

    _getGitLog(repo_name, branch, 100, function(error, result) {
        if (error) {
            _content_sendError(error.status, error.message, res);
            return;
        }
        res.render('recent.jade', {
            locals: {
                'repo': repo_name,
                'branch': branch,
                'loglines': result,
                'gravatar': _settings.gravatar
            },
            layout: false
        });
    });
};


// ----- App middleware + routing
app.use(connect.logger());

app.use(express.static(__dirname + '/client'));

app.use(express.bodyParser());

// ----- html/json commit responder actions
var _respond = {
    'html': function(repo_name, branch, sha, res) {
        // TODO - generate this once & cache,
        // use window.location to infer all ajax calls
        // no need to have a tailored-with-urls copy for this commit
        res.render('commit.jade', {
            locals: {
                'sha': sha,
                'repo': repo_name,
                'branch': branch,
                'gravatar': _settings.gravatar
            },
            layout: false
        });
    },
    'json': function(repo_name, branch, sha, res) {
        // return the git-show results & comments in one response
        var git_show_and_comments = {};

        _getGitShow(repo_name, sha, function(error, result) {
            if (error) {
                _api_sendError(error.status, error.message, res);
                return;
            }

            git_show_and_comments.git_show = result;

            _getComments(repo_name, sha, function(error, result) {
                if (error) {
                    _api_sendError(error.status, error.message, res);
                    return;
                }
                git_show_and_comments.comments = result;
                var stringified_response = JSON.stringify(git_show_and_comments);
                res.writeHead(200, {'Content-Length': stringified_response.length,
                                    'Content-Type': 'application/json'});
                res.write(stringified_response);
                res.end();
            });
        });
    }
};

var _respondWithError = {
    'html': _content_sendError,
    'json': _api_sendError
};

app.get('/:repo/:branch', function(req, res) {
    _renderRecentBranch(req, res, req.params.branch);
});

app.get('/:repo', function(req, res) {
    _renderRecentBranch(req, res, "master");
});

app.get('/:repo/:branch/:sha', function(req, res) {
    console.log(sys.inspect(req));
    var repo_name = req.params.repo;
    var branch = req.params.branch;
    var sha = req.params.sha;
    var format = req.query.format || 'html';

    // Do we have this repo name mapped to a local dir?
    if (_settings.repos[repo_name].repo_dir === undefined) {
        var msg = 'Undefined repo: "' + repo_name + '"';
        try {
            _respondWithError[format](404, msg, res);
        }
        catch (e1) {
            _content_sendError(415, 'Unknown format: ' + format, res);
        }
        return;
    }

    if (_isGoodSha(sha)) {
        try {
            _respond[format](repo_name, branch, sha, res);
        }
        catch (e2) {
            _content_sendError(415, 'Unknown format: ' + format, res);
        }
        return;
    }
    else {
        _content_sendError(404, 'Bad sha: "' + sha + '"', res);
    }
});

// add a new comment
app.post('/:repo/:branch/:sha/comments', function(req, res) {
    var repo_name = req.params.repo;
    var sha = req.params.sha;
    _log(res, 'Received POST body: ' + sys.inspect(req.body));

    // TODO - validate vals?
    var now = new Date().getTime();
    var comment = {
        comment_text: req.body.comment_text,
        row_idx: req.body.row_idx,
        file_idx: req.body.file_idx,
        commit_sha: sha,
        repo_name: repo_name,
        added_timestamp: now,
        edited_timestamp: now
    };

    _addComment(comment, function(error) {
        if (error) {
            _api_sendError(500, error, res);
        }
        else {
            var result_stringified = JSON.stringify(this);
            res.writeHead(200, {
                'Content-Type': 'application/json',
                'Content-Length': result_stringified.length
             });
            res.write(result_stringified);
            res.end();
            // TODO - setTimeout(~5mins, check if comment id still exists, then send)
            // TODO - get comment anchor scheme elsewhere
            comment.url = _settings.base_url +
                          repo_name + '/sha/' + sha +
                          '#comment_id_' + this.lastID;

            _sendNewCommentEmail(comment);
        }
    });
});

// edit an existing comment
app.put('/:repo/:branch/:sha/comments/:id', function(req, res) {
    _log(res, 'Received PUT body: ' + sys.inspect(req.body));

    // TODO - validate?
    _updateComment(req.params.id, req.body.comment_text, function(error) {
        if (error) {
            _api_sendError(500, error, res);
        }
        else {
            res.writeHead(200);
            res.end();
        }
    });
});

// delete a comment
app.delete('/:repo/:branch/:sha/comments/:id', function(req, res) {
    _deleteComment(req.params.id, function(error) {
        if (error) {
            _api_sendError(500, error, res);
        }
        else {
            res.writeHead(200);
            res.end();
        }
    });
});

app.listen(3000);
