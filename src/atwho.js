define([
    'underscore',
    'jquery'
], function (
    _,
    $
) {
    var that = {};

    /**
     * Turn a given input into an autocomplete, which will be populated
     * with a given set of choices and will also accept free text.
     *
     * @param $input - jQuery object, the input to turn into an autocomplete
     * @param choices - An array of strings with which to populate the autocomplete
     */
    that.dropdownAutocomplete = function ($input, choices) {
        $input.atwho({
            at: "",
            data: choices,
            maxLen: Infinity,
            suffix: "",
            tabSelectsMatch: false,
            callbacks: {
                filter: function(query, data, searchKey) {
                    return _.filter(data, function(item) {
                        return item.name.indexOf(query) !== -1;
                    });
                },
                matcher: function(flag, subtext, should_startWithSpace) {
                    return $input.val();
                },
                beforeInsert: function(value, $li) {
                    $input.data("selected-value", value);
                },
            }
        }).on("inserted.atwho", function(event, $li, otherEvent) {
            $input.val($input.data("selected-value"));
        });
    };

    /**
     * Alter a given input so that when a user enters the string "/data/",
     * they get an autocomplete of all questions in the form.
     *
     * @param $input - jQuery object, the input to modify
     * @param mug - current mug
     * @param options - Hash of options for autocomplete behavior:
     *                  category: sent to analytics
     *                  insertTpl: string to add to input when question is selected
     *                  property: sent to analytics
     */
    that.questionAutocomplete = function ($input, mug, options) {
        options = _.defaults(options || {}, {
            category: 'Question Reference',
            insertTpl: '${name}',
            property: '',
        });

        $input.atwho({
            at: "/data/",
            data: _.chain(mug.form.getMugList())
                   .map(function(mug) {
                        return {
                            id: mug.ufid,
                            name: mug.absolutePath,
                            icon: mug.options.icon,
                        };
                    })
                    .filter(function(choice) { return choice.name; })
                    .value(),
            displayTpl: '<li><i class="${icon}" /> ${name}</li>',
            insertTpl: options.insertTpl,
            limit: 10,
            maxLen: 30,
            tabSelectsMatch: false,
            callbacks: {
                matcher: function(flag, subtext) {
                    var match, regexp;
                    regexp = new RegExp('(\\s+|^)' + RegExp.escape(flag) + '([\\w_/]*)$', 'gi');
                    match = regexp.exec(subtext);
                    return match ? match[2] : null;
                },
                beforeInsert: function(value, $li) {
                    if (window.analytics) {
                        window.analytics.usage(options.category,
                                               "Autocomplete",
                                               options.property);
                    }
                    return value;
                }
            }
        });

        mug.on("teardown-mug-properties", function () {
            $input.atwho('destroy');
        }, null, "teardown-mug-properties");
    };

    return that;
});


