var uuid = require('uuid');
var EventEmitter = require('events').EventEmitter;
var util = require('util');
var Promise = require('bluebird');

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
        return this.db.putAsync(this.makeNodeDataKey(id), data).nodeify(cb);
    });
};

Tree.prototype.getNodeData = function (id, cb) {
    return this.then(function () {
        return this.db.getAsync(this.makeNodeDataKey(id)).catch(
            function (err) { return err.notFound; },
            function (err) { return {}; }
        ).nodeify(cb);
    });
};

Tree.prototype.deleteNodeData = function (id, cb) {
    return this.then(function () {
        return this.db.delAsync(this.makeNodeDataKey(id)).nodeify(cb);
    });
};

Tree.prototype.getNode = function (id, cb) {
    return this.then(function () {
        return this.db.getAsync(id).nodeify(cb);
    });
};

Tree.prototype.getNodeParent = function (id, cb) {
    var self = this;
    return this.then(function () {
        var parentId = this.getNode(this.makeNodeParentKey(id));
        var parent = parentId.then(function (parentId) { return this.getNode(parentId); });

        if (cb) {
            var oldcb = cb;
            cb = function (err, args) {
                args = args || [];
                args.unshift(err);
                oldcb.apply(self, args);
            };
        }

        var p = Promise.all([ parent, parentId ]).nodeify(cb);
    });

    //this.callDb('get', this.makeNodeParentKey(id), function (err, parentId) {
    //    this.callDb('get', parentId, function (err, parent) {
    //        if (err) return cb(err);
    //        cb(null, parent, parentId);
    //    });
    //}.bind(this));
};

Tree.prototype.getNodeAndData = function (id, cb) {
    var self = this;
    return this.then(function () {
        return Promise.props({
            children: this.getNode(id),
            data: this.getNodeData(id)
        }).then(function (result) {
            //Bleurgh
            if (cb) {
                var oldcb = cb;
                cb = function (err, args) {
                    args = args || [];
                    args.unshift(err);
                    oldcb.apply(self, args);
                };
            }

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

    var workQueue = function () {
        var nodeId = queue[queueOp]();
        var skipChildren = false;

        this.getNodeAndData(nodeId, function (err, children, data) {
            if (err) return cb(err);

            var isLeafNode = children.length === 0;
            var found = onNode(nodeId, children, data, isLeafNode);

            if (isSearch && !isLeafSearch) {
                if (found) return cb(null, nodeId, children, data);
            }

            if (isLeafSearch) {
                if (found && isLeafNode) { //is leaf
                    return cb(null, nodeId, children, data);
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
                cb(null);
            } else {
                workQueue();
            }
        });
    }.bind(this);

    workQueue();
};

Tree.prototype.breadthWalk = function (startNodeId, onNode, cb) {
    if (arguments.length === 2 && typeof startNodeId === 'function') {
        cb = onNode;
        onNode = startNodeId;
        startNodeId = undefined;
    }

    this.traverse({ startNode: startNodeId, order: 'breadth', type: 'walk' }, onNode, cb);
};

Tree.prototype.breadthSearch = function (startNodeId, onNode, cb) {
    if (arguments.length === 2 && typeof startNodeId === 'function') {
        cb = onNode;
        onNode = startNodeId;
        startNodeId = undefined;
    }
    this.traverse({ startNode: startNodeId, order: 'breadth', type: 'search' }, onNode, cb);
};

Tree.prototype.breadthLeafSearch = function (startNodeId, onNode, cb) {
    if (arguments.length === 2 && typeof startNodeId === 'function') {
        cb = onNode;
        onNode = startNodeId;
        startNodeId = undefined;
    }
    this.traverse({ startNode: startNodeId, order: 'breadth', type: 'leafsearch' }, onNode, cb);
};

Tree.prototype.depthSearch = function (startNodeId, onNode, cb) {
    if (arguments.length === 2 && typeof startNodeId === 'function') {
        cb = onNode;
        onNode = startNodeId;
        startNodeId = undefined;
    }
    this.traverse({ startNode: startNodeId, order: 'depth', type: 'search' }, onNode, cb);
};

Tree.prototype.depthLeafSearch = function (startNodeId, onNode, cb) {
    if (arguments.length === 2 && typeof startNodeId === 'function') {
        cb = onNode;
        onNode = startNodeId;
        startNodeId = undefined;
    }
    this.traverse({ startNode: startNodeId, order: 'depth', type: 'leafsearch' }, onNode, cb);
};

Tree.prototype.depthWalk = function (startNodeId, onNode, cb) {
    if (arguments.length === 2 && typeof startNodeId === 'function') {
        cb = onNode;
        onNode = startNodeId;
        startNodeId = undefined;
    }
    this.traverse({ startNode: startNodeId, order: 'depth', type: 'walk' }, onNode, cb);
};

Tree.prototype.insertNode = function (parentId, data, cb) {
    var id = this.makeNodeId(data);
    var dataKey = this.makeNodeDataKey(id);
    var parentKey = this.makeNodeParentKey(id);

    this.callDb('get', parentId, function (err, parent) {
        parent.push(id);
        this.db.batch()
                .put(parentId, parent)
                .put(id, [])
                .put(dataKey, data)
                .put(parentKey, parentId)
                .write(function (err) {
                    if (err) return cb(err);
                    else return cb(null, id);
                });
    }.bind(this));
};

Tree.prototype.deleteNode = function (nodeId, cb) {
    var batch = this.db.batch();

    this.breadthWalk(nodeId, function (id, children, data) {
        batch = batch.del(id);
    }, function (err) {
        if (err) return cb(err);               

        this.callDb('get', this.makeNodeParentKey(nodeId), function (err, parentNodeId) {
            this.callDb('get', parentNodeId, function (err, parent) {
                if (err) return cb(err);
                without(parent, nodeId);
                batch.put(parentNodeId, parent)
                     .write(cb);
            });
        }.bind(this));
    }.bind(this));
};

Tree.prototype.moveNode = function (nodeId, newParentId, cb) {
    var oldParentId;

    this.getNodeParent(nodeId, function (err, oldParent, oldParentId) {
        if (err) return cb(err);
        this.getNode(newParentId, function (err, newParent) {
            if (err) return cb(err);

            newParent.push(nodeId);
            oldParent = without(oldParent, nodeId);

            this.db.batch()
                    .put(oldParentId, oldParent)
                    .put(newParentId, newParent)
                    .write(cb);
            
        }.bind(this));
    }.bind(this));
};
