var async = require('async');
var expect = require('chai').expect;
var level = require('level');
var leveldown = require('leveldown');
var helpers = require('./helpers');

var Tree = require('../tree');
var testFile = __dirname + '/db-test-walk.db';

Tree.prototype.makeNodeId = function (data) {
    return this.treeId + '/node-' + data.name;
};

describe("Traversal", function () {
    var db, tree;

    beforeEach(function (done) {
        leveldown.destroy(testFile, function () {
            db = level(testFile, { valueEncoding: 'json'});
            tree = new Tree({
                db: db,
                treeId: 'myTree'
            }, done);
        });
    });

    afterEach(function () {
        db.close();
    });

    var structure = {
        root: 'a',
        a: ['b','c','d'],
        b: ['e','f'],
        d: ['g','h'],
        e: ['i','j'],
        g: ['k', 'l']
    };

    it('should breadth first traverse', function (done) {
        helpers.makeTree(tree, structure, function (err) {
            var breadthActual = '';

            tree.breadthWalk(function (id, children, data) {
                breadthActual += data.name;
            }, function () {
                expect(breadthActual).to.equal('abcdefghijkl');
                done();
            });
        });
    });

    it('should breadth first from a node', function (done) {
        helpers.makeTree(tree, structure, function (err) {
            var breadthActual = '';
            var bId = tree.makeNodeId({ name: 'b' });

            tree.breadthWalk(bId, function (id, children, data) {
                breadthActual += data.name;
            }, function () {
                expect(breadthActual).to.equal('befij');
                done();
            });
        });
    });

    it('should depth first traverse', function (done) {
        helpers.makeTree(tree, structure, function (err) {
            var depthActual = '';

            tree.depthWalk(function (id, children, data) {
                depthActual += data.name;
            }, function () {
                expect(depthActual).to.equal('abeijfcdgklh');
                done();
            });
        });
    });

    it('should depth first traverse from a node', function (done) {
        helpers.makeTree(tree, structure, function (err) {
            var breadthActual = '';
            var dId = tree.makeNodeId({ name: 'd' });

            tree.depthWalk(dId, function (id, children, data) {
                breadthActual += data.name;
            }, function () {
                expect(breadthActual).to.equal('dgklh');
                done();
            });
        });
    });

    it('breadth seaches', function (done) {
        helpers.makeTree(tree, structure, function () {
            var searched = '';
            tree.breadthSearch(function (id, children, data) {
                searched += data.name;
                if (data.name == 'g') return true;
            }, function () {
                expect(searched).to.equal('abcdefg');
                done();
            });
        });
    });

    it('depth seaches', function (done) {
        helpers.makeTree(tree, structure, function () {
            var searched = '';
            tree.depthSearch(function (id, children, data) {
                searched += data.name;
                if (data.name == 'g') return true;
            }, function () {
                expect(searched).to.equal('abeijfcdg');
                done();
            });
        });
    });

    it('helper deconstructs', function (done) {
        helpers.makeTree(tree, structure, function (err) {
            helpers.toStructure(tree, function (err, structureOut) {
                expect(structureOut).to.deep.equal(structure);
                done();
            });
        });
    });

    it('deletes nodes', function (done) {
        helpers.makeTree(tree, structure, function (err) {
            var dId = tree.makeNodeId({ name: 'd' });
            tree.deleteNode(dId, function (err) {
                if (err) return done(err);
                helpers.toStructure(tree, function (err, structureOut) {
                    var expected = {
                        root: 'a',
                        a: ['b','c'],
                        b: ['e','f'],
                        e: ['i','j'],
                    };
                    expect(structureOut).to.deep.equal(expected);
                    done();
                });
            });
        });
    });

    it('moves nodes', function (done) {
        helpers.makeTree(tree, structure, function (err) {
            var gId = tree.makeNodeId({ name: 'g' });
            var cId = tree.makeNodeId({ name: 'c' });

            tree.moveNode(gId, cId, function (err) {
                if (err) return done(err);
                helpers.toStructure(tree, function (err, structureOut) {
                    var expected = {
                        root: 'a',
                        a: ['b','c','d'],
                        b: ['e','f'],
                        c: ['g'],
                        d: ['h'],
                        e: ['i','j'],
                        g: ['k', 'l']
                    };
                    expect(structureOut).to.deep.equal(expected);
                    done();
                });
            });
        });
    });
});
