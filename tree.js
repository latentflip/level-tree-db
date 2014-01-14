var uuid = require('uuid');

var Tree = module.exports = function (options, ready) {
    this.db = options.db;
    this.treeId = options.treeId;

    var onReady = function (err) {
        ready(err, this);
    }.bind(this);

    this.getRoot(function (err, root) {
        if (err || !root) return this.makeRoot(onReady);
        return onReady();
    }.bind(this));
};

Tree.prototype.makeNodeId = function () {
    var id = uuid.v4();
    return this.treeId + '/node-' + id;
};

Tree.prototype.makeNodeDataId = function (id) {
    return id + '/data';
};

Tree.prototype.rootId = function () {
    return this.treeId + '/root';
};

Tree.prototype.makeRoot = function (cb) {
    this.db.put(this.rootId(), [], cb);
};

Tree.prototype.setNodeData = function (id, data, cb) {
    this.db.put(this.makeNodeDataId(id), data, cb);
};

Tree.prototype.getNodeData = function (id, cb) {
    this.db.get(this.makeNodeDataId(id), cb);
};

Tree.prototype.getNode = function (id, cb) {
    this.db.get(id, cb);
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

Tree.prototype.breadthWalk = function (onNode, done) {
    var id = this.rootId();
    var queue = [];
    queue.push(id);

    var workQueue = function () {
        var next = queue.shift();
        
        this.getNodeAndData(next, function (err, children, data) {
            onNode(next, children, data);
            queue.push.apply(queue, children);
            if (queue.length) {
                workQueue();
            } else {
                done();
            }
        });
    }.bind(this);
    workQueue();
};

Tree.prototype.depthWalk = function (onNode, done) {
    var id = this.rootId();
    var stack = [];
    stack.push(id);

    var workStack = function () {
        var next = stack.pop();
        
        this.getNodeAndData(next, function (err, children, data) {
            onNode(next, children, data);
            stack.push.apply(stack, children.reverse());
            if (stack.length) {
                workStack();
            } else {
                done();
            }
        });
    }.bind(this);

    workStack();
};


Tree.prototype.insertNode = function (parentId, data, cb) {
    var id = this.makeNodeId();
    var dataId = this.makeNodeDataId(id);

    this.db.get(parentId, function (err, parent) {
        parent.push(id);
        this.db.batch()
                .put(parentId, parent)
                .put(id, [])
                .put(dataId, data)
                .write(function (err) {
                    if (err) return cb(err);
                    else return cb(null, id);
                });
    }.bind(this));
};
