var Tree = require('../tree');
var level = require('level');
var leveldown = require('leveldown');

var testFile = __dirname + '/db-test.db';

function test() {
    var db = level(testFile, { valueEncoding: 'json'});

    new Tree({
        db: db,
        treeId: 'myTree'
    }, function (err, tree) {
        if (err) throw err;
        var rootId = tree.rootId();
        var breadthExpected = 'abcdefghijkl';
        var breadthActual = '';

        var depthExpected = 'abeijfcdgklh';
        var depthActual = '';

        tree.setNodeData(rootId, { name: 'a' }, function (err) {
            tree.insertNode(rootId, { name: 'b' }, function (err, bId) {
                tree.insertNode(rootId, { name: 'c' }, function (err, cId) {
                    tree.insertNode(rootId, { name: 'd' }, function (err, dId) {
                        tree.insertNode(bId, { name: 'e' }, function (err, eId) {
                            tree.insertNode(bId, { name: 'f' }, function (err, fId) {
                                tree.insertNode(dId, { name: 'g' }, function (err, gId) {
                                    tree.insertNode(dId, { name: 'h' }, function (err, hId) {
                                        tree.insertNode(eId, { name: 'i' }, function (err, iId) {
                                            tree.insertNode(eId, { name: 'j' }, function (err, jId) {
                                                tree.insertNode(gId, { name: 'k' }, function (err, kId) {
                                                    tree.insertNode(gId, { name: 'l' }, function (err, lId) {

                                                        console.log('Breadth:');
                                                        tree.breadthWalk(function (id, children, data) {
                                                            breadthActual += data.name;
                                                        }, function () {
                                                            console.log(breadthExpected === breadthActual, breadthActual);
                                                        });

                                                        tree.depthWalk(function (id, children, data) {
                                                            depthActual += data.name;
                                                        }, function () {
                                                            console.log(depthExpected === depthActual, depthActual);
                                                        });
                                                    });
                                                });
                                            });
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });
    });
}

leveldown.destroy(testFile, test);
