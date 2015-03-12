define([
    'jquery',
    'underscore',
    'vellum/tsv',
    'vellum/core'
], function (
    $,
    _,
    tsv
) {
    var PREAMBLE = ["vellum copy/paste", "version 1"],
        vellum,
        offScreen = {top: -10000, left: -10000},
        hiddenTextarea = $('<textarea></textarea>').css({
            position: 'absolute',
            width: 0,
            height: 0
        }).css(offScreen).appendTo('body');

    function focusTextarea($focus, value) {
        if ($focus.length === 0) {
            $focus = $("body");
        }
        hiddenTextarea.css({top: $focus.offset().top});
        hiddenTextarea.val(value);
        hiddenTextarea.focus();
        hiddenTextarea.select();
    }

    function unfocusTextarea($focus) {
        $focus.focus();
        return hiddenTextarea.val();
    }

    function onCopy(opts) {
        var $focus = $(':focus');
        if ($focus.is('.jstree-anchor')) {
            var text = opts.copy();
            if (text) {
                focusTextarea($focus, text);
                setTimeout(function () {
                    unfocusTextarea($focus);
                }, 10);
            }
        }
    }

    function onPaste(opts) {
        var $focus = $(':focus');
        if ($focus.length === 0 || $focus.parents('.fd-tree').length) {
            focusTextarea($focus);
            setTimeout(function () {
                var pasteValue = unfocusTextarea($focus);
                // on chrome this gets called twice,
                // the first time with a blank value
                if (pasteValue) {
                    opts.paste(pasteValue);
                }
            }, 0);
        }
    }

    // matches strings that could be JSON; see http://json.org/
    var JSON_STRING = /^(null|true|false|\[.*\]|\{.*\}|".*"|-?\d+(\.\d+)?([Ee][+-]?\d)?])$/;

    function jsonify(value) {
        if (value && _.isString(value) && !JSON_STRING.test(value)) {
            return value;
        }
        return JSON.stringify(value);
    }

    function copy() {
        // serialize selected mugs
        var mugs = [vellum.getCurrentlySelectedMug()],
            header = ["type", "id"],
            headings = {type: true, id: true},
            rows = _.map(mugs, function (mug) {
                var row = mug.serialize();
                if (!row) {
                    return null;
                }
                _.each(row, function (value, key) {
                    if (!headings.hasOwnProperty(key)) {
                        header.push(key);
                        headings[key] = true;
                    }
                });
                return row;
            });

        return tsv.tabDelimit([PREAMBLE, header].concat(_.map(rows, function (row) {
            return _.map(header, function (key) {
                var val = row[key];
                return _.isUndefined(val) || val === null ? "" : jsonify(val);
            });
        })));
    }

    function paste(data) {
        console.log("paste data:", data);
    }

    $.vellum.plugin('copyPaste', {
        copy: copy,
        paste: paste
    }, {
        init: function () {
            var opts = this.opts().copyPaste;
            vellum = this;
            // Firefox only fires copy/paste when it thinks it's appropriate
            // Chrome doesn't fire copy/paste after key down has changed the focus
            // So we need implement both copy/paste as catching keystrokes Ctrl+C/V
            $(document).on('copy paste keydown', function (e) {
                if (e.type === 'copy' ||
                    e.metaKey && String.fromCharCode(e.keyCode) === 'C') {
                    onCopy(opts);
                } else if (e.type === 'paste' ||
                           e.metaKey && String.fromCharCode(e.keyCode) === 'V') {
                    onPaste(opts);
                }
            });
        }
    });

    return {
        copy: copy,
        paste: paste
    };
});
