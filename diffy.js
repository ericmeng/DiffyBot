/*global browser, element, protractor, by*/
'use strict';

var mkdirpWithCallback = require('mkdirp');
var fs = require('fs');
var shell = require('shelljs');
var BlinkDiff = require('blink-diff');
var sleep = require('sleep-promise');
var sharp = require('sharp');
var jsonfile = require('jsonfile')

// constructor
function Diffy (config, mode) {

    switch (mode) {
        case 'record':
            break;
        case 'regression':
            break;
        default:
            throw 'mode must be one of "record" or "regression"';
    }

    var self = this;
    var targetScreenWidth = config.screenWidth;
    var targetScreenHeight = config.screenHeight;
    var delay = config.delay;

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
    this.recordScreenshotOrCheckRegression = function (testSuiteName, testCaseName, ignoreByCss) {
        return browser.waitForAngular()
        .then(function () {
            return reallyRecordScreenshotOrCheckRegression(testSuiteName, testCaseName, ignoreByCss);
        });
    };

    var reallyRecordScreenshotOrCheckRegression = function (testSuiteName, testCaseName, ignoreByCss) {
        if (!ignoreByCss) {
            ignoreByCss = [];
        }
        var specDir = config.specDir + testSuiteName;
        var testDir = config.testDir + testSuiteName;
        var diffDir = config.diffDir + testSuiteName;
        var specFilePath = specDir + '/' + testCaseName + '.png';
        var jsonSpecPath = specDir + '/' + testCaseName + '.json';
        var testFilePath = testDir + '/' + testCaseName + '.png';
        var pngDiffFilePath = diffDir + '/' + testCaseName + '.png';

        switch (mode) {
            case 'record': {
                return mkdirp(specDir)
                    .then (function () {
                        return browser.takeScreenshot();
                    })
                    .then(function (png) {
                        return writeScreenShot(png, specFilePath, targetScreenWidth, targetScreenHeight);
                    })
                    .then(function () {
                        return findBlockoutByClasses(ignoreByCss);
                    })
                    .then(function (blockOut) {
                        var jsonSpec = {
                            blockOut
                        };
                        return writeJsonSpec(jsonSpecPath, jsonSpec);
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
                        return writeScreenShot(png, testFilePath, targetScreenWidth, targetScreenHeight);
                    })
                    .then(function () {
                        return findBlockoutByClasses(ignoreByCss);
                    })
                    .then(function (blockOut) {
                        return readJsonSpec(jsonSpecPath)
                        .then((jsonSpec) => {
                            let specBlockOut = jsonSpec.blockOut;
                            return specBlockOut.concat(blockOut);
                        });
                    })
                    .then(function (blockOut) {
                        return pdiff(specFilePath, testFilePath, pngDiffFilePath, blockOut);
                    });
            }
            default: {
                throw 'invalid mode';
            }
        }
    };

    //walk through page, record or compare screenshots
    this.walkThroughPage = function (testSuiteName, testCaseName, ignoreByCss) {
        return browser.waitForAngular()
        .then(function () {
            return reallyWalkThroughPage(testSuiteName, testCaseName, ignoreByCss);
        });
    };

    var reallyWalkThroughPage = function (testSuiteName, testCaseName, ignoreByCss) {
        var deferred = protractor.promise.defer();
        var browserHeight;
        var scrollByBrowserHeight;
        var yOffset;

        var i = 0;
        var nothingFailed = true;
        function nextAction () {
            i++;
            reallyRecordScreenshotOrCheckRegression(testSuiteName, testCaseName + '_' + i, ignoreByCss)
            .then(function (result) {
                nothingFailed = nothingFailed && result;
                //try scroll down
                browser.driver.executeScript(scrollByBrowserHeight)
                .then(function () {
                    return browser.waitForAngular();
                })
                .then(function () {
                    return sleep(delay);
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

        scrollToTop()
        .then(getBrowserHeight)
        .then(function (height) {
            browserHeight = height;
            scrollByBrowserHeight = 'window.scrollBy(0, ' + height + ');';
            return;
        })
        .then(getBrowserOffset)
        .then(function (newOffset) {
            yOffset = newOffset;
            return;
        })
        .then(function () {
            nextAction();
        });

        return deferred.promise;
    };

    function findBlockoutByClasses(ignoreByCss) {
        var deferred = protractor.promise.defer();
        var blockOut = [];
        if (ignoreByCss.length === 0) {
            deferred.fulfill(blockOut);
        }
        var numClassesLeft = ignoreByCss.length;
        for (var i = 0; i < ignoreByCss.length; ++i) {
            var css = ignoreByCss[i];
            element.all(by.css(css))
            .then(findBlockoutByElements)
            .then(function(list) {
                blockOut = blockOut.concat(list);
                if (--numClassesLeft === 0) {
                    deferred.fulfill(blockOut);
                }
            });
        }
        return deferred.promise;
    }

    function findBlockoutByElements(elements) {
        var deferred = protractor.promise.defer();
        var blockOut = [];

        if (elements.length === 0) {
            deferred.fulfill(blockOut);
        }
        var jobsLeft = elements.length;
        for (var j = 0; j < elements.length; ++j) {
          browser.executeScript("return arguments[0].getBoundingClientRect();", elements[j].getWebElement())
          .then(function (boundingClientRect) {
              var b = {
                  x: boundingClientRect.left,
                  width: boundingClientRect.width,
                  y: boundingClientRect.top,
                  height: boundingClientRect.height
              };
              blockOut.push(b);
              jobsLeft--;
              if (jobsLeft === 0) {
                  deferred.fulfill(blockOut);
              }
          });
        }
        return deferred.promise;
    }

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
function scrollToTop() {
    return browser.driver.executeScript(function () {
        return window.scrollTo(0, 0);
    });
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
function writeScreenShot(data, filename, width, height) {
    var deferred = protractor.promise.defer();
    var buffer = new Buffer(data, 'base64');

    sharp(buffer)
    .resize(width, height)
    .toFile(filename, (err, info) => {
        if (err) {
            console.log(err);
            deferred.fulfill(false);
        } else {
            deferred.fulfill(true);
        }
    });

    return deferred.promise;
}

// promised call
function writeJsonSpec(filename, obj) {
    var deferred = protractor.promise.defer();
    jsonfile.writeFile(filename, obj, function (err) {
        if (err) {
            deferred.fulfill(false);
        } else {
            deferred.fulfill(true);
        }
    })
    return deferred.promise;
}

function readJsonSpec(filename) {
    var deferred = protractor.promise.defer();
    jsonfile.readFile(filename, function(err, obj) {
        if (err) {
            deferred.fulfill(null);
        } else {
            deferred.fulfill(obj);
        }
    })
    return deferred.promise;
}

// promised call
function pdiff(imageFilename1, imageFilename2, pngDiffFilename, blockOut) {
    var deferred = protractor.promise.defer();
    var diff = new BlinkDiff({
        imageAPath: imageFilename1, // Use file-path
        imageBPath: imageFilename2,

        blockOut: blockOut,

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
