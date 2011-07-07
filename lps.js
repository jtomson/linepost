// ----------------
// command for git bin
var _git_bin = 'git';

// repo name -> local repo dir map
var _repos = {};

_repos['linepost'] = '/Users/james/sandbox/linepost';

// sqlite db
var _db = {};
var _db_path = 'lps.sdb';

// ----------------

var express = require('express'),
    connect = require('connect'),
    sys = require('sys'),
    fs = require('fs'),
    exec = require('child_process').exec,
    sqlite3 = require('sqlite3').verbose(),
    app = express.createServer();

//-------------------------
// Initialization
//-------------------------

(function() {
    var is_new_db = false;
    
    try {
        fs.lstatSync(_db_path);
    }
    catch (error) {
        is_new_db = true;
    }
    
    _db = new sqlite3.Database(_db_path, function(error) { if (error) throw error; });
    
    // calls are queued so we can start using the db even if we haven't completed open above
    if (is_new_db) {
        _db.run('CREATE TABLE lps( ' +
                'id INTEGER PRIMARY KEY AUTOINCREMENT, ' +
                'commit_sha TEXT, ' +
                'file_idx INTEGER, ' +
                'diff_row INTEGER, ' +
                'comment TEXT );', function(error) {if (error) throw error;} );
    }
})();

var _api_sendError = function(error_code, error_msg, res) {
    var error_stringified = JSON.stringify({'error': error_msg});
    
    res.writeHead(error_code,
                  {'Content-Type': 'application/json',
                   'Content-Length': error_stringified.length});
    res.write(error_stringified);
    res.end();
    console.log('sent api error code: ' + error_code + ', error: ' + error_stringified );
}

// TODO - nicer 404 pages etc
var _content_sendError = function(error_code, error_msg, res) {
    res.writeHead(error_code,
                  {'Content-Type': 'text/plain',
                   'Content-Length': error_msg.length});
    res.write(error_msg);
    res.end();
    console.log('sent content error code: ' + error_code + ', error: ' + error_msg );
}

var _api_sendGitShow = function(repo_dir_path, sha, res) {
    // SHA \01
    // Author Name <Author Email>\01
    // Subject \n Body \01
    // Author Date \01
    // DIFF
    var format_str = '--pretty=format:"%H\01%an <%ae>\01%s\n%b\01%at\01"';
    exec( _git_bin + ' show ' + format_str + ' ' + sha,
          {cwd: repo_dir_path},
          function(error, stdout, stderr) {
              if (error) {
                  _api_sendError(500, 'Error running git show: ' + error, res);
              }
              else if (stderr) {
                  _api_sendError(500, 'Error running git show - has stderr: ' + stderr, res);
              }
              else if (stdout.length == 0) {
                  _api_sendError(500, 'Error running git show - no output');
              }
              else {
                  var split_output_array = stdout.split('\01');
                  
                  if (split_output_array.length != 5) {
                      _api_sendError(500, 'Error running git show - bad output: ' + stdout, res);
                  }
                  else {
                      var stringified_commit = JSON.stringify({
                            'sha': split_output_array[0],
                            'author-name-and-email': split_output_array[1],
                            'subject-and-body': split_output_array[2],
                            'author-date': split_output_array[3],
                            'diff': split_output_array[4]
                        });
                        
                      res.writeHead(200, {'Content-Length': stringified_commit.length,
                                          'Content-Type': 'application/json'});
                      res.write(stringified_commit);
                      res.end();
                      console.log('sent good output from git-show');
                  }
              }
          });
}

var _content_sendCommitPage = function(repo, sha, res) {
    // TODO render template, include ajax-pull to api
    res.render('commit.haml', {
        locals: {'sha': sha},
        layout: false});
}

var _isGoodSha = function(sha) {
    var sha_matches = sha.match(/(?:\d|[a-f]){6,40}/i);
    return (sha_matches !== null && sha_matches.length == 1);
}

app.use(connect.logger());

app.get('/api/git-show/:repo/:sha', function(req, res) {
    var repo = req.params.repo;
    var sha = req.params.sha;
    
    // Do we have this repo name mapped to a local dir?
    if (_repos[repo] === undefined) {
        // TODO - nicer 404
        _api_sendError(404, 'undefined repo: "' + repo + '"', res);
    }
    else if (_isGoodSha(sha)) {
        _api_sendGitShow(_repos[req.params.repo], req.params.sha, res);
    }
    else {
        _api_sendError(404, 'bad sha: "' + sha + '"', res);
    }
});

app.get('/:repo/:sha', function(req, res) {
    var repo = req.params.repo;
    var sha = req.params.sha;
    
    // Do we have this repo name mapped to a local dir?
    if (_repos[repo] === undefined) {
        // TODO - nicer 404
        _content_sendError(404, 'Undefined repo: "' + repo + '"', res);
    }
    else if (_isGoodSha(sha)) {
        _content_sendCommitPage(_repos[req.params.repo], req.params.sha, res);
    }
    else {
        _content_sendError(404, 'Bad sha: "' + sha + '"', res);
    }
});

app.listen(3000);