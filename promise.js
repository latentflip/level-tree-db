var Promise = require('bluebird');

//var p = new Promise(function (resolve, reject) {
//    setTimeout(function () {
//        reject('Ha');
//    }, 1000);
//});
//
//
//p.then(console.log).catch(function (err) {
//    if (err === 'Hi') return true; 
//    return false;
//}, function (err) {
//    return {};
//}).then(function (yay) {
//    console.log('Yay', yay);
//});

var id = 100;
var getId = function (cb) {
    id++;
    console.log('getId called');
    setTimeout(function () { console.log('CBD'); cb(null, id); }, 1000);
};

var getData = function (id, cb) {
    console.log('getData called');
    setTimeout(function () { 
        if (id === 101) return cb(null, { foo: 'bar' });
        return cb('Not Found');
    }, 1000);
};

//getId(function (err, id) {
//    if (err) throw err;
//    getData(id, function (err, data) {
//        console.log('Done', id, data);
//    });
//});

var getIdAsync = Promise.promisify(getId);
var getDataAsync = Promise.promisify(getData);

//getIdAsync().then(getDataAsync).then(console.log).catch(console.log.bind(console, 'ERR'));

getIdAsync().then(getDataAsync).then(console.log.bind(console, 'thened'));
