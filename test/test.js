var Tree = require('../tree');
var level = require('level');
var db = level(__dirname + '/db-test.db', { valueEncoding: 'json'});

new Tree({
    db: db,
    treeId: 'myTree'
}, function (err, tree) {
    if (err) throw err;

    tree.insertNode('myTree/node-2fea7b89-c1f0-472d-ad16-ff45c24ed698', { foo: 'bar' }, function (err) {
        if (err) console.log(err);
        tree.breadthWalk(function (id, children, data) {
            console.log(id, children, data);
        });
    });
});

