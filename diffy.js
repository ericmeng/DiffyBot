/*global browser, element, protractor, by*/
'use strict';

var mkdirpWithCallback = require('mkdirp');
var fs = require('fs');
var shell = require('shelljs');
var BlinkDiff = require('blink-diff');
var sleep = require('sleep-promise');

// constructor
function Diffy (config, mode) {

    switch (mode) {
        case 'record':
            break;
        case 'regression':
            break;
        default:
            throw 'mode must be one of "recording" or "regression"';
    }

    var self = this;
    var targetScreenWidth = config.screenWidth;
    var targetScreenHeight = config.screenHeight;

    this.standarizeScreenSize = function () {

        var targetBrowserWidth;
        var targetBrowserHeight;

        return browser.driver.manage().window().setSize(targetScreenWidth, targetScreenHeight)
            .then(getBrowserHeight)
            .then(function (height) {
                // console.log('current screen height ' + height);
                targetBrowserHeight = targetScreenHeight * 2 - height;
                // console.log('target browser height ' + targetBrowserHeight);
            })
            .then(getBrowserWidth)
            .then(function (width) {
                // console.log('current screen width ' + width);
                targetBrowserWidth = targetScreenWidth * 2 - width;
                // console.log('target browser width ' + targetBrowserWidth);
            })
            .then(function () {
                browser.driver.manage().window().setSize(targetBrowserWidth, targetBrowserHeight);
            })
            .then(getBrowserHeight)
            .then(function (height) {
                console.log('new screen height ' + height);
            })
            .then(getBrowserWidth)
            .then(function (width) {
                console.log('new screen width ' + width);
            });
    };

    //record or compare screenshot at the current spot
    this.takeScreenshotOrCheckRegression = function (testSuiteName, testCaseName) {
        return browser.waitForAngular()
        .then(function () {
            return reallyTakeScreenshotOrCheckResression(testSuiteName, testCaseName);
        });
    };

    var reallyTakeScreenshotOrCheckResression = function (testSuiteName, testCaseName) {
        var specDir = config.specDir + testSuiteName;
        var testDir = config.testDir + testSuiteName;
        var diffDir = config.diffDir + testSuiteName;
        var specFilePath = specDir + '/' + testCaseName + '.png';
        var testFilePath = testDir + '/' + testCaseName + '.png';
        var pngDiffFilePath = diffDir + '/' + testCaseName + '.png';

        switch (mode) {
            case 'recording': {
                return mkdirp(specDir)
                    .then (function () {
                        return browser.takeScreenshot();
                    })
                    .then(function (png) {
                        return writeScreenShot(png, specFilePath);
                    });
            }
            case 'regression': {
                return mkdirp(testDir)
                    .then (function () {
                        return mkdirp(diffDir);
                    })
                    .then (function () {
                        return browser.takeScreenshot();
                    })
                    .then(function (png) {
                        return writeScreenShot(png, testFilePath);
                    })
                    .then(function () {
                        return pdiff(specFilePath, testFilePath, pngDiffFilePath);
                    });
            }
            default: {
                throw 'invalid mode';
            }
        }
    };

    //walk through page, record or compare screenshots
    this.walkThroughPage = function (testSuiteName, testCaseName) {
        return browser.waitForAngular()
        .then(function () {
            return reallyWalkThroughPage(testSuiteName, testCaseName);
        });
    };

    var reallyWalkThroughPage = function (testSuiteName, testCaseName) {
        var deferred = protractor.promise.defer();
        var browserHeight;
        var scrollByBrowserHeight;
        var yOffset;

        var i = 0;
        var nothingFailed = true;
        function nextAction () {
            i++;
            reallyTakeScreenshotOrCheckResression(testSuiteName, testCaseName + '_' + i)
            .then(function (result) {
                nothingFailed = nothingFailed && result;
                //try scroll down
                browser.driver.executeScript(scrollByBrowserHeight)
                .then(function () {
                    return browser.waitForAngular();
                })
                .then(function () {
                    return sleep(2000);
                })
                .then(function () {
                    return getBrowserOffset();
                })
                .then(function (newOffset) {
                    if (yOffset !== newOffset) {
                        yOffset = newOffset;
                        nextAction();
                    } else {
                        deferred.fulfill(nothingFailed);
                    }
                });

            });
        }

        getBrowserHeight()
        .then(function (height) {
            browserHeight = height;
            scrollByBrowserHeight = 'window.scrollBy(0, ' + height + ');';
            return;
        })
        .then(function () {
            return getBrowserOffset();
        })
        .then(function (newOffset) {
            yOffset = newOffset;
            return;
        })
        .then(function () {
            nextAction();
        });

        return deferred.promise;
    };

}

// promised call
function mkdirp (path) {
    var deferred = protractor.promise.defer();
    mkdirpWithCallback(path, function (err) {
        if (err) {
            deferred.reject(err);
        } else {
            deferred.fulfill();
        }
    });
    return deferred.promise;
}

// promised call
function getBrowserHeight () {
    return browser.driver.executeScript(function () {
        return window.innerHeight;
    });
}

// promised call
function getBrowserWidth () {
    return browser.driver.executeScript(function () {
        return window.innerWidth;
    });
}

// promised call
function getBrowserOffset () {
    return browser.driver.executeScript(function () {
        return window.pageYOffset;
    });
}

// promised call
function writeScreenShot(data, filename) {
    var deferred = protractor.promise.defer();
    var stream = fs.createWriteStream(filename);
    stream.write(new Buffer(data, 'base64'));
    stream.end();
    stream.on('err', function () {
        deferred.reject();
    });
    stream.on('close', function () {
        deferred.fulfill(true);
    });
    return deferred.promise;
}

// promised call
function pdiff(imageFilename1, imageFilename2, pngDiffFilename) {
    var deferred = protractor.promise.defer();
    var diff = new BlinkDiff({
        imageAPath: imageFilename1, // Use file-path
        imageBPath: imageFilename2,

        thresholdType: BlinkDiff.THRESHOLD_PERCENT,
        threshold: 0.01, // 1% threshold

        vShift: 3,  // allow 3 pixel difference vertically

        imageOutputPath: pngDiffFilename
    });
    diff.run(function (error, result) {
        if (error) {
            console.log('pdiff error: ' + error);
            deferred.reject(error);
        } else {
            if (result.differences === 0) {
                shell.rm(pngDiffFilename);
            } else {
                console.log('differences: ' + result.differences);
            }
            deferred.fulfill(result.differences === 0);
        }
    });
    return deferred.promise;
}

module.exports = Diffy;
