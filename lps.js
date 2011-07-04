var express = require('express'),
    connect = require('connect'),
    exec = require('child_process').exec,
    app = express.createServer();

// ----------------
// command for git bin
var _git_bin = 'git';

// repo name -> local repo dir map
var _repos = {};

_repos['linepost'] = '/Users/james/sandbox/linepost';
// ----------------

var _getCommitInfo = function(repo_dir_path, sha, res) {
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
                  console.log('Error running git show: ' + error);
                  res.writeHead(500,
                                'Error running git show: ' + error,
                                {'Content-Type': 'text/plain'});
              }
              else if (stderr) {
                  console.log('Error running git show - has stderr: ' + stderr);
                  res.writeHead(500,
                                'Error running git show - has stderr: ' + stderr,
                                {'Content-Type': 'text/plain'});
              }
              else if (stdout.length == 0) {
                  console.log('Error running git show - no output');
                  res.writeHead(500,
                                'Error running git show - no output',
                                {'Content-Type': 'text/plain'});
              }
              else {
                  var split_output_array = stdout.split('\01');
                  
                  if (split_output_array.length < 5) {
                      console.log('Error running git show - bad output: ' + stdout);
                      res.writeHead(500,
                                   'Error running git show - bad output: ' + stdout,
                                   {'Content-Type': 'text/plain'});
                  }
                  else {
                      console.log('Good output from git-show');
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
                  }
              }
              
              res.end();
          });
}

app.use(connect.logger());

app.get('/:repo/:sha', function(req, res) {
    _getCommitInfo(_repos[req.params.repo], req.params.sha, res);
});

app.listen(3000);