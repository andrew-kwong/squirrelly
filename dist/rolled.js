(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory() :
    typeof define === 'function' && define.amd ? define(factory) :
    (factory());
}(this, (function () { 'use strict';

    var exports$1 = module.exports = {};
    exports$1.Utils = require('./utils.js'); // For user-accessible ones
    exports$1.Compiler = {
        parseFiltered: require('./parseFiltered.js')
    }; // For RegExp's, etc.
    exports$1.Helpers = require('./helpers.js');
    exports$1.H = exports$1.Helpers;
    /* These two are technically just helpers, but in Squirrelly they're 1st-class citizens. */
    exports$1.Partials = {}; // For partials
    exports$1.P = exports$1.Partials;
    exports$1.Layouts = {}; // For layouts
    exports$1.registerLayout = function (name, callback) {

    };
    exports$1.registerHelper = function (name, callback) {
        exports$1.Helpers[name] = callback;
        exports$1.H = exports$1.Helpers;
    };

    exports$1.Render = function (template, options) {
        return template(options, exports$1)
    };

    exports$1.F = require('./filters.js');

    exports$1.Filters = exports$1.F;

    exports$1.registerFilter = function (name, callback) {
        exports$1.F[name] = callback;
        exports$1.Filters = exports$1.F;
    };

    exports$1.precompileHelpers = require('./precompileHelpers.js');
    exports$1.Precompile = function (str) {
        var regEx = /{{ *?(?:(?:(?:(?:([a-zA-Z_$]+[\w]*? *?(?:[^\s\w\($]+[^\n]*?)*?))|(?:@(?:([\w$]+:|(?:\.\.\/)+))? *(.+?) *))(?: *?(\| *?[^\n]+ *?)*)*)|(?:([a-zA-Z_$]+[\w]*) *?\(([^\n]*)\) *?([A-Za-z$_]*[\w]*))|(?:\/ *?([a-zA-Z_$]+[\w]*))|(?:# *?([a-zA-Z_$]+[\w]*))|(?:([^]+?))) *?}}/g;
        var paramHRef = /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|[\\]@(?:[\w$]*:)?[\w$]+|@(?:([\w$]*):)?([\w$]+)/g;
        var lastIndex = 0;
        var funcStr = "";
        var helperArray = [];
        var helperNumber = -1;
        var helperAutoId = 0;
        var varName = "tmpltRes";
        var helperContainsBlocks = {};
        while ((m = regEx.exec(str)) !== null) {
            // This is necessary to avoid infinite loops with zero-width matches
            if (m.index === regEx.lastIndex) {
                regEx.lastIndex++;
            }
            if (helperNumber < 0) {
                varName = "tmpltRes";
            }
            if (funcStr === "") {
                funcStr += "var tmpltRes=\'" + str.slice(lastIndex, m.index).replace(/'/g, "\\'") + '\';';
            } else {
                if (lastIndex !== m.index) {
                    funcStr += varName + '+=\'' + str.slice(lastIndex, m.index).replace(/'/g, "\\'") + '\';';
                }
            }
            lastIndex = m[0].length + m.index;
            if (m[1]) {
                //It's a global ref. p4 = filters
                funcStr += varName + '+=' + globalRef(m[1], m[4]) + ';';
            } else if (m[3]) {
                //It's a helper ref. p2 = id (with ':' after it) or path, p4 = filters
                funcStr += varName + '+=' + helperRef(m[3], m[2], m[4]) + ';';
            } else if (m[5]) {
                //It's a helper oTag. p6 parameters, p7 id
                var id = m[7];
                if (id === "" || id === null) {
                    id = helperAutoId;
                    helperAutoId++;
                }
                helperNumber += 1;
                var helperTag = {
                    name: m[5],
                    id: id
                };
                var params = m[6] || "";
                if (paramHRef.test(params)) {
                    params = '[' + params.replace(paramHRef, function (m, p1, p2) { // p1 scope, p2 string
                        if (typeof p2 === 'undefined') {
                            return m
                        } else {
                            if (typeof p1 === 'undefined') {
                                p1 = '';
                            }
                            return 'helpervals' + p1 + '.' + p2
                        }
                    }) + ']';
                } else {
                    params = '[' + params + ']';
                }
                helperArray[helperNumber] = helperTag;
                funcStr += varName + '+=Sqrl.H.' + m[5] + '(' + params + ',function(hvals){var hvals' + id + '=hvals;var blockRes="";';
                varName = 'blockRes';
            } else if (m[8]) {
                //It's a helper cTag.
                var mostRecentHelper = helperArray[helperNumber];
                if (mostRecentHelper && mostRecentHelper.name === m[8]) {
                    helperNumber -= 1;
                    if (helperContainsBlocks[mostRecentHelper.id]) {
                        funcStr += "return blockRes}});";
                    } else {
                        funcStr += "return blockRes});";
                    }
                }
            } else if (m[9]) {
                //It's a helper block.
                var parentId = helperArray[helperNumber].id;
                //console.log("parentId: " + parentId)
                if (!helperContainsBlocks[parentId]) {
                    funcStr += "return blockRes}, {" + m[9] + ":function(hvals){var hvals" + parentId + "=hvals;var blockRes=\'\';";
                    helperContainsBlocks[parentId] = true;
                } else {
                    funcStr += "return blockRes}}," + m[9] + ":function(hvals){var hvals" + parentId + "=hvals;var blockRes=\'\';";
                }
            } else if (m[10]) ; else {
                console.error("Err: Code 000");
            }
            //console.log("funcStr is now: " + funcStr)

            function globalRef(refName, filters) {
                return exports$1.Compiler.parseFiltered('options.' + refName, filters)
            }

            function helperRef(name, id, filters) {
                var prefix;
                if (typeof id !== 'undefined') {
                    if (/(?:\.\.\/)+/g.test(id)) {
                        prefix = helperArray[helperNumber - (id.length / 3)].id;
                        //console.log("prefix: " + prefix)
                    } else {
                        prefix = id.slice(0, -1);
                        //console.log("prefix: " + prefix)
                    }
                }
                return exports$1.Compiler.parseFiltered("hvals" + prefix + "." + name)
            }

        }
        if (str.length > regEx.lastIndex) {
            funcStr += 'tmpltRes+=\'' + str.slice(lastIndex, str.length).replace(/'/g, "\\'") + '\';';
        }
        funcStr += 'return tmpltRes';
        //console.log("funcString is: " + funcStr)
        //console.log("funcStr is now: " + funcStr.replace(/\n/g, '\\n').replace(/\r/g, '\\r'))
        var func = new Function('options', 'Sqrl', funcStr.replace(/\n/g, '\\n').replace(/\r/g, '\\r'));
        return func
    };

    exports$1.__express = require('./express.js');

})));