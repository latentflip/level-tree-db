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

    it('connects without callback', function (done) {
        var tree = new Tree({ db: db, treeId: 'myTree' });
        expect(tree.ready).to.equal(false);
        tree.getRoot(function (err, root) {
            expect(tree.ready).to.equal(true);
            tree.getRoot(function (err, root) {
                done();
            });
        });
    });

    it('connects with callback', function (done) {
        var tree = new Tree({ db: db, treeId: 'myTree' }, function (err) {
            if (err) return done(err);
            expect(tree.ready).to.equal(true);
            tree.getRoot(function (err, root) {
                expect(tree.ready).to.equal(true);
                tree.getRoot(function (err, root) {
                    done();
                });
            });
        });
    });
});
