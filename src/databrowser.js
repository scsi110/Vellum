/**
 * External data source tree/browser plugin
 */
define([
    'jquery',
    'underscore',
    'vellum/datasources',
    'vellum/widgets',
    'vellum/window',
    'tpl!vellum/templates/external_data_tree',
], function (
    $,
    _,
    datasources,
    widgets,
    window_,
    external_data_tree
) {
    var panelHeight, isDataTreeLoaded;

    // plugin adds an item to the Tools menu when enabled
    $.vellum.plugin('databrowser', {}, {
        init: function () {
            var vellum = this,
                pane = this.$f.find(".fd-accessory-pane");
            isDataTreeLoaded = false;
            pane.append($(external_data_tree()));
            pane.resize(function () {
                if (pane.height() > 100) {
                    panelHeight = pane.height();
                } else if (pane.height() > 0) {
                    initDataBrowser(vellum);
                }
            });
            window_.preventDoubleScrolling(pane.find(".fd-scrollable"));
            datasources.getDataSources(function () {});
        },
        getToolsMenuItems: function () {
            var vellum = this,
                items = this.__callOld();
            items.push({
                name: "External Data",
                action: function (done) {
                    toggleExternalDataTree(vellum, done);
                }
            });
            return items;
        }
    });

    var initDataBrowser = function (vellum) {
        if (isDataTreeLoaded) { return; }
        isDataTreeLoaded = true;

        // display spinner and begin loading...
        var $container = vellum.$f.find(".fd-external-data-tree-container"),
            $search = $container.find(".fd-search-box input"),
            $tree = $container.find(".fd-external-data-tree"),
            pending = false;
        $tree.jstree({
            core: {
                data: function (node, callback) {
                    if (node.data && node.data.getNodes) {
                        // load children of deferred node
                        callback.call(this, node.data.getNodes());
                    } else {
                        var _this = this;
                        datasources.getDataSources(function (data) {
                            callback.call(_this, dataTreeJson(data, vellum));
                        });
                    }
                },
                worker: false,
                multiple: false,
                check_callback: function(operation, node, parent, position, more) {
                    return false;
                }
            },
            search: {
                show_only_matches: true
            },
            conditionalevents: {
                should_activate: function () { return false; }
            },
            "plugins" : [ "themes", "conditionalevents", "dnd", "search" ]
        });
        $search.keyup(function () {
            if (pending) {
                clearTimeout(pending);
            }
            pending = setTimeout(function () {
                $tree.jstree(true).search($search.val());
            }, 250);
        });
    };

    function dataTreeJson(data, vellum) {
        function node(parentPath, info) {
            return function (item, id) {
                var path = parentPath ? (parentPath + "/" + id) : id,
                    tree = getTree(item, id, path, info);
                return {
                    icon: false,
                    text: tree.name,
                    state: {opened: tree.nodes !== true &&
                                    tree.nodes.length <= MAX_OPEN_NODE},
                    children: tree.nodes,
                    data: {
                        handleDrop: _.partial(handleDrop, path, info),
                        getNodes: tree.getNodes,
                    }
                };
            };
        }
        function getTree(item, id, path, info) {
            var tree = {name: item.name || id},
                source = item;
            if (!item.structure && item.reference) {
                var ref = item.reference;
                source = sources[ref.source || info.id];
                if (source) {
                    info = _.extend(_.omit(source, "structure"), {_parent: info});
                    path = "instance('" + source.id + "')" + source.path +
                           "[" + ref.key + "=" + path + "]";
                    if (source.subsets && ref.subset) {
                        // magic: match key: "@case_type"
                        source = _.findWhere(
                            source.subsets,
                            {id: ref.subset, key: "@case_type"}
                        ) || source;
                    }
                    var name = source.name || source.id;
                    if (name) {
                        tree.name = tree.name + " (" + name + ")";
                    }
                    if (seen.hasOwnProperty(source.id)) {
                        // defer to prevent infinite loop
                        tree.nodes = true;
                        tree.getNodes = _.partial(getNodes, source, path, info);
                        return tree;
                    }
                    seen[source.id] = true;
                }
            }
            tree.nodes = getNodes(source, path, info);
            return tree;
        }
        function getNodes(source, path, info) {
            var nodes = _.chain(source && source.structure)
                .map(node(path, info))
                .sortBy("text")
                .value();
            if (source && source.related) {
                nodes = _.chain(source.related)
                    .map(function (subset, relation) {
                        // magic: reference key: @case_id
                        var item = {reference: {subset: subset, key: "@case_id"}};
                        // magic: append "/index" to path
                        return node(path + "/index", info)(item, relation);
                    })
                    .sortBy("text")
                    .value()
                    .concat(nodes);
            }
            return nodes;
        }
        function handleDrop(path, info, target) {
            var widget = widgets.util.getWidget(target, vellum);
            while (info) {
                var id = widget.addInstanceRef({id: info.id, src: info.uri});
                if (id !== info.id) {
                    path = widget.mug.form.updateInstanceQuery(path, id, info.id);
                }
                info = info._parent;
            }
            vellum.handleDropFinish(target, path);
        }
        var MAX_OPEN_NODE = 50,
            sources = _.indexBy(data, "id"),
            nodes = [],
            seen = {};
        if (sources.commcaresession) {
            var source = sources.commcaresession,
                info = _.omit(source, "structure"),
                path = "instance('" + source.id + "')" + source.path;
            // do not show Session node for now
            nodes = node(null, info)(source, path).children;
        }
        return nodes;
    }

    function toggleExternalDataTree(vellum, done) {
        var pane = vellum.$f.find(".fd-accessory-pane");
        if (pane.height()) {
            pane.css("height", "0");
            $(window).resize();
        } else {
            var tree = vellum.$f.find(".fd-tree"),
                height = panelHeight || Math.min(tree.height() / 2, 200);
            pane.css("height", height + "px");
            $(window).resize();
            initDataBrowser(vellum);
        }
        done();
    }

    return {
        initDataBrowser: initDataBrowser,
    };
});
