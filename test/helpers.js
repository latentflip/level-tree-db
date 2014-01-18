var async = require('async');

module.exports = {
    makeTree: function (tree, structure, done) {
        var nodeIds = {};
        var rootId = tree.rootId();
        nodeIds[structure.root] = rootId;
        
        var populateNode = function (name, cb) {
            var children = structure[name];
            async.eachSeries(children, function (childname, done) {
                tree.insertNode(nodeIds[name], { name: childname }, function (err, id) {
                     if (err) return done(err);              
                     nodeIds[childname] = id;
                     tree.getNode(rootId, function (err, node) {
                        done();
                     });
                });
            }, function (err) {
                if (err) throw err;
                cb();
            });
        };
        
        var nodes = Object.keys(structure);
        async.eachSeries(nodes, function (node, done) {
            if (node === 'root') {
                tree.setNodeData(rootId, { name: structure[node] }, done);
            } else {
                populateNode(node, done);
            }
        }, function (err) {
            if (err) throw err;
            done();
        });
    },

    toStructure: function (tree, cb) {
        var structure = {};
        var first = true;
        tree.breadthWalk(function (id, children, data) {
            if (first) {
                first = false;
                structure.root = data.name;
                structure[data.name] = children;
            } else {
                if (children.length) structure[data.name] = children;
            }
        }, function () {
            async.each(Object.keys(structure), function (key, outerDone) {
                if (key === 'root') return outerDone();

                async.map(structure[key], function (childId, done) {
                    tree.getNodeData(childId, function (err, data) {
                        done(null, data.name);
                    });
                }, function (err, names) {
                    structure[key] = names;
                    outerDone();
                });
            }, function (err) {
                cb(err, structure);
            });
        });
    }
};
