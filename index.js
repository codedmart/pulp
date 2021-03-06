#!/usr/bin/env node

var args = require("./args");
var log = require("./log");
var validate = require("./validate");
var files = require("./files");
var merge = require("merge");
var path = require("path");

var defaultDependencyPath = files.readJson(".bowerrc").directory || "bower_components";

var globals = [
  args.option(
    "bowerFile", ["--bower-file", "-b"], args.file,
    "Read this bower.json file instead of autodetecting it."
  ),
  args.option(
    "watch", ["--watch", "-w"], args.flag,
    "Watch source directories and re-run command if something changes."
  ),
  args.option(
    "monochrome", ["--monochrome"], args.flag,
    "Don't colourise log output."
  ),
  args.option(
    "then", ["--then"], args.string,
    "Run a shell command after the operation finishes. Useful with `--watch`."
  )
];

// Options for any command requiring paths
var pathArgs = [
  args.option(
    "includePaths", ["--include", "-I"], args.directories,
    "Additional source directories, separated by `" + path.delimiter + "`."
  ),
  args.option(
    "srcPath", ["--src-path"], args.directory,
    "Directory for PureScript source files.",
    "src"
  ),
  args.option(
    "testPath", ["--test-path"], args.directory,
    "Directory for PureScript test files.",
    "test"
  ),
  args.option(
    "dependencyPath", ["--dependency-path"], args.directory,
    "Directory for PureScript dependency files.",
    defaultDependencyPath
  )
];

// Options common to 'build', 'test' and 'browserify'
var buildishArgs = pathArgs.concat([
  args.option(
    "buildPath", ["--build-path", "-o"], args.string,
    "Path for compiler output.", "./output"
  ),
  args.option(
    "optimise", ["--optimise", "-O"], args.flag,
    "Perform dead code elimination."
  ),
  args.option(
    "force", ["--force"], args.flag,
    "Force a build even if no source files have changed."
  )
]);

var buildArgs = buildishArgs.concat([
  args.option(
    "main", ["--main", "-m"], args.string,
    "Application's entry point.", "Main"
  ),
  args.option(
    "to", ["--to", "-t"], args.string,
    "Output file name (stdout if not specified)."
  ),
  args.option(
    "modules", ["--modules"], args.string,
    "Additional modules to be included in the output bundle (comma-separated list)."
  )
]);

var commands = [
  args.command(
    "init", "Generate an example PureScript project.", function() {
      return require("./init").apply(this, arguments);
    }, [
      args.option(
        "force", ["--force"], args.flag,
        "Overwrite any project found in the current directory."
      )
    ]
    // noProject: true
  ),
  args.command(
    "dep", "Invoke Bower for package management.", function() {
      return require("./bower").apply(this, arguments);
    }
  ),
  args.command(
    "build", "Build the project.", function() {
      return require("./build").apply(this, arguments);
    }, buildArgs
  ),
  args.command(
    "test", "Run project tests.", function() {
      return require("./test").apply(this, arguments);
    }, [
      args.option(
        "main", ["--main", "-m"], args.string,
        "Test entry point.", "Test.Main"
      ),
      args.option(
        "testRuntime", ["--runtime", "-r"], args.string,
        "Run test script using this command instead of Node."
      ),
      args.option(
        "engine", ["--engine"], args.string,
        "Use the specified command to run compiled code", "node"
      )
    ].concat(buildishArgs)
  ),
  args.command(
    "browserify", "Produce a deployable bundle using Browserify.",
    function() {
      return require("./browserify").apply(this, arguments);
    }, buildishArgs.concat([
      args.option(
        "to", ["--to", "-t"], args.string,
        "Output file name (stdout if not specified)."
      ),
      args.option(
        "main", ["--main", "-m"], args.string,
        "Application's entry point.", "Main"
      ),
      args.option(
        "transform", ["--transform"], args.string,
        "Apply a Browserify transform."
      ),
      args.option(
        "sourceMap", ["--source-map"], args.string,
        "Generate source maps."
      ),
      args.option(
        "skipEntryPoint", ["--skip-entry-point"], args.flag,
        "Don't add code to automatically invoke Main."
      )
    ])
  ),
  args.command(
    "run", "Compile and run the project.", function() {
      return require("./run").apply(this, arguments);
    }, [
      args.option(
        "engine", ["--engine"], args.string,
        "Use the specified command to run compiled code", "node"
      )
    ].concat(buildArgs)
  ),
  args.command(
    "docs", "Generate project documentation.", function() {
      return require("./docs").apply(this, arguments);
    }, pathArgs.concat([
      args.option(
        "withTests", ["--with-tests", "-t"], args.flag,
        "Include tests."
      ),
      args.option(
        "withDeps", ["--with-deps", "-d"], args.flag,
        "Include external dependencies."
      )
    ])
  ),
  args.command(
    "psci", "Launch a PureScript REPL configured for the project.",
    function() {
      return require("./psci").apply(this, arguments);
    }, pathArgs
  ),
  args.command(
    "server", "Launch a Webpack development server.",
    function() {
      return require("./server").apply(this, arguments);
    }, buildishArgs.concat([
      args.option(
        "main", ["--main", "-m"], args.string,
        "Application's entry point.", "Main"
      ),
      args.option(
        "config", ["--config", "-c"], args.file,
        "Override the default Webpack config."
      ),
      args.option(
        "port", ["--port", "-p"], args.int,
        "Port number to listen on.", 1337
      ),
      args.option(
        "host", ["--host"], args.string,
        "IP address to bind the server to.", "localhost"
      ),
      args.option(
        "noInfo", ["--no-info"], args.flag,
        "Display no info to the console, only warnings and errors."
      ),
      args.option(
        "quiet", ["--quiet", "-q"], args.flag,
        "Display nothing to the console when rebuilding."
      )
    ])
  )
];

var opts = args.parse(globals, commands, process.argv.slice(2));

module.exports.opts = opts;

if (args.isError(opts) && opts.help && opts.context === "dep") {
  // Special treatment for `pulp dep --help`
  opts = {
    command: {
      action: function() {
        return require("./bower").apply(this, arguments);
      }
    },
    remainder: ["help"]
  };
  var ansi = require("ansi")(process.stderr);
  ansi.bold().write("Dependency Management with Bower\n\n").reset();
  console.error("The `pulp dep` command invokes the Bower package manager.");
  console.error("Run Bower commands like eg. `pulp dep install` instead of `bower install`.\n");
  console.error("Consult Bower's help page for the available commands:");
}

if (args.isError(opts)) {
  if (opts.version) {
    console.log(require('./package.json').version);
    process.exit(0);
  }
  if (!opts.help) {
    var ansi = require("ansi")(process.stderr);
    ansi.red().bold().write("Error:").reset().write(" ");
    console.error(opts.message, "\n");
  }
  args.help(globals, commands, opts.context, process.stderr);
  process.exit(1);
}

opts = merge(opts.opts, opts.commandOpts, {
  command: opts.command,
  remainder: opts.remainder
});

function done(opts) {
  return function doneFunc(err) {
    if (err) {
      log.error("ERROR:", err.message);
      process.exit(1);
    } else {
      if (opts.then) {
        require("./shell")(opts.then, done({}));
      } else {
        process.exit(0);
      }
    }
  };
}

if (opts.monochrome) {
  log.mono(true);
}


var command = opts.command;

validate(function() {
  if (command.name === "init") {
    command.action(opts, done(opts));
  } else {
    require("./project")(opts, function(err, pro) {
      if (err) {
        log.error("ERROR:", err.message);
        process.exit(1);
      } else {
        if (opts.watch) {
          require("./watch")();
        } else {
          command.action(pro, opts, done(opts));
        }
      }
    });
  }
});
