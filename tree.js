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

Tree.prototype.getNodeData = function (id, cb) {
    this.db.get(this.makeNodeDataId(id), cb);
};

Tree.prototype.getNode = function (id, cb) {
    this.db.get(id, cb);
};

Tree.prototype.getRoot = function (cb) {
    this.getNode(this.rootId(), cb);
};

Tree.prototype.breadthWalk = function (onNode) {
    var id = this.rootId();

    var visitNode = function (id, onNode) {
        this.getNode(id, function (err, children) {
            this.getNodeData(id, function (err, data) {
                onNode(id, children, data);
                children.forEach(function(child) {
                    visitNode(child, onNode);
                }.bind(this));
            }.bind(this));
        }.bind(this));
    }.bind(this);

    visitNode(id, onNode);
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
                .write(cb);
    }.bind(this));
};
