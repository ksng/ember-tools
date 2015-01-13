var exec = require('child_process').exec;
var fs = require('../util/fs');
var glob = require('glob');
var handlebars = require('handlebars');
var appDirs = require('../util/appDirs');
var message = require('../util/message');
var inflector = require('../util/inflector');
var walk = require('walk').walkSync;
var precompile = require('../util/precompile');
var config = require('../util/config');
var fsmonitor          = require('fsmonitor');
var RelPathList        = require('pathspec').RelPathList;
var color = require('cli-color');
var path = require('path');

module.exports = function(env) {
  env.watch ? watchBuild(env) : singleBuild(env);
};

function singleBuild(env){
  precompileTemplates(function() {
    createIndex(function() {
      build(env, function() {
       // if (env.cleanup) cleanup();
      });
    });
  });
}

var PATHS = RelPathList.parse(
  [
    '*.js',
    '*.hbs',
    '!application.js',
    '!index.js',
    '!templates.js'
  ]
);

function watchBuild(env){
  message.notify('Watching build...');
  var jsPath = process.cwd() + '/' + config().jsPath;
  fsmonitor.watch(jsPath, PATHS, function(change){
    message.notify('Change detected: ' + change.toString().trim());
    singleBuild(env);
  });
}

function precompileTemplates(cb) {
  precompile(getAssetPath('templates'), getAssetPath('templates.js'), cb);
}

function createIndex(cb) {
  var modules = [];
  var helpers = [];
  appDirs.forEach(function(dirName, index, array) {
    if (dirName == 'templates' || dirName == 'config') return;
    var dirPath = getAssetPath(dirName);
    var walker = walk(dirPath);
    walker.on('file', function(dir, stats, next) {
      if (stats.name.charAt(0) !== '.') {
        var path = unroot(dir+'/'+stats.name).replace(/\.js$/, '');
        if (dirName == 'helpers') {
          helpers.push({path: path});
        } else {
          var name = inflector.objectify(path.replace(dirName, ''));
          modules.push({
            objectName: name,
            path: path
          });
        }
      }
      next();
    });
    walker.on('end', function() {
      if (index != array.length - 1) return;
      var locals = {modules: modules, helpers: helpers};
      fs.writeTemplate('build', 'index.js', locals, getAssetPath('index.js'), 'force');
      cb();
    });
  });
}

function build(env, cb) {
    cb();
}

function cleanup() {
  fs.unlink(getAssetPath('index.js'));
  fs.unlink(getAssetPath('templates.js'));
}

function getAssetPath(path) {
  return config().jsPath+'/'+path;
}

function unroot(path) {
  return path.replace(config().jsPath+'/', '');
}

