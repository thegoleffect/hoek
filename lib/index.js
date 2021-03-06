// Load modules

var Fs = require('fs');


// Declare internals

var internals = {};


// Clone object or array

exports.clone = function (obj) {

    if (obj != null && typeof obj != 'undefined') {
        return exports.extend({}, obj);
    }
    return null;
};


exports.extend = function (target, source, seen) {

    var newObj = (source instanceof Array) ? [] : {};
    seen = seen || [source];
    
    if (Object.keys(target).length > 0) {
        newObj = exports.clone(target);
    }
    
    Object.keys(source).forEach(function (key) {

        var descriptor = Object.getOwnPropertyDescriptor(source, key);
        var orig = descriptor.value;
        
        if (orig instanceof Date) {
            descriptor.value = new Date(orig.getTime());
        }
        else if (orig instanceof RegExp) {
            var flags = '' + (orig.global ? 'g' : '') + (orig.ignoreCase ? 'i' : '') + (orig.multiline ? 'm' : ''); // y is a firefox only thing + (orig.sticky ? 'y' : '');
            descriptor.value = new RegExp(orig.source, flags);
        }
        else if (orig instanceof Array) {
            descriptor.value = orig.slice();
        }
        else if (typeof orig == 'object') {
            if (seen.indexOf(orig) >= 0) {
                // Cyclic Reference Detected
            }
            else {
                descriptor.value = exports.extend({}, orig, seen);
                seen.push(descriptor.value)
            }
        }
        else {
            // Should just be ignorable immutables here (String, Number, Boolean...)
        }
        
        Object.defineProperty(newObj, key, descriptor);
    });
    
    return newObj;
};


// Merge all the properties of source into target, source wins in conflic, and by default null and undefined from source are applied

exports.merge = function (target, source, isNullOverride /* = true */, isMergeArrays /* = true */) {

    exports.assert(target && typeof target == 'object', 'Invalid target value: must be an object');
    exports.assert(source === null || source === undefined || typeof source === 'object', 'Invalid source value: must be null, undefined, or an object');

    if (!source) {
        return target;
    }

    if (source instanceof Array) {
        exports.assert(target instanceof Array, 'Cannot merge array onto an object');
        if (isMergeArrays === false) {                                                  // isMergeArrays defaults to true
            target.length = 0;                                                          // Must not change target assignment
        }

        source.forEach(function (item) {

            target.push(item);
        });

        return target;
    }

    Object.keys(source).forEach(function (key) {

        var value = source[key];
        if (value &&
            typeof value === 'object') {

            if (!target[key] ||
                typeof target[key] !== 'object') {

                target[key] = exports.clone(value);
            }
            else {
                exports.merge(target[key], source[key], isNullOverride, isMergeArrays);
            }
        }
        else {
            if (value !== null && value !== undefined) {            // Explicit to preserve empty strings
                target[key] = value;
            }
            else if (isNullOverride !== false) {                    // Defaults to true
                target[key] = value;
            }
        }
    });

    return target;
};


// Apply options to a copy of the defaults

exports.applyToDefaults = function (defaults, options) {

    exports.assert(defaults && typeof defaults == 'object', 'Invalid defaults value: must be an object');
    exports.assert(!options || options === true || typeof options === 'object', 'Invalid options value: must be true, falsy or an object');

    if (!options) {                                                 // If no options, return null
        return null;
    }

    var copy = exports.clone(defaults);

    if (options === true) {                                         // If options is set to true, use defaults
        return copy;
    }

    return exports.merge(copy, options, false, false);
};


// Remove duplicate items from array

exports.unique = function (array, key) {

    var index = {};
    var result = [];

    for (var i = 0, il = array.length; i < il; ++i) {
        var id = (key ? array[i][key] : array[i]);
        if (index[id] !== true) {

            result.push(array[i]);
            index[id] = true;
        }
    }

    return result;
};


// Convert array into object

exports.mapToObject = function (array, key) {

    if (!array) {
        return null;
    }

    var obj = {};
    for (var i = 0, il = array.length; i < il; ++i) {
        if (key) {
            if (array[i][key]) {
                obj[array[i][key]] = true;
            }
        }
        else {
            obj[array[i]] = true;
        }
    }

    return obj;
};


// Find the common unique items in two arrays

exports.intersect = function (array1, array2) {

    if (!array1 || !array2) {
        return [];
    }

    var common = [];
    var hash = exports.mapToObject(array1);
    var found = {};
    for (var i = 0, il = array2.length; i < il; ++i) {
        if (hash[array2[i]] && !found[array2[i]]) {
            common.push(array2[i]);
            found[array2[i]] = true;
        }
    }

    return common;
};


// Find which keys are present

exports.matchKeys = function (obj, keys) {

    var matched = [];
    for (var i = 0, il = keys.length; i < il; ++i) {
        if (obj.hasOwnProperty(keys[i])) {
            matched.push(keys[i]);
        }
    }
    return matched;
};


// Flatten array

exports.flatten = function (array, target) {

    var result = target || [];

    for (var i = 0, il = array.length; i < il; ++i) {
        if (Array.isArray(array[i])) {
            exports.flatten(array[i], result);
        }
        else {
            result.push(array[i]);
        }
    }

    return result;
};


// Remove keys

exports.removeKeys = function (object, keys) {

    for (var i = 0, il = keys.length; i < il; i++) {
        delete object[keys[i]];
    }
};


// Convert an object key chain string ('a.b.c') to reference (object[a][b][c])

exports.reach = function (obj, chain) {

    var path = chain.split('.');
    var ref = obj;
    path.forEach(function (level) {

        if (ref) {
            ref = ref[level];
        }
    });

    return ref;
};


// Inherits a selected set of methods from an object, wrapping functions in asynchronous syntax and catching errors

exports.inheritAsync = function (self, obj, keys) {

    keys = keys || null;

    for (var i in obj) {
        if (obj.hasOwnProperty(i)) {
            if (keys instanceof Array &&
                keys.indexOf(i) < 0) {

                continue;
            }

            self.prototype[i] = (function (fn) {

                return function (callback) {

                    var result = null;
                    try {
                        result = fn();
                    }
                    catch (err) {
                        return callback(err);
                    }

                    return callback(null, result);
                };
            })(obj[i]);
        }
    }
};


exports.callStack = function (slice) {

    // http://code.google.com/p/v8/wiki/JavaScriptStackTraceApi

    var v8 = Error.prepareStackTrace;
    Error.prepareStackTrace = function (err, stack) {

        return stack;
    };

    var capture = {};
    Error.captureStackTrace(capture, arguments.callee);
    var stack = capture.stack;

    Error.prepareStackTrace = v8;

    var trace = [];
    stack.forEach(function (item) {

        trace.push([item.getFileName(), item.getLineNumber(), item.getColumnNumber(), item.getFunctionName(), item.isConstructor()]);
    });

    if (slice) {
        return trace.slice(slice);
    }

    return trace;
};


exports.displayStack = function (slice) {

    var trace = exports.callStack(slice === undefined ? 1 : slice + 1);
    var display = [];
    trace.forEach(function (row) {

        display.push((row[4] ? 'new ' : '') + row[3] + ' (' + row[0] + ':' + row[1] + ':' + row[2] + ')');
    });

    return display;
};


exports.abortThrow = false;


exports.abort = function (message, hideStack) {

    if (process.env.NODE_ENV === 'test' || exports.abortThrow === true) {
        throw new Error(message || 'Unknown error');
    }

    var stack = '';
    if (!hideStack) {
        stack = exports.displayStack(1).join('\n\t');
    }
    console.log('ABORT: ' + message + '\n\t' + stack);
    process.exit(1);
};


exports.assert = function (condition, message) {

    if (!condition) {
        throw new Error(message || 'Unknown error');
    }
};


exports.loadDirModules = function (path, excludeFiles, target) {      // target(filename, name, capName)

    var exclude = {};
    for (var i = 0, il = excludeFiles.length; i < il; ++i) {
        exclude[excludeFiles[i] + '.js'] = true;
    }

    Fs.readdirSync(path).forEach(function (filename) {

        if (/\.js$/.test(filename) &&
            !exclude[filename]) {

            var name = filename.substr(0, filename.lastIndexOf('.'));
            var capName = name.charAt(0).toUpperCase() + name.substr(1).toLowerCase();

            if (typeof target !== 'function') {
                target[capName] = require(path + '/' + name);
            }
            else {
                target(path + '/' + name, name, capName);
            }
        }
    });
};


exports.rename = function (obj, from, to) {

    obj[to] = obj[from];
    delete obj[from];
};


exports.Timer = function () {

    this.reset();
};


exports.Timer.prototype.reset = function () {

    this.ts = Date.now();
};


exports.Timer.prototype.elapsed = function () {

    return Date.now() - this.ts;
};


// Load and parse package.json process root or given directory

exports.loadPackage = function (dir) {

    var result = {};
    var filepath = (dir || process.env.PWD) + '/package.json';
    if (Fs.existsSync(filepath)) {
        try {
            result = JSON.parse(Fs.readFileSync(filepath));
        }
        catch (e) { }
    }

    return result;
};


// Escape string for Regex construction

exports.escapeRegex = function (string) {

    // Escape ^$.*+-?=!:|\/()[]{},
    return string.replace(/[\^\$\.\*\+\-\?\=\!\:\|\\\/\(\)\[\]\{\}\,]/g, '\\$&');
};


// Return an error as first argument of a callback

exports.toss = function (condition /*, [message], callback */) {

    var message = (arguments.length === 3 ? arguments[1] : '');
    var callback = (arguments.length === 3 ? arguments[2] : arguments[1]);

    var err = (message instanceof Error ? message : (message ? new Error(message) : (condition instanceof Error ? condition : new Error())));

    if (condition instanceof Error ||
        !condition) {

        return callback(err);
    }
};


// Base64url (RFC 4648) encode

exports.base64urlEncode = function (value) {

    return (new Buffer(value, 'binary')).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/\=/g, '');
};


// Base64url (RFC 4648) decode

exports.base64urlDecode = function (encoded) {

    if (encoded &&
        !encoded.match(/^[\w\-]*$/)) {

        return new Error('Invalid character');
    }

    try {
        return (new Buffer(encoded.replace(/-/g, '+').replace(/:/g, '/'), 'base64')).toString('binary');
    }
    catch (err) {
        return err;
    }
};


// Escape attribute value for use in HTTP header

exports.escapeHeaderAttribute = function (attribute) {

    return attribute.replace(/\\/g, '\\\\').replace(/\"/g, '\\"');
};


// Escape string for inclusion in HTML

internals.htmlEscaped = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '`': '&#x60;'
};

exports.escapeHtml = function (string) {

    if (!string) {
        return '';
    }

    if (/[&<>"'`]/.test(string) === false) {
        return string;
    }

    return string.replace(/[&<>"'`]/g, function (chr) {

        return internals.htmlEscaped[chr];
    });
};


/*
var event = {
    timestamp: now.getTime(),
    tags: ['tag'],
    data: { some: 'data' }
};
*/

exports.consoleFunc = console.log;

exports.printEvent = function (event) {

    var pad = function (value) {

        return (value < 10 ? '0' : '') + value;
    };

    var now = new Date(event.timestamp);
    var timestring = (now.getYear() - 100).toString() +
        pad(now.getMonth() + 1) +
        pad(now.getDate()) +
        '/' +
        pad(now.getHours()) +
        pad(now.getMinutes()) +
        pad(now.getSeconds()) +
        '.' +
        now.getMilliseconds();

    var data = event.data;
    if (typeof event.data !== 'string') {
        try {
            data = JSON.stringify(event.data);
        }
        catch (e) {
            data = 'JSON Error: ' + e.message;
        }
    }

    var output = timestring + ', ' + event.tags[0] + ', ' + data;
    exports.consoleFunc(output);
};
