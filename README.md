# level-tree-db (could probably have a better name)

A generic tree backed by level db.

## Example

### Create a Tree, Insert some elements, breadth-first walk the tree

```javascript
var level = require('level');
var leveldown = require('leveldown');
var Tree = require('./tree');

var dbPath = './trees.db';

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
```

outputs:

```
Node myTree/root has data {} and children [ 'myTree/node-f9851923-15a6-418c-898b-9af6a96fd732',
  'myTree/node-fa37a40c-405b-458b-a302-55adf44083a2' ]
Node myTree/node-f9851923-15a6-418c-898b-9af6a96fd732 has data { name: 'Node A' } and children []
Node myTree/node-fa37a40c-405b-458b-a302-55adf44083a2 has data { name: 'Node B' } and children [ 'myTree/node-b8a48562-7431-49cf-8f58-60207d84606b' ]
Node myTree/node-b8a48562-7431-49cf-8f58-60207d84606b has data { name: 'Node C' } and children []
Done walking
```
