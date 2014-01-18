var uuid = require('uuid');
var EventEmitter = require('events').EventEmitter;
var util = require('util');

var without = function (array, element) {
    var idx = array.indexOf(element);
    if (idx < 0) return array;
    array.splice(idx, 1);
    return array;
};

var Tree = module.exports = function (options, ready) {
    this.ready = false;
    this.db = options.db;
    this.treeId = options.treeId;

    var onReady = function (err) {
        if (err) {
            if (ready) {
                ready(err);
            } else {
                throw new Error(error);
            }
        } else {
            this.ready = true;
            if (ready) {
                ready(null, this);
            }
            this.processDbCallQueue();
        }
    }.bind(this);

    this._setupRoot(onReady);
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

Tree.prototype.rootId = function () {
    return this.treeId + '/root';
};

Tree.prototype.queueDbCall = function (call) {
    this.dbCallQueue = this.dbCallQueue || [];
    this.dbCallQueue.push(call);
};

Tree.prototype.processDbCallQueue = function () {
    while (this.dbCallQueue && this.dbCallQueue.length) {
        this._processNext();
    }
};

Tree.prototype._processNext = function () {
    if (this.ready) {
        var fn = this.dbCallQueue.shift();
        if (fn) fn();
    }
};

Tree.prototype.callDb = function (type/*, args... */) {
    var args = Array.prototype.slice.call(arguments);
    args.shift();

    var doCall = function (done) {
        this.db[type].apply(this.db, args);
    }.bind(this);

    if (this.ready) { 
        doCall();
    } else {
        this.queueDbCall(doCall);
        this._processNext();
    }
};

Tree.prototype._setupRoot = function (cb) {
    var rootId = this.rootId();
    this.db.get(rootId, function (err, node) {
        if (!err && node) return cb();
        
        this.db.put(rootId, [], cb);
    }.bind(this));
};

Tree.prototype.makeRoot = function (cb) {
    this.db.put(this.rootId(), [], cb);
};

Tree.prototype.setNodeData = function (id, data, cb) {
    this.db.put(this.makeNodeDataKey(id), data, cb);
};

Tree.prototype.getNodeData = function (id, cb) {
    this.db.get(this.makeNodeDataKey(id), cb);
};

Tree.prototype.deleteNodeData = function (id, cb) {
    this.db.del(this.makeNodeDataKey(id), cb);
};

Tree.prototype.getNode = function (id, cb) {
    this.callDb('get', id, cb);
};

Tree.prototype.getNodeParent = function (id, cb) {
    this.db.get(this.makeNodeParentKey(id), function (err, parentId) {
        this.db.get(parentId, function (err, parent) {
            if (err) return cb(err);
            cb(null, parent, parentId);
        });
    }.bind(this));
};

Tree.prototype.getNodeAndData = function (id, cb) {
    this.getNode(id, function (err, children) {
        if (err) return cb(err);
        this.getNodeData(id, function (err, data) {
            cb(err, children, data);
        }.bind(this));
    }.bind(this));
};

Tree.prototype.getRoot = function (cb) {
    this.getNode(this.rootId(), cb);
};

/* opts:
 *  - startNode: nodeId to start searching from
 *  - order: ['breadth' / 'depth']
 *  - type: ['walk', / 'search']
 */

Tree.prototype.traverse = function (opts, onNode, cb) {
    var startNodeId = opts.startNode || this.rootId();
    var queueOp = opts.order === 'breadth' ? 'shift' : 'pop';
    var reverseQueue = opts.order === 'depth';
    var isSearch = opts.type === 'search';

    var queue = [ startNodeId ];

    var workQueue = function () {
        var nodeId = queue[queueOp]();

        this.getNodeAndData(nodeId, function (err, children, data) {
            if (err) return cb(err);

            var found = onNode(nodeId, children, data);
            if (reverseQueue) {
                queue.push.apply(queue, children.reverse());
            } else {
                queue.push.apply(queue, children);
            }

            if ((isSearch && found) || queue.length === 0) {
                cb(null, nodeId, children, data);
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

Tree.prototype.depthSearch = function (startNodeId, onNode, cb) {
    if (arguments.length === 2 && typeof startNodeId === 'function') {
        cb = onNode;
        onNode = startNodeId;
        startNodeId = undefined;
    }
    this.traverse({ startNode: startNodeId, order: 'depth', type: 'search' }, onNode, cb);
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

    this.db.get(parentId, function (err, parent) {
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

        this.db.get(this.makeNodeParentKey(nodeId), function (err, parentNodeId) {
            this.db.get(parentNodeId, function (err, parent) {
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
