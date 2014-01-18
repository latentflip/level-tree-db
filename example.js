var level = require('level');
var leveldown = require('leveldown');
var Tree = require('./tree');

var dbPath = './test/trees.db';

leveldown.destroy(dbPath, function () {
    var db = level(dbPath, { valueEncoding: 'json' });

    //db: the leveldb database to save to
    //treeId: identifier of the tree to save/load
    var tree = new Tree({ db: db, treeId: 'myTree' });


    //Insert a node with some data
    //tree.insertNode(parentNodeId, nodeData, cb(err, nodeId));
    tree.insertNode(tree.rootId, { name: 'Node A' }, function (err, nodeAId) {
        if (err) throw err;

        //Add { name: 'Node B' } to the root
        tree.insertNode(tree.rootId, { name: 'Node B' }, function (err, nodeBId) {

            //Add { name: 'Node C' } to node A
            tree.insertNode(nodeBId, { name: 'Node C' }, function (err, nodeCId) {
                //Breadth first traverse the tree from the root
                tree.breadthWalk(function (nodeId, children, data) {
                    console.log('Node', nodeId, 'has data', data, 'and children', children);
                }, function (err) {
                    if (err) throw err;
                    console.log('Done walking');
                });
            });
        });
    });
});
