var uuid = require('uuid');
var EventEmitter = require('events').EventEmitter;
var util = require('util');
var Promise = require('bluebird');

var dearrayify = function (cb) {
    var oldcb = cb;
    cb = function (err, args) {
        args = args || [];
        if (!(args instanceof Array)) args = [ args ];

        args.unshift(err);
        oldcb.apply(this, args);
    };
    return cb;
};

var without = function (array, element) {
    var idx = array.indexOf(element);
    if (idx < 0) return array;
    array.splice(idx, 1);
    return array;
};

var Tree = module.exports = function (options, ready) {
    this.isTree = true;
    this.ready = false;
    this.db = options.db;
    this.db.putAsync = Promise.promisify(this.db.put, this.db);
    this.db.getAsync = Promise.promisify(this.db.get, this.db);
    this.db.delAsync = Promise.promisify(this.db.del, this.db);

    this.treeId = options.treeId;
    this.rootId = this.makeRootId();

    var resolver = Promise.defer();
    this._setupRoot(resolver.callback);
    var p = resolver.promise.bind(this);
    this.then = p.then.bind(p);
    this.then(function () {
        this.ready = true;
    });
    p.nodeify(ready);
};

util.inherits(Tree, EventEmitter);


Tree.prototype.makeNodeId = function () {
    var id = uuid.v4();
    return this.treeId + '/node-' + id;
};

Tree.prototype.makeNodeDataKey = function (id) {
    return id + '/data';
};

Tree.prototype.makeNodeParentKey = function (id) {
    return id + '/parent';
};

Tree.prototype.makeRootId = function () {
    return this.treeId + '/root';
};



Tree.prototype.callDb = function (type/*, args... */) {
    var args = Array.prototype.slice.call(arguments);
    args.shift();

    var doCall = function (done) {
        this.db[type].apply(this.db, args);
    }.bind(this);

    this.then(function (yes, no) {
        doCall();
    });
};

Tree.prototype._setupRoot = function (cb) {
    this.db.get(this.rootId, function (err, node) {
        if (!err && node) return cb();
        this.db.put(this.rootId, [], cb);
    }.bind(this));
};

Tree.prototype.setNodeData = function (id, data, cb) {
    //this.callDb('put', this.makeNodeDataKey(id), data, cb);
    return this.then(function () {
        return this.db.putAsync(this.makeNodeDataKey(id), data);
    }).nodeify(cb);
};

Tree.prototype.getNodeData = function (id, cb) {
    return this.then(function () {
        return this.db.getAsync(this.makeNodeDataKey(id)).catch(
            function (err) { return err.notFound; },
            function (err) { return {}; }
        );
    }).nodeify(cb);
};

Tree.prototype.deleteNodeData = function (id, cb) {
    return this.then(function () {
        return this.db.delAsync(this.makeNodeDataKey(id));
    }).nodeify(cb);
};

Tree.prototype.getNode = function (id, cb) {
    return this.then(function () {
        return this.db.getAsync(id);
    }).nodeify(cb);
};

Tree.prototype.getNodeParent = function (id, cb) {
    var self = this;
    return this.then(function () {
        var parentId = this.getNode(this.makeNodeParentKey(id));
        var parent = parentId.then(function (parentId) { return this.getNode(parentId); });

        if (cb) cb = dearrayify(cb);

        return Promise.all([ parent, parentId ]);
    }).nodeify(cb);
};

Tree.prototype.getNodeAndData = function (id, cb) {
    var self = this;
    return this.then(function () {
        return Promise.props({
            children: this.getNode(id),
            data: this.getNodeData(id)
        }).then(function (result) {

            if (cb) cb = dearrayify(cb);

            return Promise.cast([result.children, result.data]).nodeify(cb);
        }.bind(this));
    });
};

Tree.prototype.getRoot = function (cb) {
    return this.then(function () {
        return this.getNode(this.rootId).nodeify(cb);
    });
};

/* opts:
 *  - startNode: nodeId to start searching from
 *  - order: ['breadth' / 'depth']
 *  - type: ['walk', / 'search' / 'leafsearch']
 */
Tree.prototype.traverse = function (opts, onNode, cb) {
    var startNodeId = opts.startNode || this.rootId;
    var queueOp = opts.order === 'breadth' ? 'shift' : 'pop';
    var reverseQueue = opts.order === 'depth';
    var isSearch = opts.type === 'search' || opts.type === 'leafsearch';
    var isLeafSearch = opts.type === 'leafsearch';

    var queue = [ startNodeId ];

    if (cb) cb = dearrayify(cb);

    var self = this;

    var p = new Promise(function (yes, no) {
        var workQueue = function () {
            var nodeId = queue[queueOp]();
            var skipChildren = false;

            self.getNodeAndData(nodeId).spread(function (children, data) {
                var isLeafNode = children.length === 0;
                var found = onNode(nodeId, children, data, isLeafNode);

                if (isSearch && !isLeafSearch) {
                    if (found) return yes([nodeId, children, data]);
                }

                if (isLeafSearch) {
                    if (found && isLeafNode) { //is leaf
                        return yes([nodeId, children, data]);
                    }
                }

                if (!isLeafSearch || (isLeafSearch && found)) {
                    if (reverseQueue) {
                        queue.push.apply(queue, children.reverse());
                    } else {
                        queue.push.apply(queue, children);
                    }
                }

                if (queue.length === 0) {
                    yes();
                } else {
                    workQueue();
                }
            });
        }.bind(this);
        workQueue();
    });

    return p.nodeify(cb);
};

Tree.prototype.breadthWalk = function (startNodeId, onNode, cb) {
    if (arguments.length === 2 && typeof startNodeId === 'function') {
        cb = onNode;
        onNode = startNodeId;
        startNodeId = undefined;
    }
    if (cb) cb = dearrayify(cb);
    return this.traverse({ startNode: startNodeId, order: 'breadth', type: 'walk' }, onNode).nodeify(cb);
};

Tree.prototype.breadthSearch = function (startNodeId, onNode, cb) {
    if (arguments.length === 2 && typeof startNodeId === 'function') {
        cb = onNode;
        onNode = startNodeId;
        startNodeId = undefined;
    }
    if (cb) cb = dearrayify(cb);
    return this.traverse({ startNode: startNodeId, order: 'breadth', type: 'search' }, onNode).nodeify(cb);
};

Tree.prototype.breadthLeafSearch = function (startNodeId, onNode, cb) {
    if (arguments.length === 2 && typeof startNodeId === 'function') {
        cb = onNode;
        onNode = startNodeId;
        startNodeId = undefined;
    }
    if (cb) cb = dearrayify(cb);
    return this.traverse({ startNode: startNodeId, order: 'breadth', type: 'leafsearch' }, onNode).nodeify(cb);
};

Tree.prototype.depthSearch = function (startNodeId, onNode, cb) {
    if (arguments.length === 2 && typeof startNodeId === 'function') {
        cb = onNode;
        onNode = startNodeId;
        startNodeId = undefined;
    }
    if (cb) cb = dearrayify(cb);
    return this.traverse({ startNode: startNodeId, order: 'depth', type: 'search' }, onNode).nodeify(cb);
};

Tree.prototype.depthLeafSearch = function (startNodeId, onNode, cb) {
    if (arguments.length === 2 && typeof startNodeId === 'function') {
        cb = onNode;
        onNode = startNodeId;
        startNodeId = undefined;
    }
    if (cb) cb = dearrayify(cb);
    return this.traverse({ startNode: startNodeId, order: 'depth', type: 'leafsearch' }, onNode).nodeify(cb);
};

Tree.prototype.depthWalk = function (startNodeId, onNode, cb) {
    if (arguments.length === 2 && typeof startNodeId === 'function') {
        cb = onNode;
        onNode = startNodeId;
        startNodeId = undefined;
    }
    if (cb) cb = dearrayify(cb);
    return this.traverse({ startNode: startNodeId, order: 'depth', type: 'walk' }, onNode).nodeify(cb);
};

Tree.prototype.insertNode = function (parentId, data, cb) {
    var id = this.makeNodeId(data);
    var dataKey = this.makeNodeDataKey(id);
    var parentKey = this.makeNodeParentKey(id);

    return this.then(function () {
        return this.getNode(parentId).then(function (parent) {
            parent.push(id);
            var batch = this.db.batch()
                                .put(parentId, parent)
                                .put(id, [])
                                .put(dataKey, data)
                                .put(parentKey, parentId);

            return new Promise(function (yes, no) {
                batch.write(function (err) {
                    if (err) return no(err);
                    yes(id);
                });
            });
        }.bind(this));
    }).nodeify(cb);
};

Tree.prototype.deleteNode = function (nodeId, cb) {
    var self = this;
    var batch = this.db.batch();

    return this.breadthWalk(nodeId, function (id, children, data) {
        batch = batch.del(id);
    }).then(function () {
        return self.getNodeParent(nodeId).spread(function (parent, parentNodeId) {
            without(parent, nodeId);
            batch.put(parentNodeId, parent);

            return Promise.promisify(batch.write, batch)();
        });
    }).nodeify(cb);
};

Tree.prototype.moveNode = function (nodeId, newParentId, cb) {
    var oldParentId;

    return this.then(function () {
        return this.getNodeParent(nodeId).spread(function (oldParent, oldParentId) {
            return this.getNode(newParentId).then(function (newParent) {
                newParent.push(nodeId);
                oldParent = without(oldParent, nodeId);
                var batch = this.db.batch()
                                    .put(oldParentId, oldParent)
                                    .put(newParentId, newParent);
                return new Promise(function (yes, no) {
                    batch.write(function (err) {
                        if (err) return no(err);
                        yes();
                    });
                });
            }.bind(this));
        }.bind(this));
    }).nodeify(cb);
};
