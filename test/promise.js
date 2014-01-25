var Tree = require('../tree');
var testFile = __dirname + '/db-test-ready.db';
var expect = require('chai').expect;

var level = require('level');
var leveldown = require('leveldown');

describe('Ready Behaviour', function () {
    var db, tree;

    beforeEach(function (done) {
        leveldown.destroy(testFile, function () {
            db = level(testFile, { valueEncoding: 'json'});
            done();
        });
    });

    afterEach(function () {
        db.close();
    });
    
    it('sets node data, and returns a promise', function (done) {
        var tree = new Tree({ db: db, treeId: 'myTree' });

        var p = tree.setNodeData(tree.rootId, {foo: 'bar'});
        p.then(done);
    });

    it('sets node data, and returns a callback', function (done) {
        var tree = new Tree({ db: db, treeId: 'myTree' });

        var p = tree.setNodeData(tree.rootId, {foo: 'bar'}, function (err) {
            expect(err).to.equal(null);
            done();
        });
    });

    it('sets and gets node data, and returns a promise', function (done) {
        var tree = new Tree({ db: db, treeId: 'myTree' });

        tree.setNodeData(tree.rootId, { foo: 'bar' }).then(function () {
            tree.getNodeData(tree.rootId).then(function (value) {
                expect(value.foo).to.equal('bar');
                done();
            });
        });
    });

    it('sets and gets node and data, and returns a promise', function (done) {
        var tree = new Tree({ db: db, treeId: 'myTree' });

        tree.setNodeData(tree.rootId, { foo: 'bar' }).then(function () {
            tree.getNodeAndData(tree.rootId).spread(function (children, value) {
                expect(children).to.deep.equal([]);
                expect(value.foo).to.equal('bar');
                done();
            });
        });
    });

    it('sets and gets node and data, and returns a callback', function (done) {
        var tree = new Tree({ db: db, treeId: 'myTree' });

        tree.setNodeData(tree.rootId, { foo: 'bar' }, function () {
            tree.getNodeAndData(tree.rootId, function (err, children, value) {
                expect(children).to.deep.equal([]);
                expect(value.foo).to.equal('bar');
                done();
            });
        });
    });

    it('sets and gets node data, and returns a callback', function (done) {
        var tree = new Tree({ db: db, treeId: 'myTree' });

        tree.setNodeData(tree.rootId, { foo: 'bar' }, function (err) {
            tree.getNodeData(tree.rootId, function (err, value) {
                expect(value.foo).to.equal('bar');
                done();
            });
        });
    });

    it('sets and gets node data, and returns a callback', function (done) {
        var tree = new Tree({ db: db, treeId: 'myTree' });

        tree.setNodeData(tree.rootId, { foo: 'bar' }, function (err) {
            tree.getNodeData(tree.rootId, function (err, value) {
                expect(value.foo).to.equal('bar');
                done();
            });
        });
    });

    it('gets empty node data, and returns a promise', function (done) {
        var tree = new Tree({ db: db, treeId: 'myTree' });

        tree.getNodeData('asdf').then(function (value) {
            expect(value).to.deep.equal({});
            done();
        });
    });

    it('gets empty node data, and returns a callback', function (done) {
        var tree = new Tree({ db: db, treeId: 'myTree' });

        tree.getNodeData('asdf', function (err, value) {
            expect(value).to.deep.equal({});
            done();
        });
    });
});
